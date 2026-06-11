// services/analytics/AnalyticsService.ts
import logger from '../../utils/logger';
import { ensureError } from '../../utils/errorUtils';
import { dashboardService, DashboardFilters, FullDashboard } from './DashboardService';
import { heatmapService, HeatmapRequestFilters, EnhancedHeatmapPoint, HeatmapStats, HeatmapConfig } from './HeatmapService';
import { clusterService, ClusterRequestFilters, EnhancedCluster, ClusterStats, ClusterDisplayConfig } from './ClusterService';
import { Bounds } from '../BovineGeoService';
import { HealthStatus } from '../../models/Bovine';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

/**
 * Respuesta combinada para mapa
 */
export interface MapDataResponse {
    type: 'clusters' | 'points';
    data: EnhancedCluster[] | EnhancedHeatmapPoint[];
    stats: {
        totalPoints: number;
        visiblePoints: number;
        zoom: number;
    };
    generatedAt: Date;
}

/**
 * Filtros para mapa
 */
export interface MapFilters {
    ranchId: string;
    bounds: Bounds;
    zoom: number;
    healthStatus?: HealthStatus[];
    breeds?: string[];
    ageRange?: { min: number; max: number };
    clusterThreshold?: number; // Zoom a partir del cual mostrar puntos individuales
}

/**
 * Configuración de visualización del mapa
 */
export interface MapDisplayConfig {
    clusterConfig?: ClusterDisplayConfig;
    heatmapConfig?: HeatmapConfig;
    showClustersBelowZoom?: number;
    showHeatmapAboveZoom?: number;
}

// ============================================================================
// CONFIGURACIÓN POR DEFECTO
// ============================================================================

