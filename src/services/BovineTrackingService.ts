import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import {
    BovineError,
    BovineValidationError,
    BovineNotFoundError
} from '../utils/BovineErrors';
import { getErrorMessage, ensureError } from '../utils/errorUtils';
import {
    ALERT_THRESHOLDS,
    MOVEMENT_PATTERNS,
    UNITS,
    API_LIMITS,
    ANOMALY_THRESHOLDS
} from '../constants/bovine.constants';

// Modelos
import BovineTracking, { TrackingSource } from '../models/BovineTracking';
import Bovine from '../models/Bovine';
import { HealthStatus } from '../models/Bovine';

// Servicios (con lazy loading)
import type { BovineGeoService } from './BovineGeoService';
import type { EventService } from './EventService';
import type { NotificationService, CreateNotificationDTO } from './NotificationService';
import Location, { LocationType, GeofenceType, LocationStatus, Coordinates, AlertTrigger } from '../models/Location';
import { AccessLevel } from '../models/LocationAccess';
import { haversineDistance, toRadians } from '../utils/geoUtils';
import { NotificationType, NotificationPriority } from '../models/Notification';
import { Geometry } from 'geojson';
import User, {UserRole, UserStatus} from '../models/User';
// WebSocket (para tiempo real)
import WebSocket from 'ws';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

/**
 * Datos para registrar un punto de tracking
 */
export interface TrackingPointData {
    bovineId: string;
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    batteryLevel?: number;
    deviceId?: string;
    recordedAt: Date;
    source: TrackingSource;
    healthStatusAtTime?: HealthStatus;
}

/**
 * Resultado de registro por lote
 */
export interface BatchTrackingResult {
    successful: number;
    failed: number;
    errors: Array<{
        point: TrackingPointData;
        error: string;
    }>;
    updatedBovines: string[]; // IDs de bovinos con nueva ubicación
}

/**
 * Punto para visualización de rutas
 */
export interface PathPoint {
    lat: number;
    lng: number;
    timestamp: Date;
    speed?: number;
    heading?: number;
    healthStatus?: HealthStatus;
}

/**
 * Estadísticas de movimiento
 */
export interface MovementStats {
    totalDistance: number;      // km
    averageSpeed: number;       // km/h
    maxSpeed: number;           // km/h
    movingTime: number;         // minutos
    restingTime: number;        // minutos
    startTime: Date;
    endTime: Date;
    pointCount: number;
}

/**
 * Anomalía detectada
 */
export interface Anomaly {
    type: 'IMMOBILITY' | 'HIGH_SPEED' | 'AREA_EXIT' | 'LOW_BATTERY' | 'DEVICE_OFFLINE';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    timestamp: Date;
    description: string;
    value?: number;
    threshold?: number;
}

/**
 * Estado del dispositivo
 */
export interface DeviceStatus {
    deviceId: string;
    isOnline: boolean;
    lastSeen: Date | null;
    batteryLevel: number | null;
    currentBovineId?: string;
}

/**
 * Filtros para consultas históricas
 */
