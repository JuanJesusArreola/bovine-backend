// dtos/analytics-response.dto.ts
import { HealthStatus } from '../models/Bovine';

/**
 * DTO para respuesta de dashboard
 */
export interface DashboardResponse {
    health: HealthDashboardResponse;
    production: ProductionDashboardResponse;
    financial: FinancialDashboardResponse;
    summary: DashboardSummaryResponse;
    generatedAt: Date;
}

export interface HealthDashboardResponse {
    totalBovines: number;
    byStatus: Record<HealthStatus, number>;
    healthyPercentage: number;
    sickPercentage: number;
    criticalCount: number;
    recentChecks: number;
    upcomingChecks: number;
    commonDiagnosis: Array<{ diagnosis: string; count: number }>;
    recentHealthEvents: Array<{
        id: string;
        date: Date;
        type: string;
        bovineId: string;
        bovineEarTag?: string;
        description: string;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }>;
    upcomingHealthChecks: number;
    overdueHealthChecks: number;
}

export interface ProductionDashboardResponse {
    currentPeriod: { startDate: Date; endDate: Date };
    milkProduction: {
        total: number;
        averagePerCow: number;
        vsLastPeriod: number;
    };
    meatProduction: {
        total: number;
        averagePerAnimal: number;
        vsLastPeriod: number;
    };
    reproduction: {
        calvingRate: number;
        conceptionRate: number;
        birthsLastMonth: number;
        expectedBirths: number;
    };
    trends: {
        milk: number[];
        meat: number[];
        years: number[];
    };
}

export interface FinancialDashboardResponse {
    currentPeriod: { startDate: Date; endDate: Date };
    totals: {
        income: number;
        expenses: number;
        net: number;
        profitMargin: number;
    };
    byCategory: {
        income: Array<{ category: string; amount: number; percentage: number }>;
        expenses: Array<{ category: string; amount: number; percentage: number }>;
    };
    veterinaryCosts: {
        total: number;
        trend: 'INCREASING' | 'DECREASING' | 'STABLE';
        percentageOfExpenses: number;
    };
    roi: number;
}

export interface DashboardSummaryResponse {
    totalBovines: number;
    activeAlerts: number;
    pendingTasks: number;
    unreadNotifications: number;
    criticalHealthIssues: number;
    lowStockItems: number;
}

/**
 * DTO para respuesta de mapa
 */
export interface MapDataResponse {
    type: 'clusters' | 'points';
    data: ClusterResponse[] | HeatmapPointResponse[];
    stats: {
        totalPoints: number;
        visiblePoints: number;
        zoom: number;
    };
    generatedAt: Date;
}

export interface ClusterResponse {
    id: string;
    center: { lat: number; lng: number };
    pointCount: number;
    bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
    };
    healthStatuses: HealthStatus[];
    avgSeverity: number;
    healthStatusLabels: string[];
    predominantColor: string;
    predominantHealthStatus: HealthStatus;
    severityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    centerLabel: string;
}

export interface HeatmapPointResponse {
    id: string;
    lat: number;
    lng: number;
    value: number;
    color: string;
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
 * DTO para estadísticas de heatmap
 */
export interface HeatmapStatsResponse {
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
 * DTO para estadísticas de clustering
 */
export interface ClusterStatsResponse {
    totalClusters: number;
    totalPoints: number;
    averageClusterSize: number;
    largestCluster: {
        size: number;
        center: { lat: number; lng: number };
        healthStatuses: HealthStatus[];
    } | null;
    distributionByHealthStatus: Record<HealthStatus, number>;
    clusterDensity: number;
}