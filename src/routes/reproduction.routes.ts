// src/routes/reproduction.routes.ts
import { Router } from 'express';
import { reproductionController } from '../controllers/reproduction.controller';
import { authenticateToken } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/role';
import { UserRole } from '../models/User';
import { validateReproduction } from '../validators/reproduction.validators';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// ==========================================================================
// Registro de eventos específicos (requieren rol WORKER o superior)
// ==========================================================================
router.post(
  '/heat',
  requireMinimumRole(UserRole.VIEWER),
  validateReproduction('recordHeat'),
  reproductionController.recordHeat
);
router.post(
  '/insemination',
  requireMinimumRole(UserRole.WORKER),
  validateReproduction('recordInsemination'),
  reproductionController.recordInsemination
);
router.post(
  '/pregnancy',
  requireMinimumRole(UserRole.WORKER),
  validateReproduction('confirmPregnancy'),
  reproductionController.confirmPregnancy
);
router.post(
  '/birth',
  requireMinimumRole(UserRole.WORKER),
  validateReproduction('recordBirth'),
  reproductionController.recordBirth
);

// ==========================================================================
// Consultas (acceso VIEWER)
// ==========================================================================
router.get(
  '/events/:id',
  requireMinimumRole(UserRole.VIEWER),
  reproductionController.getEventById
);
router.get(
  '/events',
  requireMinimumRole(UserRole.VIEWER),
  reproductionController.listEvents
);
router.get(
  '/ranch/:ranchId/events',
  requireMinimumRole(UserRole.VIEWER),
  reproductionController.listEventsByRanch
);
router.get(
  '/metrics/conception-rate',
  requireMinimumRole(UserRole.VIEWER),
  reproductionController.getConceptionRate
);
router.get(
  '/ranch/:ranchId/metrics/calving-interval',
  requireMinimumRole(UserRole.VIEWER),
  reproductionController.getAverageCalvingInterval
);

// ==========================================================================
// Actualización y eliminación (requieren rol WORKER o MANAGER)
// ==========================================================================
router.put(
  '/events/:id',
  requireMinimumRole(UserRole.WORKER),
  validateReproduction('updateEvent'),
  reproductionController.updateEvent
);
router.delete(
  '/events/:id',
  requireMinimumRole(UserRole.MANAGER),
  reproductionController.deleteEvent
);

export default router;