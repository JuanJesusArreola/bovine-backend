// routes/locationMonitoring.routes.ts
import { Router } from 'express';
import { locationMonitoringController } from '../controllers/locationMonitoring.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateId } from '../middleware/validation';
import { UserRole } from '../models/User';

/**
 * ============================================================================
 * RUTAS DE LOCATION MONITORING
 * ============================================================================
 *
 * Endpoints para gestionar el monitoreo IoT de ubicaciones:
 *   - Configuración (modo, intervalo, dispositivo, umbrales)
 *   - Pings del dispositivo (batería, señal)
 *   - Lecturas ambientales (temperatura, humedad, presión)
 *   - Alertas y resolución
 *   - Mantenimiento
 *   - Dashboards (alertas activas, offline, batería baja, mantenimiento próximo)
 *
 * Todas las rutas se montan bajo /api/locations
 * Todas requieren autenticación.
 *
 * Permisos:
 *   - GET → cualquier usuario autenticado
 *   - Configuración (POST/PUT/PATCH/DELETE) → SUPER_ADMIN, OWNER, MANAGER, RANCH_MANAGER
 *   - Pings y lecturas (operativos) → WRITE_ROLES + VETERINARIAN + WORKER
 *   - Alertas y mantenimiento → WRITE_ROLES + VETERINARIAN
 * ============================================================================
 */

const router = Router();

router.use(authenticateToken);

const WRITE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.RANCH_MANAGER,
];

const OPERATIONAL_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.RANCH_MANAGER,
  UserRole.VETERINARIAN,
  UserRole.WORKER,
];

const ALERT_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.RANCH_MANAGER,
  UserRole.VETERINARIAN,
];

// ============================================================================
// LISTADOS GLOBALES / DASHBOARDS
// ============================================================================

/**
 * GET /api/locations/monitoring/stats
 * Resumen global: monitoreadas, con alertas, offline, mantenimiento, batería baja.
 */
router.get('/monitoring/stats', locationMonitoringController.getGlobalStats);

/**
 * GET /api/locations/monitoring/active-alerts
 * Lista de ubicaciones con alertas activas (unresolvedAlertCount > 0).
 */
router.get('/monitoring/active-alerts', locationMonitoringController.listWithActiveAlerts);

/**
 * GET /api/locations/monitoring/offline-devices?thresholdMinutes=30
 * Dispositivos cuyo último ping supera el umbral (default 30 min).
 */
router.get('/monitoring/offline-devices', locationMonitoringController.listOfflineDevices);

/**
 * GET /api/locations/monitoring/upcoming-maintenance?withinDays=7
 * Dispositivos con mantenimiento próximo a vencer (default 7 días).
 */
router.get('/monitoring/upcoming-maintenance', locationMonitoringController.listUpcomingMaintenance);

/**
 * GET /api/locations/monitoring/low-battery?threshold=20
 * Dispositivos con batería por debajo del umbral (default 20%).
 */
router.get('/monitoring/low-battery', locationMonitoringController.listLowBattery);

// ============================================================================
// CRUD DE MONITOREO POR UBICACIÓN
// ============================================================================

/**
 * GET /api/locations/:locationId/monitoring
 * Obtiene la configuración de monitoreo de la ubicación.
 */
router.get(
  '/:locationId/monitoring',
  validateId('locationId'),
  locationMonitoringController.getMonitoring
);

/**
 * POST /api/locations/:locationId/monitoring
 * Crea la configuración (falla si ya existe).
 */
router.post(
  '/:locationId/monitoring',
  authorizeRoles(...WRITE_ROLES),
  validateId('locationId'),
  locationMonitoringController.createMonitoring
);

/**
 * PUT /api/locations/:locationId/monitoring
 * Upsert: crea si no existe, actualiza si existe. Idempotente.
 */
router.put(
  '/:locationId/monitoring',
  authorizeRoles(...WRITE_ROLES),
  validateId('locationId'),
  locationMonitoringController.upsertMonitoring
);

/**
 * PATCH /api/locations/:locationId/monitoring
 * Actualiza parcialmente (falla si no existe).
 */
router.patch(
  '/:locationId/monitoring',
  authorizeRoles(...WRITE_ROLES),
  validateId('locationId'),
  locationMonitoringController.updateMonitoring
);

/**
 * DELETE /api/locations/:locationId/monitoring
 * Soft delete de la configuración.
 */
router.delete(
  '/:locationId/monitoring',
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.RANCH_MANAGER),
  validateId('locationId'),
  locationMonitoringController.deleteMonitoring
);

// ============================================================================
// ACTIVAR / DESACTIVAR
// ============================================================================

/**
 * POST /api/locations/:locationId/monitoring/enable
 * Activa el monitoreo (crea config por defecto si no existe).
 */
router.post(
  '/:locationId/monitoring/enable',
  authorizeRoles(...WRITE_ROLES),
  validateId('locationId'),
  locationMonitoringController.enableMonitoring
);

/**
 * POST /api/locations/:locationId/monitoring/disable
 * Desactiva el monitoreo.
 */
router.post(
  '/:locationId/monitoring/disable',
  authorizeRoles(...WRITE_ROLES),
  validateId('locationId'),
  locationMonitoringController.disableMonitoring
);

// ============================================================================
// DISPOSITIVO: PING Y LECTURAS
// ============================================================================

/**
 * POST /api/locations/:locationId/monitoring/ping
 * Registra un ping del dispositivo IoT (batería, señal, estado).
 * Body opcional: { deviceBattery, signalStrength, signalQuality, deviceStatus }
 */
router.post(
  '/:locationId/monitoring/ping',
  authorizeRoles(...OPERATIONAL_ROLES),
  validateId('locationId'),
  locationMonitoringController.pingDevice
);

/**
 * POST /api/locations/:locationId/monitoring/reading
 * Registra lectura ambiental. Si cruza umbrales, genera alerta automática.
 * Body: { temperature?, humidity?, pressure? }
 */
router.post(
  '/:locationId/monitoring/reading',
  authorizeRoles(...OPERATIONAL_ROLES),
  validateId('locationId'),
  locationMonitoringController.recordReading
);

// ============================================================================
// ALERTAS
// ============================================================================

/**
 * POST /api/locations/:locationId/monitoring/alert
 * Registra una alerta manual.
 * Body: { alertType, message }
 */
router.post(
  '/:locationId/monitoring/alert',
  authorizeRoles(...ALERT_ROLES),
  validateId('locationId'),
  locationMonitoringController.recordAlert
);

/**
 * POST /api/locations/:locationId/monitoring/alerts/resolve
 * Resuelve alertas. Body opcional: { count }. Si no se envía, resuelve todas.
 */
router.post(
  '/:locationId/monitoring/alerts/resolve',
  authorizeRoles(...ALERT_ROLES),
  validateId('locationId'),
  locationMonitoringController.resolveAlerts
);

// ============================================================================
// MANTENIMIENTO
// ============================================================================

/**
 * POST /api/locations/:locationId/monitoring/maintenance
 * Registra un mantenimiento.
 * Body opcional: { nextMaintenanceAt, maintenanceNotes }
 */
router.post(
  '/:locationId/monitoring/maintenance',
  authorizeRoles(...ALERT_ROLES),
  validateId('locationId'),
  locationMonitoringController.recordMaintenance
);

export default router;
