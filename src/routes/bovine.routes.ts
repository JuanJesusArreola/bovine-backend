import { Router } from 'express';
import { bovineController } from '../controllers/bovine.controller';
import { bovineGeoController } from '../controllers/bovine-geo.controller';
import { bovineHealthController } from '../controllers/bovine-health.controller';
import { bovineTrackingController } from '../controllers/bovine-tracking.controller';
import { bovineLocationController } from '../controllers/bovine-location.controller';
import { bovineFiltersController } from '../controllers/bovineFilters.controller';
import { bovineFullController } from '../controllers/bovineFull.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateId, sanitizeInput } from '../middleware/validation';
import { createBovineSchema, updateBovineSchema, listBovinesSchema, recordHealthCheckSchema, runValidation } from '../validators';
import { UserRole } from '../models/User';

const router = Router();

// ============================================================================
// MIDDLEWARE GLOBAL
// ============================================================================
router.use(sanitizeInput);

// ============================================================================
// RUTAS CRUD DE BOVINOS
// ============================================================================

/**
 * GET /api/bovines
 * Lista bovinos con filtros (paginación, búsqueda, etc.)
 */
router.get(
    '/',
    authenticateToken,
    ...listBovinesSchema,
    runValidation,
    bovineController.listBovines
);

/**
 * GET /api/bovines/statistics
 * Obtiene estadísticas generales de bovinos
 */
router.get(
    '/statistics',
    authenticateToken,
    bovineController.getStatistics
);

/**
 * GET /api/bovines/ear-tag/:earTag
 * Busca un bovino por su arete
 */
router.get(
    '/ear-tag/:earTag',
    authenticateToken,
    bovineController.getBovineByEarTag
);

/**
 * GET /api/bovines/filters/options
 * Catálogo para dropdowns: tipos, géneros, estados de salud, vacunas, razas.
 * Cache 1h. Debe ir ANTES de /:id para no chocar con la ruta paramétrica.
 */
router.get(
    '/filters/options',
    authenticateToken,
    bovineFiltersController.getFilterOptions
);

/**
 * GET /api/bovines/filters/active-diseases
 * Devuelve solo las enfermedades con al menos un caso activo en los ranchos
 * accesibles del usuario. Cache 5min por combinación de ranchos.
 * Debe ir ANTES de /:id para no chocar con la ruta paramétrica.
 */
router.get(
    '/filters/active-diseases',
    authenticateToken,
    bovineFiltersController.getActiveDiseases
);

/**
 * GET /api/bovines/:id
 * Obtiene un bovino por su ID
 */
router.get(
    '/:id',
    authenticateToken,
    validateId('id'),
    bovineController.getBovineById
);

/**
 * GET /api/bovines/:id/full
 * Detalle COMPLETO del bovino (compuesto). Reduce 6+ round-trips a 1.
 * Cache 5min en memoria, invalidación cruzada con mutaciones.
 */
router.get(
    '/:id/full',
    authenticateToken,
    validateId('id'),
    bovineFullController.getFullDetail
);

/**
 * POST /api/bovines
 * Crea un nuevo bovino (requiere rol ADMIN o MANAGER o OWNER)
 */
router.post(
    '/',
    authenticateToken,
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.OWNER, UserRole.RANCH_MANAGER),
    ...createBovineSchema,
    runValidation,
    bovineController.createBovine
);

/**
 * POST /api/bovines/:id/sick  (C-04)
 * Marca enfermo a un bovino existente (abre un caso clínico).
 */
router.post(
    '/:id/sick',
    authenticateToken,
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.VETERINARIAN),
    validateId('id'),
    bovineController.markSick
);

/**
 * POST /api/bovines/:id/decease  (X-03)
 * Registra la muerte/baja de un bovino. Permiso de gestión.
 */
router.post(
    '/:id/decease',
    authenticateToken,
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.VETERINARIAN),
    validateId('id'),
    bovineController.decease
);

