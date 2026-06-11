import { Op, Transaction, literal } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import {
    BovineError,
    BovineValidationError,
    BovineNotFoundError
} from '../utils/BovineErrors';
import { getErrorMessage, ensureError } from '../utils/errorUtils';
import {
    MIN_AGE_MONTHS,
    WEIGHT,
    HEALTH_COLORS,
    HEALTH_LABELS,
    ALERT_THRESHOLDS,
    SCHEDULED_TASKS,
    CHECK_INTERVALS,
    VITAL_SIGNS_THRESHOLDS,
} from '../constants/bovine.constants';

// Modelos
import Bovine from '../models/Bovine';
import Health, { HealthAttributes, HealthCreationAttributes } from '../models/Health';
import Event, { EventPriority } from '../models/Event';
import { HealthStatus } from '../models/Bovine';
import { EventType, EventStatus } from '../models/Event';

// Tipos usados solo para anotación — no generan dependencia circular en runtime
import type { BovineService } from './BovineService';
import type { BovineGeoService } from './BovineGeoService';
import type { EventService } from './EventService';

// ─── Caché de instancias lazy ─────────────────────────────────────────────────
// Se resuelven la primera vez que se usan, no en el constructor.
// Esto elimina la race condition: nunca accedemos a un servicio antes de que
// su módulo haya terminado de cargarse.
let _bovineServiceInstance: BovineService   | null = null;
let _geoServiceInstance:    BovineGeoService | null = null;
let _eventServiceInstance:  EventService    | null = null;

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

/**
 * Datos para registrar un chequeo de salud
 */
export interface HealthCheckData {
    bovineId: string;
    checkDate: Date;
    veterinarianId: string;
    veterinarianName?: string;
    // Estado de salud declarado explícitamente por el veterinario.
    // Cuando se proporciona, tiene prioridad absoluta sobre cualquier
    // inferencia automática — el veterinario siempre sabe más que el parser.
    // Si se omite, determineHealthStatus lo infiere como fallback.
    newHealthStatus?: HealthStatus;
    diagnosis?: string;
    diagnosisDetails?: any;
    treatment?: string;
    treatmentDetails?: any;
    symptoms?: string[];
    vitalSigns?: {
        temperature?: number;
        heartRate?: number;
        respiratoryRate?: number;
        weight?: number;
    };
    notes?: string;
    followUpDate?: Date;
    cost?: number;
}

/**
 * Resultado de un chequeo de salud (para respuesta)
 */
export interface HealthCheckResult {
    id: string;
    bovineId: string;
    bovineName?: string;
    checkDate: Date;
    veterinarianId: string;
    veterinarianName?: string;
    veterinarianLicense?: string;
    diagnosis?: string;
    treatment?: string;
    healthStatus: HealthStatus;
    followUpDate?: Date;
    createdAt: Date;
}

/**
 * Estadísticas de salud del hato
 */
export interface HerdHealthStats {
    totalBovines: number;
    byStatus: {
        [HealthStatus.HEALTHY]: number;
        [HealthStatus.SICK]: number;
        [HealthStatus.RECOVERING]: number;
        [HealthStatus.QUARANTINE]: number;
        [HealthStatus.DECEASED]: number;
    };
    healthyPercentage: number;
    sickPercentage: number;
    criticalCount: number;
    recentChecks: number; // Últimos 7 días
    upcomingChecks: number; // Próximos 7 días
    commonDiagnosis: Array<{
        diagnosis: string;
        count: number;
    }>;
}

/**
 * Punto para línea de tiempo de salud (gráficos)
 */
export interface HealthTimelinePoint {
    date: Date;
    healthStatus: HealthStatus;
    eventType: 'CHECK' | 'DIAGNOSIS' | 'TREATMENT' | 'RECOVERY';
    description: string;
}

/**
 * Filtros para historial de salud
 */
