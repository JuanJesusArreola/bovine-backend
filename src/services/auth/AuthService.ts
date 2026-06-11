// services/auth/AuthService.ts
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import User, { UserRole, UserStatus, AccessLevel, VerificationStatus } from '../../models/User';
import { tokenService } from './TokenService';
import { userService } from './UserService';
import { securityEventService } from './SecurityEventService';
import { emailService } from '../EmailService';
import logger from '../../utils/logger';
import sequelize from '../../config/database';
import { ValidationError } from '../../utils/errorUtils';
import { EventType, EventSeverity } from '../../models/SecurityEvent';
import { RevocationReason } from '../../models/TokenBlacklist';

// ============================================================================
// INTERFACES
// ============================================================================

export interface LoginCredentials {
    email: string;
    password: string;
    rememberMe?: boolean;
    ipAddress?: string;
    userAgent?: string;
}

export interface RegisterData {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role?: UserRole;
    ranchId?: string;
    ipAddress?: string;
    userAgent?: string;
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        roleLabel: string;
        avatar?: string;
        phone?: string;
        permissions: any;
        lastLogin?: Date;
        isActive: boolean;
    };
    token: string;
    refreshToken: string;
    expiresIn: number;
}

export interface RefreshTokenData {
    refreshToken: string;
    ipAddress?: string;
    userAgent?: string;
}

export interface ResetPasswordData {
    token: string;
    newPassword: string;
    confirmPassword: string;
}

export interface UpdatePasswordData {
    userId: string;
    currentPassword: string;
    newPassword: string;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class AuthService {
    private readonly context = 'AuthService';

    // ==========================================================================
    // REGISTRO
    // ==========================================================================

    /**
     * Registra un nuevo usuario en el sistema
     */
    async register(data: RegisterData): Promise<AuthResponse> {
        const startTime = Date.now();

        try {
            // Validar contraseñas
            if (data.password !== data.confirmPassword) {
                throw new ValidationError('Las contraseñas no coinciden');
            }

            // Verificar si el usuario ya existe
            const existingUser = await User.findOne({
                where: {
                    email: data.email.toLowerCase()
                }
            });

            if (existingUser) {
                throw new ValidationError('El usuario ya existe con este email');
            }

            // SEGURIDAD: el registro público SIEMPRE crea con el rol mínimo (VIEWER),
            // ignorando cualquier `role` recibido. La elevación de rol solo ocurre
            // por un endpoint de admin autenticado (userService.updateUser).
            const role = UserRole.VIEWER;
            const user = await userService.createUser({
                email: data.email,
                password: data.password,
                confirmPassword: data.confirmPassword,
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                role,
                createdBy: null as any,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent
            });

            // Generar tokens
            const tokens = tokenService.generateTokens(user, false);

            // Enviar email de verificación
            await this.sendEmailVerification(user.id, user.email, data.ipAddress, data.userAgent);

            // Registrar evento de seguridad
            await securityEventService.logEvent({
                userId: user.id,
                eventType: EventType.ADMIN_ACTION,
                severity: EventSeverity.LOW,
                description: `Nuevo usuario registrado: ${user.email}`,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                additionalData: { role }
            });

            const duration = Date.now() - startTime;

            logger.info(`Usuario registrado exitosamente: ${user.email}`, this.context, {
                userId: user.id,
                durationMs: duration
            });

            return {
                user: await this.formatUserResponse(user),
                token: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: tokens.expiresIn
            };

        } catch (error) {
            logger.error('Error en el registro', this.context, { email: data.email }, error as Error);
            throw error;
        }
    }

    // ==========================================================================
    // AUTENTICACIÓN
    // ==========================================================================

    /**
     * Autentica un usuario existente
     */
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const startTime = Date.now();

        try {
            // Buscar usuario por email
            const user = await User.findOne({
                where: {
                    email: credentials.email.toLowerCase()
                }
            });

            if (!user) {
                await securityEventService.logFailedLogin(
                    credentials.email,
                    credentials.ipAddress,
                    credentials.userAgent,
                    'Usuario no encontrado'
                );
                throw new ValidationError('Credenciales inválidas');
            }

            // Verificar si la cuenta está activa
            if (!user.isActive || user.status !== UserStatus.ACTIVE) {
                await securityEventService.logFailedLogin(
                    credentials.email,
                    credentials.ipAddress,
                    credentials.userAgent,
                    'Cuenta inactiva'
                );
                throw new ValidationError('Cuenta desactivada. Contacta al administrador');
            }

            // Verificar contraseña
            const isPasswordValid = await user.verifyPassword(credentials.password);
            if (!isPasswordValid) {
                await securityEventService.logFailedLogin(
                    credentials.email,
                    credentials.ipAddress,
                    credentials.userAgent,
                    'Contraseña incorrecta'
                );
                throw new ValidationError('Credenciales inválidas');
            }

            // Actualizar último login
            user.updateLastActivity();
            user.recordSuccessfulLogin(credentials.ipAddress || 'unknown', credentials.userAgent || 'unknown');
            await user.save();

            // Generar tokens
            const tokens = tokenService.generateTokens(user, credentials.rememberMe);

            // Registrar evento de seguridad
            await securityEventService.logSuccessfulLogin(
                user.id,
                user.email,
                credentials.ipAddress,
                credentials.userAgent
            );

            const duration = Date.now() - startTime;

            logger.info(`Usuario autenticado exitosamente: ${user.email}`, this.context, {
                userId: user.id,
                durationMs: duration
            });

            return {
                user: await this.formatUserResponse(user),
                token: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: tokens.expiresIn
            };

        } catch (error) {
            logger.error('Error en el login', this.context, { email: credentials.email }, error as Error);
            throw error;
        }
    }

