// routes/ranchCore.routes.ts
import { Router } from 'express';
import { ranchCoreController } from '../../controllers/ranch/ranch.controller';
import { authenticateToken, authorizeRoles } from '../../middleware/auth';
import { validateId } from '../../middleware/validation';
import { validateRanch } from '../../validators/ranch.validators';
import { UserRole } from '../../models/User';

const router = Router();

router.use(authenticateToken);

// Rutas CRUD
router.post('/', validateRanch('createRanch'), ranchCoreController.createRanch);
router.get('/', ranchCoreController.listRanches);
router.get('/:id', validateId('id'), ranchCoreController.getRanchById);
router.put('/:id', validateId('id'), validateRanch('updateRanch'), ranchCoreController.updateRanch);
router.delete('/:id', authorizeRoles(UserRole.OWNER, UserRole.SUPER_ADMIN), validateId('id'), ranchCoreController.deleteRanch);

// Métricas
router.get('/:id/occupancy', validateId('id'), ranchCoreController.getOccupancyRate);
router.get('/:id/available-capacity', validateId('id'), ranchCoreController.getAvailableCapacity);
router.get('/:id/at-capacity', validateId('id'), ranchCoreController.isAtCapacity);
router.get('/:id/cattle-density', validateId('id'), ranchCoreController.getCattleDensity);

// Resumen
router.get('/:id/summary', validateId('id'), ranchCoreController.getRanchSummary);

// ── Perímetro (boundary) — endpoint dedicado ─────────────────────────────────
// GET  → devuelve solo el boundary (cualquier rol autenticado puede leer)
// PUT  → actualiza boundary; valida que las locations existentes sigan dentro.
router.get(
  '/:id/boundary',
  validateId('id'),
  ranchCoreController.getRanchBoundary
);
router.put(
  '/:id/boundary',
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.RANCH_MANAGER),
  validateId('id'),
  validateRanch('updateBoundary'),
  ranchCoreController.updateRanchBoundary
);

// Utilidades (etiquetas)
router.get('/type/:type/label', ranchCoreController.getRanchTypeLabel);
router.get('/status/:status/label', ranchCoreController.getStatusLabel);

export default router;