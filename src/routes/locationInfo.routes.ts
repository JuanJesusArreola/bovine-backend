// routes/locationInfo.routes.ts
import { Router } from 'express';
import { locationInfoController } from '../controllers/locationInfo.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateId } from '../middleware/validation';
import { UserRole } from '../models/User';

/**
 * ============================================================================
 * RUTAS DE LOCATION INFO
 * ============================================================================
 *
 * Endpoints para gestionar información enriquecida de una ubicación:
 *   - Descripción, notas, tags
 *   - Media: imágenes, documentos, videos, mapas (URLs de Cloudflare R2)
 *   - Inspecciones y revisiones (condición, fechas)
 *
 * Todas las rutas se montan bajo /api/locations
 * Todas requieren autenticación.
 *
 * Permisos:
 *   - GET → cualquier usuario autenticado (lectura)
 *   - POST/PUT/DELETE → SUPER_ADMIN, OWNER, MANAGER, RANCH_MANAGER
 *   - Inspección también permitida a VETERINARIAN
 * ============================================================================
 */

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Roles con permiso de escritura sobre la info
const WRITE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.RANCH_MANAGER,
];

// Roles con permiso para registrar inspecciones (se suma VETERINARIAN)
const INSPECTION_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.RANCH_MANAGER,
  UserRole.VETERINARIAN,
];

// ============================================================================
// LISTADOS GLOBALES
// ============================================================================

/**
 * GET /api/locations/info/needing-inspection
 * Lista ubicaciones cuya próxima inspección está vencida o no programada.
 * Útil para dashboards y alertas.
 */
router.get(
  '/info/needing-inspection',
  locationInfoController.listNeedingInspection
);

// ============================================================================
// CRUD DE INFORMACIÓN POR UBICACIÓN
// ============================================================================

/**
 * GET /api/locations/:locationId/info
 * Obtiene la información enriquecida de la ubicación (descripción, media, etc.)
 */
router.get(
  '/:locationId/info',
  validateId('locationId'),
  locationInfoController.getInfo
);

/**
 * GET /api/locations/:locationId/info/summary
 * Retorna un resumen: condición, conteos de media, próximas inspecciones/revisiones
 */
router.get(
  '/:locationId/info/summary',
  validateId('locationId'),
  locationInfoController.getSummary
);

/**
 * POST /api/locations/:locationId/info
 * Crea el registro de información (falla si ya existe).
 */
router.post(
  '/:locationId/info',
  authorizeRoles(...WRITE_ROLES),
  validateId('locationId'),
  locationInfoController.createInfo
);

/**
 * PUT /api/locations/:locationId/info
 * Upsert: crea si no existe, actualiza si ya existe. Idempotente.
 */
router.put(
  '/:locationId/info',
  authorizeRoles(...WRITE_ROLES),
  validateId('locationId'),
  locationInfoController.upsertInfo
);

/**
 * PATCH /api/locations/:locationId/info
 * Actualiza parcialmente el registro de información (falla si no existe).
 */
router.patch(
  '/:locationId/info',
  authorizeRoles(...WRITE_ROLES),
  validateId('locationId'),
  locationInfoController.updateInfo
);

/**
 * DELETE /api/locations/:locationId/info
 * Soft delete del registro de información (no elimina la ubicación).
 */
router.delete(
  '/:locationId/info',
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.RANCH_MANAGER),
  validateId('locationId'),
  locationInfoController.deleteInfo
);

// ============================================================================
// MEDIA — imágenes, documentos, videos, mapas
// ============================================================================

/**
 * POST /api/locations/:locationId/info/:kind
 * Agrega una URL al array de media del tipo indicado.
 * kind ∈ images | documents | videos | maps
 * Body: { url: string }
 *
 * Flujo recomendado:
 *   1. Subir archivo a /api/uploads → obtener { url }
 *   2. POST aquí con esa URL para persistirla en la ubicación
 */
router.post(
  '/:locationId/info/:kind(images|documents|videos|maps)',
  authorizeRoles(...WRITE_ROLES),
  validateId('locationId'),
  locationInfoController.addMedia
);

/**
 * DELETE /api/locations/:locationId/info/:kind
 * Quita una URL del array de media del tipo indicado.
 * La URL puede ir en body { url } o en query ?url=...
 */
router.delete(
  '/:locationId/info/:kind(images|documents|videos|maps)',
  authorizeRoles(...WRITE_ROLES),
  validateId('locationId'),
  locationInfoController.removeMedia
);

// ============================================================================
// INSPECCIÓN Y REVISIÓN
// ============================================================================

/**
 * POST /api/locations/:locationId/info/inspection
 * Registra una inspección (setea lastInspectionDate=now, inspectedBy=usuario).
 * Body opcional: { inspectionNotes, nextInspectionDate, currentCondition, currentNotes }
 */
router.post(
  '/:locationId/info/inspection',
  authorizeRoles(...INSPECTION_ROLES),
  validateId('locationId'),
  locationInfoController.recordInspection
);

/**
 * POST /api/locations/:locationId/info/review
 * Registra una revisión (setea lastReviewedAt=now, reviewedBy=usuario).
 */
router.post(
  '/:locationId/info/review',
  authorizeRoles(...WRITE_ROLES),
  validateId('locationId'),
  locationInfoController.recordReview
);

export default router;
