// controllers/bovine-tracking.controller.ts
import { Request, Response } from 'express';
import { bovineTrackingService } from '../services/BovineTrackingService';
import { BovineError } from '../utils/BovineErrors';
import logger from '../utils/logger';

export class BovineTrackingController {
    private readonly context = 'BovineTrackingController';

    constructor() {
        this.recordLocation = this.recordLocation.bind(this);
        this.recordBatchLocations = this.recordBatchLocations.bind(this);
        this.getLastLocation = this.getLastLocation.bind(this);
        this.getLocationHistory = this.getLocationHistory.bind(this);
        this.getMovementPath = this.getMovementPath.bind(this);
        this.getMovementStats = this.getMovementStats.bind(this);
        this.calculateDistance = this.calculateDistance.bind(this);
        this.getDeviceStatus = this.getDeviceStatus.bind(this);
        this.websocketInfo = this.websocketInfo.bind(this);
        this.createGeofence = this.createGeofence.bind(this);
        this.findBovinesInRadius = this.findBovinesInRadius.bind(this);
        this.getGeoStatistics = this.getGeoStatistics.bind(this);
    }

    /**
     * POST /api/bovines/tracking/location
     * Registra un nuevo punto de ubicación
     */
    async recordLocation(req: Request, res: Response): Promise<void> {
        try {
            const tracking = await bovineTrackingService.recordLocation(req.body);

            res.status(201).json({
                success: true,
                data: tracking,
                message: 'Ubicación registrada exitosamente'
            });

        } catch (error) {
            logger.error('Error en recordLocation', this.context, { body: req.body }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * POST /api/bovines/tracking/batch
     * Registra múltiples ubicaciones en lote
     */
    async recordBatchLocations(req: Request, res: Response): Promise<void> {
        try {
            const { points } = req.body;

            if (!Array.isArray(points)) {
                res.status(400).json({
                    success: false,
                    error: 'Se requiere un array de puntos'
                });
                return;
            }

            const result = await bovineTrackingService.recordBatchLocations(points);

            res.status(201).json({
                success: true,
                data: result,
                message: `${result.successful} ubicaciones registradas exitosamente`
            });

        } catch (error) {
            logger.error('Error en recordBatchLocations', this.context, { body: req.body }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * GET /api/bovines/:bovineId/tracking/last
     * Obtiene la última ubicación de un bovino
     */
    async getLastLocation(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;

            const location = await bovineTrackingService.getLastLocation(bovineId);

            if (!location) {
                res.status(404).json({
                    success: false,
                    error: 'No hay ubicaciones registradas para este bovino'
                });
                return;
            }

            res.json({
                success: true,
                data: location
            });

        } catch (error) {
            logger.error('Error en getLastLocation', this.context, { params: req.params }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * GET /api/bovines/:bovineId/tracking/history
     * Obtiene el historial de ubicaciones de un bovino
     */
    async getLocationHistory(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;
            const { startDate, endDate, maxPoints } = req.query;

            if (!startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    error: 'Se requieren startDate y endDate'
                });
                return;
            }

            const history = await bovineTrackingService.getLocationHistory(
                bovineId,
                new Date(startDate as string),
                new Date(endDate as string),
                { maxPoints: maxPoints ? parseInt(maxPoints as string) : undefined }
            );

            res.json({
                success: true,
                data: history,
                count: history.length
            });

        } catch (error) {
            logger.error('Error en getLocationHistory', this.context, { params: req.params, query: req.query }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * GET /api/bovines/:bovineId/tracking/path
     * Obtiene la ruta de movimiento para animación
     */
    async getMovementPath(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    error: 'Se requieren startDate y endDate'
                });
                return;
            }

            const path = await bovineTrackingService.getMovementPath(
                bovineId,
                new Date(startDate as string),
                new Date(endDate as string)
            );

            res.json({
                success: true,
                data: path
            });

        } catch (error) {
            logger.error('Error en getMovementPath', this.context, { params: req.params, query: req.query }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * GET /api/bovines/:bovineId/tracking/stats
     * Obtiene estadísticas de movimiento
     */
    async getMovementStats(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;
            const { date } = req.query;

            if (!date) {
                res.status(400).json({
                    success: false,
                    error: 'Se requiere fecha'
                });
                return;
            }

            const stats = await bovineTrackingService.getMovementStats(
                bovineId,
                new Date(date as string)
            );

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            logger.error('Error en getMovementStats', this.context, { params: req.params, query: req.query }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * GET /api/bovines/tracking/distance/:bovineId
     * Calcula distancia recorrida en un período
     */
    async calculateDistance(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    error: 'Se requieren startDate y endDate'
                });
                return;
            }

            const distance = await bovineTrackingService.calculateTotalDistance(
                bovineId,
                new Date(startDate as string),
                new Date(endDate as string)
            );

            res.json({
                success: true,
                data: {
                    bovineId,
                    distance,
                    unit: 'km'
                }
            });

        } catch (error) {
            logger.error('Error en calculateDistance', this.context, { params: req.params, query: req.query }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * GET /api/bovines/tracking/device/:deviceId/status
     * Obtiene estado de un dispositivo
     */
    async getDeviceStatus(req: Request, res: Response): Promise<void> {
        try {
            const { deviceId } = req.params;

            const status = await bovineTrackingService.getDeviceStatus(deviceId);

            res.json({
                success: true,
                data: status
            });

        } catch (error) {
            logger.error('Error en getDeviceStatus', this.context, { params: req.params }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * GET /api/bovines/tracking/ws
     * Endpoint para WebSocket (no REST)
     * Este método es para documentación, el WebSocket se maneja aparte
     */
    async websocketInfo(req: Request, res: Response): Promise<void> {
        res.json({
            success: true,
            data: {
                message: 'Conexión WebSocket disponible en /ws',
                events: [
                    'LOCATION_UPDATE - Actualización de ubicación en tiempo real',
                    'ANOMALY_DETECTED - Anomalía detectada'
                ]
            }
        });
    }

    // ==========================================================================
    // GEOFENCING
    // ==========================================================================

    /**
     * POST /api/bovines/tracking/geofence
     * Crea una nueva geofence
     */
    async createGeofence(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'No autenticado'
                });
                return;
            }

            const geofence = await bovineTrackingService.createGeofence({
                ...req.body,
                createdBy: userId
            });

            res.status(201).json({
                success: true,
                data: geofence,
                message: 'Geofence creada exitosamente'
            });

        } catch (error) {
            logger.error('Error en createGeofence', this.context, { body: req.body }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    // ==========================================================================
    // BÚSQUEDA POR RADIO
    // ==========================================================================

    /**
     * GET /api/bovines/tracking/radius
     * Busca bovinos dentro de un radio alrededor de un punto central
     * 
     * Query params:
     * - lat: Latitud del centro (requerido)
     * - lng: Longitud del centro (requerido)
     * - radiusKm: Radio en kilómetros (requerido)
     * - ranchId: ID del rancho (opcional)
     */
    async findBovinesInRadius(req: Request, res: Response): Promise<void> {
        try {
            const { lat, lng, radiusKm, ranchId } = req.query;

            if (!lat || !lng || !radiusKm) {
                res.status(400).json({
                    success: false,
                    error: 'Se requieren los parámetros: lat, lng, radiusKm'
                });
                return;
            }

            const latNum = parseFloat(lat as string);
            const lngNum = parseFloat(lng as string);
            const radiusNum = parseFloat(radiusKm as string);

            if (isNaN(latNum) || isNaN(lngNum) || isNaN(radiusNum)) {
                res.status(400).json({
                    success: false,
                    error: 'lat, lng y radiusKm deben ser números válidos'
                });
                return;
            }

            const results = await bovineTrackingService.findBovinesInRadius(
                { lat: latNum, lng: lngNum },
                radiusNum,
                ranchId as string
            );

            res.json({
                success: true,
                data: results,
                count: results.length
            });

        } catch (error) {
            logger.error('Error en findBovinesInRadius', this.context, { query: req.query }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    // ==========================================================================
    // ESTADÍSTICAS GEOESPACIALES
    // ==========================================================================

    /**
     * GET /api/bovines/tracking/geo-stats/:ranchId
     * Obtiene estadísticas geoespaciales de un rancho
     * 
     * Query params:
     * - days: Período en días (opcional, por defecto 30)
     */
    async getGeoStatistics(req: Request, res: Response): Promise<void> {
        try {
            const { ranchId } = req.params;
            const { days } = req.query;

            const daysNum = days ? parseInt(days as string) : 30;

            if (isNaN(daysNum)) {
                res.status(400).json({
                    success: false,
                    error: 'days debe ser un número válido'
                });
                return;
            }

            const stats = await bovineTrackingService.getGeoStatistics(ranchId, daysNum);

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            logger.error('Error en getGeoStatistics', this.context, { params: req.params, query: req.query }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    
}

export const bovineTrackingController = new BovineTrackingController();