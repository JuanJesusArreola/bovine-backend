// services/auth/TokenService.ts
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { ensureError } from '../../utils/errorUtils';
import User, { UserPermissions, UserRole } from '../../models/User';
import { TokenBlacklist, TokenType, RevocationReason } from '../../models/TokenBlacklist';
import { EmailVerificationToken } from '../../models/EmailVerificationToken';
import PasswordResetToken from '../../models/PasswordResetToken';
import sequelize from '../../config/database';

// ============================================================================
// INTERFACES
// ============================================================================

export interface TokenPayload {
    userId: string;
    email: string;
    role: UserRole;
    permissions: UserPermissions;
    jti?: string;
    iat?: number;
    exp?: number;
}

export interface TokenResult {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface EmailVerificationResult {
    success: boolean;
    message?: string;
}

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class TokenService {
    private readonly context = 'TokenService';

    // ==========================================================================
    // TOKENS JWT
    // ==========================================================================

    /**
     * Genera par de tokens (access + refresh)
     */
    generateTokens(
        user: User,
        rememberMe: boolean = false
    ): TokenResult {
        const accessToken = this.generateAccessToken(user, rememberMe);
        const refreshToken = this.generateRefreshToken(user.id);
        const expiresIn = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;

        return {
            accessToken,
            refreshToken,
            expiresIn
        };
    }

    /**
     * Genera token de acceso JWT
     */
    generateAccessToken(user: User, rememberMe: boolean = false): string {
        const expiresIn = rememberMe ? '30d' : JWT_EXPIRES_IN;
        const jti = uuidv4();

        const payload: TokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            permissions: user.permissions,
            jti
        };

        return jwt.sign(payload, JWT_SECRET, {
            expiresIn,
            issuer: 'cattle-management-system',
            audience: 'cattle-app-users'
        } as SignOptions);
    }

    /**
     * Genera token de refresco
     */
    generateRefreshToken(userId: string): string {
        const jti = uuidv4();

        return jwt.sign(
            { userId, jti },
            JWT_REFRESH_SECRET,
            {
                expiresIn: JWT_REFRESH_EXPIRES_IN,
                issuer: 'cattle-management-system'
            } as SignOptions
        );
    }