/**
 * PUT /api/bovines/:id
 * Actualiza un bovino existente (requiere rol ADMIN o MANAGER o OWNER)
 */
router.put(
    '/:id',
    authenticateToken,
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.OWNER, UserRole.RANCH_MANAGER),
    validateId('id'),
    ...updateBovineSchema,
    runValidation,
    bovineController.updateBovine
);

/**
 * DELETE /api/bovines/:id
 * Elimina (soft delete) un bovino (requiere rol ADMIN)
 */
router.delete(
    '/:id',
    authenticateToken,
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.RANCH_MANAGER), // CORREGIDO: solo un rol
    validateId('id'),
    bovineController.deleteBovine
);

/**
 * POST /api/bovines/:id/regenerate-qr
 * Regenera el código QR de un bovino (requiere rol ADMIN o MANAGER)
 */
router.post(
    '/:id/regenerate-qr',
    authenticateToken,
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.OWNER, UserRole.RANCH_MANAGER), // CORREGIDO
    validateId('id'),
    bovineController.regenerateQR
);

// ============================================================================
// RUTAS GEOESPACIALES (MAPAS Y CLUSTERS)
// ============================================================================

/**
 * GET /api/bovines/geo/heatmap/:ranchId
 * Obtiene datos para mapa de calor
 */
router.get(
    '/geo/heatmap/:ranchId',
    authenticateToken,
    validateId('ranchId'),
    bovineGeoController.getHeatmap
);

/**
 * GET /api/bovines/geo/map-markers
 * Markers individuales (o clusters) con TODOS los filtros del listado.
 * Soporta multi-rancho (ranchIds CSV), bbox (north/south/east/west) y zoom.
 * Aplica permisos del usuario sobre ranchos automáticamente.
 */
router.get(
    '/geo/map-markers',
    authenticateToken,
    bovineGeoController.getMapMarkers
);

/**
 * POST /api/bovines/geo/clusters/:ranchId
 * Obtiene clusters de bovinos en el mapa
 */
router.post(
    '/geo/clusters/:ranchId',
    authenticateToken,
    validateId('ranchId'),
    bovineGeoController.getClusters
);

/**
 * POST /api/bovines/geo/cluster/expand/:ranchId
 * Expande un cluster para mostrar puntos individuales
 */
router.post(
    '/geo/cluster/expand/:ranchId',
    authenticateToken,
    validateId('ranchId'),
    bovineGeoController.expandCluster
);

/**
 * GET /api/bovines/geo/point/:bovineId
 * Obtiene el punto geográfico de un bovino específico
 */
router.get(
    '/geo/point/:bovineId',
    authenticateToken,
    validateId('bovineId'),
    bovineGeoController.getBovinePoint
);

/**
 * POST /api/bovines/geo/refresh/:ranchId
 * Refresca snapshots geoespaciales de un rancho (solo ADMIN)
 */
router.post(
    '/geo/refresh/:ranchId',
    authenticateToken,
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.RANCH_MANAGER), // CORREGIDO
    validateId('ranchId'),
    bovineGeoController.refreshSnapshots
);

// ============================================================================
// RUTAS DE SALUD
// ============================================================================

/**
 * POST /api/bovines/health/check
 * Registra un chequeo de salud
 */
router.post(
    '/health/check',
    authenticateToken,
    ...recordHealthCheckSchema,
    runValidation,
    bovineHealthController.recordHealthCheck
);

/**
 * GET /api/bovines/:bovineId/health/needs-check
 * Verifica si un bovino necesita chequeo
 */
router.get(
    '/:bovineId/health/needs-check',
    authenticateToken,
    validateId('bovineId'),
    bovineHealthController.needsHealthCheck
);

/**
 * POST /api/bovines/:bovineId/health/schedule-next
 * Programa el próximo chequeo (requiere ADMIN o VETERINARIAN)
 */