export interface HealthHistoryFilters {
    startDate?: Date;
    endDate?: Date;
    healthStatus?: HealthStatus[];
    veterinarianId?: string;
    limit?: number;
    offset?: number;
}
// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class BovineHealthService {
    private readonly context = 'BovineHealthService';

    // ─── Getters lazy para servicios dependientes ─────────────────────────────
    //
    // PATRÓN: cada getter resuelve la instancia la primera vez que se invoca
    // y la guarda en la variable de módulo (_xxxInstance).
    //
    // POR QUÉ NO EL CONSTRUCTOR:
    //   Un constructor no puede ser async. El patrón anterior hacía
    //   `this.initializeServices()` sin await, dejando una promesa flotante.
    //   Si llegaba una request antes de que la promesa resolviera,
    //   this.geoService era undefined y el snapshot se perdía silenciosamente.
    //
    // POR QUÉ VARIABLES DE MÓDULO Y NO DE INSTANCIA:
    //   BovineHealthService se exporta como singleton (ver final del archivo).
    //   Las variables de módulo son equivalentes a propiedades de instancia
    //   en ese caso, pero sobreviven sin riesgo si alguien crea una segunda
    //   instancia accidentalmente.

    private async getBovineService(): Promise<BovineService> {
        if (!_bovineServiceInstance) {
            const { bovineService } = await import('./BovineService');
            _bovineServiceInstance = bovineService;
        }
        return _bovineServiceInstance;
    }

    private async getGeoService(): Promise<BovineGeoService> {
        if (!_geoServiceInstance) {
            const { bovineGeoService } = await import('./BovineGeoService');
            _geoServiceInstance = bovineGeoService;
        }
        return _geoServiceInstance;
    }

    private async getEventService(): Promise<EventService> {
        if (!_eventServiceInstance) {
            const { eventService } = await import('./EventService');
            _eventServiceInstance = eventService;
        }
        return _eventServiceInstance;
    }

    // ==========================================================================
    // MÉTODOS DE CHEQUEO DE SALUD
    // ==========================================================================

    /**
     * Verifica si un bovino necesita chequeo de salud
     * 
     * @param bovineId - ID del bovino
     * @returns true si necesita chequeo, false si no
     * 
     * LÓGICA:
     *   - Si no tiene último chequeo → necesita
     *   - Si está enfermo/cuarentena → cada 3 días
     *   - Si está recuperándose → cada 7 días
     *   - Si está sano → cada 30 días
     */
    async needsHealthCheck(bovineId: string): Promise<boolean> {
        const startTime = Date.now();

        try {
            // Obtener bovino
            const bovine = await Bovine.findByPk(bovineId, {
                attributes: ['id', 'healthStatus', 'lastHealthCheck']
            });

            if (!bovine) {
                throw new BovineNotFoundError(bovineId);
            }

            // Si nunca ha tenido chequeo
            if (!bovine.lastHealthCheck) {
                logger.debug(`Bovino ${bovineId} sin chequeo previo`, this.context);
                return true;
            }

            // Calcular días desde último chequeo
            const daysSinceLastCheck = Math.floor(
                (Date.now() - bovine.lastHealthCheck.getTime()) / (1000 * 60 * 60 * 24)
            );

            // Obtener intervalo según estado de salud
            const interval = CHECK_INTERVALS[bovine.healthStatus] || CHECK_INTERVALS[HealthStatus.HEALTHY];

            const needsCheck = daysSinceLastCheck >= interval;

            const duration = Date.now() - startTime;

            logger.debug(`Verificación de necesidad de chequeo`, this.context, {
                bovineId,
                healthStatus: bovine.healthStatus,
                daysSinceLastCheck,
                interval,
                needsCheck,
                durationMs: duration
            });

            return needsCheck;

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`Error verificando necesidad de chequeo para bovino ${bovineId}`, this.context, {
                bovineId,
                durationMs: duration
            }, ensureError(error));

            if (error instanceof BovineError) throw error;
            throw new BovineError(
                `Error al verificar necesidad de chequeo para bovino ${bovineId}`,
                'HEALTH_CHECK_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Programa el próximo chequeo de salud
     *
     * @param bovineId    - ID del bovino
     * @param userId      - ID del usuario que programa
     * @param transaction - Transacción activa (opcional).
     *                      Si se proporciona, el evento se crea dentro de ella:
     *                      si la transacción padre hace rollback, el evento
     *                      también revierte y no quedan registros huérfanos.
     */
    async scheduleNextHealthCheck(
        bovineId: string,
        userId: string,
        transaction?: Transaction       // ← parámetro nuevo
    ): Promise<void> {
        const startTime = Date.now();

        try {
            // Leer el bovino dentro de la misma transacción para ver el estado
            // ya actualizado (sin transaction leeríamos datos pre-commit)
            const bovine = await Bovine.findByPk(bovineId, {
                attributes: ['id', 'earTag', 'healthStatus', 'ranchId'],
                transaction                 // ← propagado
            });

            if (!bovine) {
                throw new BovineNotFoundError(bovineId);
            }

            // Calcular próxima fecha según el estado recién actualizado
            const interval = CHECK_INTERVALS[bovine.healthStatus]
                ?? CHECK_INTERVALS[HealthStatus.HEALTHY];
            const nextCheckDate = new Date();
            nextCheckDate.setDate(nextCheckDate.getDate() + interval);

            // Prioridad según criticidad del estado
            const priority =
                bovine.healthStatus === HealthStatus.SICK ||
                bovine.healthStatus === HealthStatus.QUARANTINE
                    ? EventPriority.HIGH
                    : EventPriority.MEDIUM;

            const eventService = await this.getEventService();
            await eventService.createEvent(
                {
                    bovineId,
                    eventType: EventType.HEALTH_CHECK,
                    title: `Chequeo de salud - ${bovine.earTag}`,
                    description: `Chequeo programado automáticamente. Estado actual: ${bovine.healthStatus}`,
                    scheduledDate: nextCheckDate,
                    priority,
                    createdBy: userId,
                    requiresVeterinarian: true,
                    expectedData: {
                        type: 'SCHEDULED_HEALTH_CHECK',
                        healthStatus: bovine.healthStatus,
                        interval,
                        automatic: true
                    }
                },
                transaction             // ← propagado: si el padre revierte, el evento también
            );

            const duration = Date.now() - startTime;

            logger.info(`Próximo chequeo programado para bovino ${bovineId}`, this.context, {
                bovineId,
                nextCheckDate,
                interval,
                healthStatus: bovine.healthStatus,
                withinTransaction: !!transaction,
                durationMs: duration
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`Error programando chequeo para bovino ${bovineId}`, this.context, {
                bovineId,
                durationMs: duration
            }, ensureError(error));

            if (error instanceof BovineError) throw error;
            throw new BovineError(
                `Error al programar chequeo para bovino ${bovineId}`,
                'SCHEDULE_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Registra un chequeo de salud realizado
     * 
     * @param data - Datos del chequeo
     * @param userId - ID del usuario que registra
     * @returns El registro de salud creado
     * 
     * FLUJO:
     *   1. Validar que el bovino existe
     *   2. Crear registro en tabla Health
     *   3. Actualizar último chequeo en Bovine
     *   4. Si hay diagnóstico, actualizar estado de salud
     *   5. Actualizar snapshot para mapas
     *   6. Programar próximo chequeo
     */
    async recordHealthCheck(data: HealthCheckData, userId: string): Promise<Health> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            // Resolver servicios antes de abrir la transacción evita que un fallo
            // de import deje la transacción abierta
            const [geoService, eventService] = await Promise.all([
                this.getGeoService(),
                this.getEventService()
            ]);

            // Validar que el bovino existe
            const bovine = await Bovine.findByPk(data.bovineId, {
                transaction,
                attributes: ['id', 'earTag', 'healthStatus', 'ranchId']
            });

            if (!bovine) {
                throw new BovineNotFoundError(data.bovineId);
            }

            // Validar signos vitales si se proporcionaron
            if (data.vitalSigns) {
                this.validateVitalSigns(data.vitalSigns);
            }

            // Determinar nuevo estado de salud basado en el diagnóstico
            const newHealthStatus = this.determineHealthStatus(data);

            // Crear registro de salud
            const healthRecord = await Health.create({
                bovineId: data.bovineId,
                recordType: 'ROUTINE_CHECKUP',
                recordDate: data.checkDate,
                veterinarianId: data.veterinarianId,
                diagnosis: data.diagnosis ? {
                    primaryDiagnosis: data.diagnosis,
                    details: data.diagnosisDetails,
                    status: 'CONFIRMED'
                } : undefined,
                treatment: data.treatment ? {
                    description: data.treatment,
                    details: data.treatmentDetails,
                    status: 'PRESCRIBED'
                } : undefined,
                symptoms: data.symptoms,
                vitalSigns: data.vitalSigns,
                notes: data.notes,
                createdBy: userId,
                isActive: true
            } as any, { transaction });

            // Actualizar último chequeo y estado de salud en Bovine
            await bovine.update({
                lastHealthCheck: data.checkDate,
                healthStatus: newHealthStatus
            }, { transaction });

            // Actualizar snapshot — siempre, aunque el estado no cambie,
            // porque el diagnóstico y la fecha de chequeo sí cambiaron
            await geoService.updateSnapshot(data.bovineId, {
                healthStatus: newHealthStatus,
                //healthColor: HEALTH_COLORS[newHealthStatus],
                lastHealthCheck: data.checkDate,
                diagnosis: newHealthStatus === HealthStatus.HEALTHY ? null : data.diagnosis,
                lastUpdate: new Date()
            }, transaction);

            // Programar próximo chequeo si hay fecha de seguimiento
            if (data.followUpDate) {
                await eventService.createEvent({
                    bovineId: data.bovineId,
                    eventType: EventType.HEALTH_CHECK,
                    title: `Chequeo de seguimiento - ${bovine.earTag}`,
                    description: `Chequeo de seguimiento programado después de: ${data.diagnosis || 'consulta'}`,
                    scheduledDate: data.followUpDate,
                    priority: EventPriority.MEDIUM,
                    createdBy: userId,
                    requiresVeterinarian: true,
                    expectedData: {
                        type: 'SCHEDULED_HEALTH_CHECK',
                        healthStatus: bovine.healthStatus,
                        interval: 0,
                        automatic: true,
                        previousHealthRecordId: healthRecord.id
                    }
                }, transaction);
            } else {
                // Sin fecha de seguimiento explícita: programar el próximo
                // chequeo rutinario según el intervalo del estado de salud.
                // Se hace dentro de la transacción: si algo falla antes del
                // commit, el evento también revierte y no queda huérfano.
                await this.scheduleNextHealthCheck(data.bovineId, userId, transaction);
            }

            await transaction.commit();

            const duration = Date.now() - startTime;

            logger.info(`Chequeo de salud registrado para bovino ${data.bovineId}`, this.context, {
                bovineId: data.bovineId,
                healthRecordId: healthRecord.id,
                previousStatus: bovine.healthStatus,
                newStatus: newHealthStatus,
                hasDiagnosis: !!data.diagnosis,
                hasTreatment: !!data.treatment,
                durationMs: duration
            });

            return healthRecord;

        } catch (error) {
            await transaction.rollback();
            const duration = Date.now() - startTime;
            logger.error(`Error registrando chequeo para bovino ${data.bovineId}`, this.context, {
                bovineId: data.bovineId,
                durationMs: duration
            }, ensureError(error));

            if (error instanceof BovineError) throw error;
            throw new BovineError(
                `Error al registrar chequeo para bovino ${data.bovineId}`,
                'RECORD_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Actualiza el estado de salud de un bovino
     * 
     * @param bovineId - ID del bovino
     * @param newStatus - Nuevo estado de salud
     * @param userId - ID del usuario
     * @param reason - Razón del cambio (opcional)
     */
    async updateHealthStatus(
        bovineId: string,
        newStatus: HealthStatus,
        userId: string,
        reason?: string,
        externalTransaction?: Transaction   // ← acepta transacción externa (Fix #5)
    ): Promise<void> {
        // Si nos pasan una transacción externa la usamos; si no, creamos una propia
        const transaction = externalTransaction ?? await sequelize.transaction();
        const isOwnTransaction = !externalTransaction;
        const startTime = Date.now();

        try {
            // Resolver servicios garantizando que están disponibles
            const [geoService, eventService] = await Promise.all([
                this.getGeoService(),
                this.getEventService()
            ]);

            const bovine = await Bovine.findByPk(bovineId, {
                transaction,
                attributes: ['id', 'healthStatus', 'ranchId']
            });

            if (!bovine) {
                throw new BovineNotFoundError(bovineId);
            }

            const previousStatus = bovine.healthStatus;

            // No hacer nada si es el mismo estado
            if (previousStatus === newStatus) {
                logger.debug(`Estado de salud ya es ${newStatus} para bovino ${bovineId}`, this.context);
                if (isOwnTransaction) await transaction.rollback();
                return;
            }

            // Actualizar bovino
            await bovine.update({ healthStatus: newStatus }, { transaction });

            // Actualizar snapshot — garantizado, sin optional chaining
            await geoService.updateSnapshot(bovineId, {
                healthStatus: newStatus,
                //healthColor: HEALTH_COLORS[newStatus],
                diagnosis: newStatus === HealthStatus.HEALTHY ? null : undefined,
                lastUpdate: new Date()
            }, transaction);

            // Crear evento de cambio de salud
            await eventService.createEventFromAction('HEALTH_STATUS_CHANGED', {
                bovineId,
                userId,
                metadata: { from: previousStatus, to: newStatus, reason }
            }, transaction);

            // Reprogramar próximo chequeo dentro de la misma transacción.
            // Sin esto, el evento se comprometería aunque el resto del bloque
            // falle y haga rollback — dejando un evento huérfano en la BD.
            await this.scheduleNextHealthCheck(bovineId, userId, transaction);

            if (isOwnTransaction) await transaction.commit();

            const duration = Date.now() - startTime;

            logger.info(`Estado de salud actualizado para bovino ${bovineId}`, this.context, {
                bovineId,
                from: previousStatus,
                to: newStatus,
                reason,
                durationMs: duration
            });

        } catch (error) {
            if (isOwnTransaction) await transaction.rollback();
            const duration = Date.now() - startTime;
            logger.error(`Error actualizando estado de salud para bovino ${bovineId}`, this.context, {
                bovineId,
                newStatus,
                durationMs: duration
            }, ensureError(error));

            if (error instanceof BovineError) throw error;
            throw new BovineError(
                `Error al actualizar estado de salud para bovino ${bovineId}`,
                'STATUS_UPDATE_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Maneja un cambio de estado de salud (método público para ser llamado por otros servicios)
     */
    async handleHealthStatusChange(
        bovine: Bovine,
        previousStatus: HealthStatus,
        newStatus: HealthStatus,
        userId: string,
        transaction?: Transaction
    ): Promise<void> {
        try {
            // Propagamos la transacción externa para que updateHealthStatus
            // no abra una propia — evita transacciones anidadas no controladas
            await this.updateHealthStatus(
                bovine.id,
                newStatus,
                userId,
                `Cambio automático desde ${previousStatus}`,
                transaction
            );
        } catch (error) {
            logger.error(`Error manejando cambio de estado de salud`, this.context, {
                bovineId: bovine.id,
                previousStatus,
                newStatus
            }, ensureError(error));
            throw error;
        }
    }

    // ==========================================================================
    // MÉTODOS DE CONSULTA
    // ==========================================================================

    /**
     * Obtiene el historial de salud de un bovino
     * 
     * @param bovineId - ID del bovino
     * @param filters - Filtros opcionales
     * @returns Lista de registros de salud
     */
    async getHealthHistory(
        bovineId: string,
        filters: HealthHistoryFilters = {}
    ): Promise<Health[]> {
        const startTime = Date.now();

        try {
            const whereClause: any = { bovineId };

            if (filters.startDate || filters.endDate) {
                whereClause.recordDate = {};
                if (filters.startDate) whereClause.recordDate[Op.gte] = filters.startDate;
                if (filters.endDate) whereClause.recordDate[Op.lte] = filters.endDate;
            }

            if (filters.veterinarianId) {
                whereClause.veterinarianId = filters.veterinarianId;
            }

            const records = await Health.findAll({
                where: whereClause,
                order: [['recordDate', 'DESC']],
                limit: filters.limit || 50,
                offset: filters.offset || 0
            });

            const duration = Date.now() - startTime;

            logger.debug(`Historial de salud obtenido para bovino ${bovineId}`, this.context, {
                bovineId,
                recordCount: records.length,
                durationMs: duration
            });

            return records;

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`Error obteniendo historial de salud para bovino ${bovineId}`, this.context, {
                bovineId,
                durationMs: duration
            }, ensureError(error));

            throw new BovineError(
                `Error al obtener historial de salud para bovino ${bovineId}`,
                'HISTORY_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Obtiene estadísticas de salud del hato
     *
     * @param ranchId - ID del rancho
     * @returns Estadísticas agregadas
     */
    async getHerdHealthStats(ranchId: string): Promise<HerdHealthStats> {
        const startTime = Date.now();

        try {
            // Calcular fechas una sola vez fuera del Promise.all
            const now            = new Date();
            const sevenDaysAgo   = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
            const sevenDaysAhead = new Date(now); sevenDaysAhead.setDate(now.getDate() + 7);
            const thirtyDaysAgo  = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);

            // ── Las 4 queries son completamente independientes entre sí.
            // En secuencia: ~400 ms. En paralelo: ~100 ms (la más lenta).
            const [
                statusCounts,
                recentChecks,
                upcomingChecks,
                commonDiagnosisRaw
            ] = await Promise.all([

                // Query 1: conteo de bovinos por estado de salud
                Bovine.findAll({
                    where: { ranchId, isActive: true },
                    attributes: [
                        'healthStatus',
                        [sequelize.fn('COUNT', sequelize.col('health_status')), 'count']
                    ],
                    group: ['health_status']
                }),

                // Query 2: chequeos realizados en los últimos 7 días
                // `Health.belongsTo(Bovine, { as: 'bovine' })` exige el alias
                // explícito en el include — sin él Sequelize lanza
                // `SequelizeEagerLoadingError`.
                Health.count({
                    where: { recordDate: { [Op.gte]: sevenDaysAgo } },
                    include: [{ model: Bovine, as: 'bovine', where: { ranchId }, attributes: [] }]
                }),

                // Query 3: chequeos programados en los próximos 7 días.
                // `Event.belongsTo(Bovine, { as: 'bovine' })` — mismo alias.
                Event.count({
                    where: {
                        eventType: EventType.HEALTH_CHECK,
                        scheduledDate: { [Op.between]: [now, sevenDaysAhead] },
                        status: EventStatus.SCHEDULED
                    },
                    include: [{ model: Bovine, as: 'bovine', where: { ranchId }, attributes: [] }]
                }),

                // Query 4: top 5 diagnósticos de los últimos 30 días.
                Health.findAll({
                    where: { recordDate: { [Op.gte]: thirtyDaysAgo } },
                    attributes: [
                        [sequelize.literal("diagnosis->>'primaryDiagnosis'"), 'diagnosis'],
                        [sequelize.fn('COUNT', sequelize.col('Health.id')), 'count']
                    ],
                    include: [{ model: Bovine, as: 'bovine', where: { ranchId }, attributes: [] }],
                    group: [sequelize.literal("diagnosis->>'primaryDiagnosis'") as any],
                    order: [[sequelize.literal('count'), 'DESC']],
                    limit: 5
                })
            ]);

            // Agregar conteos por estado
            const byStatus = {
                [HealthStatus.HEALTHY]:    0,
                [HealthStatus.SICK]:       0,
                [HealthStatus.RECOVERING]: 0,
                [HealthStatus.QUARANTINE]: 0,
                [HealthStatus.DECEASED]:   0,
                [HealthStatus.UNKNOWN]:    0
            };
            let totalBovines = 0;

            statusCounts.forEach((item: any) => {
                const status = item.healthStatus as HealthStatus;
                const count  = parseInt(item.getDataValue('count'), 10);
                if (status in byStatus) {
                    byStatus[status] = count;
                    totalBovines    += count;
                }
            });

            const commonDiagnosis = commonDiagnosisRaw
                .filter((item: any) => item.getDataValue('diagnosis'))
                .map((item: any) => ({
                    diagnosis: item.getDataValue('diagnosis') as string,
                    count:     parseInt(item.getDataValue('count'), 10)
                }));

            const duration = Date.now() - startTime;

            logger.info(`Estadísticas de salud obtenidas para rancho ${ranchId}`, this.context, {
                ranchId,
                totalBovines,
                durationMs: duration
            });

            return {
                totalBovines,
                byStatus,
                healthyPercentage: totalBovines
                    ? (byStatus[HealthStatus.HEALTHY] / totalBovines) * 100
                    : 0,
                sickPercentage: totalBovines
                    ? ((byStatus[HealthStatus.SICK] + byStatus[HealthStatus.QUARANTINE]) / totalBovines) * 100
                    : 0,
                criticalCount: byStatus[HealthStatus.QUARANTINE],
                recentChecks,
                upcomingChecks,
                commonDiagnosis
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`Error obteniendo estadísticas de salud para rancho ${ranchId}`, this.context, {
                ranchId,
                durationMs: duration
            }, ensureError(error));

            throw new BovineError(
                `Error al obtener estadísticas de salud para rancho ${ranchId}`,
                'STATS_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Obtiene línea de tiempo de salud para gráficos
     * 
     * @param bovineId - ID del bovino
     * @param days - Número de días hacia atrás
     * @returns Puntos para gráfico de línea de tiempo
     */
    async getHealthTimeline(bovineId: string, days: number = 30): Promise<HealthTimelinePoint[]> {
        const startTime = Date.now();

        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            // Obtener registros de salud
            const healthRecords = await Health.findAll({
                where: {
                    bovineId,
                    recordDate: { [Op.gte]: startDate }
                },
                order: [['recordDate', 'ASC']]
            });

            // Obtener cambios de estado de eventos (si hay)
            const statusChanges = await Event.findAll({
                where: {
                    bovineId,
                    eventType: EventType.HEALTH_CHECK,
                    createdAt: { [Op.gte]: startDate },
                    [Op.and]: literal("metadata->>'event' = 'HEALTH_STATUS_CHANGED'")
                },
                order: [['created_at', 'ASC']]
            });

            // Combinar y ordenar
            const timeline: HealthTimelinePoint[] = [
                ...healthRecords.map(record => ({
                    date: record.recordDate,
                    healthStatus: record.overallHealthStatus || HealthStatus.UNKNOWN,
                    eventType: 'CHECK' as const,
                    description: record.diagnosis?.primaryDiagnosis || 'Chequeo rutinario'
                })),
                ...statusChanges.map(event => ({
                    date: event.createdAt,
                    healthStatus: (event.metadata?.to as HealthStatus) || HealthStatus.UNKNOWN,
                    eventType: 'DIAGNOSIS' as const,
                    description: `Cambio de estado: ${event.metadata?.from} → ${event.metadata?.to}`
                }))
            ].sort((a, b) => a.date.getTime() - b.date.getTime());

            const duration = Date.now() - startTime;

            logger.debug(`Línea de tiempo obtenida para bovino ${bovineId}`, this.context, {
                bovineId,
                points: timeline.length,
                durationMs: duration
            });

            return timeline;

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`Error obteniendo línea de tiempo para bovino ${bovineId}`, this.context, {
                bovineId,
                durationMs: duration
            }, ensureError(error));

            throw new BovineError(
                `Error al obtener línea de tiempo para bovino ${bovineId}`,
                'TIMELINE_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    // ==========================================================================
    // MÉTODOS DE VALIDACIÓN
    // ==========================================================================

    /**
     * Valida signos vitales
     */
    private validateVitalSigns(vitalSigns: any): void {
        if (vitalSigns.temperature !== undefined) {
            const { MIN, MAX } = VITAL_SIGNS_THRESHOLDS.TEMPERATURE;
            if (vitalSigns.temperature < MIN || vitalSigns.temperature > MAX) {
                throw new BovineValidationError(
                    `Temperatura fuera de rango normal (${MIN}°C - ${MAX}°C): ${vitalSigns.temperature}°C`
                );
            }
        }

        if (vitalSigns.heartRate !== undefined) {
            const { MIN, MAX } = VITAL_SIGNS_THRESHOLDS.HEART_RATE;
            if (vitalSigns.heartRate < MIN || vitalSigns.heartRate > MAX) {
                throw new BovineValidationError(
                    `Frecuencia cardíaca fuera de rango normal (${MIN}-${MAX} lpm): ${vitalSigns.heartRate} lpm`
                );
            }
        }

        if (vitalSigns.respiratoryRate !== undefined) {
            const { MIN, MAX } = VITAL_SIGNS_THRESHOLDS.RESPIRATORY_RATE;
            if (vitalSigns.respiratoryRate < MIN || vitalSigns.respiratoryRate > MAX) {
                throw new BovineValidationError(
                    `Frecuencia respiratoria fuera de rango normal (${MIN}-${MAX} rpm): ${vitalSigns.respiratoryRate} rpm`
                );
            }
        }
    }

    /**
     * Determina el estado de salud resultante del chequeo.
     *
     * JERARQUÍA DE DECISIÓN (de mayor a menor prioridad):
     *
     *   1. `data.newHealthStatus` — declaración explícita del veterinario.
     *      Es la fuente más fiable. Si el veterinario lo envía, se usa siempre.
     *
     *   2. Inferencia por keywords — fallback cuando el veterinario no envía
     *      `newHealthStatus`. Útil para integraciones externas o formularios
     *      simples que aún no exponen el campo.
     *      ⚠️ Es un heurístico frágil: documentado intencionalmente para que
     *      sea fácil de encontrar y reemplazar cuando el frontend lo soporte.
     *
     *   3. `HEALTHY` — estado por defecto cuando no hay señales de enfermedad.
     */
    private determineHealthStatus(data: HealthCheckData): HealthStatus {
        // ── Prioridad 1: declaración explícita del veterinario ───────────────
        if (data.newHealthStatus) {
            // Validar que el valor es un HealthStatus conocido
            if (!Object.values(HealthStatus).includes(data.newHealthStatus)) {
                throw new BovineValidationError(
                    `newHealthStatus inválido: "${data.newHealthStatus}". ` +
                    `Valores permitidos: ${Object.values(HealthStatus).join(', ')}`
                );
            }
            return data.newHealthStatus;
        }

        // ── Prioridad 2: inferencia por keywords (fallback) ──────────────────
        if (data.diagnosis) {
            const diagnosisLower = data.diagnosis.toLowerCase();

            // Cuarentena tiene prioridad sobre SICK — es más restrictiva
            const quarantineKeywords = [
                'contagioso', 'contagiosa',
                'infeccioso', 'infecciosa',
                'cuarentena', 'aislamiento',
                'zoonosis', 'epizootia'
            ];
            if (quarantineKeywords.some(k => diagnosisLower.includes(k))) {
                return HealthStatus.QUARANTINE;
            }

            // Señales claras de enfermedad activa
            const sickKeywords = [
                'crítico', 'critico', 'grave',
                'emergencia', 'urgencia',
                'infección', 'infeccion',
                'fiebre', 'mastitis', 'neumonía', 'neumonia',
                'diarrea', 'cojera', 'parásito', 'parasito'
            ];
            if (sickKeywords.some(k => diagnosisLower.includes(k))) {
                return HealthStatus.SICK;
            }

            // Señales de recuperación en curso
            const recoveringKeywords = [
                'recuperación', 'recuperacion',
                'mejorando', 'convalecencia',
                'post-tratamiento', 'seguimiento'
            ];
            if (recoveringKeywords.some(k => diagnosisLower.includes(k))) {
                return HealthStatus.RECOVERING;
            }
        }

        // Tratamiento activo sin diagnóstico de enfermedad → recuperándose
        if (data.treatment && !data.diagnosis) {
            return HealthStatus.RECOVERING;
        }

        // ── Prioridad 3: default ─────────────────────────────────────────────
        return HealthStatus.HEALTHY;
    }

    // ==========================================================================
    // MÉTODOS DE UTILIDAD
    // ==========================================================================

    /**
     * Formatea un registro de salud para respuesta
     */
    formatHealthRecord(record: Health): HealthCheckResult {
        return {
            id: record.id,
            bovineId: record.bovineId,
            checkDate: record.recordDate,
            veterinarianId: record.veterinarianId || '',
            veterinarianName: record.veterinarianName || 'Veterinario no especificado',
            veterinarianLicense: record.veterinarianLicense,
            diagnosis: record.diagnosis?.primaryDiagnosis,
            treatment: record.treatment?.treatmentPlan,
            healthStatus: record.overallHealthStatus || HealthStatus.UNKNOWN,
            followUpDate: record.followUpDate,
            createdAt: record.createdAt
        };
    }

    /**
     * Calcula días desde el último chequeo
     */
    getDaysSinceLastCheck(bovine: Bovine): number {
        if (!bovine.lastHealthCheck) return -1;
        return Math.floor(
            (Date.now() - bovine.lastHealthCheck.getTime()) / (1000 * 60 * 60 * 24)
        );
    }

    /**
     * Obtiene etiqueta de estado de salud en español
     */
    getHealthStatusLabel(status: HealthStatus): string {
        return HEALTH_LABELS[status] || status;
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const bovineHealthService = new BovineHealthService();