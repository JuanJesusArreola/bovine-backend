// routes/medicationInventory.routes.ts
import { Router } from 'express';
import { medicationInventoryController } from '../controllers/medicationInventory.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

router.use(authenticateToken);

// Rutas de consulta (accesibles para roles con acceso a inventario)
router.get('/stock/:medicationCode', medicationInventoryController.getAvailableStock);
router.get('/stock-levels', medicationInventoryController.checkStockLevels);
router.get('/expiring', medicationInventoryController.getExpiringMedications);

// Rutas de escritura (requieren permisos de administración/veterinario)
router.post(
  '/consumption',
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.VETERINARIAN),
  medicationInventoryController.recordConsumption
);
router.post(
  '/purchase',
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.VETERINARIAN),
  medicationInventoryController.recordPurchase
);

export default router;