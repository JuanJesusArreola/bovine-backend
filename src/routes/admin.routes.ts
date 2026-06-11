// src/routes/admin.routes.ts
import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { requireMinimumRole } from '../middleware/role';
import { sanitizeInput } from '../middleware/validation';
import { createRateLimit, EndpointType } from '../middleware/rate-limit';
import { UserRole } from '../models/User';
import { validateAdmin } from '../validators/admin.validators';

const router = Router();

// ============================================================================
// MIDDLEWARE GLOBAL
// ============================================================================

router.use(authenticateToken);
router.use(sanitizeInput);

// ============================================================================
// GESTIÓN DE USUARIOS (SUPER_ADMIN y OWNER)
// ============================================================================

/**
 * POST /api/admin/users
 * Crea un nuevo usuario con rol asignado.
 * La jerarquía de roles se valida en el controller.
 */
router.post(
    '/users',
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
    createRateLimit(EndpointType.CATTLE_WRITE),
    validateAdmin('createUser'),
    adminController.createUser.bind(adminController)
);

/**
 * GET /api/admin/roles
 * Retorna los roles que el usuario actual puede asignar.
 * Útil para poblar el <select> de roles en el frontend.
 */
router.get(
    '/roles',
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
    createRateLimit(EndpointType.CATTLE_READ),
    adminController.getAssignableRoles.bind(adminController)
);

// ============================================================================
// JOBS DEL SISTEMA (solo SUPER_ADMIN y OWNER)
// ============================================================================

/**
 * POST /api/admin/jobs/update-production
 * Dispara manualmente el job de actualización de producción.
 */
router.post(
    '/jobs/update-production',
    requireMinimumRole(UserRole.OWNER),
    createRateLimit(EndpointType.CATTLE_WRITE),
    adminController.triggerProductionUpdate.bind(adminController)
);

export default router;