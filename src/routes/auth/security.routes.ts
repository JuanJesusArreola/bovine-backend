// routes/auth/security.routes.ts
import { Router } from 'express';
import { securityController } from '../../controllers/auth/security.controller';
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
// RUTAS DE EVENTOS DE SEGURIDAD (solo admin y super_admin)
// ============================================================================

/**
 * GET /api/security/events
 * Lista eventos de seguridad
 */
router.get(
    '/events',
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
    createRateLimit(EndpointType.REPORTS),
    securityController.listEvents.bind(securityController)
);

/**
 * GET /api/security/events/unresolved
 * Obtiene eventos no resueltos
 */
router.get(
    '/events/unresolved',
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
    createRateLimit(EndpointType.REPORTS),
    securityController.getUnresolvedEvents.bind(securityController)
);

/**
 * GET /api/security/events/:id
 * Obtiene un evento por ID
 */
router.get(
    '/events/:id',
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
    validateId('id'),
    createRateLimit(EndpointType.CATTLE_READ),
    securityController.getEventById.bind(securityController)
);

/**
 * POST /api/security/events/resolve-batch
 * Marca múltiples eventos como resueltos
 */
router.post(
    '/events/resolve-batch',
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
    createRateLimit(EndpointType.CATTLE_WRITE),
    securityController.resolveEvents.bind(securityController)
);

/**
 * POST /api/security/events/:id/resolve
 * Marca un evento como resuelto
 */
router.post(
    '/events/:id/resolve',
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
    validateId('id'),
    createRateLimit(EndpointType.CATTLE_WRITE),
    securityController.resolveEvent.bind(securityController)
);



/**
 * GET /api/security/stats
 * Obtiene estadísticas de eventos de seguridad
 */
router.get(
    '/stats',
    authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
    createRateLimit(EndpointType.REPORTS),
    securityController.getStats.bind(securityController)
);

export default router;