    /**
     * Cierra la sesión del usuario
     */
    async logout(token: string, userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
        const startTime = Date.now();

        try {
            // Revocar token
            await tokenService.revokeToken(token, userId, RevocationReason.LOGOUT, ipAddress, userAgent);

            // Registrar evento de seguridad
            const user = await User.findByPk(userId);
            await securityEventService.logLogout(
                userId,
                user?.email || userId,
                ipAddress,
                userAgent
            );

            const duration = Date.now() - startTime;

            logger.info(`Usuario cerró sesión: ${userId}`, this.context, {
                userId,
                durationMs: duration
            });

        } catch (error) {
            logger.error('Error en el logout', this.context, { userId }, error as Error);
            throw error;
        }
    }

    /**
     * Refresca el token de acceso
     */
    async refreshToken(data: RefreshTokenData): Promise<{ token: string; refreshToken: string; expiresIn: number }> {
        const startTime = Date.now();

        try {
            // Verificar refresh token
            const decoded = tokenService.verifyRefreshToken(data.refreshToken);
            if (!decoded) {
                throw new ValidationError('Refresh token inválido');
            }

            // Verificar si el token está revocado
            const isRevoked = await tokenService.isTokenRevoked(data.refreshToken);
            if (isRevoked) {
                await securityEventService.logInvalidToken(
                    decoded.userId,
                    decoded.jti,
                    data.ipAddress,
                    data.userAgent,
                    'Refresh token reutilizado'
                );
                throw new ValidationError('Refresh token inválido o ya utilizado');
            }

            // Buscar usuario activo
            const user = await User.findOne({
                where: {
                    id: decoded.userId,
                    isActive: true,
                    status: UserStatus.ACTIVE
                }
            });

            if (!user) {
                throw new ValidationError('Usuario no encontrado o inactivo');
            }

            // Revocar el refresh token usado (token rotation)
            await tokenService.revokeToken(
                data.refreshToken,
                user.id,
                RevocationReason.TOKEN_ROTATION,
                data.ipAddress,
                data.userAgent
            );

            // Generar nuevos tokens
            const tokens = tokenService.generateTokens(user, false);

            const duration = Date.now() - startTime;

            logger.info(`Token refrescado para usuario ${user.id}`, this.context, {
                userId: user.id,
                durationMs: duration
            });

            return {
                token: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: tokens.expiresIn
            };

        } catch (error) {
            logger.error('Error al refrescar token', this.context, {}, error as Error);
            throw error;
        }
    }

    // ==========================================================================
    // VERIFICACIÓN DE EMAIL
    // ==========================================================================

    /**
     * Envía email de verificación al usuario
     */
    async sendEmailVerification(userId: string, email: string, ipAddress?: string, userAgent?: string): Promise<void> {
        try {
            // Crear token de verificación
            const token = await tokenService.createEmailVerificationToken(userId, email, ipAddress, userAgent);

            // Obtener información del usuario
            const user = await User.findByPk(userId);
            if (!user) {
                throw new ValidationError('Usuario no encontrado');
            }

            // Enviar email
            await emailService.sendEmailVerification(email, token, user.personalInfo.firstName);

            // Registrar evento
            await securityEventService.logEvent({
                userId,
                eventType: EventType.EMAIL_VERIFICATION_REQUEST,
                severity: EventSeverity.LOW,
                description: `Email de verificación enviado a ${email}`,
                ipAddress,
                userAgent
            });

            logger.info(`Email de verificación enviado para usuario ${userId}`, this.context, { userId, email });

        } catch (error) {
            logger.error('Error enviando email de verificación', this.context, { userId, email }, error as Error);
            throw error;
        }
    }

