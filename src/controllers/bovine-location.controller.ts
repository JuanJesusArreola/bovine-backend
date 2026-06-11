// controllers/bovine-location.controller.ts
import { Request, Response } from 'express';
import { bovineLocationService } from '../services/BovineLocationService';
import { BovineError } from '../utils/BovineErrors';
import logger from '../utils/logger';

export class BovineLocationController {
    private readonly context = 'BovineLocationController';

    constructor() {
        this.recordEntry = this.recordEntry.bind(this);
        this.recordExit = this.recordExit.bind(this);
        this.getCurrentLocation = this.getCurrentLocation.bind(this);
        this.getCurrentBovinesAtLocation = this.getCurrentBovinesAtLocation.bind(this);
        this.getLocationHistory = this.getLocationHistory.bind(this);
        this.getTimeSpentPerLocation = this.getTimeSpentPerLocation.bind(this);
        this.generateMovementReport = this.generateMovementReport.bind(this);
        this.getPastureUtilization = this.getPastureUtilization.bind(this);
    }

    /**
     * POST /api/bovines/location/entry
     * Registra entrada a una ubicación
     */
    async recordEntry(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            const entry = await bovineLocationService.recordEntry({
                ...req.body,
                recordedBy: userId
            });

            res.status(201).json({
                success: true,
                data: entry,
                message: 'Entrada registrada exitosamente'
            });

        } catch (error) {
            logger.error('Error en recordEntry', this.context, { body: req.body }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code,
                    ...((error as any).details ? { details: (error as any).details } : {}),
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
     * POST /api/bovines/location/exit
     * Registra salida de una ubicación
     */
    async recordExit(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId, notes } = req.body;

            const exit = await bovineLocationService.recordExit({
                bovineId,
                notes
            });

            if (!exit) {
                res.status(404).json({
                    success: false,
                    error: 'No hay entrada activa para este bovino'
                });
                return;
            }

            res.json({
                success: true,
                data: exit,
                message: 'Salida registrada exitosamente'
            });

        } catch (error) {
            logger.error('Error en recordExit', this.context, { body: req.body }, error as Error);

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
     * GET /api/bovines/:bovineId/location/current
     * Obtiene ubicación actual de un bovino
     */
    async getCurrentLocation(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;

            const currentLocation = await bovineLocationService.getCurrentLocation(bovineId);

            if (!currentLocation) {
                res.status(404).json({
                    success: false,
                    error: 'El bovino no está en ninguna ubicación'
                });
                return;
            }

            res.json({
                success: true,
                data: currentLocation
            });

        } catch (error) {
            logger.error('Error en getCurrentLocation', this.context, { params: req.params }, error as Error);

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
     * GET /api/bovines/:id/current-location
     * Versión CONSOLIDADA: combina stay activa + último GPS.
     * No retorna 404 si no hay ubicación: devuelve status UNKNOWN.
     * Sí retorna 404 si el bovino no existe.
     */
    async getCurrentLocationConsolidated(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const data = await bovineLocationService.getCurrentLocationConsolidated(id);
            res.json({ success: true, data });
        } catch (error) {
            logger.error('Error en getCurrentLocationConsolidated', this.context, { params: req.params }, error as Error);
            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code,
                });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * GET /api/bovines/location/:locationId/current
     * Lista bovinos actualmente en una ubicación
     */
    async getCurrentBovinesAtLocation(req: Request, res: Response): Promise<void> {
        try {
            const { locationId } = req.params;

            const bovines = await bovineLocationService.getCurrentBovinesAtLocation(locationId);

            res.json({
                success: true,
                data: bovines,
                count: bovines.length
            });

        } catch (error) {
            logger.error('Error en getCurrentBovinesAtLocation', this.context, { params: req.params }, error as Error);

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
     * GET /api/bovines/:bovineId/location/history
     * Obtiene historial de ubicaciones de un bovino
     */
    async getLocationHistory(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;
            const { startDate, endDate, limit } = req.query;

            const history = await bovineLocationService.getLocationHistory(
                bovineId,
                startDate ? new Date(startDate as string) : undefined,
                endDate ? new Date(endDate as string) : undefined,
                limit ? parseInt(limit as string) : undefined
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
     * GET /api/bovines/:bovineId/location/time-spent
     * Calcula tiempo pasado en cada ubicación
     */
    async getTimeSpentPerLocation(req: Request, res: Response): Promise<void> {
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

            const reports = await bovineLocationService.getTimeSpentPerLocation(
                bovineId,
                new Date(startDate as string),
                new Date(endDate as string)
            );

            res.json({
                success: true,
                data: reports
            });

        } catch (error) {
            logger.error('Error en getTimeSpentPerLocation', this.context, { params: req.params, query: req.query }, error as Error);

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
     * GET /api/bovines/location/report/movements/:ranchId
     * Genera reporte de movimientos del rancho
     */
    async generateMovementReport(req: Request, res: Response): Promise<void> {
        try {
            const { ranchId } = req.params;
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    error: 'Se requieren startDate y endDate'
                });
                return;
            }

            const report = await bovineLocationService.generateMovementReport(
                ranchId,
                new Date(startDate as string),
                new Date(endDate as string)
            );

            res.json({
                success: true,
                data: report
            });

        } catch (error) {
            logger.error('Error en generateMovementReport', this.context, { params: req.params, query: req.query }, error as Error);

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
     * GET /api/bovines/location/report/pasture/:ranchId
     * Obtiene reporte de utilización de potreros
     */
    async getPastureUtilization(req: Request, res: Response): Promise<void> {
        try {
            const { ranchId } = req.params;
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    error: 'Se requieren startDate y endDate'
                });
                return;
            }

            const utilization = await bovineLocationService.getPastureUtilization(
                ranchId,
                new Date(startDate as string),
                new Date(endDate as string)
            );

            res.json({
                success: true,
                data: utilization
            });

        } catch (error) {
            logger.error('Error en getPastureUtilization', this.context, { params: req.params, query: req.query }, error as Error);

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

    async updateLocation(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const data = req.body;
            const userId = req.user?.id;

            const result = await bovineLocationService.updateLocation(id, data, userId);

            // L-04: exponer wasNoOp/locationChanged para que el FE no compare en cliente
            return res.status(200).json({
                success: true,
                data: result.bovine,
                wasNoOp: result.wasNoOp,
                locationChanged: result.locationChanged,
            });
        } catch (error) {
            logger.error('Error en updateLocation', this.context, { params: req.params, query: req.query }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code,
                    // L-01: detalles de capacidad para BOVINE_LOCATION_FULL
                    ...((error as any).details ? { details: (error as any).details } : {}),
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

export const bovineLocationController = new BovineLocationController();