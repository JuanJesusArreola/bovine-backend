// controllers/bovine-health.controller.ts
import { Request, Response } from 'express';
import { bovineHealthService } from '../services/BovineHealthService';
import { BovineError } from '../utils/BovineErrors';
import logger from '../utils/logger';

export class BovineHealthController {
    private readonly context = 'BovineHealthController';

    constructor() {
        this.recordHealthCheck = this.recordHealthCheck.bind(this);
        this.needsHealthCheck = this.needsHealthCheck.bind(this);
        this.scheduleNextHealthCheck = this.scheduleNextHealthCheck.bind(this);
        this.updateHealthStatus = this.updateHealthStatus.bind(this);
        this.getHealthHistory = this.getHealthHistory.bind(this);
        this.getHerdHealthStats = this.getHerdHealthStats.bind(this);
        this.getHealthTimeline = this.getHealthTimeline.bind(this);
    }

    /**
     * POST /api/bovines/health/check
     * Registra un chequeo de salud
     */
    async recordHealthCheck(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            const healthRecord = await bovineHealthService.recordHealthCheck(req.body, userId);

            res.status(201).json({
                success: true,
                data: healthRecord,
                message: 'Chequeo de salud registrado exitosamente'
            });

        } catch (error) {
            logger.error('Error en recordHealthCheck', this.context, { body: req.body }, error as Error);
            
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
     * GET /api/bovines/:bovineId/health/needs-check
     * Verifica si un bovino necesita chequeo
     */
    async needsHealthCheck(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;
            
            const needsCheck = await bovineHealthService.needsHealthCheck(bovineId);

            res.json({
                success: true,
                data: { 
                    bovineId, 
                    needsCheck 
                }
            });

        } catch (error) {
            logger.error('Error en needsHealthCheck', this.context, { params: req.params }, error as Error);
            
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
     * POST /api/bovines/:bovineId/health/schedule-next
     * Programa el próximo chequeo de salud
     */
    async scheduleNextHealthCheck(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            await bovineHealthService.scheduleNextHealthCheck(bovineId, userId);

            res.json({
                success: true,
                message: 'Próximo chequeo programado exitosamente'
            });

        } catch (error) {
            logger.error('Error en scheduleNextHealthCheck', this.context, { params: req.params }, error as Error);
            
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
     * PUT /api/bovines/:bovineId/health/status
     * Actualiza el estado de salud de un bovino
     */
    async updateHealthStatus(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;
            const { healthStatus, reason } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            await bovineHealthService.updateHealthStatus(
                bovineId,
                healthStatus,
                userId,
                reason
            );

            res.json({
                success: true,
                message: `Estado de salud actualizado a ${healthStatus}`
            });

        } catch (error) {
            logger.error('Error en updateHealthStatus', this.context, { params: req.params, body: req.body }, error as Error);
            
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
     * GET /api/bovines/:bovineId/health/history
     * Obtiene el historial de salud de un bovino
     */
    async getHealthHistory(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;
            const { startDate, endDate, limit } = req.query;

            const filters = {
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                limit: limit ? parseInt(limit as string) : undefined
            };

            const history = await bovineHealthService.getHealthHistory(bovineId, filters);

            res.json({
                success: true,
                data: history,
                count: history.length
            });

        } catch (error) {
            logger.error('Error en getHealthHistory', this.context, { params: req.params, query: req.query }, error as Error);
            
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
     * GET /api/bovines/health/stats/:ranchId
     * Obtiene estadísticas de salud del hato
     */
    async getHerdHealthStats(req: Request, res: Response): Promise<void> {
        try {
            const { ranchId } = req.params;

            const stats = await bovineHealthService.getHerdHealthStats(ranchId);

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            logger.error('Error en getHerdHealthStats', this.context, { params: req.params }, error as Error);
            
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
     * GET /api/bovines/:bovineId/health/timeline
     * Obtiene línea de tiempo de salud para gráficos
     */
    async getHealthTimeline(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;
            const { days } = req.query;

            const timeline = await bovineHealthService.getHealthTimeline(
                bovineId,
                days ? parseInt(days as string) : 30
            );

            res.json({
                success: true,
                data: timeline
            });

        } catch (error) {
            logger.error('Error en getHealthTimeline', this.context, { params: req.params, query: req.query }, error as Error);
            
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

export const bovineHealthController = new BovineHealthController();