const DEFAULT_MAP_CONFIG: MapDisplayConfig = {
    clusterConfig: {
        showCounts: true,
        showHealthDistribution: true,
        colorBy: 'predominant',
        clusterIconSize: 'medium'
    },
    heatmapConfig: {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        minOpacity: 0.3
    },
    showClustersBelowZoom: 12,   // Mostrar clusters cuando zoom < 12
    showHeatmapAboveZoom: 12      // Mostrar heatmap cuando zoom >= 12
};

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class AnalyticsService {
    private readonly context = 'AnalyticsService';

    /**
     * Obtiene datos para el mapa (clusters o heatmap según zoom)
     */
    async getMapData(
        filters: MapFilters,
        config: MapDisplayConfig = DEFAULT_MAP_CONFIG
    ): Promise<MapDataResponse> {
        const startTime = Date.now();

        try {
            const { zoom } = filters;
            const threshold = config.showClustersBelowZoom ?? DEFAULT_MAP_CONFIG.showClustersBelowZoom!;

            let type: 'clusters' | 'points';
            let data: EnhancedCluster[] | EnhancedHeatmapPoint[];
            let totalPoints: number;
            let visiblePoints: number;

            if (zoom < threshold) {
                // Zoom bajo → mostrar clusters
                logger.debug('Usando clustering para mapa', this.context, { zoom, threshold });
                
                const clusterFilters: ClusterRequestFilters = {
                    ranchId: filters.ranchId,
                    bounds: filters.bounds,
                    zoom: filters.zoom,
                    healthStatus: filters.healthStatus
                };
                
                const clusters = await clusterService.getClusters(
                    clusterFilters,
                    config.clusterConfig
                );
                
                type = 'clusters';
                data = clusters;
                totalPoints = clusters.reduce((sum, c) => sum + c.pointCount, 0);
                visiblePoints = clusters.length;

            } else {
                // Zoom alto → mostrar puntos individuales (heatmap)
                logger.debug('Usando heatmap para mapa', this.context, { zoom, threshold });
                
                const heatmapFilters: HeatmapRequestFilters = {
                    ranchId: filters.ranchId,
                    healthStatus: filters.healthStatus,
                    breeds: filters.breeds,
                    ageRange: filters.ageRange
                };
                
                const points = await heatmapService.getHeatmapData(
                    heatmapFilters,
                    config.heatmapConfig
                );
                
                type = 'points';
                data = points;
                totalPoints = points.length;
                visiblePoints = points.length;
            }

            const duration = Date.now() - startTime;

            logger.info('Datos de mapa obtenidos', this.context, {
                ranchId: filters.ranchId,
                zoom,
                type,
                totalPoints,
                visiblePoints,
                durationMs: duration
            });

            return {
                type,
                data,
                stats: {
                    totalPoints,
                    visiblePoints,
                    zoom: filters.zoom
                },
                generatedAt: new Date()
            };

        } catch (error) {
            logger.error('Error obteniendo datos de mapa', this.context, {
                filters
            }, error as Error);
            throw error;
        }
    }

    /**
     * Obtiene dashboard completo
     */
    async getDashboard(filters: DashboardFilters): Promise<FullDashboard> {
        const startTime = Date.now();

        try {
            const dashboard = await dashboardService.getFullDashboard(filters);

            const duration = Date.now() - startTime;

            logger.info('Dashboard obtenido', this.context, {
                ranchId: filters.ranchId,
                period: filters.period,
                durationMs: duration
            });

            return dashboard;

        } catch (error) {
            logger.error('Error obteniendo dashboard', this.context, {
                filters
            }, error as Error);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas del heatmap
     */
    async getHeatmapStats(filters: HeatmapRequestFilters): Promise<HeatmapStats> {
        const startTime = Date.now();

        try {
            const stats = await heatmapService.getHeatmapStats(filters);

            const duration = Date.now() - startTime;

            logger.info('Estadísticas de heatmap obtenidas', this.context, {
                ranchId: filters.ranchId,
                totalPoints: stats.totalPoints,
                durationMs: duration
            });

            return stats;

        } catch (error) {
            logger.error('Error obteniendo estadísticas de heatmap', this.context, {
                filters
            }, error as Error);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de clustering
     */
    async getClusterStats(filters: ClusterRequestFilters): Promise<ClusterStats> {
        const startTime = Date.now();

        try {
            const stats = await clusterService.getClusterStats(filters);

            const duration = Date.now() - startTime;

            logger.info('Estadísticas de clustering obtenidas', this.context, {
                ranchId: filters.ranchId,
                totalClusters: stats.totalClusters,
                totalPoints: stats.totalPoints,
                durationMs: duration
            });

            return stats;

        } catch (error) {
            logger.error('Error obteniendo estadísticas de clustering', this.context, {
                filters
            }, error as Error);
            throw error;
        }
    }

    /**
     * Expande un cluster en puntos individuales
     */
    async expandCluster(
        ranchId: string,
        bounds: Bounds,
        filters?: {
            healthStatus?: HealthStatus[];
            breeds?: string[];
            ageRange?: { min: number; max: number };
        }
    ): Promise<EnhancedHeatmapPoint[]> {
        const startTime = Date.now();

        try {
            const points = await clusterService.expandCluster(ranchId, bounds, filters);

            const duration = Date.now() - startTime;

            logger.info('Cluster expandido', this.context, {
                ranchId,
                pointCount: points.length,
                durationMs: duration
            });

            return points;

        } catch (error) {
            logger.error('Error expandiendo cluster', this.context, {
                ranchId,
                bounds
            }, error as Error);
            throw error;
        }
    }

    /**
     * Obtiene datos para heatmap ponderado
     */
    async getWeightedHeatmapData(
        filters: HeatmapRequestFilters,
        weightField: 'weight' | 'age' | 'production'
    ): Promise<EnhancedHeatmapPoint[]> {
        const startTime = Date.now();

        try {
            const points = await heatmapService.getWeightedHeatmapData(filters, weightField);

            const duration = Date.now() - startTime;

            logger.info('Datos de heatmap ponderado obtenidos', this.context, {
                ranchId: filters.ranchId,
                weightField,
                pointCount: points.length,
                durationMs: duration
            });

            return points;

        } catch (error) {
            logger.error('Error obteniendo datos de heatmap ponderado', this.context, {
                filters,
                weightField
            }, error as Error);
            throw error;
        }
    }

    /**
     * Obtiene datos para heatmap temporal (histórico)
     */
    async getTemporalHeatmapData(
        filters: HeatmapRequestFilters,
        date: Date
    ): Promise<EnhancedHeatmapPoint[]> {
        const startTime = Date.now();

        try {
            const points = await heatmapService.getTemporalHeatmapData(filters, date);

            const duration = Date.now() - startTime;

            logger.info('Datos de heatmap temporal obtenidos', this.context, {
                ranchId: filters.ranchId,
                date,
                pointCount: points.length,
                durationMs: duration
            });

            return points;

        } catch (error) {
            logger.error('Error obteniendo datos de heatmap temporal', this.context, {
                filters,
                date
            }, error as Error);
            throw error;
        }
    }

    /**
     * Encuentra clusters cercanos a un punto
     */
    async findNearbyClusters(
        ranchId: string,
        point: { lat: number; lng: number },
        radiusKm: number,
        zoom: number = 12
    ): Promise<EnhancedCluster[]> {
        const startTime = Date.now();

        try {
            const clusters = await clusterService.findNearbyClusters(ranchId, point, radiusKm, zoom);

            const duration = Date.now() - startTime;

            logger.info('Clusters cercanos encontrados', this.context, {
                ranchId,
                point,
                radiusKm,
                found: clusters.length,
                durationMs: duration
            });

            return clusters;

        } catch (error) {
            logger.error('Error encontrando clusters cercanos', this.context, {
                ranchId,
                point,
                radiusKm
            }, error as Error);
            throw error;
        }
    }

    /**
     * Obtiene configuración por defecto del mapa
     */
    getDefaultMapConfig(): MapDisplayConfig {
        return { ...DEFAULT_MAP_CONFIG };
    }

    /**
     * Genera HTML para popup de cluster
     */
    generateClusterPopup(cluster: EnhancedCluster): string {
        return clusterService.generateClusterPopup(cluster);
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const analyticsService = new AnalyticsService();