    /**
     * Verifica el email del usuario usando el token
     */
    async verifyEmail(token: string, ipAddress?: string, userAgent?: string): Promise<boolean> {
        try {
            // Verificar token
            const tokenData = await tokenService.verifyEmailToken(token);
            if (!tokenData) {
                logger.warn('Token de verificación inválido o expirado', this.context);
                return false;
            }

            // Verificar email del usuario
            const success = await userService.verifyUserEmail(tokenData.userId, ipAddress, userAgent);

            if (success) {
                logger.info(`Email verificado exitosamente para usuario ${tokenData.userId}`, this.context, {
                    userId: tokenData.userId,
                    email: tokenData.email
                });
            }

            return success;

        } catch (error) {
            logger.error('Error verificando email', this.context, {}, error as Error);
            return false;
        }
    }

    /**
     * Reenvía email de verificación
     */
    async resendEmailVerification(email: string, ipAddress?: string, userAgent?: string): Promise<void> {
        try {
            const user = await User.findOne({
                where: {
                    email: email.toLowerCase(),
                    emailVerified: false
                }
            });

            if (!user) {
                // Por seguridad, no revelamos si el usuario existe
                logger.warn(`Intento de reenvío de verificación para email inexistente: ${email}`, this.context);
                return;
            }

            // Verificar límite de reenvíos
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const recentRequests = await tokenService.getRecentEmailVerificationRequests(user.id, oneHourAgo);

            if (recentRequests >= 3) {
                await securityEventService.logRateLimitExceeded(
                    user.id,
                    ipAddress,
                    userAgent,
                    'resend-email-verification'
                );
                throw new ValidationError('Demasiados intentos. Intenta nuevamente en una hora.');
            }

            await this.sendEmailVerification(user.id, user.email, ipAddress, userAgent);

            logger.info(`Email de verificación reenviado para ${email}`, this.context, { email });

        } catch (error) {
            logger.error('Error reenviando email de verificación', this.context, { email }, error as Error);
            throw error;
        }
    }

    // ==========================================================================
    // RECUPERACIÓN DE CONTRASEÑA
    // ==========================================================================

    /**
     * Inicia el proceso de recuperación de contraseña
     */
    async forgotPassword(email: string, ipAddress?: string, userAgent?: string): Promise<void> {
        try {
            const user = await User.findOne({
                where: {
                    email: email.toLowerCase(),
                    isActive: true,
                    status: UserStatus.ACTIVE
                }
            });

            if (!user) {
                // Por seguridad, no revelamos si el usuario existe
                logger.warn(`Intento de recuperación para email inexistente: ${email}`, this.context);
                return;
            }

            // Crear token de reset
            const resetToken = await tokenService.createPasswordResetToken(
                user.id,
                user.email,
                ipAddress,
                userAgent
            );

            // Enviar email
            await emailService.sendPasswordResetEmail(
                user.email,
                resetToken,
                user.personalInfo.firstName
            );

            // Registrar evento
            await securityEventService.logPasswordResetRequest(
                user.id,
                user.email,
                ipAddress,
                userAgent
            );

            logger.info(`Token de recuperación enviado para: ${user.email}`, this.context, {
                userId: user.id
            });

        } catch (error) {
            logger.error('Error en forgot password', this.context, { email }, error as Error);
            throw error;
        }
    }

    /**
     * Restablece la contraseña del usuario
     */
    async resetPassword(data: ResetPasswordData, ipAddress?: string, userAgent?: string): Promise<void> {
        const transaction = await sequelize.transaction();

        try {
            // Verificar token
            const tokenData = await tokenService.verifyPasswordResetToken(data.token);
            if (!tokenData) {
                throw new ValidationError('Token de reset inválido o expirado');
            }

            // Validar contraseñas
            if (data.newPassword !== data.confirmPassword) {
                throw new ValidationError('Las contraseñas no coinciden');
            }

            // Validar fortaleza
            this.validatePasswordStrength(data.newPassword);

            // Buscar usuario
            const user = await User.findByPk(tokenData.userId, { transaction });
            if (!user) {
                throw new ValidationError('Usuario no encontrado');
            }

            // Verificar que el email coincida
            if (tokenData.email.toLowerCase() !== user.email.toLowerCase()) {
                throw new ValidationError('El token no corresponde al usuario');
            }

            // Verificar que la nueva contraseña sea diferente
            const isDifferent = await User.isPasswordDifferent(data.newPassword, user.password);
            if (!isDifferent) {
                throw new ValidationError('La nueva contraseña es la misma que la actual');
            }

            // Hash de la nueva contraseña
            const hashedPassword = await bcrypt.hash(data.newPassword, 12);

            // Actualizar contraseña
            await user.update({
                password: hashedPassword,
                securityInfo: {
                    ...user.securityInfo,
                    passwordLastChanged: new Date()
                }
            }, { transaction });

            // Marcar token como usado
            await tokenService.markPasswordResetTokenAsUsed(data.token);

            // Revocar todos los tokens del usuario
            await tokenService.revokeAllUserTokens(user.id, RevocationReason.PASSWORD_RESET);

            await transaction.commit();

            // Registrar evento
            await securityEventService.logPasswordResetSuccess(
                user.id,
                user.email,
                ipAddress,
                userAgent
            );

            logger.info(`Contraseña restablecida para usuario ${user.id}`, this.context, {
                userId: user.id,
                email: user.email
            });

        } catch (error) {
            await transaction.rollback();
            logger.error('Error en reset password', this.context, {}, error as Error);
            throw error;
        }
    }

