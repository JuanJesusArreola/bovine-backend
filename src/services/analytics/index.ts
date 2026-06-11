// services/analytics/index.ts
export { AnalyticsService, analyticsService } from './AnalyticsService';
export { DashboardService, dashboardService } from './DashboardService';
export { HeatmapService, heatmapService } from './HeatmapService';
export { ClusterService, clusterService } from './ClusterService';

// Re-exportar tipos
export type {
    FullDashboard,
    HealthDashboard,
    ProductionDashboard,
    FinancialDashboard,
    DashboardSummary,
    DashboardFilters
} from './DashboardService';

export type {
    EnhancedHeatmapPoint,
    HeatmapStats,
    HeatmapConfig,
    HeatmapRequestFilters
} from './HeatmapService';

export type {
    EnhancedCluster,
    ClusterStats,
    ClusterRequestFilters,
    ClusterDisplayConfig
} from './ClusterService';

export type {
    MapDataResponse,
    MapFilters,
    MapDisplayConfig
} from './AnalyticsService';