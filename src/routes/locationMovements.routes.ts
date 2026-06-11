// routes/locationMovements.routes.ts
// ============================================================================
// LOCATION MOVEMENTS ROUTES
// ============================================================================
// GET /api/locations/:id/movements — historial de entradas/salidas de bovinos
// para una ubicación específica.
// ============================================================================

import { Router } from 'express';
import { locationMovementsController } from '../controllers/locationMovements.controller';
import { authenticateToken } from '../middleware/auth';
import { validateId } from '../middleware/validation';

const router = Router();

router.use(authenticateToken);

router.get(
  '/:id/movements',
  validateId('id'),
  locationMovementsController.getMovements
);

export default router;