export interface TrackingFilters {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    minSpeed?: number;
    maxSpeed?: number;
    boundingBox?: {
        north: number;
        south: number;
        east: number;
        west: number;
    };
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class BovineTrackingService {
    private readonly context = 'BovineTrackingService';

    // Servicios
    private geoService!: BovineGeoService;
    private eventService!: EventService;
    private notificationService!: NotificationService;

    // WebSocket clients map: ranchId → WebSocket[]
    private wsClients: Map<string, WebSocket[]> = new Map();

    constructor() {
        this.initializeServices();
    }

    private async initializeServices(): Promise<void> {
        try {
            const [GeoModule, EventModule, NotificationModule] = await Promise.all([
                import('./BovineGeoService'),
                import('./EventService'),
                import('./NotificationService')
            ]);

            this.geoService = GeoModule.bovineGeoService;
            this.eventService = EventModule.eventService;
            this.notificationService = NotificationModule.notificationService;

            logger.info('Servicios de tracking inicializados', this.context);
        } catch (error) {
            logger.error('Error inicializando servicios de tracking', this.context, {}, ensureError(error));
        }
    }

    // ==========================================================================
    // MÉTODOS DE REGISTRO DE UBICACIONES
    // ==========================================================================

    /**
     * Registra un nuevo punto de ubicación
     * 
     * @param data - Datos del punto GPS
     * @returns El registro de tracking creado
     * 
     * FLUJO:
     *   1. Validar coordenadas
     *   2. Verificar que el bovino existe
     *   3. Guardar punto en BovineTracking
     *   4. Actualizar ubicación actual en Bovine
     *   5. Actualizar snapshot para mapas
     *   6. Transmitir vía WebSocket
     *   7. Detectar anomalías
     */
    async recordLocation(data: TrackingPointData): Promise<BovineTracking> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            // 1. Validar coordenadas
            this.validateCoordinates(data);

            // 2. Verificar que el bovino existe
            const bovine = await Bovine.findByPk(data.bovineId, {
                attributes: ['id', 'ranchId', 'location', 'trackingConfig', 'healthStatus'],
                transaction
            });

            if (!bovine) {
                throw new BovineNotFoundError(data.bovineId);
            }

            // 3. Guardar punto de tracking
            const tracking = await BovineTracking.create({
                bovineId: data.bovineId,
                latitude: data.latitude,
                longitude: data.longitude,
                altitude: data.altitude,
                accuracy: data.accuracy,
                speed: data.speed,
                heading: data.heading,
                batteryLevel: data.batteryLevel,
                deviceId: data.deviceId,
                recordedAt: data.recordedAt || new Date(),
                source: data.source || TrackingSource.GPS,
                healthStatusAtTime: data.healthStatusAtTime || bovine.healthStatus
            }, { transaction });

            const newLocation = {
                latitude: data.latitude,
                longitude: data.longitude,
                altitude: data.altitude,
                accuracy: data.accuracy,
                timestamp: data.recordedAt || new Date(),
                source: data.source
            };

            // ✅ CONSTRUIR EL NUEVO OBJETO TRACKINGCONFIG COMPLETO
            const newTrackingConfig = {
                isEnabled: bovine.trackingConfig?.isEnabled ?? true,
                deviceId: bovine.trackingConfig?.deviceId || data.deviceId,
                batteryLevel: data.batteryLevel ?? bovine.trackingConfig?.batteryLevel,
                lastUpdate: new Date(),
                updateInterval: bovine.trackingConfig?.updateInterval,
                geofenceAlerts: bovine.trackingConfig?.geofenceAlerts ?? true
            };

            // 4. Actualizar ubicación en Bovine
            await bovine.update({
                location: newLocation,
                trackingConfig: newTrackingConfig
            }, { transaction });

            // 5. Actualizar snapshot (para mapas)
            if (this.geoService) {
                await this.geoService.updateSnapshot(data.bovineId, {
                    location: bovine.location,
                    lastUpdate: new Date()
                }, transaction);
            }

            await transaction.commit();

            // 6. Transmitir en tiempo real
            this.broadcastLocation(data.bovineId, {
                lat: data.latitude,
                lng: data.longitude,
                timestamp: data.recordedAt || new Date(),
                speed: data.speed,
                heading: data.heading
            }, bovine.ranchId);

            // 7. Detectar anomalías (asíncrono, no esperar)
            this.detectAnomalies(tracking, bovine).catch(error => {
                logger.error('Error detectando anomalías', this.context, {
                    bovineId: data.bovineId,
                    trackingId: tracking.id
                }, ensureError(error));
            });

            const duration = Date.now() - startTime;

            logger.info(`Ubicación registrada para bovino ${data.bovineId}`, this.context, {
                bovineId: data.bovineId,
                trackingId: tracking.id,
                coordinates: `${data.latitude}, ${data.longitude}`,
                speed: data.speed,
                battery: data.batteryLevel,
                durationMs: duration
            });

            return tracking;

        } catch (error) {
            await transaction.rollback();
            const duration = Date.now() - startTime;
            logger.error(`Error registrando ubicación para bovino ${data.bovineId}`, this.context, {
                bovineId: data.bovineId,
                data,
                durationMs: duration
            }, ensureError(error));

            if (error instanceof BovineError) throw error;
            throw new BovineError(
                `Error al registrar ubicación para bovino ${data.bovineId}`,
                'TRACKING_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Registra múltiples ubicaciones en lote
     * 
     * @param points - Array de puntos GPS
     * @returns Resultado del procesamiento por lote
     */
    async recordBatchLocations(points: TrackingPointData[]): Promise<BatchTrackingResult> {
        const startTime = Date.now();
        const successful: TrackingPointData[] = [];
        const errors: Array<{ point: TrackingPointData; error: string }> = [];
        const updatedBovines = new Set<string>();

        // Procesar en lotes pequeños para no sobrecargar
        const batchSize = API_LIMITS.MAX_BATCH_SIZE;

        for (let i = 0; i < points.length; i += batchSize) {
            const batch = points.slice(i, i + batchSize);

            const batchPromises = batch.map(async (point) => {
                try {
                    const tracking = await this.recordLocation(point);
                    successful.push(point);
                    updatedBovines.add(point.bovineId);
                    return { success: true };
                } catch (error) {
                    errors.push({
                        point,
                        error: getErrorMessage(error)
                    });
                    return { success: false };
                }
            });

            await Promise.allSettled(batchPromises);
        }

        const duration = Date.now() - startTime;

        logger.info(`Registro masivo completado`, this.context, {
            total: points.length,
            successful: successful.length,
            failed: errors.length,
            uniqueBovines: updatedBovines.size,
            durationMs: duration
        });

        return {
            successful: successful.length,
            failed: errors.length,
            errors,
            updatedBovines: Array.from(updatedBovines)
        };
    }

    // ==========================================================================
    // MÉTODOS DE CONSULTA
    // ==========================================================================

    /**
     * Obtiene la última ubicación conocida de un bovino
     */
    async getLastLocation(bovineId: string): Promise<BovineTracking | null> {
        try {
            const tracking = await BovineTracking.findOne({
                where: { bovineId },
                order: [['recordedAt', 'DESC']]
            });

            logger.debug(`Última ubicación obtenida para bovino ${bovineId}`, this.context, {
                bovineId,
                found: !!tracking
            });

            return tracking;
        } catch (error) {
            logger.error(`Error obteniendo última ubicación para bovino ${bovineId}`, this.context, {
                bovineId
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene el historial de ubicaciones de un bovino
     * 
     * @param bovineId - ID del bovino
     * @param startDate - Fecha de inicio
     * @param endDate - Fecha de fin
     * @param options - Opciones adicionales (límite, downsampling)
     * @returns Array de puntos para dibujar ruta
     */
    async getLocationHistory(
        bovineId: string,
        startDate: Date,
        endDate: Date,
        options?: { maxPoints?: number; includeSpeed?: boolean }
    ): Promise<PathPoint[]> {
        const startTime = Date.now();

        try {
            const trackings = await BovineTracking.findAll({
                where: {
                    bovineId,
                    recordedAt: {
                        [Op.between]: [startDate, endDate]
                    }
                },
                order: [['recordedAt', 'ASC']],
                attributes: ['latitude', 'longitude', 'recordedAt', 'speed', 'heading', 'healthStatusAtTime']
            });

            let points: PathPoint[] = trackings.map(t => ({
                lat: t.latitude,
                lng: t.longitude,
                timestamp: t.recordedAt,
                speed: t.speed,
                heading: t.heading,
                healthStatus: t.healthStatusAtTime
            }));

            // Downsampling si hay demasiados puntos
            if (options?.maxPoints && points.length > options.maxPoints) {
                points = this.downsamplePoints(points, options.maxPoints);
            }

            const duration = Date.now() - startTime;

            logger.debug(`Historial de ubicaciones obtenido para bovino ${bovineId}`, this.context, {
                bovineId,
                pointCount: points.length,
                originalCount: trackings.length,
                durationMs: duration
            });

            return points;

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`Error obteniendo historial para bovino ${bovineId}`, this.context, {
                bovineId,
                durationMs: duration
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene la ruta para animación (versión optimizada)
     */
    async getMovementPath(
        bovineId: string,
        startDate: Date,
        endDate: Date
    ): Promise<PathPoint[]> {
        return this.getLocationHistory(bovineId, startDate, endDate, {
            maxPoints: API_LIMITS.MAX_POINTS_PER_PATH
        });
    }

    /**
     * Calcula la distancia total recorrida en un período
     */
    async calculateTotalDistance(
        bovineId: string,
        startDate: Date,
        endDate: Date
    ): Promise<number> {
        try {
            const points = await this.getLocationHistory(bovineId, startDate, endDate);

            if (points.length < 2) return 0;

            let totalDistance = 0;
            for (let i = 1; i < points.length; i++) {
                totalDistance += this.haversineDistance(
                    { lat: points[i - 1].lat, lng: points[i - 1].lng },
                    { lat: points[i].lat, lng: points[i].lng }
                );
            }

            return Math.round(totalDistance * 100) / 100; // Redondear a 2 decimales

        } catch (error) {
            logger.error(`Error calculando distancia para bovino ${bovineId}`, this.context, {
                bovineId
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de movimiento para un día específico
     */
    async getMovementStats(
        bovineId: string,
        date: Date
    ): Promise<MovementStats> {
        try {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const points = await this.getLocationHistory(bovineId, startOfDay, endOfDay);

            if (points.length < 2) {
                return {
                    totalDistance: 0,
                    averageSpeed: 0,
                    maxSpeed: 0,
                    movingTime: 0,
                    restingTime: 24 * 60, // 24 horas en minutos
                    startTime: startOfDay,
                    endTime: endOfDay,
                    pointCount: points.length
                };
            }

            let totalDistance = 0;
            let maxSpeed = 0;
            let movingMinutes = 0;
            let restingMinutes = 0;

            for (let i = 1; i < points.length; i++) {
                const distance = this.haversineDistance(
                    { lat: points[i - 1].lat, lng: points[i - 1].lng },
                    { lat: points[i].lat, lng: points[i].lng }
                );

                totalDistance += distance;

                const timeDiff = (points[i].timestamp.getTime() - points[i - 1].timestamp.getTime()) / (1000 * 60); // minutos
                const speed = distance / (timeDiff / 60); // km/h

                if (speed > maxSpeed) maxSpeed = speed;

                // Consideramos en movimiento si la distancia es significativa
                if (distance > ANOMALY_THRESHOLDS.MIN_MOVEMENT_DISTANCE / 1000) { // convertir a km
                    movingMinutes += timeDiff;
                } else {
                    restingMinutes += timeDiff;
                }
            }

            const totalMinutes = 24 * 60;
            const averageSpeed = totalDistance / (totalMinutes / 60); // km/h

            return {
                totalDistance: Math.round(totalDistance * 100) / 100,
                averageSpeed: Math.round(averageSpeed * 100) / 100,
                maxSpeed: Math.round(maxSpeed * 100) / 100,
                movingTime: Math.round(movingMinutes),
                restingTime: totalMinutes - movingMinutes,
                startTime: startOfDay,
                endTime: endOfDay,
                pointCount: points.length
            };

        } catch (error) {
            logger.error(`Error obteniendo estadísticas para bovino ${bovineId}`, this.context, {
                bovineId,
                date
            }, ensureError(error));
            throw error;
        }
    }

    // ==========================================================================
    // ANÁLISIS DE MOVIMIENTO
    // ==========================================================================

    /**
     * Detecta anomalías en el movimiento
     */
    private async detectAnomalies(tracking: BovineTracking, bovine: Bovine): Promise<void> {
        const anomalies: Anomaly[] = [];
        const startTime = Date.now();

        try {
            // ====================================================================
            // 1. Verificar velocidad excesiva
            // ====================================================================
            if (tracking.speed && tracking.speed > ANOMALY_THRESHOLDS.MAX_NORMAL_SPEED) {
                const severity = tracking.speed > ANOMALY_THRESHOLDS.MAX_NORMAL_SPEED * 1.5
                    ? 'HIGH'
                    : 'MEDIUM';

                anomalies.push({
                    type: 'HIGH_SPEED',
                    severity,
                    timestamp: tracking.recordedAt,
                    description: `Velocidad alta: ${tracking.speed.toFixed(1)} km/h`,
                    value: tracking.speed,
                    threshold: ANOMALY_THRESHOLDS.MAX_NORMAL_SPEED
                });

                logger.warn(`Velocidad alta detectada para bovino ${tracking.bovineId}`, this.context, {
                    bovineId: tracking.bovineId,
                    speed: tracking.speed,
                    threshold: ANOMALY_THRESHOLDS.MAX_NORMAL_SPEED
                });
            }

            // ====================================================================
            // 2. Verificar batería baja
            // ====================================================================
            if (tracking.batteryLevel && tracking.batteryLevel < ALERT_THRESHOLDS.LOW_BATTERY_PERCENT) {
                const severity = tracking.batteryLevel < 5 ? 'CRITICAL' : 'MEDIUM';

                anomalies.push({
                    type: 'LOW_BATTERY',
                    severity,
                    timestamp: tracking.recordedAt,
                    description: `Batería baja: ${tracking.batteryLevel}%`,
                    value: tracking.batteryLevel,
                    threshold: ALERT_THRESHOLDS.LOW_BATTERY_PERCENT
                });

                logger.warn(`Batería baja para dispositivo ${tracking.deviceId || 'desconocido'}`, this.context, {
                    bovineId: tracking.bovineId,
                    deviceId: tracking.deviceId,
                    batteryLevel: tracking.batteryLevel,
                    threshold: ALERT_THRESHOLDS.LOW_BATTERY_PERCENT
                });
            }

            // ====================================================================
            // 3. Verificar inmovilidad (consultando puntos recientes)
            // ====================================================================
            const recentPoints = await BovineTracking.findAll({
                where: {
                    bovineId: tracking.bovineId,
                    recordedAt: {
                        [Op.gte]: new Date(Date.now() - ANOMALY_THRESHOLDS.IMMOBILITY_MINUTES * 60 * 1000)
                    }
                },
                order: [['recordedAt', 'ASC']]
            });

            if (recentPoints.length >= 2) {
                const firstPoint = recentPoints[0];
                const lastPoint = recentPoints[recentPoints.length - 1];

                const distance = this.haversineDistance(
                    { lat: firstPoint.latitude, lng: firstPoint.longitude },
                    { lat: lastPoint.latitude, lng: lastPoint.longitude }
                );

                const distanceMeters = distance * 1000; // convertir a metros

                if (distanceMeters < ANOMALY_THRESHOLDS.MIN_MOVEMENT_DISTANCE) {
                    anomalies.push({
                        type: 'IMMOBILITY',
                        severity: 'MEDIUM',
                        timestamp: tracking.recordedAt,
                        description: `Posible inmovilidad detectada - ${distanceMeters.toFixed(1)}m en ${ANOMALY_THRESHOLDS.IMMOBILITY_MINUTES} minutos`,
                        value: distanceMeters,
                        threshold: ANOMALY_THRESHOLDS.MIN_MOVEMENT_DISTANCE
                    });

                    logger.warn(`Posible inmovilidad para bovino ${tracking.bovineId}`, this.context, {
                        bovineId: tracking.bovineId,
                        distanceMeters,
                        timeWindow: ANOMALY_THRESHOLDS.IMMOBILITY_MINUTES,
                        threshold: ANOMALY_THRESHOLDS.MIN_MOVEMENT_DISTANCE
                    });
                }
            }

            // ====================================================================
            // 4. Verificar si el dispositivo está offline (si es el primer punto después de mucho tiempo)
            // ====================================================================
            if (tracking.deviceId) {
                const lastTracking = await BovineTracking.findOne({
                    where: {
                        deviceId: tracking.deviceId,
                        id: { [Op.ne]: tracking.id }
                    },
                    order: [['recordedAt', 'DESC']]
                });

                if (lastTracking) {
                    const minutesSinceLastSeen = (tracking.recordedAt.getTime() - lastTracking.recordedAt.getTime()) / (1000 * 60);

                    if (minutesSinceLastSeen > ANOMALY_THRESHOLDS.OFFLINE_MINUTES) {
                        anomalies.push({
                            type: 'DEVICE_OFFLINE',
                            severity: 'HIGH',
                            timestamp: tracking.recordedAt,
                            description: `Dispositivo reconectado después de ${Math.round(minutesSinceLastSeen)} minutos sin datos`,
                            value: minutesSinceLastSeen,
                            threshold: ANOMALY_THRESHOLDS.OFFLINE_MINUTES
                        });

                        logger.warn(`Dispositivo reconectado después de estar offline`, this.context, {
                            deviceId: tracking.deviceId,
                            bovineId: tracking.bovineId,
                            minutesOffline: minutesSinceLastSeen,
                            threshold: ANOMALY_THRESHOLDS.OFFLINE_MINUTES
                        });
                    }
                }
            }

            // ====================================================================
            // 5. ENVIAR NOTIFICACIONES PARA ANOMALÍAS CRÍTICAS
            // ====================================================================
            if (anomalies.length > 0) {
                // Registrar todas las anomalías en el log
                logger.warn(`Anomalías detectadas para bovino ${tracking.bovineId}`, this.context, {
                    bovineId: tracking.bovineId,
                    trackingId: tracking.id,
                    anomalyCount: anomalies.length,
                    anomalies: anomalies.map(a => ({
                        type: a.type,
                        severity: a.severity,
                        description: a.description,
                        value: a.value,
                        threshold: a.threshold
                    }))
                });

                // Enviar notificaciones para anomalías de severidad HIGH o CRITICAL
                for (const anomaly of anomalies) {
                    if (anomaly.severity === 'HIGH' || anomaly.severity === 'CRITICAL') {
                        try {
                            await this.sendAnomalyNotification(anomaly, tracking, bovine);
                        } catch (notifError) {
                            logger.error(`Error enviando notificación para anomalía`, this.context, {
                                anomalyType: anomaly.type,
                                bovineId: tracking.bovineId,
                                error: ensureError(notifError).message
                            });
                        }
                    }
                }

                // Si hay anomalías de tipo HIGH_SPEED, también enviar a veterinarios
                const highSpeedAnomalies = anomalies.filter(a => a.type === 'HIGH_SPEED');
                if (highSpeedAnomalies.length > 0) {
                    await this.sendHighSpeedAlerts(highSpeedAnomalies, tracking, bovine);
                }

                // Si hay anomalías de tipo LOW_BATTERY, enviar a técnicos
                const lowBatteryAnomalies = anomalies.filter(a => a.type === 'LOW_BATTERY');
                if (lowBatteryAnomalies.length > 0) {
                    await this.sendLowBatteryAlerts(lowBatteryAnomalies, tracking, bovine);
                }
            }


            const duration = Date.now() - startTime;
            if (anomalies.length > 0) {
                logger.info(`Procesamiento de anomalías completado`, this.context, {
                    bovineId: tracking.bovineId,
                    anomalyCount: anomalies.length,
                    durationMs: duration
                });
            }

        } catch (error) {
            logger.error('Error detectando anomalías', this.context, {
                trackingId: tracking.id,
                bovineId: tracking.bovineId
            }, ensureError(error));
        }
    }

    // ==========================================================================
    // MÉTODOS DE DISPOSITIVOS
    // ==========================================================================

    /**
     * Obtiene el estado actual de un dispositivo
     */
    async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
        try {
            const lastTracking = await BovineTracking.findOne({
                where: { deviceId },
                order: [['recordedAt', 'DESC']],
            });

            if (!lastTracking) {
                return {
                    deviceId,
                    isOnline: false,
                    lastSeen: null,
                    batteryLevel: null,
                    currentBovineId: undefined,
                };
            }

            const minutesSinceLastSeen = (Date.now() - lastTracking.recordedAt.getTime()) / (1000 * 60);

            return {
                deviceId,
                isOnline: minutesSinceLastSeen < ANOMALY_THRESHOLDS.OFFLINE_MINUTES,
                lastSeen: lastTracking.recordedAt,
                batteryLevel: lastTracking.batteryLevel ?? null,
                currentBovineId: lastTracking.bovineId,
            };

        } catch (error) {
            logger.error(`Error obteniendo estado del dispositivo ${deviceId}`, this.context, {
                deviceId
            }, ensureError(error));
            throw error;
        }
    }

    // ==========================================================================
    // WEBSOCKET PARA TIEMPO REAL
    // ==========================================================================

    /**
     * Suscribe un cliente WebSocket a las actualizaciones de un rancho
     */
    subscribeToRanch(ranchId: string, ws: WebSocket): void {
        if (!this.wsClients.has(ranchId)) {
            this.wsClients.set(ranchId, []);
        }
        this.wsClients.get(ranchId)!.push(ws);

        ws.on('close', () => {
            const clients = this.wsClients.get(ranchId) || [];
            this.wsClients.set(
                ranchId,
                clients.filter(client => client !== ws)
            );
        });

        logger.debug(`Cliente suscrito a rancho ${ranchId}`, this.context);
    }

    /**
     * Suscribe un cliente a las actualizaciones de un bovino específico
     */
    subscribeToBovine(bovineId: string, ws: WebSocket): void {
        // Usamos el mismo mapa pero con key especial
        const key = `bovine:${bovineId}`;
        if (!this.wsClients.has(key)) {
            this.wsClients.set(key, []);
        }
        this.wsClients.get(key)!.push(ws);

        ws.on('close', () => {
            const clients = this.wsClients.get(key) || [];
            this.wsClients.set(
                key,
                clients.filter(client => client !== ws)
            );
        });
    }

    /**
     * Transmite una actualización de ubicación a los clientes suscritos
     */
    private broadcastLocation(
        bovineId: string,
        location: { lat: number; lng: number; timestamp: Date; speed?: number; heading?: number },
        ranchId?: string
    ): void {
        const message = JSON.stringify({
            type: 'LOCATION_UPDATE',
            bovineId,
            data: location
        });

        // Enviar a suscriptores del bovino específico
        const bovineKey = `bovine:${bovineId}`;
        const bovineClients = this.wsClients.get(bovineKey) || [];
        bovineClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });

        // Enviar a suscriptores del rancho
        if (ranchId) {
            const ranchClients = this.wsClients.get(ranchId) || [];
            ranchClients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        }
    }

    // ==========================================================================
    // MÉTODOS DE UTILIDAD
    // ==========================================================================

    /**
     * Valida coordenadas geográficas
     */
    private validateCoordinates(data: TrackingPointData): void {
        if (data.latitude < -90 || data.latitude > 90) {
            throw new BovineValidationError(`Latitud inválida: ${data.latitude}`);
        }
        if (data.longitude < -180 || data.longitude > 180) {
            throw new BovineValidationError(`Longitud inválida: ${data.longitude}`);
        }
        if (data.accuracy && data.accuracy < 0) {
            throw new BovineValidationError(`Precisión inválida: ${data.accuracy}`);
        }
    }

    /**
     * Calcula distancia Haversine entre dos puntos (en km)
     */
    private haversineDistance(
        p1: { lat: number; lng: number },
        p2: { lat: number; lng: number }
    ): number {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLng = (p2.lng - p1.lng) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Reduce la cantidad de puntos para visualización (downsampling)
     */
    private downsamplePoints(points: PathPoint[], targetCount: number): PathPoint[] {
        if (points.length <= targetCount) return points;

        const result: PathPoint[] = [];
        const step = Math.floor(points.length / targetCount);

        for (let i = 0; i < points.length; i += step) {
            result.push(points[i]);
            if (result.length >= targetCount) break;
        }

        return result;
    }

    /**
     * Obtiene el patrón de movimiento basado en la velocidad
     */
    getMovementPattern(speed: number): string {
        if (speed < 1) return MOVEMENT_PATTERNS.RESTING;
        if (speed < 3) return MOVEMENT_PATTERNS.GRAZING;
        if (speed < 8) return MOVEMENT_PATTERNS.WALKING;
        return MOVEMENT_PATTERNS.RUNNING;
    }

    /**
     * Formatea la velocidad para mostrar
     */
    formatSpeed(speed: number): string {
        return `${Math.round(speed * 10) / 10} ${UNITS.SPEED}`;
    }

    /**
     * Formatea la distancia para mostrar
     */
    formatDistance(distance: number): string {
        if (distance < 1) {
            return `${Math.round(distance * 1000)} m`;
        }
        return `${Math.round(distance * 10) / 10} ${UNITS.DISTANCE}`;
    }

    // ==========================================================================
    // MÉTODOS DE NOTIFICACIÓN ESPECÍFICOS
    // ==========================================================================



    /**
     * Envía una notificación para una anomalía específica
     */
    private async sendAnomalyNotification(
        anomaly: Anomaly,
        tracking: BovineTracking,
        bovine: Bovine
    ): Promise<void> {
        try {
            const alertType = this.mapAnomalyToAlertType(anomaly.type);

            await this.notificationService.sendGeofenceAlert({
                bovineId: tracking.bovineId,
                bovineEarTag: bovine.earTag,
                geofenceId: 'unknown',
                geofenceName: 'Zona restringida',
                event: 'entry',
                location: { latitude: tracking.latitude, longitude: tracking.longitude },
                ranchId: bovine.ranchId!
            });
            logger.debug(`Notificación de anomalía enviada`, this.context, {
                bovineId: tracking.bovineId,
                anomalyType: anomaly.type,
                alertType
            });

        } catch (error) {
            logger.error(`Error enviando notificación de anomalía`, this.context, {
                bovineId: tracking.bovineId,
                anomalyType: anomaly.type
            }, ensureError(error));
        }
    }

    /**
     * Envía alertas específicas de alta velocidad
     */
    private async sendHighSpeedAlerts(
        anomalies: Anomaly[],
        tracking: BovineTracking,
        bovine: Bovine
    ): Promise<void> {
        try {
            const veterinarians = await this.getVeterinariansForRanch(bovine.ranchId || '');

            if (veterinarians.length === 0) return;

            const maxSpeed = Math.max(...anomalies.map(a => a.value || 0));
            const veterinarianIds = veterinarians.map(v => v.id);

            const notifications: CreateNotificationDTO[] = veterinarians.map(vet => ({
                userId: vet.id,
                type: NotificationType.HEALTH_ALERT,
                priority: NotificationPriority.HIGH,
                title: '🚨 Alerta de Velocidad Inusual',
                content: `Velocidad inusual detectada: ${maxSpeed.toFixed(1)} km/h`,
                data: {
                    bovineId: tracking.bovineId,
                    bovineEarTag: bovine.earTag,
                    alertType: 'warning',
                    message: `Velocidad inusual detectada: ${maxSpeed.toFixed(1)} km/h`,
                    details: `El bovino ha alcanzado una velocidad de ${maxSpeed.toFixed(1)} km/h, lo que podría indicar estrés o emergencia.`,
                    location: { latitude: tracking.latitude, longitude: tracking.longitude },
                    speed: maxSpeed,
                    threshold: ANOMALY_THRESHOLDS.MAX_NORMAL_SPEED
                },
                metadata: {
                    bovineId: tracking.bovineId,
                    ranchId: bovine.ranchId,
                    source: 'tracking_service',
                    category: 'health',
                    tags: ['high_speed', 'alert']
                }
            }));

            await this.notificationService.sendBulkNotifications(notifications);

        } catch (error) {
            logger.error(`Error enviando alertas de alta velocidad`, this.context, {
                bovineId: tracking.bovineId
            }, ensureError(error));
        }
    }

    /**
     * Envía alertas específicas de batería baja
     */
    private async sendLowBatteryAlerts(
        anomalies: Anomaly[],
        tracking: BovineTracking,
        bovine: Bovine
    ): Promise<void> {
        try {
            if (!tracking.deviceId) return;

            const batteryLevel = anomalies[0]?.value || 0;
            const severity = batteryLevel < 5 ? 'critical' : 'warning';

            await this.notificationService.sendHealthAlert({
                bovineId: tracking.bovineId,
                bovineEarTag: bovine.earTag,
                alertType: batteryLevel < 5 ? 'critical' : 'warning',
                message: `Batería baja en dispositivo: ${batteryLevel}%`,
                details: `El dispositivo del bovino tiene batería baja (${batteryLevel}%).`,
                ranchId: bovine.ranchId!,
                location: { latitude: tracking.latitude, longitude: tracking.longitude }
            });

        } catch (error) {
            logger.error(`Error enviando alerta de batería baja`, this.context, {
                bovineId: tracking.bovineId,
                deviceId: tracking.deviceId
            }, ensureError(error));
        }
    }

    /**
     * Mapea el tipo de anomalía al tipo de alerta de notificaciones
     */
    private mapAnomalyToAlertType(anomalyType: string): 'unusual_movement' | 'device_offline' | 'geofence_violation' {
        const map: Record<string, 'unusual_movement' | 'device_offline' | 'geofence_violation'> = {
            'HIGH_SPEED': 'unusual_movement',
            'LOW_BATTERY': 'device_offline',
            'IMMOBILITY': 'geofence_violation',
            'DEVICE_OFFLINE': 'device_offline'
        };
        return map[anomalyType] || 'geofence_violation';
    }

    

    //METODOS RESCATADOS DE VERSIONES ANTERIORES (POR SI SE NECESITAN EN EL FUTURO)
    /**
 * Crea una nueva geofence (zona geográfica) asociada a un rancho.
 * @param data - Datos de la geofence
 * @returns La geofence creada (registro en Location)
 */
    async createGeofence(data: {
        name: string;
        description?: string;
        type: GeofenceType;
        coordinates: Coordinates[];
        center?: Coordinates;
        radius?: number;
        ranchId: string;
        createdBy: string;
        alertsEnabled?: boolean;
    }): Promise<Location> {
        const transaction = await sequelize.transaction();
        try {
            const center = data.center || this.calculateCentroid(data.coordinates);
            const geofenceConfig = {
                type: data.type,
                center,
                radius: data.radius,
                coordinates: data.coordinates,
                isActive: true,
                priority: 'MEDIUM' as const,
                alertTriggers: [AlertTrigger.ENTRY, AlertTrigger.EXIT],
                alertRecipients: []
            };


            // Construir geometría como punto GeoJSON
            const geom: Geometry = {
                type: 'Point',
                coordinates: [center.longitude, center.latitude]
            };

            const locationCode = `GF_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            const geofence = await Location.create({
                locationCode,
                name: data.name,
                type: LocationType.SAFE_ZONE, // o RESTRICTED_AREA según necesidad
                status: LocationStatus.ACTIVE,
                coordinates: center,
                geom,
                geofenceConfig,
                isActive: true,
                ranchId: data.ranchId,
                createdBy: data.createdBy
            }, { transaction });

            await transaction.commit();
            return geofence;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
 * Verifica si la ubicación actual del bovino activa alguna geofence y envía alertas.
 * Se llama automáticamente después de registrar una ubicación.
 */
    private async checkGeofenceAlerts(
        tracking: BovineTracking,
        bovine: Bovine
    ): Promise<void> {
        try {
            // Obtener todas las geofences activas del rancho
            const geofences = await Location.findAll({
                where: {
                    ranchId: bovine.ranchId,
                    isActive: true,
                    type: { [Op.in]: [LocationType.SAFE_ZONE, LocationType.RESTRICTED_AREA] },
                    geofenceConfig: { [Op.ne]: null as any }
                }
            });

            for (const geofence of geofences) {
                const isInside = this.isPointInsideGeofence(
                    { latitude: tracking.latitude, longitude: tracking.longitude },
                    geofence
                );

                // Aquí puedes implementar lógica para detectar entradas/salidas
                // Necesitarías guardar el estado anterior (por ejemplo, en memoria o en una tabla de estados)
                // Por simplicidad, generamos alerta si está dentro de una zona restringida.
                if (geofence.type === LocationType.RESTRICTED_AREA && isInside) {
                    // Enviar notificación
                    await this.notificationService.sendGeofenceAlert({
                        bovineId: bovine.id,
                        bovineEarTag: bovine.earTag,
                        geofenceId: geofence.id,
                        geofenceName: geofence.name,
                        event: 'entry',
                        location: { latitude: tracking.latitude, longitude: tracking.longitude },
                        ranchId: bovine.ranchId!
                    });
                    logger.warn(`Geofence violación: bovino ${bovine.id} en ${geofence.name}`);
                }
            }
        } catch (error) {
            logger.error('Error verificando geofence alerts', this.context, { error });
        }
    }

    /**
 * Busca bovinos dentro de un radio alrededor de un punto central.
 * @param center - Centro del radio
 * @param radiusKm - Radio en kilómetros
 * @param ranchId - ID del rancho (opcional)
 * @returns Lista de bovinos con distancia y ubicación
 */
    async findBovinesInRadius(
        center: { lat: number; lng: number },
        radiusKm: number,
        ranchId?: string
    ): Promise<Array<{ bovineId: string; earTag: string; distance: number; location: { lat: number; lng: number } }>> {
        try {
            // Obtener la última ubicación de cada bovino (usando DISTINCT ON)
            const latestTrackings = await sequelize.query(`
      SELECT DISTINCT ON (bovine_id) bovine_id, latitude, longitude, recorded_at
      FROM bovine_tracking
      WHERE recorded_at = (
        SELECT MAX(recorded_at) FROM bovine_tracking bt2 WHERE bt2.bovine_id = bovine_tracking.bovine_id
      )
      ${ranchId ? `AND bovine_id IN (SELECT id FROM bovines WHERE ranch_id = :ranchId AND is_active = true)` : ''}
      ORDER BY bovine_id, recorded_at DESC
    `, {
                replacements: { ranchId },
                type: 'SELECT'
            });

            const results = [];
            for (const point of latestTrackings as any[]) {
                const distance = haversineDistance(
                    center.lat, center.lng,
                    point.latitude, point.longitude
                );
                if (distance <= radiusKm) {
                    const bovine = await Bovine.findByPk(point.bovine_id, { attributes: ['earTag'] });
                    results.push({
                        bovineId: point.bovine_id,
                        earTag: bovine?.earTag || 'Desconocido',
                        distance,
                        location: { lat: point.latitude, lng: point.longitude }
                    });
                }
            }
            return results.sort((a, b) => a.distance - b.distance);
        } catch (error) {
            logger.error('Error en findBovinesInRadius', this.context, { error });
            throw error;
        }
    }
    /**
 * Calcula el centroide (punto medio) de un conjunto de coordenadas.
 * @param points - Array de puntos geográficos
 * @returns Coordenadas del centroide
 */
    private calculateCentroid(points: Coordinates[]): Coordinates {
        if (points.length === 0) {
            return { latitude: 0, longitude: 0 };
        }
        const sum = points.reduce(
            (acc, p) => ({
                latitude: acc.latitude + p.latitude,
                longitude: acc.longitude + p.longitude
            }),
            { latitude: 0, longitude: 0 }
        );
        return {
            latitude: sum.latitude / points.length,
            longitude: sum.longitude / points.length
        };
    }

    private isPointInsideGeofence(point: Coordinates, geofence: Location): boolean {
        const config = geofence.geofenceConfig;
        if (!config || !config.isActive) return false;

        const { type, center, radius, coordinates: polygonCoords, boundingBox } = config;

        switch (type) {
            case GeofenceType.CIRCULAR:
                if (!center || !radius) return false;
                const distance = this.haversineDistance(
                    { lat: center.latitude, lng: center.longitude },
                    { lat: point.latitude, lng: point.longitude }
                );
                return distance <= radius / 1000;

            case GeofenceType.RECTANGULAR:
                if (!boundingBox) return false;
                return point.latitude >= boundingBox.south &&
                    point.latitude <= boundingBox.north &&
                    point.longitude >= boundingBox.west &&
                    point.longitude <= boundingBox.east;

            case GeofenceType.POLYGON:
                if (!polygonCoords || polygonCoords.length < 3) return false;
                return this.isPointInPolygon(point, polygonCoords);

            default:
                return false;
        }
    }

    private isPointInPolygon(point: Coordinates, polygon: Coordinates[]): boolean {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].latitude, yi = polygon[i].longitude;
            const xj = polygon[j].latitude, yj = polygon[j].longitude;
            const intersect = ((yi > point.longitude) !== (yj > point.longitude)) &&
                (point.latitude < (xj - xi) * (point.longitude - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
 * Obtiene estadísticas geoespaciales del rancho.
 * @param ranchId - ID del rancho
 * @param days - Período en días (por defecto 30)
 */
    async getGeoStatistics(ranchId: string, days: number = 30): Promise<{
        totalLocations: number;
        averageAccuracy: number;
        coverageArea: number;
        mostActiveHours: Array<{ hour: number; count: number }>;
        deviceUptime: number;
        locationsBySource: Record<string, number>;
        geofenceViolations: number;
        averageMovementSpeed: number;
    }> {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            // 1. Total de ubicaciones en el período
            const totalLocations = await BovineTracking.count({
                include: [{
                    model: Bovine,
                    as: 'bovine',
                    attributes: [],
                    required: true,
                    where: { ranchId }
                }],
                where: { recordedAt: { [Op.gte]: startDate } }
            });

            // 2. Precisión promedio
            const accuracyResult = await BovineTracking.findOne({
                attributes: [[sequelize.fn('AVG', sequelize.col('accuracy')), 'avgAccuracy']],
                include: [{
                    model: Bovine,
                    as: 'bovine',
                    attributes: [],
                    required: true,
                    where: { ranchId }
                }],
                where: { recordedAt: { [Op.gte]: startDate }, accuracy: { [Op.ne]: null } as any },
                raw: true
            });
            const averageAccuracy = (accuracyResult as any)?.avgAccuracy || 0;

            // 3. Área cubierta (bounding box)
            const minMax = await BovineTracking.findOne({
                attributes: [
                    [sequelize.fn('MIN', sequelize.col('latitude')), 'minLat'],
                    [sequelize.fn('MAX', sequelize.col('latitude')), 'maxLat'],
                    [sequelize.fn('MIN', sequelize.col('longitude')), 'minLng'],
                    [sequelize.fn('MAX', sequelize.col('longitude')), 'maxLng']
                ],
                include: [{
                    model: Bovine,
                    as: 'bovine',
                    attributes: [],
                    required: true,
                    where: { ranchId }
                }],
                where: { recordedAt: { [Op.gte]: startDate } },
                raw: true
            });
            const bounds = minMax as any;
            const coverageArea = this.calculateBoundingBoxArea(bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng);

            // 4. Horas más activas
            const hourStats = await BovineTracking.findAll({
                attributes: [
                    [sequelize.fn('EXTRACT', sequelize.literal('HOUR FROM recorded_at')), 'hour'],
                    [sequelize.fn('COUNT', '*'), 'count']
                ],
                include: [{
                    model: Bovine,
                    as: 'bovine',
                    attributes: [],
                    required: true,
                    where: { ranchId }
                }],
                where: { recordedAt: { [Op.gte]: startDate } },
                group: [sequelize.literal('hour')] as any,
                order: [[sequelize.literal('count'), 'DESC']],
                raw: true
            });
            const mostActiveHours = (hourStats as any[]).slice(0, 5).map(h => ({
                hour: parseInt(h.hour),
                count: parseInt(h.count)
            }));

            // 5. Uptime de dispositivos
            const bovines = await Bovine.findAll({
                where: { ranchId, isActive: true },
                attributes: ['trackingConfig']
            });
            const devicesWithTracking = bovines.filter(b => b.trackingConfig?.isEnabled === true).length;
            const deviceUptime = bovines.length ? (devicesWithTracking / bovines.length) * 100 : 0;

            // 6. Ubicaciones por fuente (GPS, MANUAL, ESTIMATED) – asumimos que todas son GPS
            const sourceStats = await BovineTracking.findAll({
                attributes: [
                    'source',
                    [sequelize.fn('COUNT', '*'), 'count']
                ],
                include: [{
                    model: Bovine,
                    as: 'bovine',
                    attributes: [],
                    required: true,
                    where: { ranchId }
                }],
                where: { recordedAt: { [Op.gte]: startDate } },
                group: ['source'],
                raw: true
            });
            const locationsBySource: Record<string, number> = {
                GPS: 0,
                MANUAL: 0,
                ESTIMATED: 0
            };
            (sourceStats as any[]).forEach(stat => {
                locationsBySource[stat.source] = parseInt(stat.count);
            });

            // 7. Violaciones de geofence (puedes contar desde eventos de alerta, aquí es mock)
            const geofenceViolations = 0;

            // 8. Velocidad promedio
            const avgSpeedResult = await BovineTracking.findOne({
                attributes: [[sequelize.fn('AVG', sequelize.col('speed')), 'avgSpeed']],
                include: [{
                    model: Bovine,
                    as: 'bovine',
                    attributes: [],
                    required: true,
                    where: { ranchId }
                }],
                where: { recordedAt: { [Op.gte]: startDate }, speed: { [Op.ne]: null } as any },
                raw: true
            });
            const averageMovementSpeed = (avgSpeedResult as any)?.avgSpeed || 0;

            return {
                totalLocations,
                averageAccuracy,
                coverageArea,
                mostActiveHours,
                deviceUptime,
                locationsBySource,
                geofenceViolations,
                averageMovementSpeed
            };
        } catch (error) {
            logger.error('Error obteniendo geoestadísticas', this.context, { error });
            throw error;
        }
    }

    private calculateBoundingBoxArea(minLat: number, maxLat: number, minLng: number, maxLng: number): number {
        // Área aproximada en km² usando simplificación: (dif lat * 111) * (dif lng * 111 * cos(lat medio))
        const latDiff = Math.abs(maxLat - minLat);
        const lngDiff = Math.abs(maxLng - minLng);
        const midLat = (minLat + maxLat) / 2;
        const latKm = latDiff * 111;
        const lngKm = lngDiff * 111 * Math.cos(toRadians(midLat));
        return Math.abs(latKm * lngKm);
    }

    /**
 * Obtiene los veterinarios asociados a un rancho.
 * @param ranchId - ID del rancho
 * @returns Lista de usuarios con rol veterinario y acceso al rancho
 */
    private async getVeterinariansForRanch(ranchId: string): Promise<any[]> {
        try {
            // Buscar usuarios con rol VETERINARIAN que tengan acceso a este rancho
            const veterinarians = await User.findAll({
                where: {
                    role: UserRole.VETERINARIAN,
                    isActive: true,
                    status: UserStatus.ACTIVE
                },
                attributes: ['id', 'email', 'personalInfo', 'contactInfo']
            });

            // Filtrar aquellos que tienen acceso al rancho específico
            const filtered = veterinarians.filter(user => {
                // Verificar si el usuario tiene acceso al rancho
                if (!user.ranchAccess) return false;
                const access = user.ranchAccess.find(
                    (access: any) => access.ranchId === ranchId && access.isActive === true
                );
                return !!access;
            });

            return filtered.map(v => ({
                id: v.id,
                email: v.email,
                name: v.personalInfo?.firstName + ' ' + v.personalInfo?.lastName,
                phone: v.contactInfo?.primaryPhone
            }));
        } catch (error) {
            logger.error(`Error obteniendo veterinarios para rancho ${ranchId}`, this.context, { ranchId }, ensureError(error));
            return [];
        }
    }

    /**
     * Obtiene los administradores (managers) asociados a un rancho.
     * @param ranchId - ID del rancho
     * @returns Lista de usuarios con rol manager y acceso al rancho
     */
    private async getRanchManagers(ranchId: string): Promise<any[]> {
        try {
            // Buscar usuarios con rol MANAGER o RANCH_MANAGER que tengan acceso a este rancho
            const managers = await User.findAll({
                where: {
                    role: { [Op.in]: [UserRole.MANAGER, UserRole.RANCH_MANAGER] },
                    isActive: true,
                    status: UserStatus.ACTIVE
                },
                attributes: ['id', 'email', 'personalInfo', 'contactInfo']
            });

            // Filtrar aquellos que tienen acceso al rancho específico
            const filtered = managers.filter(user => {
                if (!user.ranchAccess) return false;
                const access = user.ranchAccess.find(
                    (access: any) => access.ranchId === ranchId && access.isActive === true
                );
                return !!access;
            });

            return filtered.map(m => ({
                id: m.id,
                email: m.email,
                name: m.personalInfo?.firstName + ' ' + m.personalInfo?.lastName,
                phone: m.contactInfo?.primaryPhone
            }));
        } catch (error) {
            logger.error(`Error obteniendo managers para rancho ${ranchId}`, this.context, { ranchId }, ensureError(error));
            return [];
        }
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const bovineTrackingService = new BovineTrackingService();