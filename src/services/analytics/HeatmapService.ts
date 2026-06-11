// services/analytics/HeatmapService.ts
import { Op } from 'sequelize';
import logger from '../../utils/logger';
import { ensureError } from '../../utils/errorUtils';
import { bovineGeoService, HeatmapPoint, HeatmapFilters } from '../BovineGeoService';
import {
    HEAT_INTENSITY,
    HEALTH_COLORS,
    HEALTH_LABELS
} from '../../constants/bovine.constants';
import { HealthStatus } from '../../models/Bovine';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

/**
 * Datos para mapa de calor con metadatos adicionales
 */
export interface EnhancedHeatmapPoint extends HeatmapPoint {
    metadata: {
        healthStatus: HealthStatus;
        healthStatusLabel: string;
        breed?: string;
        age?: number;
        ageDisplay?: string;
        diagnosis?: string;
        lastHealthCheck?: Date;
        weight?: number;
        isPregnant?: boolean;
    };
}

/**
 * Estadísticas del heatmap
 */
export interface HeatmapStats {
    totalPoints: number;
    byHealthStatus: Record<HealthStatus, number>;
    averageIntensity: number;
    healthiestArea: {
        center: { lat: number; lng: number };
        radius: number;
        healthyCount: number;
    } | null;
    mostCriticalArea: {
        center: { lat: number; lng: number };
        radius: number;
        criticalCount: number;
    } | null;
}

/**
 * Configuración del heatmap
 */
export interface HeatmapConfig {
    radius?: number;
    blur?: number;
    maxZoom?: number;
    minOpacity?: number;
    gradient?: Record<number, string>;
}

/**
 * Filtros para heatmap
 */
export interface HeatmapRequestFilters {
    ranchId: string;
    healthStatus?: HealthStatus[];
    breeds?: string[];
    ageRange?: { min: number; max: number };
    diseases?: string[];
    /** Filtro por UUID de Disease (Phase 2). Se mapea a activeDiseaseId en el snapshot. */
    diseaseIds?: string[];
    startDate?: Date;
    endDate?: Date;
    includeInactive?: boolean;
}

// ============================================================================
// CONFIGURACIÓN POR DEFECTO
// ============================================================================

