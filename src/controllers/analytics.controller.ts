// controllers/analytics.controller.ts
import { Request, Response } from 'express';
import { analyticsService } from '../services/analytics/';
import { BovineError } from '../utils/BovineErrors';
import logger from '../utils/logger';
import { HealthStatus } from '../models/Bovine';
import { UserRole } from '../models/User';
import { dashboardService } from '../services/analytics/DashboardService';

export class AnalyticsController {
    private readonly context = 'AnalyticsController';

    constructor() {
        this.getDashboard = this.getDashboard.bind(this);
        this.getMapData = this.getMapData.bind(this);
        this.getHeatmapStats = this.getHeatmapStats.bind(this);
        this.getWeightedHeatmap = this.getWeightedHeatmap.bind(this);
        this.getTemporalHeatmap = this.getTemporalHeatmap.bind(this);
        this.expandCluster = this.expandCluster.bind(this);
        this.getClusterStats = this.getClusterStats.bind(this);
        this.findNearbyClusters = this.findNearbyClusters.bind(this);
    }

    /**
     * GET /api/analytics/dashboard
     * Obtiene dashboard filtrado por rol del usuario autenticado.
     *
     * El servicio decide qué secciones incluir según el rol:
     * - SUPER_ADMIN/OWNER: todo + sección de usuarios
     * - RANCH_MANAGER: salud completa + producción + finanzas parciales
     * - MANAGER: salud resumida + producción + finanzas mínimas
     * - VETERINARIAN: salud completa + producción resumida, sin finanzas
     * - WORKER/VIEWER: resúmenes básicos, sin finanzas
     */
    async getDashboard(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user;
            const userRole = req.userRole;

            if (!user || !userRole) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            const { ranchId, period, startDate, endDate, compareWithPrevious } = req.query;

            if (!ranchId) {
                res.status(400).json({
                    success: false,
                    error: 'ranchId es requerido'
                });
                return;
            }

            const filters = {
                ranchId: ranchId as string,
                period: (period as 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom') || 'month',
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                compareWithPrevious: compareWithPrevious === 'true'
            };

            const dashboard = await dashboardService.getRoleDashboard(filters, {
                id: user.id,
                role: userRole,
                ranchAccess: user.ranchAccess?.filter(a => a.isActive)
            });

            res.json({
                success: true,
                data: dashboard
            });

        } catch (error) {
            logger.error('Error en getDashboard', this.context, { query: req.query }, error as Error);

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
     * POST /api/analytics/map
     * Obtiene datos para el mapa (clusters o heatmap según zoom)
     */
    async getMapData(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            const { ranchId, bounds, zoom, healthStatus, breeds, ageMin, ageMax } = req.body;

            if (!ranchId) {
                res.status(400).json({
                    success: false,
                    error: 'ranchId es requerido'
                });
                return;
            }

            if (!bounds || typeof zoom !== 'number') {
                res.status(400).json({
                    success: false,
                    error: 'bounds y zoom son requeridos'
                });
                return;
            }

            // Procesar filtros
            let healthStatusFilter: HealthStatus[] | undefined;
            if (healthStatus) {
                const statusStrings = (healthStatus as string).split(',');
                healthStatusFilter = statusStrings
                    .map(s => s.trim().toUpperCase())
                    .filter(s => Object.values(HealthStatus).includes(s as HealthStatus))
                    .map(s => s as HealthStatus);
            }

            let breedsFilter: string[] | undefined;
            if (breeds) {
                breedsFilter = (breeds as string).split(',').map(b => b.trim());
            }

            let ageRangeFilter: { min: number; max: number } | undefined;
            if (ageMin && ageMax) {
                const min = parseInt(ageMin as string);
                const max = parseInt(ageMax as string);
                if (!isNaN(min) && !isNaN(max) && min <= max) {
                    ageRangeFilter = { min, max };
                }
            }

            const filters = {
                ranchId: ranchId as string,
                bounds,
                zoom: zoom as number,
                healthStatus: healthStatusFilter,
                breeds: breedsFilter,
                ageRange: ageRangeFilter
            };

            const mapData = await analyticsService.getMapData(filters);

            res.json({
                success: true,
                data: mapData
            });

        } catch (error) {
            logger.error('Error en getMapData', this.context, { body: req.body }, error as Error);

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
     * GET /api/analytics/heatmap/stats
     * Obtiene estadísticas del heatmap
     */
    async getHeatmapStats(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            const { ranchId, healthStatus, breeds, ageMin, ageMax, startDate, endDate } = req.query;

            if (!ranchId) {
                res.status(400).json({
                    success: false,
                    error: 'ranchId es requerido'
                });
                return;
            }

            // Procesar filtros
            let healthStatusFilter: HealthStatus[] | undefined;
            if (healthStatus) {
                const statusStrings = (healthStatus as string).split(',');
                healthStatusFilter = statusStrings
                    .map(s => s.trim().toUpperCase())
                    .filter(s => Object.values(HealthStatus).includes(s as HealthStatus))
                    .map(s => s as HealthStatus);
            }

            let breedsFilter: string[] | undefined;
            if (breeds) {
                breedsFilter = (breeds as string).split(',').map(b => b.trim());
            }

            let ageRangeFilter: { min: number; max: number } | undefined;
            if (ageMin && ageMax) {
                const min = parseInt(ageMin as string);
                const max = parseInt(ageMax as string);
                if (!isNaN(min) && !isNaN(max) && min <= max) {
                    ageRangeFilter = { min, max };
                }
            }

            const filters = {
                ranchId: ranchId as string,
                healthStatus: healthStatusFilter,
                breeds: breedsFilter,
                ageRange: ageRangeFilter,
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                includeInactive: false
            };

            const stats = await analyticsService.getHeatmapStats(filters);

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            logger.error('Error en getHeatmapStats', this.context, { query: req.query }, error as Error);

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
     * POST /api/analytics/heatmap/weighted
     * Obtiene datos de heatmap ponderado (por peso, edad, producción)
     */
    async getWeightedHeatmap(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            const { ranchId, weightField, healthStatus, breeds, ageMin, ageMax } = req.body;

            if (!ranchId) {
                res.status(400).json({
                    success: false,
                    error: 'ranchId es requerido'
                });
                return;
            }

            if (!weightField || !['weight', 'age', 'production'].includes(weightField)) {
                res.status(400).json({
                    success: false,
                    error: 'weightField debe ser weight, age o production'
                });
                return;
            }

            // Procesar filtros
            let healthStatusFilter: HealthStatus[] | undefined;
            if (healthStatus) {
                const statusStrings = (healthStatus as string).split(',');
                healthStatusFilter = statusStrings
                    .map(s => s.trim().toUpperCase())
                    .filter(s => Object.values(HealthStatus).includes(s as HealthStatus))
                    .map(s => s as HealthStatus);
            }

            let breedsFilter: string[] | undefined;
            if (breeds) {
                breedsFilter = (breeds as string).split(',').map(b => b.trim());
            }

            let ageRangeFilter: { min: number; max: number } | undefined;
            if (ageMin && ageMax) {
                const min = parseInt(ageMin as string);
                const max = parseInt(ageMax as string);
                if (!isNaN(min) && !isNaN(max) && min <= max) {
                    ageRangeFilter = { min, max };
                }
            }

            const filters = {
                ranchId: ranchId as string,
                healthStatus: healthStatusFilter,
                breeds: breedsFilter,
                ageRange: ageRangeFilter,
                includeInactive: false
            };

            const points = await analyticsService.getWeightedHeatmapData(
                filters,
                weightField as 'weight' | 'age' | 'production'
            );

            res.json({
                success: true,
                data: points
            });

        } catch (error) {
            logger.error('Error en getWeightedHeatmap', this.context, { body: req.body }, error as Error);

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
     * POST /api/analytics/heatmap/temporal
     * Obtiene datos de heatmap para una fecha específica (histórico)
     */
    async getTemporalHeatmap(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            const { ranchId, date, healthStatus, breeds, ageMin, ageMax } = req.body;

            if (!ranchId) {
                res.status(400).json({
                    success: false,
                    error: 'ranchId es requerido'
                });
                return;
            }

            if (!date) {
                res.status(400).json({
                    success: false,
                    error: 'date es requerido'
                });
                return;
            }

            // Procesar filtros
            let healthStatusFilter: HealthStatus[] | undefined;
            if (healthStatus) {
                const statusStrings = (healthStatus as string).split(',');
                healthStatusFilter = statusStrings
                    .map(s => s.trim().toUpperCase())
                    .filter(s => Object.values(HealthStatus).includes(s as HealthStatus))
                    .map(s => s as HealthStatus);
            }

            let breedsFilter: string[] | undefined;
            if (breeds) {
                breedsFilter = (breeds as string).split(',').map(b => b.trim());
            }

            let ageRangeFilter: { min: number; max: number } | undefined;
            if (ageMin && ageMax) {
                const min = parseInt(ageMin as string);
                const max = parseInt(ageMax as string);
                if (!isNaN(min) && !isNaN(max) && min <= max) {
                    ageRangeFilter = { min, max };
                }
            }

            const filters = {
                ranchId: ranchId as string,
                healthStatus: healthStatusFilter,
                breeds: breedsFilter,
                ageRange: ageRangeFilter,
                includeInactive: false
            };

            const targetDate = new Date(date as string);
            const points = await analyticsService.getTemporalHeatmapData(filters, targetDate);

            res.json({
                success: true,
                data: points
            });

        } catch (error) {
            logger.error('Error en getTemporalHeatmap', this.context, { body: req.body }, error as Error);

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
     * POST /api/analytics/cluster/expand
     * Expande un cluster en puntos individuales
     */
    async expandCluster(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            const { ranchId, bounds, healthStatus, breeds, ageMin, ageMax } = req.body;

            if (!ranchId) {
                res.status(400).json({
                    success: false,
                    error: 'ranchId es requerido'
                });
                return;
            }

            if (!bounds) {
                res.status(400).json({
                    success: false,
                    error: 'bounds son requeridos'
                });
                return;
            }

            // Procesar filtros
            let healthStatusFilter: HealthStatus[] | undefined;
            if (healthStatus) {
                const statusStrings = (healthStatus as string).split(',');
                healthStatusFilter = statusStrings
                    .map(s => s.trim().toUpperCase())
                    .filter(s => Object.values(HealthStatus).includes(s as HealthStatus))
                    .map(s => s as HealthStatus);
            }

            let breedsFilter: string[] | undefined;
            if (breeds) {
                breedsFilter = (breeds as string).split(',').map(b => b.trim());
            }

            let ageRangeFilter: { min: number; max: number } | undefined;
            if (ageMin && ageMax) {
                const min = parseInt(ageMin as string);
                const max = parseInt(ageMax as string);
                if (!isNaN(min) && !isNaN(max) && min <= max) {
                    ageRangeFilter = { min, max };
                }
            }

            const points = await analyticsService.expandCluster(
                ranchId as string,
                bounds,
                {
                    healthStatus: healthStatusFilter,
                    breeds: breedsFilter,
                    ageRange: ageRangeFilter
                }
            );

            res.json({
                success: true,
                data: points
            });

        } catch (error) {
            logger.error('Error en expandCluster', this.context, { body: req.body }, error as Error);

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
     * GET /api/analytics/cluster/stats
     * Obtiene estadísticas de clustering
     */
    async getClusterStats(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            const { ranchId, bounds, zoom, healthStatus } = req.query;

            if (!ranchId) {
                res.status(400).json({
                    success: false,
                    error: 'ranchId es requerido'
                });
                return;
            }

            if (!bounds || !zoom) {
                res.status(400).json({
                    success: false,
                    error: 'bounds y zoom son requeridos'
                });
                return;
            }

            let healthStatusFilter: HealthStatus[] | undefined;
            if (healthStatus) {
                const statusStrings = (healthStatus as string).split(',');
                healthStatusFilter = statusStrings
                    .map(s => s.trim().toUpperCase())
                    .filter(s => Object.values(HealthStatus).includes(s as HealthStatus))
                    .map(s => s as HealthStatus);
            }

            const filters = {
                ranchId: ranchId as string,
                bounds: JSON.parse(bounds as string),
                zoom: parseInt(zoom as string),
                healthStatus: healthStatusFilter
            };

            const stats = await analyticsService.getClusterStats(filters);

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            logger.error('Error en getClusterStats', this.context, { query: req.query }, error as Error);

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
     * POST /api/analytics/nearby-clusters
     * Encuentra clusters cercanos a un punto
     */
    async findNearbyClusters(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            const { ranchId, point, radiusKm, zoom } = req.body;

            if (!ranchId) {
                res.status(400).json({
                    success: false,
                    error: 'ranchId es requerido'
                });
                return;
            }

            if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
                res.status(400).json({
                    success: false,
                    error: 'point con lat y lng es requerido'
                });
                return;
            }

            if (!radiusKm || typeof radiusKm !== 'number') {
                res.status(400).json({
                    success: false,
                    error: 'radiusKm es requerido'
                });
                return;
            }

            const clusters = await analyticsService.findNearbyClusters(
                ranchId as string,
                point,
                radiusKm,
                zoom as number || 12
            );

            res.json({
                success: true,
                data: clusters
            });

        } catch (error) {
            logger.error('Error en findNearbyClusters', this.context, { body: req.body }, error as Error);

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

export const analyticsController = new AnalyticsController();