router.post(
    '/:bovineId/health/schedule-next',
    authenticateToken,
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.VETERINARIAN), // CORREGIDO
    validateId('bovineId'),
    bovineHealthController.scheduleNextHealthCheck
);

/**
 * PUT /api/bovines/:bovineId/health/status
 * Actualiza el estado de salud de un bovino (requiere ADMIN o VETERINARIAN)
 */
router.put(
    '/:bovineId/health/status',
    authenticateToken,
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.VETERINARIAN, UserRole.OWNER, UserRole.RANCH_MANAGER, UserRole.MANAGER), // CORREGIDO
    validateId('bovineId'),
    bovineHealthController.updateHealthStatus
);

/**
 * GET /api/bovines/:bovineId/health/history
 * Obtiene el historial de salud de un bovino
 */
router.get(
    '/:bovineId/health/history',
    authenticateToken,
    validateId('bovineId'),
    bovineHealthController.getHealthHistory
);

/**
 * GET /api/bovines/health/stats/:ranchId
 * Obtiene estadísticas de salud del hato
 */
router.get(
    '/health/stats/:ranchId',
    authenticateToken,
    validateId('ranchId'),
    bovineHealthController.getHerdHealthStats
);

/**
 * GET /api/bovines/:bovineId/health/timeline
 * Obtiene línea de tiempo de salud para gráficos
 */
router.get(
    '/:bovineId/health/timeline',
    authenticateToken,
    validateId('bovineId'),
    bovineHealthController.getHealthTimeline
);

// ============================================================================
// RUTAS DE TRACKING EN TIEMPO REAL
// ============================================================================

/**
 * POST /api/bovines/tracking/location
 * Registra un nuevo punto de ubicación
 */
router.post(
    '/tracking/location',
    authenticateToken,
    bovineTrackingController.recordLocation
);

/**
 * POST /api/bovines/tracking/batch
 * Registra múltiples ubicaciones en lote (solo ADMIN)
 */
router.post(
    '/tracking/batch',
    authenticateToken,
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.RANCH_MANAGER), // CORREGIDO
    bovineTrackingController.recordBatchLocations
);

/**
 * GET /api/bovines/:bovineId/tracking/last
 * Obtiene la última ubicación de un bovino
 */
router.get(
    '/:bovineId/tracking/last',
    authenticateToken,
    validateId('bovineId'),
    bovineTrackingController.getLastLocation
);

/**
 * GET /api/bovines/:bovineId/tracking/history
 * Obtiene historial de ubicaciones
 */
router.get(
    '/:bovineId/tracking/history',
    authenticateToken,
    validateId('bovineId'),
    bovineTrackingController.getLocationHistory
);

/**
 * GET /api/bovines/:bovineId/tracking/path
 * Obtiene ruta de movimiento para animación
 */
router.get(
    '/:bovineId/tracking/path',
    authenticateToken,
    validateId('bovineId'),
    bovineTrackingController.getMovementPath
);

/**
 * GET /api/bovines/:bovineId/tracking/stats
 * Obtiene estadísticas de movimiento
 */
router.get(
    '/:bovineId/tracking/stats',
    authenticateToken,
    validateId('bovineId'),
    bovineTrackingController.getMovementStats
);

/**
 * GET /api/bovines/tracking/distance/:bovineId
 * Calcula distancia recorrida en un período
 */
router.get(
    '/tracking/distance/:bovineId',
    authenticateToken,
    validateId('bovineId'),
    bovineTrackingController.calculateDistance
);

/**
 * GET /api/bovines/tracking/device/:deviceId/status
 * Obtiene estado de un dispositivo de tracking
 */
router.get(
    '/tracking/device/:deviceId/status',
    authenticateToken,
    bovineTrackingController.getDeviceStatus
);

/**
 * GET /api/bovines/tracking/ws
 * Información sobre WebSocket
 */
