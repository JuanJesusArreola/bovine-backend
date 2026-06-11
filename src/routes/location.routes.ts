// routes/location.routes.ts
import { Router } from 'express';
import { locationController } from '../controllers/location.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateId } from '../middleware/validation';
import { UserRole } from '../models/User';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// ==============================================================
// Rutas CRUD (accesibles para roles con acceso a ranchos)
// ==============================================================
router.get('/', locationController.listLocations);
router.get('/nearby', locationController.getNearbyLocations);
router.get('/types/:type/label', locationController.getLocationTypeLabel);
router.get('/status/:status/label', locationController.getStatusLabel);
router.get('/:id', validateId('id'), locationController.getLocationById);
router.get('/:id/summary', validateId('id'), locationController.getLocationSummary);
router.get('/distance/:id1/:id2', validateId('id1'), validateId('id2'), locationController.calculateDistance);

// Rutas de escritura (requieren permisos de administración o gestión de ranchos)
router.post(
  '/',
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.RANCH_MANAGER),
  locationController.createLocation
);
router.put(
  '/:id',
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.RANCH_MANAGER),
  validateId('id'),
  locationController.updateLocation
);
router.delete(
  '/:id',
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.RANCH_MANAGER),
  validateId('id'),
  locationController.deleteLocation
);

export default router;