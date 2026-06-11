// routes/analytics.routes.ts
import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

// ============================================================================
// MIDDLEWARE GLOBAL
// ============================================================================

/**
 * Todas las rutas de analytics requieren autenticación
 */
router.use(authenticateToken);

// ============================================================================
// DASHBOARD
// ============================================================================

/**
 * GET /api/analytics/dashboard
 * Obtiene dashboard completo (salud, producción, finanzas)
 * 
 * @query ranchId - ID del rancho (requerido)
 * @query period - day|week|month|quarter|year|custom (default: month)
 * @query startDate - Fecha de inicio (para período custom)
 * @query endDate - Fecha de fin (para período custom)
 * @query compareWithPrevious - true|false (default: false)
 * 
 * @access VIEWER, WORKER, VETERINARIAN, MANAGER, SUPER_ADMIN, OWNER
 */
router.get(
    '/dashboard',
    authorizeRoles(
        UserRole.VIEWER,
        UserRole.WORKER,
        UserRole.VETERINARIAN,
        UserRole.MANAGER,
        UserRole.SUPER_ADMIN,
        UserRole.OWNER
    ),
    analyticsController.getDashboard
);

// ============================================================================
// MAPA (Heatmap + Clusters)
// ============================================================================

/**
 * POST /api/analytics/map
 * Obtiene datos para el mapa (clusters o heatmap según zoom)
 * 
 * @body ranchId - ID del rancho (requerido)
 * @body bounds - Límites geográficos { north, south, east, west } (requerido)
 * @body zoom - Nivel de zoom de Leaflet (requerido)
 * @body healthStatus - Lista de estados de salud (opcional)
 * @body breeds - Lista de razas (opcional)
 * @body ageMin - Edad mínima en meses (opcional)
 * @body ageMax - Edad máxima en meses (opcional)
 * 
 * @access VIEWER, WORKER, VETERINARIAN, MANAGER, SUPER_ADMIN, OWNER
 */
router.post(
    '/map',
    authorizeRoles(
        UserRole.VIEWER,
        UserRole.WORKER,
        UserRole.VETERINARIAN,
        UserRole.MANAGER,
        UserRole.SUPER_ADMIN,
        UserRole.OWNER
    ),
    analyticsController.getMapData
);

/**
 * GET /api/analytics/heatmap/stats
 * Obtiene estadísticas del heatmap
 * 
 * @query ranchId - ID del rancho (requerido)
 * @query healthStatus - Lista de estados de salud (opcional)
 * @query breeds - Lista de razas (opcional)
 * @query ageMin - Edad mínima en meses (opcional)
 * @query ageMax - Edad máxima en meses (opcional)
 * @query startDate - Fecha de inicio para análisis histórico (opcional)
 * @query endDate - Fecha de fin para análisis histórico (opcional)
 * 
 * @access VIEWER, WORKER, VETERINARIAN, MANAGER, SUPER_ADMIN, OWNER
 */
router.get(
    '/heatmap/stats',
    authorizeRoles(
        UserRole.VIEWER,
        UserRole.WORKER,
        UserRole.VETERINARIAN,
        UserRole.MANAGER,
        UserRole.SUPER_ADMIN,
        UserRole.OWNER
    ),
    analyticsController.getHeatmapStats
);

/**
 * POST /api/analytics/heatmap/weighted
 * Obtiene datos de heatmap ponderado (por peso, edad, producción)
 * 
 * @body ranchId - ID del rancho (requerido)
 * @body weightField - weight|age|production (requerido)
 * @body healthStatus - Lista de estados de salud (opcional)
 * @body breeds - Lista de razas (opcional)
 * @body ageMin - Edad mínima en meses (opcional)
 * @body ageMax - Edad máxima en meses (opcional)
 * 
 * @access VIEWER, WORKER, VETERINARIAN, MANAGER, SUPER_ADMIN, OWNER
 */