router.get(
    '/tracking/ws',
    authenticateToken,
    bovineTrackingController.websocketInfo
);

// ============================================================================
// RUTAS DE UBICACIONES (ENTRADAS/SALIDAS DE POTREROS)
// ============================================================================

/**
 * POST /api/bovines/location/entry
 * Registra entrada a una ubicación
 */
router.post(
    '/location/entry',
    authenticateToken,
    bovineLocationController.recordEntry
);

/**
 * POST /api/bovines/location/exit
 * Registra salida de una ubicación
 */
router.post(
    '/location/exit',
    authenticateToken,
    bovineLocationController.recordExit
);

/**
 * GET /api/bovines/:bovineId/location/current
 * Obtiene ubicación actual de un bovino (formato legacy: solo stay).
 */
router.get(
    '/:bovineId/location/current',
    authenticateToken,
    validateId('bovineId'),
    bovineLocationController.getCurrentLocation
);

/**
 * GET /api/bovines/:id/current-location
 * Ubicación actual CONSOLIDADA: stay activa + último GPS + status derivado.
 * Endpoint preferido para vista de detalle del bovino. No retorna 404 si no
 * hay ubicación; retorna status UNKNOWN.
 */
router.get(
    '/:id/current-location',
    authenticateToken,
    validateId('id'),
    bovineLocationController.getCurrentLocationConsolidated
);

/**
 * GET /api/bovines/location/:locationId/current
 * Lista bovinos actualmente en una ubicación
 */
router.get(
    '/location/:locationId/current',
    authenticateToken,
    validateId('locationId'),
    bovineLocationController.getCurrentBovinesAtLocation
);

/**
 * GET /api/bovines/:bovineId/location/history
 * Obtiene historial de ubicaciones de un bovino
 */
router.get(
    '/:bovineId/location/history',
    authenticateToken,
    validateId('bovineId'),
    bovineLocationController.getLocationHistory
);

/**
 * GET /api/bovines/:bovineId/location/time-spent
 * Calcula tiempo pasado en cada ubicación
 */
router.get(
    '/:bovineId/location/time-spent',
    authenticateToken,
    validateId('bovineId'),
    bovineLocationController.getTimeSpentPerLocation
);

/**
 * GET /api/bovines/location/report/movements/:ranchId
 * Genera reporte de movimientos del rancho
 */
router.get(
    '/location/report/movements/:ranchId',
    authenticateToken,
    validateId('ranchId'),
    bovineLocationController.generateMovementReport
);

/**
 * GET /api/bovines/location/report/pasture/:ranchId
 * Obtiene reporte de utilización de potreros
 */
router.get(
    '/location/report/pasture/:ranchId',
    authenticateToken,
    validateId('ranchId'),
    bovineLocationController.getPastureUtilization
);

// ============================================================================
// NUEVAS RUTAS DE TRACKING (GEOFENCING, RADIO, ESTADÍSTICAS)
// ============================================================================

/**
 * POST /api/bovines/tracking/geofence
 * Crea una nueva geofence (requiere rol MANAGER)
 */
router.post(
    '/tracking/geofence',
    authenticateToken,
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.OWNER, UserRole.RANCH_MANAGER),
    bovineTrackingController.createGeofence
);

/**
 * GET /api/bovines/tracking/radius
 * Busca bovinos dentro de un radio alrededor de un punto central
 */
router.get(
    '/tracking/radius',
    authenticateToken,
    bovineTrackingController.findBovinesInRadius
);

/**
 * GET /api/bovines/tracking/geo-stats/:ranchId
 * Obtiene estadísticas geoespaciales de un rancho
 */
router.get(
    '/tracking/geo-stats/:ranchId',
    authenticateToken,
    validateId('ranchId'),
    bovineTrackingController.getGeoStatistics
);

router.patch(
    '/:id/location',
    authenticateToken,
    validateId('id'),
    bovineLocationController.updateLocation
);

export default router;