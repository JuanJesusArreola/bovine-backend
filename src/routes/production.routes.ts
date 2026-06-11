// src/routes/production.routes.ts
import { Router } from 'express';
import { productionController } from '../controllers/production.controller';
import { authenticateToken } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/role';
import { UserRole } from '../models/User';
import { validateProduction } from '../validators/production.validators';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Crear un registro de producción
router.post(
  '/',
  requireMinimumRole(UserRole.WORKER),
  validateProduction('createProduction'),
  productionController.createProduction
);

// Listar producciones con filtros
router.get(
  '/',
  requireMinimumRole(UserRole.VIEWER),
  productionController.listProductions
);

// Obtener un registro por ID
router.get(
  '/:id',
  requireMinimumRole(UserRole.VIEWER),
  productionController.getProductionById
);

// Obtener métricas de un bovino
router.get(
  '/metrics/:bovineId',
  requireMinimumRole(UserRole.VIEWER),
  productionController.getProductionMetrics
);

// Obtener tendencias de un bovino
router.get(
  '/trends/:bovineId',
  requireMinimumRole(UserRole.VIEWER),
  productionController.getProductionTrends
);

// Actualizar un registro
router.put(
  '/:id',
  requireMinimumRole(UserRole.WORKER),
  validateProduction('updateProduction'),
  productionController.updateProduction
);

// Eliminar un registro
router.delete(
  '/:id',
  requireMinimumRole(UserRole.MANAGER),
  productionController.deleteProduction
);

export default router;