    // ==========================================================================
    // CAMBIO DE CONTRASEÑA (AUTENTICADO)
    // ==========================================================================

    /**
     * Actualiza la contraseña del usuario autenticado
     */
    async changePassword(data: UpdatePasswordData, ipAddress?: string, userAgent?: string): Promise<void> {
        const transaction = await sequelize.transaction();

        try {
            const user = await User.findByPk(data.userId, { transaction });
            if (!user) {
                throw new ValidationError('Usuario no encontrado');
            }

            // Verificar contraseña actual
            const isCurrentPasswordValid = await user.verifyPassword(data.currentPassword);
            if (!isCurrentPasswordValid) {
                await securityEventService.logFailedLogin(
                    user.email,
                    ipAddress,
                    userAgent,
                    'Cambio de contraseña - contraseña actual incorrecta'
                );
                throw new ValidationError('Contraseña actual incorrecta');
            }

            // Verificar que la nueva contraseña sea diferente
            const isDifferent = await User.isPasswordDifferent(data.newPassword, user.password);
            if (!isDifferent) {
                throw new ValidationError('La nueva contraseña es la misma que la actual');
            }

            // Validar nueva contraseña
            this.validatePasswordStrength(data.newPassword);

            // Hash de la nueva contraseña
            const hashedPassword = await bcrypt.hash(data.newPassword, 12);

            // Actualizar contraseña
            await user.update({
                password: hashedPassword,
                securityInfo: {
                    ...user.securityInfo,
                    passwordLastChanged: new Date()
                }
            }, { transaction });

            // Revocar todos los tokens del usuario
            await tokenService.revokeAllUserTokens(user.id, RevocationReason.PASSWORD_CHANGE);

            await transaction.commit();

            // Registrar evento
            await securityEventService.logPasswordChange(
                user.id,
                user.email,
                ipAddress,
                userAgent
            );

            logger.info(`Contraseña actualizada para usuario ${user.id}`, this.context, {
                userId: user.id,
                email: user.email
            });

        } catch (error) {
            await transaction.rollback();
            logger.error('Error en changePassword', this.context, { userId: data.userId }, error as Error);
            throw error;
        }
    }

    // ==========================================================================
    // UTILIDADES
    // ==========================================================================

    /**
     * Verifica y decodifica un token JWT
     */
    async verifyToken(token: string): Promise<any> {
        const payload = tokenService.verifyAccessToken(token);
        if (!payload) {
            throw new ValidationError('Token inválido o expirado');
        }
        return payload;
    }

    /**
     * Valida la fortaleza de una contraseña
     */
    private validatePasswordStrength(password: string): void {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (password.length < minLength) {
            throw new ValidationError(`La contraseña debe tener al menos ${minLength} caracteres`);
        }
        if (!hasUpperCase) {
            throw new ValidationError('La contraseña debe contener al menos una letra mayúscula');
        }
        if (!hasLowerCase) {
            throw new ValidationError('La contraseña debe contener al menos una letra minúscula');
        }
        if (!hasNumbers) {
            throw new ValidationError('La contraseña debe contener al menos un número');
        }
        if (!hasSpecialChar) {
            throw new ValidationError('La contraseña debe contener al menos un carácter especial');
        }
    }

    /**
     * Formatea la respuesta del usuario
     */
    private async formatUserResponse(user: User): Promise<AuthResponse['user']> {
        return {
            id: user.id,
            email: user.email,
            firstName: user.personalInfo.firstName,
            lastName: user.personalInfo.lastName,
            role: user.role,
            roleLabel: user.getRoleLabel(),
            avatar: user.personalInfo.profilePhoto,
            phone: user.contactInfo.primaryPhone,
            permissions: user.permissions,
            lastLogin: user.lastLoginAt,
            isActive: user.isActive
        };
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const authService = new AuthService();