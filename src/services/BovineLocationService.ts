import { Op, Transaction, WhereOptions } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import {
    BovineError,
    BovineValidationError,
    BovineNotFoundError
} from '../utils/BovineErrors';
import { getErrorMessage, ensureError } from '../utils/errorUtils';

import {
    PAGINATION,
    API_LIMITS
} from '../constants/bovine.constants';

// Modelos
import BovineLocationHistory, {
    MovementReason,
    MovementType
} from '../models/BovineLocationHistory';
import Location from '../models/Location';
import Bovine from '../models/Bovine';
import BovineTracking from '../models/BovineTracking';
import LocationCapacity from '../models/LocationCapacity';
import { bovineFullService } from './BovineFullService';

// Servicios (con lazy loading para evitar dependencias circulares)
import type { EventService } from './EventService';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

/**
 * Datos para registrar una entrada a una ubicación
 */
export interface EntryRecordData {
    bovineId: string;
    locationId: string;
    enteredAt?: Date;           // Si no se provee, se usa la fecha actual
    reason: MovementReason;
    recordedBy: string;
    movementType: MovementType;
    notes?: string;
    eventId?: string;
    /** L-01: si true, omite la validación de capacidad del potrero destino. */
    forceOverride?: boolean;
}

/**
 * Datos para registrar una salida de una ubicación
 */
export interface ExitRecordData {
    bovineId: string;
    exitedAt?: Date;            // Si no se provee, se usa la fecha actual
    notes?: string;
}

/**
 * Resultado de consulta de ubicación actual
 */
export interface CurrentLocationInfo {
    location: Location;
    entry: BovineLocationHistory;
    timeSpent: number;          // Minutos en la ubicación actual
}

/**
 * Status del bovino respecto a su ubicación actual.
 *  - IN_LOCATION: hay stay activa (BovineLocationHistory.exitedAt = null)
 *  - GPS_ONLY:    no stay activa pero hay punto GPS reciente (< 24h)
 *  - GPS_STALE:   no stay activa, GPS existe pero es viejo (>= 24h)
 *  - UNKNOWN:     ni stay ni GPS — el bovino existe pero no se sabe dónde está
 */
export type CurrentLocationStatus = 'IN_LOCATION' | 'GPS_ONLY' | 'GPS_STALE' | 'UNKNOWN';

export interface ConsolidatedCurrentLocation {
    bovineId: string;
    status: CurrentLocationStatus;
    location: {
        id: string;
        name: string;
        type: string;
        enteredAt: Date;
        timeSpentMinutes: number;
        reason: string | null;
    } | null;
    gpsPoint: {
        latitude: number;
        longitude: number;
        altitude: number | null;
        accuracy: number | null;
        speed: number | null;
        heading: number | null;
        recordedAt: Date;
        batteryLevel: number | null;
        deviceId: string | null;
        source: string;
    } | null;
    lastSeenAt: Date | null;
}

/**
 * Reporte de tiempo por ubicación
 */
export interface TimeSpentReport {
    locationId: string;
    locationName: string;
    locationType: string;
    totalMinutes: number;
    totalHours: number;
    totalDays: number;
    entries: number;
    firstEntry: Date;
    lastExit?: Date;
}

/**
 * Reporte de movimientos del rancho
 */
export interface MovementReport {
    period: {
        startDate: Date;
        endDate: Date;
    };
    totalMovements: number;
    byReason: Record<MovementReason, number>;
    byLocation: Array<{
        locationId: string;
        locationName: string;
        count: number;
    }>;
    busiestDay: {
        date: string;
        count: number;
    };
    peakHour: number;
    recentMovements: Array<{
        bovineId: string;
        bovineTag: string;
        locationName: string;
        enteredAt: Date;
        reason: MovementReason;
    }>;
}

/**
 * Reporte de utilización de potreros
 */