const DEFAULT_HEATMAP_CONFIG: HeatmapConfig = {
    radius: 25,
    blur: 15,
    maxZoom: 17,
    minOpacity: 0.3,
    gradient: {
        0.2: '#10b981',   // Verde - saludable
        0.4: '#f59e0b',   // Naranja - recuperándose
        0.6: '#f97316',   // Naranja oscuro - enfermo
        0.8: '#ef4444',   // Rojo - grave
        1.0: '#7f1d1d'    // Rojo oscuro - crítico
    }
};

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class HeatmapService {
    private readonly context = 'HeatmapService';

    /**
     * Obtiene datos para mapa de calor
     */
    async getHeatmapData(
        filters: HeatmapRequestFilters,
        config: HeatmapConfig = DEFAULT_HEATMAP_CONFIG
    ): Promise<EnhancedHeatmapPoint[]> {
        const startTime = Date.now();

        try {
            logger.info('Obteniendo datos de heatmap', this.context, {
                ranchId: filters.ranchId,
                healthStatus: filters.healthStatus
            });

            // Construir filtros para el servicio de geolocalización
            const geoFilters: HeatmapFilters = {
                healthStatus: filters.healthStatus,
                breeds: filters.breeds,
                ageRange: filters.ageRange,
                diseases: filters.diseases,
                diseaseIds: filters.diseaseIds,
            };

            // Obtener puntos base del servicio geo
            const points = await bovineGeoService.getHeatmapData(
                filters.ranchId,
                geoFilters
            );

            // Enriquecer puntos con metadata adicional
            const enhancedPoints: EnhancedHeatmapPoint[] = points.map(point => ({
                ...point,
                metadata: {
                    ...point.metadata,
                    diagnosis: point.metadata.diagnosis ?? undefined,
                    healthStatusLabel: this.getHealthStatusLabel(point.metadata.healthStatus),
                    ageDisplay: this.getAgeDisplay(point.metadata.age),
                    lastHealthCheck: undefined, // Se puede obtener de otra fuente si es necesario
                    weight: undefined,
                    isPregnant: undefined
                }
            }));

            const duration = Date.now() - startTime;

            logger.info('Datos de heatmap obtenidos', this.context, {
                ranchId: filters.ranchId,
                pointCount: enhancedPoints.length,
                durationMs: duration
            });

            return enhancedPoints;

        } catch (error) {
            logger.error('Error obteniendo datos de heatmap', this.context, {
                filters
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene estadísticas del heatmap
     */
    async getHeatmapStats(
        filters: HeatmapRequestFilters
    ): Promise<HeatmapStats> {
        const startTime = Date.now();

        try {
            const points = await this.getHeatmapData(filters);

            // Estadísticas por estado de salud
            const byHealthStatus = points.reduce((acc, point) => {
                const status = point.metadata.healthStatus;
                acc[status] = (acc[status] || 0) + 1;
                return acc;
            }, {} as Record<HealthStatus, number>);

            // Calcular intensidad promedio
            const totalIntensity = points.reduce((sum, p) => sum + p.value, 0);
            const averageIntensity = points.length > 0
                ? totalIntensity / points.length
                : 0;

            // Identificar áreas con mayor concentración (simplificado)
            const healthiestArea = await this.findHealthiestCluster(filters.ranchId);
            const mostCriticalArea = await this.findCriticalCluster(filters.ranchId);

            const duration = Date.now() - startTime;

            logger.info('Estadísticas de heatmap obtenidas', this.context, {
                ranchId: filters.ranchId,
                totalPoints: points.length,
                durationMs: duration
            });

            return {
                totalPoints: points.length,
                byHealthStatus,
                averageIntensity,
                healthiestArea,
                mostCriticalArea
            };

        } catch (error) {
            logger.error('Error obteniendo estadísticas de heatmap', this.context, {
                filters
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene datos para heatmap ponderado por peso
     */
    async getWeightedHeatmapData(
        filters: HeatmapRequestFilters,
        weightField: 'weight' | 'age' | 'production'
    ): Promise<EnhancedHeatmapPoint[]> {
        const startTime = Date.now();

        try {
            const points = await this.getHeatmapData(filters);

            // Ajustar valor según el campo de peso seleccionado
            const weightedPoints = points.map(point => ({
                ...point,
                value: this.calculateWeightedValue(point, weightField)
            }));

            const duration = Date.now() - startTime;

            logger.info('Datos de heatmap ponderado obtenidos', this.context, {
                ranchId: filters.ranchId,
                weightField,
                pointCount: weightedPoints.length,
                durationMs: duration
            });

            return weightedPoints;

        } catch (error) {
            logger.error('Error obteniendo datos de heatmap ponderado', this.context, {
                filters,
                weightField
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene datos para heatmap temporal (evolución histórica)
     */
    async getTemporalHeatmapData(
        filters: HeatmapRequestFilters,
        date: Date
    ): Promise<EnhancedHeatmapPoint[]> {
        const startTime = Date.now();

        try {
            // TODO: Implementar cuando tengamos tracking histórico
            // Por ahora retornamos los datos actuales con advertencia
            logger.warn('Heatmap temporal aún no implementado, retornando datos actuales', this.context, {
                ranchId: filters.ranchId,
                requestedDate: date
            });

            const points = await this.getHeatmapData(filters);

            // Marcar que estos son datos actuales, no históricos
            const pointsWithWarning = points.map(point => ({
                ...point,
                metadata: {
                    ...point.metadata,
                    note: 'Datos actuales (histórico no disponible)'
                }
            }));

            const duration = Date.now() - startTime;

            return pointsWithWarning;

        } catch (error) {
            logger.error('Error obteniendo datos de heatmap temporal', this.context, {
                filters,
                date
            }, ensureError(error));
            throw error;
        }
    }

    // ==========================================================================
    // MÉTODOS AUXILIARES
    // ==========================================================================

    /**
     * Encuentra el cluster con mayor concentración de animales saludables
     */
    private async findHealthiestCluster(
        ranchId: string
    ): Promise<{ center: { lat: number; lng: number }; radius: number; healthyCount: number } | null> {
        try {
            // Obtener puntos saludables
            const points = await bovineGeoService.getHeatmapData(ranchId, {
                healthStatus: [HealthStatus.HEALTHY]
            });

            if (points.length === 0) return null;

            // Calcular centroide
            const center = this.calculateCentroid(points);

            // Calcular radio basado en dispersión
            const radius = this.calculateRadius(points, center);

            return {
                center,
                radius: Math.min(radius, 5000), // Máximo 5km
                healthyCount: points.length
            };

        } catch (error) {
            logger.warn('Error encontrando cluster saludable', this.context, { ranchId });
            return null;
        }
    }

    /**
     * Encuentra el cluster con mayor concentración de animales críticos
     */
    private async findCriticalCluster(
        ranchId: string
    ): Promise<{ center: { lat: number; lng: number }; radius: number; criticalCount: number } | null> {
        try {
            // Obtener puntos críticos (SICK + QUARANTINE)
            const points = await bovineGeoService.getHeatmapData(ranchId, {
                healthStatus: [HealthStatus.SICK, HealthStatus.QUARANTINE]
            });

            if (points.length === 0) return null;

            // Calcular centroide
            const center = this.calculateCentroid(points);

            // Calcular radio basado en dispersión
            const radius = this.calculateRadius(points, center);

            return {
                center,
                radius: Math.min(radius, 5000), // Máximo 5km
                criticalCount: points.length
            };

        } catch (error) {
            logger.warn('Error encontrando cluster crítico', this.context, { ranchId });
            return null;
        }
    }

    /**
     * Calcula el centroide de un conjunto de puntos
     */
    private calculateCentroid(points: HeatmapPoint[]): { lat: number; lng: number } {
        const sum = points.reduce(
            (acc, p) => ({
                lat: acc.lat + p.lat,
                lng: acc.lng + p.lng
            }),
            { lat: 0, lng: 0 }
        );

        return {
            lat: sum.lat / points.length,
            lng: sum.lng / points.length
        };
    }

    /**
     * Calcula el radio que cubre el 95% de los puntos
     */
    private calculateRadius(
        points: HeatmapPoint[],
        center: { lat: number; lng: number }
    ): number {
        // Calcular distancias desde el centro
        const distances = points.map(p => this.haversineDistance(
            center.lat, center.lng,
            p.lat, p.lng
        ));

        // Ordenar y tomar percentil 95
        distances.sort((a, b) => a - b);
        const index95 = Math.floor(distances.length * 0.95);

        return distances[index95] || 0;
    }

    /**
     * Calcula distancia Haversine (en metros)
     */
    private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371000; // Radio de la Tierra en metros
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
     * Calcula valor ponderado según campo seleccionado
     */
    private calculateWeightedValue(
        point: HeatmapPoint,
        weightField: 'weight' | 'age' | 'production'
    ): number {
        // Valor base es la intensidad por estado de salud
        let baseValue = point.value;

        // Ajustar según el campo de peso
        switch (weightField) {
            case 'weight':
                // Normalizar peso entre 0 y 1 (asumiendo 0-1000kg)
                /*const weight = point.metadata.weight || 0;
                const weightFactor = Math.min(weight / 1000, 1);
                baseValue = (baseValue + weightFactor) / 2;*/
                // TODO: Implementar cuando weight esté disponible en el snapshot
                // Por ahora usamos solo el valor base
                baseValue = baseValue;
                break;

            case 'age':
                // Normalizar edad entre 0 y 1 (asumiendo 0-120 meses)
                const age = point.metadata.age || 0;
                const ageFactor = Math.min(age / 120, 1);
                baseValue = (baseValue + ageFactor) / 2;
                break;

            case 'production':
                // Producción necesita datos adicionales
                baseValue = baseValue * 1.2; // Factor de ajuste
                break;
        }

        // Asegurar que el valor esté entre 0 y 1
        return Math.min(Math.max(baseValue, 0), 1);
    }

    /**
     * Obtiene etiqueta de estado de salud en español
     */
    private getHealthStatusLabel(status: HealthStatus): string {
        return HEALTH_LABELS[status] || status;
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
     * Obtiene configuración por defecto del heatmap
     */
    getDefaultConfig(): HeatmapConfig {
        return { ...DEFAULT_HEATMAP_CONFIG };
    }

    /**
     * Genera gradiente personalizado para heatmap
     */
    generateGradient(colors: Record<number, string>): Record<number, string> {
        return { ...DEFAULT_HEATMAP_CONFIG.gradient, ...colors };
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const heatmapService = new HeatmapService();