// routes/ranchOccupancy.routes.ts
// ============================================================================
// RANCH OCCUPANCY ROUTES
// ============================================================================
// Endpoints que agregan información de capacidad de todas las ubicaciones
// pertenecientes a un rancho específico.
// ============================================================================

import { Router } from 'express';
import { locationCapacityController } from '../controllers/locationCapacity.controller';
import { authenticateToken } from '../middleware/auth';
import { validateId } from '../middleware/validation';

const router = Router();

router.use(authenticateToken);

/**
 * GET /api/ranches/:ranchId/occupancy
 * Suma las ocupaciones actuales (currentAnimals) de todas las ubicaciones
 * del rancho y devuelve totales + desglose por ubicación.
 */
router.get(
  '/:ranchId/occupancy',
  validateId('ranchId'),
  locationCapacityController.getRanchOccupancy
);

export default router;
