// routes/auth/auth.routes.ts
import { Router } from 'express';
import { authController } from '../../controllers/auth/auth.controller';
import { authenticateToken } from '../../middleware/auth';
import { createRateLimit, EndpointType } from '../../middleware/rate-limit';
import { sanitizeInput } from '../../middleware/validation';
import { validateAuth } from '../../middleware/Auth.validation';

const router = Router();

// ============================================================================
// MIDDLEWARE GLOBAL
// ============================================================================

// Sanitización de inputs para todas las rutas
router.use(sanitizeInput);

// ============================================================================
// RUTAS PÚBLICAS (no requieren autenticación)
// ============================================================================

/**
 * POST /api/auth/register
 * Registra un nuevo usuario
 */
router.post(
    '/register',
    createRateLimit(EndpointType.AUTH),
    validateAuth('register'),
    authController.register.bind(authController)
);

/**
 * POST /api/auth/login
 * Inicia sesión de usuario
 */
router.post(
    '/login',
    createRateLimit(EndpointType.AUTH),
    validateAuth('login'),
    authController.login.bind(authController)
);

/**
 * POST /api/auth/refresh-token
 * Refresca el token de acceso
 */
router.post(
    '/refresh-token',
    createRateLimit(EndpointType.AUTH),
    authController.refreshToken.bind(authController)
);

/**
 * POST /api/auth/forgot-password
 * Solicita recuperación de contraseña
 */
router.post(
    '/forgot-password',
    createRateLimit(EndpointType.AUTH),
    validateAuth('forgotPassword'),
    authController.forgotPassword.bind(authController)
);

//GET que redirije al frontend
router.get(
    '/reset-password',
    createRateLimit(EndpointType.AUTH),
    authController.redirectResetPassword
);

/**
 * POST /api/auth/reset-password
 * Restablece la contraseña con token
 */
router.post(
    '/reset-password',
    createRateLimit(EndpointType.AUTH),
    validateAuth('resetPassword'),
    authController.resetPassword.bind(authController)
);

/**
 * GET /api/auth/verify-email
 * Verifica el email del usuario
 */
router.get(
    '/verify-email',
    createRateLimit(EndpointType.AUTH),
    validateAuth('verifyEmail'),
    authController.verifyEmail.bind(authController)
);

/**
 * POST /api/auth/resend-verification
 * Reenvía email de verificación
 */
router.post(
    '/resend-verification',
    createRateLimit(EndpointType.AUTH),
    validateAuth('resendVerification'),
    authController.resendVerification.bind(authController)
);

// ============================================================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ============================================================================

/**
 * POST /api/auth/logout
 * Cierra sesión del usuario
 */
router.post(
    '/logout',
    authenticateToken,
    createRateLimit(EndpointType.AUTH),
    authController.logout.bind(authController)
);

/**
 * POST /api/auth/change-password
 * Cambia la contraseña del usuario autenticado
 */
router.post(
    '/change-password',
    authenticateToken,
    createRateLimit(EndpointType.AUTH),
    validateAuth('changePassword'),
    authController.changePassword.bind(authController)
);

export default router;