router.post(
    '/heatmap/weighted',
    authorizeRoles(
        UserRole.VIEWER,
        UserRole.WORKER,
        UserRole.VETERINARIAN,
        UserRole.MANAGER,
        UserRole.SUPER_ADMIN,
        UserRole.OWNER
    ),
    analyticsController.getWeightedHeatmap
);

/**
 * POST /api/analytics/heatmap/temporal
 * Obtiene datos de heatmap para una fecha específica (histórico)
 * 
 * @body ranchId - ID del rancho (requerido)
 * @body date - Fecha para la consulta histórica (requerido)
 * @body healthStatus - Lista de estados de salud (opcional)
 * @body breeds - Lista de razas (opcional)
 * @body ageMin - Edad mínima en meses (opcional)
 * @body ageMax - Edad máxima en meses (opcional)
 * 
 * @access VIEWER, WORKER, VETERINARIAN, MANAGER, SUPER_ADMIN, OWNER
 */
router.post(
    '/heatmap/temporal',
    authorizeRoles(
        UserRole.VIEWER,
        UserRole.WORKER,
        UserRole.VETERINARIAN,
        UserRole.MANAGER,
        UserRole.SUPER_ADMIN,
        UserRole.OWNER
    ),
    analyticsController.getTemporalHeatmap
);

// ============================================================================
// CLUSTERS
// ============================================================================

/**
 * POST /api/analytics/cluster/expand
 * Expande un cluster en puntos individuales
 * 
 * @body ranchId - ID del rancho (requerido)
 * @body bounds - Límites del cluster a expandir { north, south, east, west } (requerido)
 * @body healthStatus - Lista de estados de salud (opcional)
 * @body breeds - Lista de razas (opcional)
 * @body ageMin - Edad mínima en meses (opcional)
 * @body ageMax - Edad máxima en meses (opcional)
 * 
 * @access VIEWER, WORKER, VETERINARIAN, MANAGER, SUPER_ADMIN, OWNER
 */
router.post(
    '/cluster/expand',
    authorizeRoles(
        UserRole.VIEWER,
        UserRole.WORKER,
        UserRole.VETERINARIAN,
        UserRole.MANAGER,
        UserRole.SUPER_ADMIN,
        UserRole.OWNER
    ),
    analyticsController.expandCluster
);

/**
 * GET /api/analytics/cluster/stats
 * Obtiene estadísticas de clustering
 * 
 * @query ranchId - ID del rancho (requerido)
 * @query bounds - Límites geográficos (requerido, formato JSON)
 * @query zoom - Nivel de zoom (requerido)
 * @query healthStatus - Lista de estados de salud (opcional)
 * 
 * @access VIEWER, WORKER, VETERINARIAN, MANAGER, SUPER_ADMIN, OWNER
 */
router.get(
    '/cluster/stats',
    authorizeRoles(
        UserRole.VIEWER,
        UserRole.WORKER,
        UserRole.VETERINARIAN,
        UserRole.MANAGER,
        UserRole.SUPER_ADMIN,
        UserRole.OWNER
    ),
    analyticsController.getClusterStats
);

/**
 * POST /api/analytics/nearby-clusters
 * Encuentra clusters cercanos a un punto
 * 
 * @body ranchId - ID del rancho (requerido)
 * @body point - Punto central { lat, lng } (requerido)
 * @body radiusKm - Radio de búsqueda en kilómetros (requerido)
 * @body zoom - Nivel de zoom (opcional, default: 12)
 * 
 * @access VIEWER, WORKER, VETERINARIAN, MANAGER, SUPER_ADMIN, OWNER
 */
router.post(
    '/nearby-clusters',
    authorizeRoles(
        UserRole.VIEWER,
        UserRole.WORKER,
        UserRole.VETERINARIAN,
        UserRole.MANAGER,
        UserRole.SUPER_ADMIN,
        UserRole.OWNER
    ),
    analyticsController.findNearbyClusters
);

export default router;