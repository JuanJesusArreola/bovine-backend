// services/analytics/ClusterService.ts
import { Op } from 'sequelize';
import logger from '../../utils/logger';
import { ensureError } from '../../utils/errorUtils';
import {
    bovineGeoService,
    Cluster,
    Bounds,
    HeatmapPoint,
} from '../BovineGeoService';
import { HealthStatus } from '../../models/Bovine';
import { HEALTH_COLORS, HEALTH_LABELS } from '../../constants/bovine.constants';
import { EnhancedHeatmapPoint } from './HeatmapService';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

/**
 * Cluster enriquecido con metadata adicional
 */
export interface EnhancedCluster extends Cluster {
    healthStatusLabels: string[];
    predominantColor: string;
    predominantHealthStatus: HealthStatus;
    severityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    centerLabel: string;
}

/**
 * Estadísticas de clustering
 */
export interface ClusterStats {
    totalClusters: number;
    totalPoints: number;
    averageClusterSize: number;
    largestCluster: {
        size: number;
        center: { lat: number; lng: number };
        healthStatuses: HealthStatus[];
    } | null;
    distributionByHealthStatus: Record<HealthStatus, number>;
    clusterDensity: number; // clusters por km²
}

/**
 * Filtros para clustering
 */
export interface ClusterRequestFilters {
    ranchId: string;
    bounds: Bounds;
    zoom: number;
    healthStatus?: HealthStatus[];
    breeds?: string[];
    ageRange?: { min: number; max: number };
    minPointsPerCluster?: number;
    maxClusters?: number;
}

/**
 * Configuración de visualización de clusters
 */
export interface ClusterDisplayConfig {
    showCounts: boolean;
    showHealthDistribution: boolean;
    colorBy: 'predominant' | 'severity' | 'diversity';
    clusterIconSize: 'small' | 'medium' | 'large';
    customColors?: Record<HealthStatus, string>;
}

// ============================================================================
// CONFIGURACIÓN POR DEFECTO
// ============================================================================

const DEFAULT_DISPLAY_CONFIG: ClusterDisplayConfig = {
    showCounts: true,
    showHealthDistribution: true,
    colorBy: 'predominant',
    clusterIconSize: 'medium'
};

