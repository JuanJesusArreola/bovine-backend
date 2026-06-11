// src/routes/inventory.routes.ts
import { Router } from 'express';
import { inventoryController } from '../controllers/inventory.controller';
import { authenticateToken } from '../middleware/auth';
import { authorizeRoles } from '../middleware/auth';
import { UserRole } from '../models/User';
import { validateInventory } from '../validators/inventory.validators';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// ============================================================================
// CONSULTAS (rol VIEWER o superior)
// ============================================================================

/**
 * GET /api/inventory
 * Lista items de inventario con filtros
 */
router.get(
    '/',
    authorizeRoles(UserRole.VIEWER, UserRole.WORKER, UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.SUPER_ADMIN),
    inventoryController.getInventory
);

/**
 * GET /api/inventory/:itemId
 * Obtiene un item específico
 */
router.get(
    '/:itemId',
    authorizeRoles(UserRole.VIEWER, UserRole.WORKER, UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.SUPER_ADMIN),
    inventoryController.getInventoryItem
);

/**
 * GET /api/inventory/valuation/:ranchId
 * Calcula valuación del inventario
 */
router.get(
    '/valuation/:ranchId',
    authorizeRoles(UserRole.MANAGER, UserRole.SUPER_ADMIN),
    inventoryController.calculateValuation
);

/**
 * GET /api/inventory/alerts/:ranchId
 * Obtiene alertas de inventario
 */
router.get(
    '/alerts/:ranchId',
    authorizeRoles(UserRole.MANAGER, UserRole.SUPER_ADMIN),
    inventoryController.getInventoryAlerts
);

// ============================================================================
// OPERACIONES DE STOCK (rol MANAGER o superior)
// ============================================================================

/**
 * POST /api/inventory/:itemId/update-stock
 * Actualiza stock (compra, uso, ajuste)
 */
router.post(
    '/:itemId/update-stock',
    authorizeRoles(UserRole.MANAGER, UserRole.SUPER_ADMIN),
    validateInventory('updateStock'),
    inventoryController.updateStock
);

/**
 * POST /api/inventory/:itemId/reserve
 * Reserva stock para tratamiento
 */
router.post(
    '/:itemId/reserve',
    authorizeRoles(UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.SUPER_ADMIN),
    validateInventory('reserveStock'),
    inventoryController.reserveStock
);

/**
 * POST /api/inventory/:itemId/release
 * Libera stock reservado
 */
router.post(
    '/:itemId/release',
    authorizeRoles(UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.SUPER_ADMIN),
    validateInventory('releaseStock'),
    inventoryController.releaseStock
);

export default router;