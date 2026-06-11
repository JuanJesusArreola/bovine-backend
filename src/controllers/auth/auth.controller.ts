// controllers/auth/auth.controller.ts
import { Request, Response } from 'express';
import { authService } from '../../services/auth';
import { ValidationError } from '../../utils/errorUtils';
import logger from '../../utils/logger';

export class AuthController {
    private readonly context = 'AuthController';

    constructor() {
        this.register = this.register.bind(this);
        this.login = this.login.bind(this);
        this.logout = this.logout.bind(this);
        this.refreshToken = this.refreshToken.bind(this);
        this.forgotPassword = this.forgotPassword.bind(this);
        this.resetPassword = this.resetPassword.bind(this);
        this.changePassword = this.changePassword.bind(this);
        this.verifyEmail = this.verifyEmail.bind(this);
        this.resendVerification = this.resendVerification.bind(this);
        this.redirectResetPassword = this.redirectResetPassword.bind(this);
    }

    /**
     * POST /api/auth/register
     * Registra un nuevo usuario
     */
    async register(req: Request, res: Response): Promise<void> {
        try {
            // SEGURIDAD: el registro público NUNCA debe aceptar `role` del cliente
            // (escalada de privilegios). Se IGNORA a propósito; el rol lo asigna
            // AuthService con el default mínimo (VIEWER). La elevación de rol solo
            // se hace por un endpoint de admin autenticado.
            const { email, password, confirmPassword, firstName, lastName, phone } = req.body;
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.get('User-Agent');

            const result = await authService.register({
                email,
                password,
                confirmPassword,
                firstName,
                lastName,
                phone,
                // role: OMITIDO intencionalmente → AuthService usa VIEWER por defecto
                ipAddress,
                userAgent
            });

            res.status(201).json({
                success: true,
                data: result,
                message: 'Usuario registrado exitosamente. Revisa tu email para verificar tu cuenta.'
            });

        } catch (error) {
            logger.error('Error en register', this.context, { body: req.body }, error as Error);

            if (error instanceof ValidationError) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    code: 'VALIDATION_ERROR'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * POST /api/auth/login
     * Inicia sesión de usuario
     */
    async login(req: Request, res: Response): Promise<void> {
        try {
            const { email, password, rememberMe } = req.body;
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.get('User-Agent');

            const result = await authService.login({
                email,
                password,
                rememberMe,
                ipAddress,
                userAgent
            });

            res.json({
                success: true,
                data: result,
                message: 'Login exitoso'
            });

        } catch (error) {
            logger.error('Error en login', this.context, { body: req.body }, error as Error);

            if (error instanceof ValidationError) {
                res.status(401).json({
                    success: false,
                    error: error.message,
                    code: 'INVALID_CREDENTIALS'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * POST /api/auth/logout
     * Cierra sesión del usuario
     */
    async logout(req: Request, res: Response): Promise<void> {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            const userId = req.user?.id;
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.get('User-Agent');

            if (!token || !userId) {
                res.status(401).json({
                    success: false,
                    error: 'No autenticado'
                });
                return;
            }

            await authService.logout(token, userId, ipAddress, userAgent);

            res.json({
                success: true,
                message: 'Sesión cerrada exitosamente'
            });

        } catch (error) {
            logger.error('Error en logout', this.context, { userId: req.user?.id }, error as Error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * POST /api/auth/refresh-token
     * Refresca el token de acceso
     */
    async refreshToken(req: Request, res: Response): Promise<void> {
        try {
            const { refreshToken } = req.body;
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.get('User-Agent');

            if (!refreshToken) {
                res.status(400).json({
                    success: false,
                    error: 'Refresh token requerido'
                });
                return;
            }

            const result = await authService.refreshToken({
                refreshToken,
                ipAddress,
                userAgent
            });

            res.json({
                success: true,
                data: result,
                message: 'Token refrescado exitosamente'
            });

        } catch (error) {
            logger.error('Error en refreshToken', this.context, {}, error as Error);

            if (error instanceof ValidationError) {
                res.status(401).json({
                    success: false,
                    error: error.message,
                    code: 'INVALID_REFRESH_TOKEN'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * POST /api/auth/forgot-password
     * Solicita recuperación de contraseña
     */
    async forgotPassword(req: Request, res: Response): Promise<void> {
        try {
            const { email } = req.body;
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.get('User-Agent');

            if (!email) {
                res.status(400).json({
                    success: false,
                    error: 'Email requerido'
                });
                return;
            }

            await authService.forgotPassword(email, ipAddress, userAgent);

            // Siempre responder con éxito por seguridad (no revelar si el email existe)
            res.json({
                success: true,
                message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña'
            });

        } catch (error) {
            logger.error('Error en forgotPassword', this.context, { body: req.body }, error as Error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * POST /api/auth/reset-password
     * Restablece la contraseña con token
     */
    async resetPassword(req: Request, res: Response): Promise<void> {
        try {
            const { token, newPassword, confirmPassword } = req.body;
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.get('User-Agent');

            if (!token || !newPassword || !confirmPassword) {
                res.status(400).json({
                    success: false,
                    error: 'Token y nueva contraseña requeridos'
                });
                return;
            }

            await authService.resetPassword({
                token,
                newPassword,
                confirmPassword
            }, ipAddress, userAgent);

            res.json({
                success: true,
                message: 'Contraseña restablecida exitosamente'
            });

        } catch (error) {
            logger.error('Error en resetPassword', this.context, {}, error as Error);

            if (error instanceof ValidationError) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    code: 'INVALID_TOKEN'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * POST /api/auth/change-password
     * Cambia la contraseña del usuario autenticado
     */
    async changePassword(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const { currentPassword, newPassword, confirmPassword } = req.body;
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.get('User-Agent');

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'No autenticado'
                });
                return;
            }

            if (!currentPassword || !newPassword || !confirmPassword) {
                res.status(400).json({
                    success: false,
                    error: 'Contraseña actual y nueva contraseña requeridas'
                });
                return;
            }

            await authService.changePassword({
                userId,
                currentPassword,
                newPassword
            }, ipAddress, userAgent);

            res.json({
                success: true,
                message: 'Contraseña actualizada exitosamente'
            });

        } catch (error) {
            logger.error('Error en changePassword', this.context, { userId: req.user?.id }, error as Error);

            if (error instanceof ValidationError) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    code: 'PASSWORD_ERROR'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * GET /api/auth/verify-email
     * Verifica el email del usuario
     */
    async verifyEmail(req: Request, res: Response): Promise<void> {
        try {
            const { token } = req.query;
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.get('User-Agent');

            if (!token || typeof token !== 'string') {
                res.status(400).json({
                    success: false,
                    error: 'Token requerido'
                });
                return;
            }

            const success = await authService.verifyEmail(token, ipAddress, userAgent);

            if (success) {
                res.json({
                    success: true,
                    message: 'Email verificado exitosamente'
                });
                //return res.redirect(`${process.env.FRONTEND_URL}/auth/email-verified?status=success`);
            } else {
                res.status(400).json({
                    success: false,
                    error: 'Token inválido o expirado'
                });
            }

        } catch (error) {
            logger.error('Error en verifyEmail', this.context, { query: req.query }, error as Error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * POST /api/auth/resend-verification
     * Reenvía email de verificación
     */
    async resendVerification(req: Request, res: Response): Promise<void> {
        try {
            const { email } = req.body;
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.get('User-Agent');

            if (!email) {
                res.status(400).json({
                    success: false,
                    error: 'Email requerido'
                });
                return;
            }

            await authService.resendEmailVerification(email, ipAddress, userAgent);

            res.json({
                success: true,
                message: 'Email de verificación reenviado exitosamente'
            });

        } catch (error) {
            logger.error('Error en resendVerification', this.context, { body: req.body }, error as Error);

            if (error instanceof ValidationError) {
                res.status(429).json({
                    success: false,
                    error: error.message,
                    code: 'RATE_LIMIT_EXCEEDED'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
 * GET /api/auth/reset-password?token=xxx
 *
 * Este endpoint existe SOLO para el caso en que alguien configure
 * el link del email apuntando a la API en lugar del frontend.
 * Redirige inmediatamente al frontend con el token intacto.
 *
 * ¿Por qué no simplemente corregir el link del email y listo?
 * Doble protección: si en algún momento el link del email cambia
 * o se configura mal, el usuario no ve un 404 sino que llega
 * al lugar correcto igualmente.
 */
    async redirectResetPassword(req: Request, res: Response): Promise<void> {
        const { token } = req.query;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        if (!token || typeof token !== 'string') {
            return res.redirect(`${frontendUrl}/auth/reset-password?error=token-missing`) as any;
        }

        // Redirigir al frontend con el token — el frontend mostrará el formulario
        return res.redirect(`${frontendUrl}/auth/reset-password?token=${token}`) as any;
    }
}

export const authController = new AuthController();