export interface PastureUtilization {
    locationId: string;
    locationName: string;
    totalDays: number;
    occupancyRate: number;      // Porcentaje de tiempo ocupado
    averageAnimals: number;      // Promedio de animales
    peakAnimals: number;         // Máximo de animales simultáneos
    restPeriod: number;          // Días de descanso (sin animales)
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class BovineLocationService {
    private readonly context = 'BovineLocationService';

    // Servicios (lazy loading)
    private eventService!: EventService;

    constructor() {
        this.initializeServices();
    }

    private async initializeServices(): Promise<void> {
        try {
            const EventModule = await import('./EventService');
            this.eventService = EventModule.eventService;
            logger.info('Servicios de location inicializados', this.context);
        } catch (error) {
            logger.error('Error inicializando servicios de location', this.context, {}, ensureError(error));
        }
    }

    // ==========================================================================
    // MÉTODOS PRINCIPALES
    // ==========================================================================

    /**
     * Registra la entrada de un bovino a una ubicación
     * 
     * @param data - Datos de la entrada
     * @returns El registro de historial creado
     * 
     * FLUJO:
     *   1. Validar que bovino y ubicación existen
     *   2. Verificar que el bovino no está ya en otra ubicación
     *   3. Cerrar entrada anterior si existe
     *   4. Crear nuevo registro de entrada
     *   5. Actualizar currentLocationId en Bovine
     *   6. Registrar evento (opcional)
     */
    async recordEntry(data: EntryRecordData, externalTransaction?: Transaction): Promise<BovineLocationHistory> {
        const transaction = externalTransaction || await sequelize.transaction();
        const startTime = Date.now();
        const isOwnTransaction = !externalTransaction;

        try {
            // 1. Validar que el bovino existe (solo para verificar)
            const bovine = await Bovine.findByPk(data.bovineId, {
                attributes: ['id', 'ranchId'],  // ← SOLO lo necesario
                transaction
            });

            if (!bovine) {
                throw new BovineNotFoundError(data.bovineId);
            }

            // 2. Validar que la ubicación existe
            const location = await Location.findByPk(data.locationId, {
                attributes: ['id', 'name', 'ranchId'],
                transaction
            });

            if (!location) {
                throw new BovineValidationError(`Ubicación con ID ${data.locationId} no encontrada`);
            }

            // 3. Verificar mismo rancho
            if (bovine.ranchId !== location.ranchId) {
                throw new BovineValidationError(
                    `El bovino y la ubicación no pertenecen al mismo rancho`
                );
            }

            // 3b. (L-02) Validar enteredAt: no futura (>1h tolerancia) ni anterior
            //     a la última salida registrada del bovino.
            const enteredAt = data.enteredAt || new Date();
            const ONE_HOUR_MS = 60 * 60 * 1000;
            if (enteredAt.getTime() > Date.now() + ONE_HOUR_MS) {
                throw new BovineValidationError('La fecha de entrada no puede ser futura');
            }
            const lastExitedRow = await BovineLocationHistory.findOne({
                where: { bovineId: data.bovineId, exitedAt: { [Op.not]: null } as any },
                order: [['exitedAt', 'DESC']],
                attributes: ['exitedAt'],
                transaction,
            });
            const lastExitedAt = (lastExitedRow as any)?.exitedAt as Date | undefined;
            if (lastExitedAt && enteredAt < lastExitedAt) {
                throw new BovineValidationError(
                    'La fecha de entrada no puede ser anterior a la última salida registrada'
                );
            }

            // 4. Verificar si tiene entrada activa (opcional, según tu lógica de negocio)
            const activeEntry = await BovineLocationHistory.findOne({
                where: {
                    bovineId: data.bovineId,
                    exitedAt: { [Op.is]: null } as any
                },
                transaction
            });

            // M-01: si el bovino YA tiene una estancia activa en el MISMO potrero
            // destino → no-op. No se crea un movimiento redundante (que ensuciaría
            // el historial y la detección epidemiológica de contactos). La
            // actualización de GPS, si la hay, la realiza el caller (updateLocation)
            // en la misma transacción, por lo que se conserva.
            if (activeEntry && activeEntry.locationId === data.locationId) {
                // Auto-sanar currentLocationId por si quedó desincronizado (legacy)
                await Bovine.update(
                    { currentLocationId: data.locationId },
                    { where: { id: data.bovineId }, transaction }
                );
                if (isOwnTransaction) await transaction.commit();
                bovineFullService.invalidate(data.bovineId);
                logger.info(
                    `Bovino ${data.bovineId} ya se encuentra en la ubicación ${data.locationId} — movimiento omitido (no-op)`,
                    this.context,
                    { bovineId: data.bovineId, locationId: data.locationId }
                );
                return activeEntry;
            }

            // Recordar el potrero anterior (para re-sincronizar su ocupación)
            let previousLocationId: string | null = null;
            if (activeEntry) {
                if (data.movementType === MovementType.AUTOMATED) {
                    // Cerrar automáticamente la entrada anterior
                    previousLocationId = activeEntry.locationId;
                    await activeEntry.update({ exitedAt: enteredAt }, { transaction });
                } else {
                    throw new BovineValidationError(
                        `El bovino ya tiene una entrada activa en otra ubicación. ` +
                        `Debe registrar salida primero.`
                    );
                }
            }

            // 4b. (L-01) Validar capacidad del potrero destino contra
            //     LocationCapacity.maxAnimals, usando el CONTEO EN VIVO de estancias
            //     activas. Se omite si forceOverride o si no hay capacidad definida.
            if (!data.forceOverride) {
                await this.assertLocationHasCapacity(data.locationId, transaction);
            }

            // 5. Crear nueva entrada
            const entry = await BovineLocationHistory.create({
                bovineId: data.bovineId,
                locationId: data.locationId,
                enteredAt,
                reason: data.reason,
                recordedBy: data.recordedBy,
                movementType: data.movementType,
                notes: data.notes,
                eventId: data.eventId
            }, { transaction });

            // 5b. (L-03) Sincronizar currentLocationId del bovino (lo lee el mapa)
            await Bovine.update(
                { currentLocationId: data.locationId },
                { where: { id: data.bovineId }, transaction }
            );

            // 5c. (L-01) Sincronizar el contador de ocupación de los potreros afectados
            await this.syncLocationOccupancy(data.locationId, transaction);
            if (previousLocationId && previousLocationId !== data.locationId) {
                await this.syncLocationOccupancy(previousLocationId, transaction);
            }

            if (isOwnTransaction) await transaction.commit();
            // No hacer commit si la transacción es externa


            // Invalidar cache compuesto del bovino
            bovineFullService.invalidate(data.bovineId);

            logger.info(`Entrada registrada para bovino ${data.bovineId}`, this.context, {
                bovineId: data.bovineId,
                locationId: data.locationId,
                reason: data.reason
            });

            return entry;

        } catch (error) {
            // Solo hacer rollback si esta función abrió la transacción.
            // Si es externa (externalTransaction), el dueño la maneja.
            if (isOwnTransaction) await transaction.rollback();

            // ✅ 1. Log con contexto y error convertido
            logger.error(`Error registrando entrada`, this.context, { data },
                ensureError(error)
            );

            // ✅ 2. Preserva el tipo de error original
            if (error instanceof BovineError) throw error;

            // ✅ 3. Envuelve errores desconocidos
            throw new BovineError(
                `Error al registrar entrada`,
                'ENTRY_ERROR',
                500,
                ensureError(error)  // ← Pasa el error original como causa
            );
        }
    }

    /**
     * Registra la salida de un bovino de su ubicación actual
     * 
     * @param data - Datos de la salida
     * @returns El registro de historial actualizado
     */
    async recordExit(data: ExitRecordData): Promise<BovineLocationHistory | null> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            // Buscar entrada activa DIRECTAMENTE en History
            const activeEntry = await BovineLocationHistory.findOne({
                where: {
                    bovineId: data.bovineId,
                    exitedAt: { [Op.is]: null } as any
                },
                transaction
            });

            if (!activeEntry) {
                logger.warn(`No hay entrada activa para bovino ${data.bovineId}`, this.context);
                return null;
            }

            // Registrar salida
            const exitedAt = data.exitedAt || new Date();

            if (exitedAt < activeEntry.enteredAt) {
                throw new BovineValidationError(
                    'La fecha de salida no puede ser anterior a la entrada'
                );
            }

            await activeEntry.update({ exitedAt }, { transaction });

            // L-03: el bovino ya no está en ningún potrero → limpiar currentLocationId
            await Bovine.update(
                { currentLocationId: null as any },
                { where: { id: data.bovineId }, transaction }
            );

            // L-01: re-sincronizar la ocupación del potrero del que salió
            await this.syncLocationOccupancy(activeEntry.locationId, transaction);

            await transaction.commit();

            // Invalidar cache compuesto del bovino
            bovineFullService.invalidate(data.bovineId);

            logger.info(`Salida registrada para bovino ${data.bovineId}`, this.context, {
                bovineId: data.bovineId,
                locationId: activeEntry.locationId,
                duration: this.formatDuration(activeEntry.enteredAt, exitedAt)
            });

            return activeEntry;

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error registrando salida`, this.context, { data }, ensureError(error));
            throw error;
        }
    }

    // ==========================================================================
    // MÉTODOS DE CONSULTA
    // ==========================================================================

    /**
     * Obtiene la ubicación actual de un bovino
     */
    async getCurrentLocation(bovineId: string): Promise<CurrentLocationInfo | null> {
        try {
            const activeEntry = await BovineLocationHistory.findOne({
                where: {
                    bovineId,
                    exitedAt: { [Op.is]: null } as any
                },
                include: [{
                    model: Location,
                    as: 'location',
                    required: true
                }],
                order: [['enteredAt', 'DESC']]
            });

            if (!activeEntry || !activeEntry.location) {
                return null;
            }

            const now = new Date();
            const timeSpent = Math.floor(
                (now.getTime() - activeEntry.enteredAt.getTime()) / (1000 * 60)
            );

            return {
                location: activeEntry.location,
                entry: activeEntry,
                timeSpent
            };

        } catch (error) {
            logger.error(`Error obteniendo ubicación actual para bovino ${bovineId}`, this.context, {
                bovineId
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Devuelve la ubicación actual CONSOLIDADA del bovino: combina la stay
     * activa (BovineLocationHistory.exitedAt = null) con el último punto GPS
     * registrado (BovineTracking).
     *
     * Reglas de status:
     *  - IN_LOCATION: hay stay activa (puede o no haber GPS)
     *  - GPS_ONLY:    no stay, GPS reciente (< 24h)
     *  - GPS_STALE:   no stay, GPS antiguo (>= 24h)
     *  - UNKNOWN:     ni stay ni GPS
     *
     * NO lanza 404 si el bovino no tiene ubicación: devuelve UNKNOWN. Sí
     * valida que el bovino exista (404 explícito si no).
     *
     * Performance: dos queries puntuales con índices apropiados (~5ms total).
     */
    async getCurrentLocationConsolidated(bovineId: string): Promise<ConsolidatedCurrentLocation> {
        try {
            // Verificar que el bovino existe (404 si no)
            const bovine = await Bovine.findByPk(bovineId, { attributes: ['id'] });
            if (!bovine) {
                throw new BovineNotFoundError(bovineId);
            }

            // Ejecutar en paralelo: stay activa + último GPS
            const [activeEntry, lastGps] = await Promise.all([
                BovineLocationHistory.findOne({
                    where: {
                        bovineId,
                        exitedAt: { [Op.is]: null } as any,
                    },
                    include: [{
                        model: Location,
                        as: 'location',
                        required: true,
                        attributes: ['id', 'name', 'type'],
                    }],
                    order: [['enteredAt', 'DESC']],
                }),
                BovineTracking.findOne({
                    where: { bovineId },
                    order: [['recordedAt', 'DESC']],
                    limit: 1,
                }),
            ]);

            const now = new Date();
            const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

            // Construir el bloque de location si hay stay activa
            let locationBlock: ConsolidatedCurrentLocation['location'] = null;
            if (activeEntry && (activeEntry as any).location) {
                const loc: any = (activeEntry as any).location;
                const timeSpentMinutes = Math.floor(
                    (now.getTime() - activeEntry.enteredAt.getTime()) / (1000 * 60)
                );
                locationBlock = {
                    id: loc.id,
                    name: loc.name,
                    type: loc.type,
                    enteredAt: activeEntry.enteredAt,
                    timeSpentMinutes,
                    reason: (activeEntry as any).reason ?? null,
                };
            }

            // Construir el bloque de GPS si existe
            let gpsBlock: ConsolidatedCurrentLocation['gpsPoint'] = null;
            if (lastGps) {
                gpsBlock = {
                    latitude: Number(lastGps.latitude),
                    longitude: Number(lastGps.longitude),
                    altitude: lastGps.altitude !== undefined ? Number(lastGps.altitude) : null,
                    accuracy: lastGps.accuracy !== undefined ? Number(lastGps.accuracy) : null,
                    speed: lastGps.speed !== undefined ? Number(lastGps.speed) : null,
                    heading: lastGps.heading !== undefined ? Number(lastGps.heading) : null,
                    recordedAt: lastGps.recordedAt,
                    batteryLevel: lastGps.batteryLevel ?? null,
                    deviceId: lastGps.deviceId ?? null,
                    source: lastGps.source,
                };
            }

            // Determinar status
            let status: CurrentLocationStatus;
            if (locationBlock) {
                status = 'IN_LOCATION';
            } else if (gpsBlock) {
                const ageMs = now.getTime() - gpsBlock.recordedAt.getTime();
                status = ageMs < TWENTY_FOUR_HOURS_MS ? 'GPS_ONLY' : 'GPS_STALE';
            } else {
                status = 'UNKNOWN';
            }

            // lastSeenAt = la fecha más reciente entre stay y GPS
            let lastSeenAt: Date | null = null;
            const candidates: Date[] = [];
            if (locationBlock) candidates.push(locationBlock.enteredAt);
            if (gpsBlock) candidates.push(gpsBlock.recordedAt);
            if (candidates.length > 0) {
                lastSeenAt = new Date(Math.max(...candidates.map((d) => d.getTime())));
            }

            return {
                bovineId,
                status,
                location: locationBlock,
                gpsPoint: gpsBlock,
                lastSeenAt,
            };
        } catch (error) {
            logger.error(
                `Error obteniendo ubicación consolidada para bovino ${bovineId}`,
                this.context,
                { bovineId },
                ensureError(error)
            );
            throw error;
        }
    }

    /**
     * Lista los bovinos que están actualmente en una ubicación
     */
    async getCurrentBovinesAtLocation(locationId: string): Promise<Bovine[]> {
        try {
            // Buscar entradas activas en History
            const activeEntries = await BovineLocationHistory.findAll({
                where: {
                    locationId,
                    exitedAt: { [Op.is]: null } as any
                },
                include: [{
                    model: Bovine,
                    as: 'bovine',
                    required: true,
                    where: { isActive: true }
                }]
            });

            return activeEntries
                .map(entry => (entry as any).bovine)
                .filter(Boolean);

        } catch (error) {
            logger.error(`Error obteniendo bovinos en ubicación ${locationId}`, this.context, {
                locationId
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene el historial completo de ubicaciones de un bovino
     */
    async getLocationHistory(
        bovineId: string,
        startDate?: Date,
        endDate?: Date,
        limit: number = PAGINATION.DEFAULT_LIMIT
    ): Promise<BovineLocationHistory[]> {
        try {
            const whereClause: any = { bovineId };

            if (startDate || endDate) {
                whereClause.enteredAt = {};
                if (startDate) whereClause.enteredAt[Op.gte] = startDate;
                if (endDate) whereClause.enteredAt[Op.lte] = endDate;
            }

            const history = await BovineLocationHistory.findAll({
                where: whereClause,
                include: [{
                    model: Location,
                    as: 'location',
                    attributes: ['id', 'name', 'type']
                }],
                order: [['enteredAt', 'DESC']],
                limit
            });

            logger.debug(`Historial obtenido para bovino ${bovineId}`, this.context, {
                bovineId,
                recordCount: history.length,
                dateRange: { startDate, endDate }
            });

            return history;

        } catch (error) {
            logger.error(`Error obteniendo historial para bovino ${bovineId}`, this.context, {
                bovineId
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Calcula el tiempo total pasado en cada ubicación
     */
    async getTimeSpentPerLocation(
        bovineId: string,
        startDate: Date,
        endDate: Date
    ): Promise<TimeSpentReport[]> {
        try {
            const history = await BovineLocationHistory.findAll({
                where: {
                    bovineId,
                    enteredAt: { [Op.lte]: endDate },
                    [Op.or]: [
                        { exitedAt: { [Op.gte]: startDate } },
                        { exitedAt: { [Op.is]: null } as any }
                    ]
                },
                include: [{
                    model: Location,
                    as: 'location',
                    attributes: ['name', 'type']
                }]
            });

            const timeMap = new Map<string, {
                total: number;
                entries: number;
                name: string;
                type: string;
                firstEntry: Date;
                lastExit?: Date;
            }>();

            for (const entry of history) {
                const exitTime = entry.exitedAt || endDate;
                const entryTime = entry.enteredAt < startDate ? startDate : entry.enteredAt;

                const duration = Math.max(0, exitTime.getTime() - entryTime.getTime());
                const minutes = Math.floor(duration / (1000 * 60));

                const current = timeMap.get(entry.locationId) || {
                    total: 0,
                    entries: 0,
                    name: entry.location?.name || 'Desconocida',
                    type: entry.location?.type || 'unknown',
                    firstEntry: entry.enteredAt
                };

                timeMap.set(entry.locationId, {
                    total: current.total + minutes,
                    entries: current.entries + 1,
                    name: current.name,
                    type: current.type,
                    firstEntry: current.firstEntry < entry.enteredAt ? current.firstEntry : entry.enteredAt,
                    lastExit: entry.exitedAt || undefined
                });
            }

            const reports: TimeSpentReport[] = Array.from(timeMap.entries()).map(([locationId, data]) => ({
                locationId,
                locationName: data.name,
                locationType: data.type,
                totalMinutes: data.total,
                totalHours: Math.round(data.total / 60 * 100) / 100,
                totalDays: Math.round(data.total / (60 * 24) * 100) / 100,
                entries: data.entries,
                firstEntry: data.firstEntry,
                lastExit: data.lastExit
            }));

            return reports.sort((a, b) => b.totalMinutes - a.totalMinutes);

        } catch (error) {
            logger.error(`Error calculando tiempo por ubicación para bovino ${bovineId}`, this.context, {
                bovineId
            }, ensureError(error));
            throw error;
        }
    }

    // ==========================================================================
    // MÉTODOS DE REPORTES
    // ==========================================================================

    /**
     * Genera un reporte de movimientos del rancho
     */
    async generateMovementReport(
        ranchId: string,
        startDate: Date,
        endDate: Date
    ): Promise<MovementReport> {
        try {
            const movements = await BovineLocationHistory.findAll({
                where: {
                    enteredAt: { [Op.between]: [startDate, endDate] }
                },
                include: [
                    {
                        model: Bovine,
                        as: 'bovine',
                        where: { ranchId },
                        attributes: ['earTag']
                    },
                    {
                        model: Location,
                        as: 'location',
                        attributes: ['name']
                    }
                ],
                order: [['enteredAt', 'DESC']]
            });

            // Estadísticas por razón
            const byReason = {} as Record<MovementReason, number>;
            Object.values(MovementReason).forEach(reason => byReason[reason] = 0);

            // Estadísticas por ubicación
            const locationCount = new Map<string, number>();
            const locationNames = new Map<string, string>();

            // Día más activo
            const dayCount = new Map<string, number>();
            let maxDay = { date: '', count: 0 };

            // Hora pico
            const hourCount = new Array(24).fill(0);

            for (const movement of movements) {
                // Por razón
                byReason[movement.reason] = (byReason[movement.reason] || 0) + 1;

                // Por ubicación
                const locId = movement.locationId;
                locationCount.set(locId, (locationCount.get(locId) || 0) + 1);
                if (movement.location) {
                    locationNames.set(locId, movement.location.name);
                }

                // Por día
                const day = movement.enteredAt.toISOString().split('T')[0];
                const dayTotal = (dayCount.get(day) || 0) + 1;
                dayCount.set(day, dayTotal);
                if (dayTotal > maxDay.count) {
                    maxDay = { date: day, count: dayTotal };
                }

                // Por hora
                const hour = movement.enteredAt.getHours();
                hourCount[hour]++;
            }

            // Encontrar hora pico
            const peakHour = hourCount.indexOf(Math.max(...hourCount));

            // Últimos 10 movimientos
            const recentMovements = movements.slice(0, 10).map(m => ({
                bovineId: m.bovineId,
                bovineTag: (m as any).bovine?.earTag || 'Desconocido',
                locationName: (m as any).location?.name || 'Desconocida',
                enteredAt: m.enteredAt,
                reason: m.reason
            }));

            const byLocation = Array.from(locationCount.entries()).map(([locationId, count]) => ({
                locationId,
                locationName: locationNames.get(locationId) || 'Desconocida',
                count
            })).sort((a, b) => b.count - a.count);

            return {
                period: { startDate, endDate },
                totalMovements: movements.length,
                byReason,
                byLocation,
                busiestDay: maxDay,
                peakHour,
                recentMovements
            };

        } catch (error) {
            logger.error(`Error generando reporte de movimientos para rancho ${ranchId}`, this.context, {
                ranchId
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene reporte de utilización de potreros
     */
    async getPastureUtilization(
        ranchId: string,
        startDate: Date,
        endDate: Date
    ): Promise<PastureUtilization[]> {
        try {
            // Obtener todos los potreros del rancho
            const pastures = await Location.findAll({
                where: {
                    ranchId,
                    type: 'PASTURE'  // Asumiendo que existe este tipo
                },
                attributes: ['id', 'name']
            });

            const utilization: PastureUtilization[] = [];

            for (const pasture of pastures) {
                // Obtener todos los movimientos a este potrero en el período
                const movements = await BovineLocationHistory.findAll({
                    where: {
                        locationId: pasture.id,
                        enteredAt: { [Op.lte]: endDate },
                        [Op.or]: [
                            { exitedAt: { [Op.gte]: startDate } },
                            { exitedAt: { [Op.is]: null } as any }
                        ]
                    },
                    include: [{
                        model: Bovine,
                        as: 'bovine',
                        attributes: ['id']
                    }]
                });

                if (movements.length === 0) {
                    utilization.push({
                        locationId: pasture.id,
                        locationName: pasture.name,
                        totalDays: 0,
                        occupancyRate: 0,
                        averageAnimals: 0,
                        peakAnimals: 0,
                        restPeriod: this.calculateRestPeriod(movements, startDate, endDate)
                    });
                    continue;
                }

                // Calcular días ocupado y animales promedio
                let totalMinutes = 0;
                const animalCounts: number[] = [];
                const timeline = new Map<string, Set<string>>();

                for (const movement of movements) {
                    const entryTime = movement.enteredAt < startDate ? startDate : movement.enteredAt;
                    const exitTime = movement.exitedAt || endDate;

                    const duration = Math.max(0, exitTime.getTime() - entryTime.getTime());
                    totalMinutes += duration;

                    // Contar animales por día (para promedio y pico)
                    const currentDate = new Date(entryTime);
                    while (currentDate <= exitTime) {
                        const dateKey = currentDate.toISOString().split('T')[0];
                        if (!timeline.has(dateKey)) {
                            timeline.set(dateKey, new Set());
                        }
                        timeline.get(dateKey)!.add(movement.bovineId);
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                }

                // Calcular estadísticas
                const totalDays = totalMinutes / (24 * 60);
                const daysWithAnimals = Array.from(timeline.values()).map(s => s.size);
                const averageAnimals = daysWithAnimals.length > 0
                    ? daysWithAnimals.reduce((a, b) => a + b, 0) / daysWithAnimals.length
                    : 0;
                const peakAnimals = Math.max(...daysWithAnimals, 0);

                const periodDays = (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);
                const occupancyRate = (totalDays / periodDays) * 100;

                utilization.push({
                    locationId: pasture.id,
                    locationName: pasture.name,
                    totalDays: Math.round(totalDays * 100) / 100,
                    occupancyRate: Math.round(occupancyRate * 100) / 100,
                    averageAnimals: Math.round(averageAnimals * 100) / 100,
                    peakAnimals,
                    restPeriod: this.calculateRestPeriod(movements, startDate, endDate)
                });
            }

            return utilization;

        } catch (error) {
            logger.error(`Error obteniendo utilización de potreros para rancho ${ranchId}`, this.context, {
                ranchId
            }, ensureError(error));
            throw error;
        }
    }

    // ==========================================================================
    // MÉTODOS PRIVADOS DE UTILIDAD
    // ==========================================================================

    /**
     * Cuenta las estancias activas (exitedAt IS NULL) en un potrero — ocupación real.
     */
    private async countActiveOccupants(locationId: string, transaction?: Transaction): Promise<number> {
        return BovineLocationHistory.count({
            where: { locationId, exitedAt: { [Op.is]: null } as any },
            transaction,
        });
    }

    /**
     * L-01: valida la capacidad del potrero destino contra LocationCapacity.maxAnimals
     * usando el conteo EN VIVO de ocupantes. Si no hay fila de capacidad o maxAnimals
     * no está definido (≤ 0), no se valida. Lanza 409 BOVINE_LOCATION_FULL.
     */
    private async assertLocationHasCapacity(locationId: string, transaction?: Transaction): Promise<void> {
        const capacity = await LocationCapacity.findOne({
            where: { locationId },
            attributes: ['maxAnimals'],
            transaction,
        });
        const maxAnimals = (capacity as any)?.maxAnimals as number | undefined;
        if (!maxAnimals || maxAnimals <= 0) return; // sin capacidad definida → no se valida

        const current = await this.countActiveOccupants(locationId, transaction);
        if (current >= maxAnimals) {
            const err = new BovineError(
                `El potrero está lleno (${current}/${maxAnimals})`,
                'BOVINE_LOCATION_FULL',
                409,
            );
            (err as any).details = { currentOccupancy: current, maxAnimals };
            throw err;
        }
    }

    /**
     * L-01: recuenta ocupantes activos y actualiza LocationCapacity.currentAnimals.
     * No-op si el potrero no tiene fila de capacidad.
     */
    private async syncLocationOccupancy(locationId: string, transaction?: Transaction): Promise<void> {
        const capacity = await LocationCapacity.findOne({ where: { locationId }, transaction });
        if (!capacity) return;
        const current = await this.countActiveOccupants(locationId, transaction);
        await capacity.update({ currentAnimals: current }, { transaction });
    }

    /**
     * Cierra la entrada activa actual de un bovino
     */
    private async closeCurrentEntry(
        bovineId: string,
        exitedAt: Date,
        transaction: Transaction
    ): Promise<void> {
        const activeEntry = await BovineLocationHistory.findOne({
            where: {
                bovineId,
                exitedAt: { [Op.is]: null } as any
            },
            transaction
        });

        if (activeEntry) {
            await activeEntry.update({ exitedAt }, { transaction });

            logger.debug(`Entrada anterior cerrada para bovino ${bovineId}`, this.context, {
                bovineId,
                locationId: activeEntry.locationId,
                enteredAt: activeEntry.enteredAt,
                exitedAt
            });
        }
    }

    /**
     * Obtiene la entrada activa de un bovino
     */
    private async getActiveEntry(
        bovineId: string,
        transaction?: Transaction
    ): Promise<BovineLocationHistory> {
        const entry = await BovineLocationHistory.findOne({
            where: {
                bovineId,
                exitedAt: { [Op.is]: null } as any
            },
            transaction
        });

        if (!entry) {
            throw new BovineValidationError(`No hay entrada activa para el bovino ${bovineId}`);
        }

        return entry;
    }

    /**
     * Calcula la duración entre dos fechas en formato legible
     */
    private calculateDuration(start: Date, end: Date): string {
        const minutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));

        if (minutes < 60) return `${minutes} minutos`;
        if (minutes < 1440) {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return `${hours} hora${hours !== 1 ? 's' : ''} ${mins > 0 ? `${mins} minutos` : ''}`.trim();
        }

        const days = Math.floor(minutes / 1440);
        const hours = Math.floor((minutes % 1440) / 60);
        return `${days} día${days !== 1 ? 's' : ''} ${hours > 0 ? `${hours} horas` : ''}`.trim();
    }

    /**
     * Formatea duración para logs
     */
    private formatDuration(start: Date, end: Date): string {
        const minutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
        return `${minutes} minutos`;
    }

    /**
     * Calcula período de descanso (días sin animales)
     */
    private calculateRestPeriod(
        movements: BovineLocationHistory[],
        startDate: Date,
        endDate: Date
    ): number {
        if (movements.length === 0) {
            return (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);
        }

        // Ordenar movimientos por fecha de entrada
        const sorted = [...movements].sort((a, b) =>
            a.enteredAt.getTime() - b.enteredAt.getTime()
        );

        let restDays = 0;
        let lastExit = startDate;

        for (const movement of sorted) {
            const entryTime = movement.enteredAt;
            if (entryTime > lastExit) {
                restDays += (entryTime.getTime() - lastExit.getTime()) / (24 * 60 * 60 * 1000);
            }

            if (movement.exitedAt) {
                lastExit = movement.exitedAt > endDate ? endDate : movement.exitedAt;
            } else {
                lastExit = endDate;
            }
        }

        if (lastExit < endDate) {
            restDays += (endDate.getTime() - lastExit.getTime()) / (24 * 60 * 60 * 1000);
        }

        return Math.round(restDays * 100) / 100;
    }

    /**
     * Asigna o cambia la ubicación de un bovino.
     * Actualiza coordenadas GPS (JSONB) si se proveen Y crea un registro
     * en bovine_location_history para mantener el historial de movimientos.
     * Si el bovino ya tenía una entrada activa, la cierra automáticamente.
     */
    async updateLocation(
        bovineId: string,
        data: any,
        userId?: string
    ): Promise<{ bovine: Bovine; wasNoOp: boolean; locationChanged: boolean }> {
        const t = await sequelize.transaction();
        try {
            const bovine = await Bovine.findByPk(bovineId, { transaction: t });
            if (!bovine) {
                throw new BovineNotFoundError(bovineId);
            }

            // Actualizar coordenadas GPS (campo JSONB) si vienen en el body
            if (data.location) {
                await bovine.update({ location: data.location }, { transaction: t });
            }

            // L-04: detectar si el movimiento será un no-op (ya está en ese potrero)
            let wasNoOp = false;
            let locationChanged = false;

            // Crear entrada en historial si se indica una ubicación estructural
            if (data.locationId && userId) {
                const active = await BovineLocationHistory.findOne({
                    where: { bovineId, exitedAt: { [Op.is]: null } as any },
                    attributes: ['locationId'],
                    transaction: t,
                });
                wasNoOp = !!active && active.locationId === data.locationId;
                locationChanged = !wasNoOp;

                await this.recordEntry({
                    bovineId,
                    locationId: data.locationId,
                    reason:       data.reason       || MovementReason.TRANSFER,
                    recordedBy:   userId,
                    // AUTOMATED cierra automáticamente cualquier entrada activa previa
                    movementType: MovementType.AUTOMATED,
                    notes:        data.notes,
                    enteredAt:    data.enteredAt ? new Date(data.enteredAt) : undefined,
                    forceOverride: data.forceOverride === true,  // L-01 override
                }, t);
            }

            await t.commit();
            bovineFullService.invalidate(bovineId);

            return { bovine: await bovine.reload(), wasNoOp, locationChanged };
        } catch (error) {
            await t.rollback();
            logger.error(`Error en updateLocation para bovino ${bovineId}`, this.context,
                { bovineId, data }, ensureError(error));
            if (error instanceof BovineError) throw error;
            throw new BovineError('Error al actualizar ubicación', 'LOCATION_UPDATE_ERROR', 500, ensureError(error));
        }
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const bovineLocationService = new BovineLocationService();