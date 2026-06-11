// routes/locationRelationByLocation.routes.ts
import { Router } from 'express';
import { locationRelationController } from '../controllers/locationRelation.controller';
import { authenticateToken } from '../middleware/auth';
import { validateId } from '../middleware/validation';

/**
 * ============================================================================
 * RUTAS DE RELACIONES POR UBICACIÓN
 * ============================================================================
 *
 * Atajos de lectura bajo /api/locations/:locationId/relations/*
 *
 * Todas requieren autenticación (solo lectura).
 * ============================================================================
 */

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/locations/:locationId/relations/children
 * Ubicaciones que contiene (hijas en jerarquía CONTAINS).
 */
router.get(
  '/:locationId/relations/children',
  validateId('locationId'),
  locationRelationController.getChildren
);

/**
 * GET /api/locations/:locationId/relations/parents
 * Ubicaciones padre (inversa de CONTAINS).
 */
router.get(
  '/:locationId/relations/parents',
  validateId('locationId'),
  locationRelationController.getParents
);

/**
 * GET /api/locations/:locationId/relations/adjacent
 * Ubicaciones adyacentes (ADJACENT).
 */
router.get(
  '/:locationId/relations/adjacent',
  validateId('locationId'),
  locationRelationController.getAdjacent
);

/**
 * GET /api/locations/:locationId/relations/connected
 * Ubicaciones conectadas físicamente (CONNECTED).
 */
router.get(
  '/:locationId/relations/connected',
  validateId('locationId'),
  locationRelationController.getConnected
);

export default router;
