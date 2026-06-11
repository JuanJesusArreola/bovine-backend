// src/routes/reports.routes.ts
import { Router } from 'express';
import { reportsController } from '../controllers/reports.controller';
import { authenticateToken } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/role';
import { UserRole } from '../models/User';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Generar reporte (solo lectura, cualquier usuario autenticado)
router.post(
  '/generate',
  requireMinimumRole(UserRole.VIEWER),
  reportsController.generateReport
);

// Exportar reporte (solo lectura, cualquier usuario autenticado)
router.post(
  '/export',
  requireMinimumRole(UserRole.VIEWER),
  reportsController.exportReport
);

export default router;