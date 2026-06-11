// services/auth/SecurityEventService.ts
import { Op } from 'sequelize';
import logger from '../../utils/logger';
import { ensureError } from '../../utils/errorUtils';
import SecurityEvent, { 
    EventType, 
    EventSeverity,
     
} from '../../models/SecurityEvent';
import User from '../../models/User';
import sequelize from '../../config/database';

// ============================================================================
// INTERFACES
// ============================================================================

export interface EventData {
    userId?: string;
    eventType: EventType;
    severity: EventSeverity;
    description: string;
    ipAddress?: string;
    userAgent?: string;
    location?: {
        country?: string;
        region?: string;
        city?: string;
        latitude?: number;
        longitude?: number;
        timezone?: string;
    };
    deviceInfo?: {
        type?: 'mobile' | 'desktop' | 'tablet';
        os?: string;
        browser?: string;
        version?: string;
    };
    sessionId?: string;
    tokenId?: string;
    additionalData?: Record<string, any>;
}

export interface EventStats {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    critical: number;
    unresolved: number;
}

export interface EventFilters {
    userId?: string;
    eventType?: EventType[];
    severity?: EventSeverity[];
    startDate?: Date;
    endDate?: Date;
    resolved?: boolean;
    ipAddress?: string;
    limit?: number;
    offset?: number;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class SecurityEventService {
    private readonly context = 'SecurityEventService';

    // ==========================================================================
    // REGISTRO DE EVENTOS
    // ==========================================================================

    /**
     * Registra un evento de seguridad
     */
    async logEvent(data: EventData): Promise<SecurityEvent> {
        const startTime = Date.now();

        try {
            const event = await SecurityEvent.create({
                user_id: data.userId,
                event_type: data.eventType,
                severity: data.severity,
                description: data.description,
                ip_address: data.ipAddress,
                user_agent: data.userAgent,
                location: data.location,
                device_info: data.deviceInfo,
                session_id: data.sessionId,
                token_id: data.tokenId,
                additional_data: data.additionalData,
                resolved: false
            });

            const duration = Date.now() - startTime;

            // Loggear solo eventos críticos en consola
            if (data.severity === EventSeverity.CRITICAL) {
                logger.security(
                    `Evento crítico: ${data.eventType} - ${data.description}`,
                    this.context,
                    {
                        userId: data.userId,
                        eventType: data.eventType,
                        ipAddress: data.ipAddress,
                        severity: data.severity
                    }
                );
            }

            logger.debug('Evento de seguridad registrado', this.context, {
                eventId: event.id,
                eventType: data.eventType,
                severity: data.severity,
                userId: data.userId,
                durationMs: duration
            });

            return event;

        } catch (error) {
            logger.error('Error registrando evento de seguridad', this.context, {
                data
            }, error as Error);
            throw error;
        }
    }

    /**
     * Registra un intento de login fallido
     */
    async logFailedLogin(
        email: string,
        ipAddress?: string,
        userAgent?: string,
        reason?: string
    ): Promise<SecurityEvent> {
        return this.logEvent({
            eventType: EventType.LOGIN_FAILED,
            severity: EventSeverity.MEDIUM,
            description: reason 
                ? `Intento de login fallido para ${email}: ${reason}`
                : `Intento de login fallido para ${email}`,
            ipAddress,
            userAgent,
            additionalData: { email, reason }
        });
    }

    /**
     * Registra un login exitoso
     */
    async logSuccessfulLogin(
        userId: string,
        email: string,
        ipAddress?: string,
        userAgent?: string,
        sessionId?: string
    ): Promise<SecurityEvent> {
        return this.logEvent({
            userId,
            eventType: EventType.LOGIN_SUCCESS,
            severity: EventSeverity.LOW,
            description: `Login exitoso para ${email}`,
            ipAddress,
            userAgent,
            sessionId,
            additionalData: { email }
        });
    }

    /**
     * Registra un logout
     */
    async logLogout(
        userId: string,
        email: string,
        ipAddress?: string,
        userAgent?: string,
        sessionId?: string
    ): Promise<SecurityEvent> {
        return this.logEvent({
            userId,
            eventType: EventType.LOGOUT,
            severity: EventSeverity.LOW,
            description: `Logout para ${email}`,
            ipAddress,
            userAgent,
            sessionId,
            additionalData: { email }
        });
    }

    /**
     * Registra un cambio de contraseña
     */
    async logPasswordChange(
        userId: string,
        email: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<SecurityEvent> {
        return this.logEvent({
            userId,
            eventType: EventType.PASSWORD_CHANGED,
            severity: EventSeverity.MEDIUM,
            description: `Cambio de contraseña para ${email}`,
            ipAddress,
            userAgent,
            additionalData: { email }
        });
    }

    /**
     * Registra un intento de reset de contraseña
     */
    async logPasswordResetRequest(
        userId: string,
        email: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<SecurityEvent> {
        return this.logEvent({
            userId,
            eventType: EventType.PASSWORD_RESET_REQUEST,
            severity: EventSeverity.MEDIUM,
            description: `Solicitud de reset de contraseña para ${email}`,
            ipAddress,
            userAgent,
            additionalData: { email }
        });
    }

    /**
     * Registra un reset de contraseña exitoso
     */
    async logPasswordResetSuccess(
        userId: string,
        email: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<SecurityEvent> {
        return this.logEvent({
            userId,
            eventType: EventType.PASSWORD_RESET_SUCCESS,
            severity: EventSeverity.MEDIUM,
            description: `Reset de contraseña exitoso para ${email}`,
            ipAddress,
            userAgent,
            additionalData: { email }
        });
    }

    /**
     * Registra una verificación de email
     */
    async logEmailVerification(
        userId: string,
        email: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<SecurityEvent> {
        return this.logEvent({
            userId,
            eventType: EventType.EMAIL_VERIFICATION_SUCCESS,
            severity: EventSeverity.LOW,
            description: `Email verificado: ${email}`,
            ipAddress,
            userAgent,
            additionalData: { email }
        });
    }

    /**
     * Registra un bloqueo de cuenta
     */
    async logAccountLocked(
        userId: string,
        email: string,
        reason: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<SecurityEvent> {
        return this.logEvent({
            userId,
            eventType: EventType.ACCOUNT_LOCKED,
            severity: EventSeverity.HIGH,
            description: `Cuenta bloqueada para ${email}: ${reason}`,
            ipAddress,
            userAgent,
            additionalData: { email, reason }
        });
    }

    /**
     * Registra actividad sospechosa
     */
    async logSuspiciousActivity(
        userId: string | undefined,
        description: string,
        ipAddress?: string,
        userAgent?: string,
        additionalData?: Record<string, any>
    ): Promise<SecurityEvent> {
        return this.logEvent({
            userId,
            eventType: EventType.SUSPICIOUS_ACTIVITY,
            severity: EventSeverity.HIGH,
            description,
            ipAddress,
            userAgent,
            additionalData
        });
    }

    /**
     * Registra un ataque de rate limit
     */
    async logRateLimitExceeded(
        userId: string | undefined,
        ipAddress?: string,
        userAgent?: string,
        endpoint?: string
    ): Promise<SecurityEvent> {
        return this.logEvent({
            userId,
            eventType: EventType.RATE_LIMIT_EXCEEDED,
            severity: EventSeverity.MEDIUM,
            description: `Rate limit excedido en ${endpoint || 'endpoint desconocido'}`,
            ipAddress,
            userAgent,
            additionalData: { endpoint }
        });
    }

    /**
     * Registra un token inválido
     */
    async logInvalidToken(
        userId: string | undefined,
        tokenId?: string,
        ipAddress?: string,
        userAgent?: string,
        reason?: string
    ): Promise<SecurityEvent> {
        return this.logEvent({
            userId,
            eventType: EventType.INVALID_TOKEN,
            severity: EventSeverity.MEDIUM,
            description: `Token inválido: ${reason || 'motivo desconocido'}`,
            ipAddress,
            userAgent,
            tokenId,
            additionalData: { reason }
        });
    }

    // ==========================================================================
    // CONSULTAS
    // ==========================================================================

    /**
     * Obtiene evento por ID
     */
    async getEventById(id: string): Promise<SecurityEvent | null> {
        return await SecurityEvent.findByPk(id, {
            include: [{ model: User, as: 'user', attributes: ['id', 'email', 'username'] }]
        });
    }

    /**
     * Lista eventos con filtros
     */
    async listEvents(filters: EventFilters = {}): Promise<{ rows: SecurityEvent[]; count: number }> {
        const where: any = {};

        if (filters.userId) where.user_id = filters.userId;
        if (filters.eventType?.length) where.event_type = { [Op.in]: filters.eventType };
        if (filters.severity?.length) where.severity = { [Op.in]: filters.severity };
        if (filters.resolved !== undefined) where.resolved = filters.resolved;
        if (filters.ipAddress) where.ip_address = filters.ipAddress;

        if (filters.startDate || filters.endDate) {
            where.created_at = {};
            if (filters.startDate) where.created_at[Op.gte] = filters.startDate;
            if (filters.endDate) where.created_at[Op.lte] = filters.endDate;
        }

        const limit = filters.limit || 50;
        const offset = filters.offset || 0;

        const { rows, count } = await SecurityEvent.findAndCountAll({
            where,
            limit,
            offset,
            order: [['created_at', 'DESC']],
            include: [{ model: User, as: 'user', attributes: ['id', 'email', 'username'] }]
        });

        return { rows, count };
    }

    /**
     * Obtiene eventos no resueltos
     */
    async getUnresolvedEvents(limit: number = 50): Promise<SecurityEvent[]> {
        return await SecurityEvent.findAll({
            where: { resolved: false },
            order: [['created_at', 'DESC']],
            limit,
            include: [{ model: User, as: 'user', attributes: ['id', 'email', 'username'] }]
        });
    }

    /**
     * Obtiene eventos de un usuario
     */
    async getEventsByUser(
        userId: string,
        limit: number = 50,
        offset: number = 0
    ): Promise<{ rows: SecurityEvent[]; count: number }> {
        const { rows, count } = await SecurityEvent.findAndCountAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
            limit,
            offset
        });

        return { rows, count };
    }

    /**
     * Obtiene eventos por IP
     */
    async getEventsByIP(
        ipAddress: string,
        limit: number = 50
    ): Promise<SecurityEvent[]> {
        return await SecurityEvent.findAll({
            where: { ip_address: ipAddress },
            order: [['created_at', 'DESC']],
            limit
        });
    }

    /**
     * Obtiene estadísticas de eventos
     */
    async getEventStats(days: number = 7): Promise<EventStats> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const events = await SecurityEvent.findAll({
            where: {
                created_at: { [Op.gte]: startDate }
            }
        });

        const stats: EventStats = {
            total: events.length,
            byType: {},
            bySeverity: {},
            critical: 0,
            unresolved: 0
        };

        for (const event of events) {
            // Por tipo
            stats.byType[event.event_type] = (stats.byType[event.event_type] || 0) + 1;

            // Por severidad
            stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;

            // Contar críticos
            if (event.severity === EventSeverity.CRITICAL) {
                stats.critical++;
            }

            // Contar no resueltos
            if (!event.resolved) {
                stats.unresolved++;
            }
        }

        return stats;
    }

    // ==========================================================================
    // RESOLUCIÓN DE EVENTOS
    // ==========================================================================

    /**
     * Marca un evento como resuelto
     */
    async resolveEvent(
        eventId: string,
        resolvedBy: string,
        notes?: string
    ): Promise<SecurityEvent | null> {
        const transaction = await sequelize.transaction();

        try {
            const event = await SecurityEvent.findByPk(eventId, { transaction });

            if (!event) {
                await transaction.rollback();
                return null;
            }

            if (event.resolved) {
                await transaction.rollback();
                return event;
            }

            event.markAsResolved(resolvedBy, notes);
            await event.save({ transaction });

            await transaction.commit();

            logger.info(`Evento de seguridad resuelto: ${eventId}`, this.context, {
                eventId,
                resolvedBy,
                eventType: event.event_type
            });

            return event;

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error resolviendo evento ${eventId}`, this.context, {}, error as Error);
            throw error;
        }
    }

    /**
     * Marca múltiples eventos como resueltos
     */
    async resolveEvents(
        eventIds: string[],
        resolvedBy: string,
        notes?: string
    ): Promise<number> {
        const transaction = await sequelize.transaction();

        try {
            const [updatedCount] = await SecurityEvent.update(
                {
                    resolved: true,
                    resolved_at: new Date(),
                    resolved_by: resolvedBy,
                    resolution_notes: notes
                },
                {
                    where: {
                        id: { [Op.in]: eventIds },
                        resolved: false
                    },
                    transaction
                }
            );

            await transaction.commit();

            logger.info(`Eventos de seguridad resueltos: ${updatedCount}`, this.context, {
                eventIds,
                resolvedBy
            });

            return updatedCount;

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error resolviendo eventos`, this.context, { eventIds }, error as Error);
            throw error;
        }
    }

    // ==========================================================================
    // UTILIDADES
    // ==========================================================================

    /**
     * Verifica si un evento es crítico
     */
    isCritical(event: SecurityEvent): boolean {
        return event.severity === EventSeverity.CRITICAL;
    }

    /**
     * Calcula tiempo transcurrido desde el evento
     */
    getTimeElapsed(event: SecurityEvent): number {
        const now = new Date();
        const diff = now.getTime() - event.created_at.getTime();
        return Math.floor(diff / (1000 * 60)); // minutos
    }

    /**
     * Obtiene etiqueta legible del tipo de evento
     */
    getEventTypeLabel(eventType: EventType): string {
        const labels: Record<EventType, string> = {
            [EventType.LOGIN_SUCCESS]: 'Login exitoso',
            [EventType.LOGIN_FAILED]: 'Login fallido',
            [EventType.LOGOUT]: 'Cierre de sesión',
            [EventType.PASSWORD_CHANGE]: 'Cambio de contraseña',
            [EventType.PASSWORD_RESET_REQUEST]: 'Solicitud de reset',
            [EventType.PASSWORD_RESET_SUCCESS]: 'Reset exitoso',
            [EventType.PASSWORD_RESET_FAILED]: 'Reset fallido',
            [EventType.PASSWORD_CHANGED]: 'Contraseña cambiada',
            [EventType.PASSWORD_RESET_RATE_LIMIT_EXCEEDED]: 'Límite de reset excedido',
            [EventType.EMAIL_VERIFICATION_REQUEST]: 'Verificación de email',
            [EventType.EMAIL_VERIFICATION_SUCCESS]: 'Email verificado',
            [EventType.ACCOUNT_LOCKED]: 'Cuenta bloqueada',
            [EventType.ACCOUNT_UNLOCKED]: 'Cuenta desbloqueada',
            [EventType.TOKEN_REVOKED]: 'Token revocado',
            [EventType.SUSPICIOUS_ACTIVITY]: 'Actividad sospechosa',
            [EventType.RATE_LIMIT_EXCEEDED]: 'Límite de peticiones excedido',
            [EventType.INVALID_TOKEN]: 'Token inválido',
            [EventType.UNAUTHORIZED_ACCESS]: 'Acceso no autorizado',
            [EventType.ADMIN_ACTION]: 'Acción de administrador'
        };
        return labels[eventType] || eventType;
    }

    /**
     * Obtiene etiqueta legible de la severidad
     */
    getSeverityLabel(severity: EventSeverity): string {
        const labels: Record<EventSeverity, string> = {
            [EventSeverity.LOW]: 'Baja',
            [EventSeverity.MEDIUM]: 'Media',
            [EventSeverity.HIGH]: 'Alta',
            [EventSeverity.CRITICAL]: 'Crítica'
        };
        return labels[severity] || severity;
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const securityEventService = new SecurityEventService();