const SEVERITY_LEVELS: Record<number, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
    0: 'LOW',
    1: 'MEDIUM',
    2: 'HIGH',
    3: 'CRITICAL'
};

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class ClusterService {
    private readonly context = 'ClusterService';

    /**
     * Obtiene clusters para el mapa
     */
    async getClusters(
        filters: ClusterRequestFilters,
        displayConfig: ClusterDisplayConfig = DEFAULT_DISPLAY_CONFIG
    ): Promise<EnhancedCluster[]> {
        const startTime = Date.now();

        try {
            logger.info('Obteniendo clusters', this.context, {
                ranchId: filters.ranchId,
                zoom: filters.zoom,
                bounds: filters.bounds
            });

            // Obtener clusters del servicio geo
            const clusters = await bovineGeoService.getClusters(
                filters.ranchId,
                filters.bounds,
                filters.zoom,
                { healthStatus: filters.healthStatus }
            );

            // Enriquecer clusters con metadata adicional
            const enhancedClusters = await Promise.all(
                clusters.map(cluster => this.enhanceCluster(cluster, displayConfig))
            );

            // Filtrar por tamaño mínimo si se especificó
            let result = enhancedClusters;
            if (filters.minPointsPerCluster) {
                result = result.filter(c => c.pointCount >= filters.minPointsPerCluster!);
            }

            // Limitar número de clusters si se especificó
            if (filters.maxClusters && result.length > filters.maxClusters) {
                // Ordenar por tamaño y tomar los más grandes
                result = result
                    .sort((a, b) => b.pointCount - a.pointCount)
                    .slice(0, filters.maxClusters);
            }

            const duration = Date.now() - startTime;

            logger.info('Clusters obtenidos', this.context, {
                ranchId: filters.ranchId,
                clusterCount: result.length,
                totalPoints: result.reduce((sum, c) => sum + c.pointCount, 0),
                durationMs: duration
            });

            return result;

        } catch (error) {
            logger.error('Error obteniendo clusters', this.context, {
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
            logger.info('Expandiendo cluster', this.context, {
                ranchId,
                bounds
            });

            const points = await bovineGeoService.expandCluster(
                ranchId,
                bounds,
                { healthStatus: filters?.healthStatus }
            );

            // Convertir a EnhancedHeatmapPoint añadiendo metadata
            const enhancedPoints: EnhancedHeatmapPoint[] = points.map(point => ({
                ...point,
                metadata: {
                    ...point.metadata,
                    diagnosis: point.metadata.diagnosis ?? undefined,
                    healthStatusLabel: this.getHealthStatusLabel(point.metadata.healthStatus),
                    ageDisplay: this.getAgeDisplay(point.metadata.age)
                }
            }));

            const duration = Date.now() - startTime;

            logger.info('Cluster expandido', this.context, {
                ranchId,
                pointCount: enhancedPoints.length,
                durationMs: duration
            });

            return enhancedPoints;

        } catch (error) {
            logger.error('Error expandiendo cluster', this.context, {
                ranchId,
                bounds
            }, error as Error);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de clustering
     */
    async getClusterStats(
        filters: ClusterRequestFilters
    ): Promise<ClusterStats> {
        const startTime = Date.now();

        try {
            const clusters = await this.getClusters(filters);

            const totalPoints = clusters.reduce((sum, c) => sum + c.pointCount, 0);
            const averageClusterSize = clusters.length > 0
                ? totalPoints / clusters.length
                : 0;

            // Encontrar cluster más grande
            let largestCluster: ClusterStats['largestCluster'] = null;
            if (clusters.length > 0) {
                const largest = clusters.reduce((max, c) =>
                    c.pointCount > max.pointCount ? c : max, clusters[0]);
                largestCluster = {
                    size: largest.pointCount,
                    center: largest.center,
                    healthStatuses: largest.healthStatuses
                };
            }

            // Distribución por estado de salud
            const distributionByHealthStatus = clusters.reduce((acc, cluster) => {
                cluster.healthStatuses.forEach(status => {
                    acc[status] = (acc[status] || 0) + 1;
                });
                return acc;
            }, {} as Record<HealthStatus, number>);

            // Calcular densidad de clusters (aproximada)
            const bounds = filters.bounds;
            const areaKm2 = this.calculateArea(bounds);
            const clusterDensity = areaKm2 > 0
                ? clusters.length / areaKm2
                : 0;

            const duration = Date.now() - startTime;

            logger.info('Estadísticas de clustering obtenidas', this.context, {
                ranchId: filters.ranchId,
                totalClusters: clusters.length,
                totalPoints,
                durationMs: duration
            });

            return {
                totalClusters: clusters.length,
                totalPoints,
                averageClusterSize: Math.round(averageClusterSize * 100) / 100,
                largestCluster,
                distributionByHealthStatus,
                clusterDensity: Math.round(clusterDensity * 100) / 100
            };

        } catch (error) {
            logger.error('Error obteniendo estadísticas de clustering', this.context, {
                filters
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
            // Calcular bounding box alrededor del punto
            const bounds = this.calculateBoundingBox(point, radiusKm);

            const filters: ClusterRequestFilters = {
                ranchId,
                bounds,
                zoom,
                minPointsPerCluster: 1
            };

            const clusters = await this.getClusters(filters);

            // Filtrar clusters dentro del radio
            const nearbyClusters = clusters.filter(cluster => {
                const distance = this.haversineDistance(
                    point.lat, point.lng,
                    cluster.center.lat, cluster.center.lng
                );
                return distance <= radiusKm;
            });

            const duration = Date.now() - startTime;

            logger.info('Clusters cercanos encontrados', this.context, {
                ranchId,
                point,
                radiusKm,
                found: nearbyClusters.length,
                durationMs: duration
            });

            return nearbyClusters;

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
     * Genera HTML para el popup de un cluster
     */
    generateClusterPopup(cluster: EnhancedCluster): string {
        const statusLabels = cluster.healthStatusLabels.join(', ');
        const severityColors = {
            LOW: '#10b981',
            MEDIUM: '#f59e0b',
            HIGH: '#f97316',
            CRITICAL: '#ef4444'
        };

        return `
            <div class="cluster-popup" style="font-family: Arial, sans-serif; padding: 8px; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; color: #333;">
                    📍 Grupo de ${cluster.pointCount} bovinos
                </h3>
                <div style="margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; margin-bottom: 5px;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background: ${cluster.predominantColor}; margin-right: 8px;"></div>
                        <strong>Estado predominante:</strong> ${this.getHealthStatusLabel(cluster.predominantHealthStatus)}
                    </div>
                    <div style="margin-top: 5px;">
                        <strong>Estados presentes:</strong> ${statusLabels}
                    </div>
                    <div style="margin-top: 5px;">
                        <strong>Severidad:</strong> 
                        <span style="color: ${severityColors[cluster.severityLevel]}; font-weight: bold;">
                            ${cluster.severityLevel}
                        </span>
                    </div>
                </div>
                <button 
                    onclick="window.dispatchEvent(new CustomEvent('cluster-expand', { detail: { 
                        bounds: {
                            north: ${cluster.bounds.north},
                            south: ${cluster.bounds.south},
                            east: ${cluster.bounds.east},
                            west: ${cluster.bounds.west}
                        },
                        center: {
                            lat: ${cluster.center.lat},
                            lng: ${cluster.center.lng}
                        }
                    } }))"
                    style="width: 100%; padding: 8px; background: #16a34a; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    🔍 Expandir grupo (${cluster.pointCount} bovinos)
                </button>
            </div>
        `;
    }

    // ==========================================================================
    // MÉTODOS AUXILIARES
    // ==========================================================================

    /**
     * Enriquece un cluster con metadata adicional
     */
    private async enhanceCluster(
        cluster: Cluster,
        config: ClusterDisplayConfig
    ): Promise<EnhancedCluster> {
        // Obtener etiquetas de salud
        const healthStatusLabels = cluster.healthStatuses.map(s =>
            this.getHealthStatusLabel(s)
        );

        // Determinar estado predominante
        const predominantHealthStatus = this.getPredominantHealthStatus(
            cluster.healthStatuses,
            cluster.avgSeverity
        );

        // Obtener color predominante
        const predominantColor = config.customColors?.[predominantHealthStatus]
            || HEALTH_COLORS[predominantHealthStatus]
            || '#6b7280';

        // Determinar nivel de severidad
        const severityLevel = this.getSeverityLevel(cluster.avgSeverity);

        // Generar etiqueta para el centro
        const centerLabel = this.generateCenterLabel(cluster, config);

        return {
            ...cluster,
            healthStatusLabels,
            predominantColor,
            predominantHealthStatus,
            severityLevel,
            centerLabel
        };
    }

    /**
     * Obtiene el estado de salud predominante en el cluster
     */
    private getPredominantHealthStatus(
        healthStatuses: HealthStatus[],
        avgSeverity: number
    ): HealthStatus {
        // Si hay un solo estado, ese es el predominante
        if (healthStatuses.length === 1) {
            return healthStatuses[0];
        }

        // Basado en severidad promedio
        if (avgSeverity >= 3.5) return HealthStatus.QUARANTINE;
        if (avgSeverity >= 2.5) return HealthStatus.SICK;
        if (avgSeverity >= 1.5) return HealthStatus.RECOVERING;
        return HealthStatus.HEALTHY;
    }

    /**
     * Determina nivel de severidad basado en avgSeverity
     */
    private getSeverityLevel(avgSeverity: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
        if (avgSeverity >= 3.5) return 'CRITICAL';
        if (avgSeverity >= 2.5) return 'HIGH';
        if (avgSeverity >= 1.5) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Genera etiqueta para el centro del cluster
     */
    private generateCenterLabel(
        cluster: Cluster,
        config: ClusterDisplayConfig
    ): string {
        const parts: string[] = [];

        if (config.showCounts) {
            parts.push(`${cluster.pointCount} bovinos`);
        }

        if (config.showHealthDistribution && cluster.healthStatuses.length > 0) {
            const mainStatus = this.getHealthStatusLabel(cluster.healthStatuses[0]);
            if (cluster.healthStatuses.length === 1) {
                parts.push(`Estado: ${mainStatus}`);
            } else {
                parts.push(`${cluster.healthStatuses.length} estados diferentes`);
            }
        }

        return parts.join(' • ');
    }

    /**
     * Calcula el área de un bounding box en km²
     */
    private calculateArea(bounds: Bounds): number {
        const latDiff = Math.abs(bounds.north - bounds.south);
        const lngDiff = Math.abs(bounds.east - bounds.west);

        // Aproximación: 1 grado ≈ 111 km
        const widthKm = lngDiff * 111 * Math.cos((bounds.north + bounds.south) / 2 * Math.PI / 180);
        const heightKm = latDiff * 111;

        return widthKm * heightKm;
    }

    /**
     * Calcula bounding box alrededor de un punto
     */
    private calculateBoundingBox(
        point: { lat: number; lng: number },
        radiusKm: number
    ): Bounds {
        // 1 grado ≈ 111 km
        const delta = radiusKm / 111;

        return {
            north: point.lat + delta,
            south: point.lat - delta,
            east: point.lng + delta,
            west: point.lng - delta
        };
    }

    /**
     * Calcula distancia Haversine (en km)
     */
    private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radio de la Tierra en km
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Obtiene etiqueta de estado de salud en español
     */

    private getHealthStatusLabel(status: HealthStatus): string {
        const labels: Record<HealthStatus, string> = {
            [HealthStatus.HEALTHY]: 'Saludable',
            [HealthStatus.SICK]: 'Enfermo',
            [HealthStatus.RECOVERING]: 'Recuperándose',
            [HealthStatus.QUARANTINE]: 'Cuarentena',
            [HealthStatus.DECEASED]: 'Fallecido',
            [HealthStatus.UNKNOWN]: 'Desconocido'
        };
        return labels[status] || status;
    }

    /**
     * Obtiene display de edad
     */
    private getAgeDisplay(ageMonths?: number): string {
        if (!ageMonths) return 'Desconocida';

        const years = Math.floor(ageMonths / 12);
        const months = ageMonths % 12;

        if (years === 0) {
            return `${months} ${months === 1 ? 'mes' : 'meses'}`;
        }

        return `${years} ${years === 1 ? 'año' : 'años'} ${months > 0 ? `${months} meses` : ''}`.trim();
    }

    /**
     * Obtiene configuración por defecto
     */
    getDefaultConfig(): ClusterDisplayConfig {
        return { ...DEFAULT_DISPLAY_CONFIG };
    }

    /**
     * Calcula tamaño de icono según zoom
     */
    getIconSize(zoom: number, baseSize: 'small' | 'medium' | 'large' = 'medium'): number {
        const sizes = {
            small: 30,
            medium: 40,
            large: 50
        };

        const base = sizes[baseSize];
        // Ajustar tamaño según zoom (menos zoom = iconos más pequeños)
        const factor = Math.min(1, zoom / 15);

        return Math.floor(base * factor);
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const clusterService = new ClusterService();