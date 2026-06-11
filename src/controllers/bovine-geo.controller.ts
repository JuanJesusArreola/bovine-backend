// controllers/bovine-geo.controller.ts
import { Request, Response } from 'express';
import { bovineGeoService, MapMarkersFilters } from '../services/BovineGeoService';
import { bovineService } from '../services/BovineService';
import {
    HealthStatus,
    GenderType,
    CattleType,
    VaccinationStatus,
} from '../models/Bovine';
import { BovineError } from '../utils/BovineErrors';
import logger from '../utils/logger';

export class BovineGeoController {
    private readonly context = 'BovineGeoController';

    constructor() {
        this.getHeatmap = this.getHeatmap.bind(this);
        this.getClusters = this.getClusters.bind(this);
        this.expandCluster = this.expandCluster.bind(this);
        this.getBovinePoint = this.getBovinePoint.bind(this);
        this.refreshSnapshots = this.refreshSnapshots.bind(this);
        this.getMapMarkers = this.getMapMarkers.bind(this);
    }

    /**
     * GET /api/bovines/geo/heatmap
     * Obtiene datos para mapa de calor
     */
    async getHeatmap(req: Request, res: Response): Promise<void> {
        try {
            const { ranchId } = req.params;
            
            // Obtener filtros del query string
            const healthStatusQuery = req.query.healthStatus as string;
            const breedsQuery = req.query.breeds as string;
            const ageMin = req.query.ageMin as string;
            const ageMax = req.query.ageMax as string;

            // ✅ CONVERTIR LOS STRINGS AL ENUM HEALTHSTATUS
            let healthStatus: HealthStatus[] | undefined;
            if (healthStatusQuery) {
                const statusStrings = healthStatusQuery.split(',');
                healthStatus = statusStrings
                    .map(s => s.trim().toUpperCase())
                    .filter(s => Object.values(HealthStatus).includes(s as HealthStatus))
                    .map(s => s as HealthStatus);
                
                // Opcional: Log si algunos valores no son válidos
                if (healthStatus.length !== statusStrings.length) {
                    logger.warn('Algunos valores de healthStatus no son válidos', this.context, {
                        received: statusStrings,
                        valid: healthStatus
                    });
                }
            }

            // Procesar breeds (siguen siendo strings, no hay problema)
            let breeds: string[] | undefined;
            if (breedsQuery) {
                breeds = breedsQuery.split(',').map(b => b.trim());
            }

            // Procesar rango de edad
            let ageRange: { min: number; max: number } | undefined;
            if (ageMin && ageMax) {
                const min = parseInt(ageMin);
                const max = parseInt(ageMax);
                if (!isNaN(min) && !isNaN(max) && min <= max) {
                    ageRange = { min, max };
                }
            }

            // Filtro por UUID de enfermedad activa (Phase 2)
            const diseaseIdsQuery = req.query.diseaseIds as string;
            let diseaseIds: string[] | undefined;
            if (diseaseIdsQuery) {
                diseaseIds = diseaseIdsQuery.split(',').map((d) => d.trim()).filter(Boolean);
            }

            const filters = {
                healthStatus,
                breeds,
                ageRange,
                diseaseIds,
            };

            const data = await bovineGeoService.getHeatmapData(ranchId, filters);

            res.json({
                success: true,
                data
            });

        } catch (error) {
            logger.error('Error en getHeatmap', this.context, { params: req.params }, error as Error);
            
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
     * POST /api/bovines/geo/clusters
     * Obtiene clusters para el mapa
     */
    async getClusters(req: Request, res: Response): Promise<void> {
        try {
            const { ranchId } = req.params;
            const { bounds, zoom, filters } = req.body;

            const clusters = await bovineGeoService.getClusters(
                ranchId,
                bounds,
                zoom,
                filters
            );

            res.json({
                success: true,
                data: clusters
            });

        } catch (error) {
            logger.error('Error en getClusters', this.context, { params: req.params, body: req.body }, error as Error);
            
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
     * POST /api/bovines/geo/cluster/expand
     * Expande un cluster en puntos individuales
     */
    async expandCluster(req: Request, res: Response): Promise<void> {
        try {
            const { ranchId } = req.params;
            const { bounds, filters } = req.body;

            const points = await bovineGeoService.expandCluster(
                ranchId,
                bounds,
                filters
            );

            res.json({
                success: true,
                data: points
            });

        } catch (error) {
            logger.error('Error en expandCluster', this.context, { params: req.params, body: req.body }, error as Error);
            
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
     * GET /api/bovines/geo/point/:bovineId
     * Obtiene punto de un bovino específico
     */
    async getBovinePoint(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;

            const point = await bovineGeoService.getBovinePoint(bovineId);

            if (!point) {
                res.status(404).json({
                    success: false,
                    error: 'Punto no encontrado para el bovino'
                });
                return;
            }

            res.json({
                success: true,
                data: point
            });

        } catch (error) {
            logger.error('Error en getBovinePoint', this.context, { params: req.params }, error as Error);
            
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
     * POST /api/bovines/geo/refresh/:ranchId
     * Refresca snapshots de un rancho (admin)
     */
    async refreshSnapshots(req: Request, res: Response): Promise<void> {
        try {
            const { ranchId } = req.params;
            const userId = req.user?.id;

            // Verificar permisos de admin
            if (req.user?.role !== 'SUPER_ADMIN') {
                res.status(403).json({
                    success: false,
                    error: 'No autorizado'
                });
                return;
            }

            const count = await bovineGeoService.refreshRanchSnapshots(ranchId);

            res.json({
                success: true,
                data: { refreshed: count },
                message: `Snapshots actualizados para ${count} bovinos`
            });

        } catch (error) {
            logger.error('Error en refreshSnapshots', this.context, { params: req.params }, error as Error);
            
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
     * GET /api/bovines/geo/map-markers
     * Markers individuales (o clusters si zoom bajo / volumen alto) con
     * TODOS los filtros del listado de bovinos.
     *
     * Query params:
     *   ranchId | ranchIds (CSV)
     *   healthStatus (CSV) | breeds (CSV) | cattleTypes (CSV) | genders (CSV)
     *   ageMin | ageMax
     *   diseases (CSV texto, legacy)
     *   diseaseIds (CSV de UUIDs de Disease — Phase 2)
     *   vaccinationStatus
     *   locationId
     *   zoom (number)  default 12
     *   north,south,east,west (bbox)
     *   maxMarkers (default 5000)
     */
    async getMapMarkers(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            // Resolver ranchos accesibles del usuario
            const allowedRanchIds = await bovineService.getAccessibleRanchIds(userId);

            // Parsear filtros del query string
            const parseCsv = (raw: any): string[] | undefined =>
                typeof raw === 'string' && raw.length > 0
                    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
                    : undefined;

            // Resolver ranchIds: querystring → intersección con permisos
            let effectiveRanchIds: string[] | null | undefined;
            const queryRanchIds = parseCsv(req.query.ranchIds) ??
                (req.query.ranchId ? [req.query.ranchId as string] : undefined);

            if (allowedRanchIds === null) {
                // SUPER_ADMIN / OWNER → sin restricción salvo lo que pidan explícitamente
                effectiveRanchIds = queryRanchIds ?? null;
            } else if (allowedRanchIds.length === 0) {
                // Sin acceso a ningún rancho
                res.json({ success: true, data: { mode: 'markers', total: 0, items: [] } });
                return;
            } else if (queryRanchIds) {
                effectiveRanchIds = queryRanchIds.filter((id) => allowedRanchIds.includes(id));
                if (effectiveRanchIds.length === 0) {
                    res.json({ success: true, data: { mode: 'markers', total: 0, items: [] } });
                    return;
                }
            } else {
                effectiveRanchIds = allowedRanchIds;
            }

            const filters: MapMarkersFilters = {
                ranchIds: effectiveRanchIds,
                healthStatus: parseCsv(req.query.healthStatus) as HealthStatus[] | undefined,
                breeds: parseCsv(req.query.breeds),
                cattleTypes: parseCsv(req.query.cattleTypes) as CattleType[] | undefined,
                genders: parseCsv(req.query.genders) as GenderType[] | undefined,
                diseases: parseCsv(req.query.diseases),
                diseaseIds: parseCsv(req.query.diseaseIds),
                vaccinationStatus: req.query.vaccinationStatus
                    ? (req.query.vaccinationStatus as VaccinationStatus)
                    : undefined,
                locationId: (req.query.locationId as string) || undefined,
                ageRange:
                    req.query.ageMin && req.query.ageMax
                        ? {
                              min: parseInt(req.query.ageMin as string, 10),
                              max: parseInt(req.query.ageMax as string, 10),
                          }
                        : undefined,
            };

            // Bounding box (opcional)
            const north = req.query.north ? parseFloat(req.query.north as string) : undefined;
            const south = req.query.south ? parseFloat(req.query.south as string) : undefined;
            const east = req.query.east ? parseFloat(req.query.east as string) : undefined;
            const west = req.query.west ? parseFloat(req.query.west as string) : undefined;
            const bbox =
                north !== undefined && south !== undefined && east !== undefined && west !== undefined
                    ? { north, south, east, west }
                    : undefined;

            const zoom = req.query.zoom ? parseInt(req.query.zoom as string, 10) : 12;
            const maxMarkers = req.query.maxMarkers
                ? parseInt(req.query.maxMarkers as string, 10)
                : undefined;

            const data = await bovineGeoService.getMapMarkers(filters, {
                bbox,
                zoom,
                maxMarkers,
            });

            res.json({ success: true, data });
        } catch (error) {
            logger.error('Error en getMapMarkers', this.context, { query: req.query }, error as Error);
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
}

export const bovineGeoController = new BovineGeoController();