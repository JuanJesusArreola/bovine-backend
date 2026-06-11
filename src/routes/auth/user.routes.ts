// routes/auth/user.routes.ts
import { Router } from 'express';
import { userController } from '../../controllers/auth/user.controller';
import { authenticateToken, authorizeRoles } from '../../middleware/auth';
import { validateId, sanitizeInput } from '../../middleware/validation';
import { createRateLimit, EndpointType } from '../../middleware/rate-limit';
import { UserRole } from '../../models/User';

const router = Router();

// ============================================================================
// MIDDLEWARE GLOBAL
// ============================================================================

// Todas las rutas requieren autenticación
router.use(authenticateToken);
router.use(sanitizeInput);

// ============================================================================
// PERFIL DEL USUARIO AUTENTICADO
// ============================================================================

/**
 * GET /api/users/profile
 * Obtiene el perfil del usuario autenticado
 */
router.get(
    '/profile',
    createRateLimit(EndpointType.CATTLE_READ),
    userController.getProfile.bind(userController)
);

/**
 * PUT /api/users/profile
 * Actualiza el perfil del usuario autenticado
 */
router.put(
    '/profile',
    createRateLimit(EndpointType.CATTLE_WRITE),
    userController.updateProfile.bind(userController)
);

// ============================================================================
// ADMINISTRACIÓN DE USUARIOS (solo roles con permisos)
// ============================================================================

/**
 * GET /api/users
 * Lista usuarios (solo admin y super_admin)
 */
router.get(
    '/',
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
    createRateLimit(EndpointType.REPORTS),
    userController.listUsers.bind(userController)
);

/**
 * GET /api/users/:id
 * Obtiene un usuario por ID (solo admin)
 */
router.get(
    '/:id',
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
    validateId('id'),
    createRateLimit(EndpointType.CATTLE_READ),
    userController.getUserById.bind(userController)
);

/**
 * PUT /api/users/:id
 * Actualiza un usuario (solo admin)
 */
router.put(
    '/:id',
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
    validateId('id'),
    createRateLimit(EndpointType.CATTLE_WRITE),
    userController.updateUser.bind(userController)
);

/**
 * DELETE /api/users/:id
 * Desactiva un usuario (solo admin)
 */
router.delete(
    '/:id',
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
    validateId('id'),
    createRateLimit(EndpointType.CATTLE_WRITE),
    userController.deactivateUser.bind(userController)
);

/**
 * POST /api/users/:id/activate
 * Activa un usuario (solo admin)
 */
router.post(
    '/:id/activate',
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
    validateId('id'),
    createRateLimit(EndpointType.CATTLE_WRITE),
    userController.activateUser.bind(userController)
);

export default router;