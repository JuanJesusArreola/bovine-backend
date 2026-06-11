// routes/locationCapacity.routes.ts
import { Router } from 'express';
import { locationCapacityController } from '../controllers/locationCapacity.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

router.use(authenticateToken);

const WRITE_ROLES = [
  UserRole.MANAGER,
  UserRole.RANCH_MANAGER,
  UserRole.SUPER_ADMIN,
  UserRole.OWNER,
];

// Rutas de consulta
router.get('/:locationId/capacity', locationCapacityController.getCapacity);
router.get('/:locationId/occupancy', locationCapacityController.getOccupancyPercentage);
router.get('/:locationId/at-capacity', locationCapacityController.isAtCapacity);
router.get('/:locationId/available', locationCapacityController.getAvailableCapacity);
router.get('/:locationId/stats', locationCapacityController.getCapacityStats);
router.get('/:locationId/current-occupancy', locationCapacityController.getCurrentOccupancy);
router.get('/:locationId/recommend', locationCapacityController.recommendCapacityAdjustment);

// CRUD del registro de capacidad
router.post(
  '/:locationId/capacity',
  authorizeRoles(...WRITE_ROLES),
  locationCapacityController.createCapacity
);
router.put(
  '/:locationId/capacity',
  authorizeRoles(...WRITE_ROLES),
  locationCapacityController.updateCapacity
);
router.patch(
  '/:locationId/capacity',
  authorizeRoles(...WRITE_ROLES),
  locationCapacityController.upsertCapacity
);

// Rutas de modificación atómica
router.post('/:locationId/increment', locationCapacityController.incrementAnimals);
router.post('/:locationId/decrement', locationCapacityController.decrementAnimals);
router.post('/:locationId/meets-requirements', locationCapacityController.meetsRequirements);

export default router;