    /**
     * Verifica y decodifica un token de acceso
     */
    verifyAccessToken(token: string): TokenPayload | null {
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
            return decoded;
        } catch (error) {
            logger.debug('Error verificando access token', this.context, { error: (error as Error).message });
            return null;
        }
    }

    /**
     * Verifica y decodifica un token de refresco
     */
    verifyRefreshToken(token: string): { userId: string; jti: string; exp: number } | null {
        try {
            const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as any;
            return {
                userId: decoded.userId,
                jti: decoded.jti,
                exp: decoded.exp
            };
        } catch (error) {
            logger.debug('Error verificando refresh token', this.context, { error: (error as Error).message });
            return null;
        }
    }

    /**
     * Obtiene el tiempo de expiración del token en segundos
     */
    getTokenExpirationTime(rememberMe: boolean = false): number {
        return rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
    }

    // ==========================================================================
    // BLACKLIST
    // ==========================================================================

    /**
     * Revoca un token (agrega a blacklist)
     */
    async revokeToken(
        token: string,
        userId: string,
        reason: RevocationReason = RevocationReason.LOGOUT,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        let decoded: any;
        let tokenType: TokenType;

        // Intentar decodificar como access token
        try {
            decoded = jwt.verify(token, JWT_SECRET) as any;
            tokenType = TokenType.ACCESS;
        } catch {
            // Intentar como refresh token
            try {
                decoded = jwt.verify(token, JWT_REFRESH_SECRET) as any;
                tokenType = TokenType.REFRESH;
            } catch {
                throw new Error('Token inválido');
            }
        }

        if (!decoded.jti) {
            throw new Error('Token no tiene JWT ID');
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        await TokenBlacklist.addToBlacklist(
            userId,
            tokenType,
            decoded.jti,
            tokenHash,
            new Date(decoded.exp * 1000),
            reason,
            ipAddress,
            userAgent,
            userId
        );

        logger.info(`Token revocado: ${decoded.jti}`, this.context, {
            userId,
            tokenType,
            reason
        });
    }

    /**
     * Verifica si un token está revocado
     */
    async isTokenRevoked(token: string): Promise<boolean> {
        try {
            let decoded: any;
            let tokenJti: string | undefined;

            // Intentar decodificar
            try {
                decoded = jwt.verify(token, JWT_SECRET) as any;
                tokenJti = decoded.jti;
            } catch {
                try {
                    decoded = jwt.verify(token, JWT_REFRESH_SECRET) as any;
                    tokenJti = decoded.jti;
                } catch {
                    return false;
                }
            }

            if (!tokenJti) return false;

            const blacklisted = await TokenBlacklist.findOne({
                where: {
                    token_jti: tokenJti,
                    expires_at: { [Op.gt]: new Date() }
                }
            });

            return !!blacklisted;

        } catch (error) {
            logger.error('Error verificando token revocado', this.context, {}, error as Error);
            return true; // Por seguridad, considerar revocado
        }
    }

    /**
     * Revoca todos los tokens de un usuario
     */
    async revokeAllUserTokens(userId: string, reason: RevocationReason): Promise<void> {
        await TokenBlacklist.update(
            {
                reason,
                revoked_by: userId
            },
            {
                where: {
                    user_id: userId,
                    expires_at: { [Op.gt]: new Date() }
                }
            }
        );

        logger.info(`Todos los tokens revocados para usuario ${userId}`, this.context, { reason });
    }

    /**
     * Limpia tokens expirados de la blacklist
     */
    async cleanupExpiredBlacklistedTokens(): Promise<number> {
        const deleted = await TokenBlacklist.destroy({
            where: {
                expires_at: { [Op.lt]: new Date() }
            }
        });

        logger.info(`Tokens expirados eliminados de blacklist: ${deleted}`, this.context);
        return deleted;
    }

    // ==========================================================================
    // EMAIL VERIFICATION TOKENS
    // ==========================================================================

    /**
     * Crea token de verificación de email
     */
    async createEmailVerificationToken(
        userId: string,
        email: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<string> {
        // Invalidar tokens anteriores
        await EmailVerificationToken.update(
            { used: true },
            { where: { user_id: userId, used: false } }
        );

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 horas

        await EmailVerificationToken.create({
            user_id: userId,
            email,
            token,
            expires_at: expiresAt,
            used: false,
            ip_address: ipAddress,
            user_agent: userAgent
        });

        logger.info(`Token de verificación de email creado para usuario ${userId}`, this.context);

        return token;
    }

    /**
     * Verifica token de email
     */
    async verifyEmailToken(token: string): Promise<{ userId: string; email: string } | null> {
        const verificationToken = await EmailVerificationToken.findOne({
            where: {
                token,
                used: false,
                expires_at: { [Op.gt]: new Date() }
            }
        });

        if (!verificationToken) {
            return null;
        }

        // Marcar como usado
        verificationToken.markAsUsed();
        await verificationToken.save();

        logger.info(`Token de email verificado para usuario ${verificationToken.user_id}`, this.context);

        return {
            userId: verificationToken.user_id,
            email: verificationToken.email
        };
    }

    /**
     * Limpia tokens de verificación de email expirados
     */
    async cleanupExpiredEmailTokens(): Promise<number> {
        const deleted = await EmailVerificationToken.destroy({
            where: {
                expires_at: { [Op.lt]: new Date() },
                used: false
            }
        });

        logger.info(`Tokens de email expirados eliminados: ${deleted}`, this.context);
        return deleted;
    }

    // ==========================================================================
    // PASSWORD RESET TOKENS
    // ==========================================================================

    /**
     * Crea token de reset de contraseña
     */
    async createPasswordResetToken(
        userId: string,
        email: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<string> {
        // Invalidar tokens anteriores no usados
        await PasswordResetToken.update(
            { used: true, used_at: new Date() },
            {
                where: {
                    user_id: userId,
                    used: false,
                    expires_at: { [Op.gt]: new Date() }
                }
            }
        );

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // 1 hora

        await PasswordResetToken.create({
            user_id: userId,
            email,
            token,
            expires_at: expiresAt,
            used: false,
            ip_address: ipAddress,
            user_agent: userAgent
        });

        logger.info(`Token de reset de contraseña creado para usuario ${userId}`, this.context);

        return token;
    }

    /**
     * Verifica token de reset de contraseña
     */
    async verifyPasswordResetToken(token: string): Promise<{ userId: string; email: string } | null> {
        const resetToken = await PasswordResetToken.findByToken(token);

        if (!resetToken) {
            return null;
        }

        if (!resetToken.isValid()) {
            return null;
        }

        return {
            userId: resetToken.user_id,
            email: resetToken.email
        };
    }

    /**
     * Marca token de reset como usado
     */
    async markPasswordResetTokenAsUsed(token: string): Promise<void> {
        const resetToken = await PasswordResetToken.findOne({ where: { token } });
        if (resetToken) {
            resetToken.markAsUsed();
            await resetToken.save();
        }
    }

    /**
     * Limpia tokens de reset expirados
     */
    async cleanupExpiredResetTokens(): Promise<number> {
        const deleted = await PasswordResetToken.destroy({
            where: {
                expires_at: { [Op.lt]: new Date() },
                used: false
            }
        });

        logger.info(`Tokens de reset expirados eliminados: ${deleted}`, this.context);
        return deleted;
    }

    /**
     * Obtiene la cantidad de solicitudes de verificación de email recientes
     */
    async getRecentEmailVerificationRequests(userId: string, since: Date): Promise<number> {
        try {
            const count = await EmailVerificationToken.count({
                where: {
                    user_id: userId,
                    created_at: { [Op.gte]: since },
                    used: false
                }
            });
            return count;
        } catch (error) {
            logger.error('Error obteniendo solicitudes recientes de verificación', this.context, { userId }, error as Error);
            return 0;
        }
    }

    // ==========================================================================
    // LIMPIEZA GENERAL
    // ==========================================================================

    /**
     * Limpia todos los tokens expirados (blacklist, email, reset)
     */
    async cleanupAllExpiredTokens(): Promise<{
        blacklist: number;
        email: number;
        reset: number;
    }> {
        const [blacklist, email, reset] = await Promise.all([
            this.cleanupExpiredBlacklistedTokens(),
            this.cleanupExpiredEmailTokens(),
            this.cleanupExpiredResetTokens()
        ]);

        logger.info('Limpieza general de tokens completada', this.context, {
            blacklist,
            email,
            reset
        });

        return { blacklist, email, reset };
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const tokenService = new TokenService();