// src/routes/finance.routes.ts
import { Router } from 'express';
import { financeController } from '../controllers/finance.controller';
import { authenticateToken } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/role';
import { UserRole } from '../models/User';
import { validateFinance } from '../validators/finance.validators';

const router = Router();

router.use(authenticateToken);

// CRUD (solo roles con acceso financiero)
router.post(
  '/',
  requireMinimumRole(UserRole.MANAGER),
  validateFinance('createTransaction'),
  financeController.createTransaction
);
router.get(
  '/',
  requireMinimumRole(UserRole.VIEWER),
  financeController.listTransactions
);
router.get(
  '/:id',
  requireMinimumRole(UserRole.VIEWER),
  financeController.getTransactionById
);
router.put(
  '/:id',
  requireMinimumRole(UserRole.MANAGER),
  validateFinance('updateTransaction'),
  financeController.updateTransaction
);
router.delete(
  '/:id',
  requireMinimumRole(UserRole.SUPER_ADMIN),
  financeController.deleteTransaction
);

// Métricas y reportes
router.get(
  '/summary',
  requireMinimumRole(UserRole.VIEWER),
  financeController.getFinancialSummary
);
router.get(
  '/veterinary-costs',
  requireMinimumRole(UserRole.VIEWER),
  financeController.getVeterinaryCosts
);
router.get(
  '/roi-analysis',
  requireMinimumRole(UserRole.VIEWER),
  financeController.getROIAnalysis
);

export default router;