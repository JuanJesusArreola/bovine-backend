// routes/locationRelation.routes.ts
import { Router } from 'express';
import { locationRelationController } from '../controllers/locationRelation.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateId } from '../middleware/validation';
import { UserRole } from '../models/User';

/**
 * ============================================================================
 * RUTAS DE LOCATION RELATION
 * ============================================================================
 *
 * Endpoints para gestionar relaciones entre ubicaciones:
 *   - Jerarquías (CONTAINS)
 *   - Adyacencias (ADJACENT)
 *   - Conexiones físicas (CONNECTED) — puertas, caminos, puentes
 *   - Cercanías (NEARBY)
 *
 * Se montan bajo /api/location-relations (rutas globales por ID) y
 * bajo /api/locations/:locationId/relations/* (consultas por ubicación).
 *
 * Permisos:
 *   - GET → cualquier usuario autenticado
 *   - POST/PUT/DELETE → SUPER_ADMIN, OWNER, MANAGER, RANCH_MANAGER
 *   - recordUsage → operacional (se permite a WORKER para tránsito de ganado)
 *   - deactivateExpired → SUPER_ADMIN, OWNER (job/mantenimiento)
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

const USAGE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.RANCH_MANAGER,
  UserRole.VETERINARIAN,
  UserRole.WORKER,
];

// ============================================================================
// UTILIDADES / MANTENIMIENTO
// ============================================================================

/**
 * GET /api/location-relations/stats?locationId=...
 * Conteo de relaciones activas por tipo. Si se pasa locationId, filtra por ella.
 */
router.get('/stats', locationRelationController.getStats);

/**
 * POST /api/location-relations/deactivate-expired
 * Desactiva relaciones cuyo validTo ya pasó. Pensado para cron/jobs.
 */
router.post(
  '/deactivate-expired',
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
  locationRelationController.deactivateExpired
);

/**
 * GET /api/location-relations/between/:locationA/:locationB?relationType=...
 * Busca relaciones directas entre dos ubicaciones.
 */
router.get(
  '/between/:locationA/:locationB',
  validateId('locationA'),
  validateId('locationB'),
  locationRelationController.findBetween
);

// ============================================================================
// LISTADO GENERAL (con filtros por query)
// ============================================================================

/**
 * GET /api/location-relations
 * Filtros disponibles por query:
 *   locationId, sourceLocationId, targetLocationId, relationType,
 *   isActive, isPrimary, bidirectional
 */
router.get('/', locationRelationController.listRelations);

// ============================================================================
// CRUD POR ID
// ============================================================================

/**
 * GET /api/location-relations/:id
 * Obtiene una relación por su ID.
 */
router.get('/:id', validateId('id'), locationRelationController.getRelation);

/**
 * POST /api/location-relations
 * Crea una nueva relación.
 * Body: { sourceLocationId, targetLocationId, relationType, distance?, bidirectional?,
 *         isPrimary?, metadata?, validFrom?, validTo?, isActive? }
 */
router.post(
  '/',
  authorizeRoles(...WRITE_ROLES),
  locationRelationController.createRelation
);

/**
 * PATCH /api/location-relations/:id
 * Actualiza parcialmente una relación.
 */
router.patch(
  '/:id',
  authorizeRoles(...WRITE_ROLES),
  validateId('id'),
  locationRelationController.updateRelation
);

/**
 * DELETE /api/location-relations/:id
 * Soft delete.
 */
router.delete(
  '/:id',
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.RANCH_MANAGER),
  validateId('id'),
  locationRelationController.deleteRelation
);

/**
 * POST /api/location-relations/:id/activate
 */
router.post(
  '/:id/activate',
  authorizeRoles(...WRITE_ROLES),
  validateId('id'),
  locationRelationController.activateRelation
);

/**
 * POST /api/location-relations/:id/deactivate
 */
router.post(
  '/:id/deactivate',
  authorizeRoles(...WRITE_ROLES),
  validateId('id'),
  locationRelationController.deactivateRelation
);

/**
 * POST /api/location-relations/:id/record-usage
 * Incrementa usageCount y actualiza lastUsedAt.
 * Permitido a operativos (registro de tránsito).
 */
router.post(
  '/:id/record-usage',
  authorizeRoles(...USAGE_ROLES),
  validateId('id'),
  locationRelationController.recordUsage
);

export default router;
