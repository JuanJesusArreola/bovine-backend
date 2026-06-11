// routes/locationGeofence.routes.ts
import { Router } from 'express';
import { locationGeofenceController } from '../controllers/locationGeofence.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateId } from '../middleware/validation';
import { UserRole } from '../models/User';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas de verificación de geocercas
router.post('/location/:locationId/inside', validateId('locationId'), locationGeofenceController.isPointInsideGeofence);
router.post('/circle', locationGeofenceController.isPointInCircle);
router.post('/rectangle', locationGeofenceController.isPointInRectangle);
router.post('/polygon', locationGeofenceController.isPointInPolygon);
router.post('/corridor', locationGeofenceController.isPointInCorridor);
router.post('/distance-to-segment', locationGeofenceController.distanceToSegment);
router.get('/location/:locationId/center', validateId('locationId'), locationGeofenceController.getGeofenceCenter);

export default router;