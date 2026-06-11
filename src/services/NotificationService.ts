// services/notification/NotificationService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import Notification, {
    NotificationAttributes,
    NotificationCreationAttributes,
    NotificationType,
    NotificationChannel,
    NotificationPriority,
    NotificationStatus
} from '../models/Notification';
import User, { NotificationPreference } from '../models/User';
import {
    NotificationError,
    NotificationNotFoundError,
    NotificationValidationError,
    ChannelNotAvailableError2,
    NotificationQuotaError
} from '../utils/NotificationErrors';
import { getErrorMessage, ensureError } from '../utils/errorUtils';
import {
    AVAILABLE_CHANNELS,
    DEFAULT_PRIORITY,
    EXPIRATION_TIMES,
    RETRY_LIMITS,
    API_LIMITS
} from '../constants/notification.constants';
import { notificationChannelService } from './NotificationChannelService';
import { notificationTemplateService } from './NotificationTemplateService';
import { notificationQueueService } from './NotificationQueueService';

// ============================================================================
// INTERFACES
// ============================================================================

export interface CreateNotificationDTO {
    userId: string;
    type: NotificationType;
    channel?: NotificationChannel;
    priority?: NotificationPriority;
    title?: string;
    content?: string;
    data?: any;
    scheduledFor?: Date;
    expiresAt?: Date;
    metadata?: {
        bovineId?: string;
        eventId?: string;
        healthRecordId?: string;
        locationId?: string;
        ranchId?: string;
        [key: string]: any;
    };
    createdBy?: string;
}

export interface NotificationFilters {
    userId?: string;
    type?: NotificationType[];
    status?: NotificationStatus[];
    priority?: NotificationPriority[];
    startDate?: Date;
    endDate?: Date;
    read?: boolean;
    limit?: number;
    offset?: number;
}

export interface NotificationResponse {
    id: string;
    type: string;
    typeLabel: string;
    channel: string;
    channelLabel: string;
    priority: string;
    priorityLabel: string;
    title: string;
    content: string;
    status: string;
    statusLabel: string;
    sentAt?: Date;
    deliveredAt?: Date;
    readAt?: Date;
    createdAt: Date;
    metadata?: any;
    isRead: boolean;
    timeAgo: string;
}

export interface BatchCreateResult {
    successful: number;
    failed: number;
    errors: Array<{ userId: string; error: string }>;
    notificationIds: string[];
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class NotificationService {
    private readonly context = 'NotificationService';

    // ==========================================================================
    // MÉTODOS PÚBLICOS
    // ==========================================================================

    /**
     * Crea y envía una notificación
     */
    async sendNotification(data: CreateNotificationDTO): Promise<Notification> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            // 1. Validar usuario
            const user = await User.findByPk(data.userId, {
                attributes: ['id', 'email', 'phone', 'preferences']
            });

            if (!user) {
                throw new NotificationValidationError(`Usuario con ID ${data.userId} no encontrado`);
            }

            // 2. Validar canal
            const channel = data.channel || await this.getDefaultChannel(user);
            if (!channel) {
                throw new NotificationValidationError(
                    'No se pudo determinar un canal de notificación para el usuario'
                );
            }

            // 3. Validar disponibilidad del canal para el tipo
            await this.validateChannelForType(channel, data.type);

            // 4. Determinar prioridad
            const priority = data.priority || DEFAULT_PRIORITY[data.type] || NotificationPriority.MEDIUM;

            // 5. Establecer expiración por defecto
            const expiresAt = data.expiresAt || new Date(
                Date.now() + EXPIRATION_TIMES[priority] * 60 * 1000
            );

            // 6. Renderizar plantilla
            const template = await notificationTemplateService.render(
                data.type,
                data.data || {}
            );

            // 7. Crear notificación en BD
            const notification = await Notification.create({
                userId: data.userId,
                type: data.type,
                channel,
                priority,
                title: data.title || template.title,
                content: data.content || template.content,
                data: data.data,
                status: NotificationStatus.PENDING,
                maxRetries: RETRY_LIMITS[priority],
                scheduledFor: data.scheduledFor,
                expiresAt,
                metadata: data.metadata,
                createdBy: data.createdBy
            } as NotificationCreationAttributes, { transaction });

            await transaction.commit();

            const duration = Date.now() - startTime;

            logger.info(`Notificación creada: ${notification.id}`, this.context, {
                notificationId: notification.id,
                userId: data.userId,
                type: data.type,
                channel,
                priority,
                durationMs: duration
            });

            return notification;

        } catch (error) {
            await transaction.rollback();
            logger.error('Error creando notificación', this.context, { data }, ensureError(error));

            if (error instanceof NotificationError) throw error;
            throw new NotificationError(
                'Error al crear la notificación',
                'CREATE_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Crea notificaciones en lote
     */
    async sendBulkNotifications(
        notifications: CreateNotificationDTO[]
    ): Promise<BatchCreateResult> {
        const startTime = Date.now();
        const result: BatchCreateResult = {
            successful: 0,
            failed: 0,
            errors: [],
            notificationIds: []
        };

        // Procesar en lotes para no sobrecargar
        const batchSize = API_LIMITS.MAX_NOTIFICATIONS_PER_REQUEST;

        for (let i = 0; i < notifications.length; i += batchSize) {
            const batch = notifications.slice(i, i + batchSize);

            const batchPromises = batch.map(async (notification) => {
                try {
                    const created = await this.sendNotification(notification);
                    result.successful++;
                    result.notificationIds.push(created.id);
                } catch (error) {
                    result.failed++;
                    result.errors.push({
                        userId: notification.userId,
                        error: getErrorMessage(error)
                    });
                }
            });

            await Promise.allSettled(batchPromises);
        }

        const duration = Date.now() - startTime;

        logger.info(`Notificaciones masivas creadas`, this.context, {
            total: notifications.length,
            successful: result.successful,
            failed: result.failed,
            durationMs: duration
        });

        return result;
    }

    /**
     * Obtiene una notificación por ID
     */
    async getNotificationById(
        notificationId: string,
        userId: string
    ): Promise<Notification | null> {
        try {
            const notification = await Notification.findOne({
                where: {
                    id: notificationId,
                    userId
                }
            });

            return notification;

        } catch (error) {
            logger.error(`Error obteniendo notificación ${notificationId}`, this.context, {
                notificationId,
                userId
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Lista notificaciones con filtros
     */
    async listNotifications(
        filters: NotificationFilters
    ): Promise<{ rows: Notification[]; count: number; unreadCount: number }> {
        try {
            const where = this.buildWhereClause(filters);
            const limit = filters.limit || 50;
            const offset = filters.offset || 0;

            const [rows, count, unreadCount] = await Promise.all([
                Notification.findAll({
                    where,
                    limit,
                    offset,
                    order: [['created_at', 'DESC']]
                }),
                Notification.count({ where }),
                Notification.count({
                    where: {
                        ...where,
                        status: {
                            [Op.in]: [NotificationStatus.SENT, NotificationStatus.DELIVERED]
                        },
                        readAt: null
                    }
                })
            ]);

            return { rows, count, unreadCount };

        } catch (error) {
            logger.error('Error listando notificaciones', this.context, { filters }, ensureError(error));
            throw error;
        }
    }

    /**
     * Marca una notificación como leída
     */
    async markAsRead(notificationId: string, userId: string): Promise<Notification> {
        const transaction = await sequelize.transaction();

        try {
            const notification = await Notification.findOne({
                where: { id: notificationId, userId },
                transaction
            });

            if (!notification) {
                throw new NotificationNotFoundError(notificationId);
            }

            notification.markAsRead();
            await notification.save({ transaction });

            await transaction.commit();

            logger.info(`Notificación marcada como leída: ${notificationId}`, this.context, {
                notificationId,
                userId
            });

            return notification;

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error marcando notificación ${notificationId} como leída`, this.context, {
                notificationId,
                userId
            }, ensureError(error));

            if (error instanceof NotificationError) throw error;
            throw new NotificationError(
                'Error al marcar notificación como leída',
                'UPDATE_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Marca todas las notificaciones de un usuario como leídas
     */
    async markAllAsRead(userId: string): Promise<number> {
        const transaction = await sequelize.transaction();

        try {
            const [updatedCount] = await Notification.update(
                {
                    status: NotificationStatus.READ,
                    readAt: new Date()
                },
                {
                    where: {
                        userId,
                        readAt: { [Op.is]: null } as any,
                        status: {
                            [Op.in]: [NotificationStatus.SENT, NotificationStatus.DELIVERED]
                        }
                    },
                    transaction
                }
            );

            await transaction.commit();

            logger.info(`Todas las notificaciones marcadas como leídas para usuario ${userId}`, this.context, {
                userId,
                count: updatedCount
            });

            return updatedCount;

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error marcando todas las notificaciones como leídas`, this.context, {
                userId
            }, ensureError(error));

            throw new NotificationError(
                'Error al marcar notificaciones como leídas',
                'UPDATE_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Elimina una notificación (soft delete)
     */
    async deleteNotification(notificationId: string, userId: string): Promise<void> {
        const transaction = await sequelize.transaction();

        try {
            const notification = await Notification.findOne({
                where: { id: notificationId, userId },
                transaction
            });

            if (!notification) {
                throw new NotificationNotFoundError(notificationId);
            }

            await notification.destroy({ transaction });

            await transaction.commit();

            logger.info(`Notificación eliminada: ${notificationId}`, this.context, {
                notificationId,
                userId
            });

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error eliminando notificación ${notificationId}`, this.context, {
                notificationId,
                userId
            }, ensureError(error));

            if (error instanceof NotificationError) throw error;
            throw new NotificationError(
                'Error al eliminar notificación',
                'DELETE_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Obtiene el conteo de no leídas
     */
    async getUnreadCount(userId: string): Promise<number> {
        try {
            return await Notification.count({
                where: {
                    userId,
                    readAt: { [Op.is]: null } as any,
                    status: {
                        [Op.in]: [NotificationStatus.SENT, NotificationStatus.DELIVERED]
                    }
                }
            });
        } catch (error) {
            logger.error(`Error obteniendo conteo de no leídas`, this.context, { userId }, ensureError(error));
            throw error;
        }
    }

    // ==========================================================================
    // MÉTODOS DE UTILIDAD
    // ==========================================================================

    /**
     * Formatea una notificación para respuesta
     */
    formatNotificationResponse(notification: Notification): NotificationResponse {
        const now = new Date();
        const createdAt = new Date(notification.createdAt);
        const diffMs = now.getTime() - createdAt.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        let timeAgo: string;
        if (diffMins < 1) {
            timeAgo = 'Ahora mismo';
        } else if (diffMins < 60) {
            timeAgo = `Hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
        } else if (diffHours < 24) {
            timeAgo = `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
        } else {
            timeAgo = `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
        }

        return {
            id: notification.id,
            type: notification.type,
            typeLabel: this.getTypeLabel(notification.type),
            channel: notification.channel,
            channelLabel: this.getChannelLabel(notification.channel),
            priority: notification.priority,
            priorityLabel: this.getPriorityLabel(notification.priority),
            title: notification.title,
            content: notification.content,
            status: notification.status,
            statusLabel: this.getStatusLabel(notification.status),
            sentAt: notification.sentAt,
            deliveredAt: notification.deliveredAt,
            readAt: notification.readAt,
            createdAt: notification.createdAt,
            metadata: notification.metadata,
            isRead: !!notification.readAt,
            timeAgo
        };
    }

    /**
     * Construye cláusula WHERE para filtros
     */
    private buildWhereClause(filters: NotificationFilters): any {
        const where: any = {};

        if (filters.userId) {
            where.userId = filters.userId;
        }

        if (filters.type?.length) {
            where.type = { [Op.in]: filters.type };
        }

        if (filters.status?.length) {
            where.status = { [Op.in]: filters.status };
        }

        if (filters.priority?.length) {
            where.priority = { [Op.in]: filters.priority };
        }

        if (filters.startDate || filters.endDate) {
            where.createdAt = {};
            if (filters.startDate) where.createdAt[Op.gte] = filters.startDate;
            if (filters.endDate) where.createdAt[Op.lte] = filters.endDate;
        }

        if (filters.read !== undefined) {
            if (filters.read) {
                where.readAt = { [Op.not]: null };
            } else {
                where.readAt = null;
            }
        }

        return where;
    }

    /**
     * Valida disponibilidad del canal para el tipo de notificación
     */
    private async validateChannelForType(
        channel: NotificationChannel,
        type: NotificationType
    ): Promise<void> {
        const available = AVAILABLE_CHANNELS[type] || [];

        //type CheckError = typeof ChannelNotAvailableError2;
        //type CheckParams = ConstructorParameters<typeof ChannelNotAvailableError2>;

        if (!available.includes(channel as any)) {
            throw new ChannelNotAvailableError2(channel as NotificationChannel, type as NotificationType);
        }
    }

    /**
     * Obtiene el canal por defecto para un usuario
     */
    private async getDefaultChannel(user: User): Promise<NotificationChannel | undefined> {
        const prefs = user.systemSettings?.notifications;

        // Prioridad según preferencias y disponibilidad de datos
        if (prefs) {
            if (prefs.email !== NotificationPreference.NONE && user.email) return NotificationChannel.EMAIL;
            if (prefs.sms !== NotificationPreference.NONE && user.contactInfo?.primaryPhone) return NotificationChannel.SMS;
            if (prefs.push !== NotificationPreference.NONE && user.pushTokens?.some(t => t.active)) return NotificationChannel.PUSH;
            if (prefs.whatsapp !== NotificationPreference.NONE && user.contactInfo?.primaryPhone) return NotificationChannel.WHATSAPP;
        }

        // Fallback a canales básicos si hay datos
        if (user.email) return NotificationChannel.EMAIL;
        if (user.contactInfo?.primaryPhone) return NotificationChannel.SMS;
        if (user.pushTokens?.some(t => t.active)) return NotificationChannel.PUSH;

        return NotificationChannel.IN_APP;
    }

    /**
     * Obtiene etiqueta del tipo
     */
    getTypeLabel(type: NotificationType): string {
        const labels = {
            [NotificationType.HEALTH_ALERT]: 'Alerta de Salud',
            [NotificationType.VACCINATION_REMINDER]: 'Recordatorio de Vacunación',
            [NotificationType.TREATMENT_REMINDER]: 'Recordatorio de Tratamiento',
            [NotificationType.BIRTH_ALERT]: 'Alerta de Nacimiento',
            [NotificationType.WEANING_ALERT]: 'Alerta de Destete',
            [NotificationType.HEAT_DETECTION]: 'Detección de Celo',
            [NotificationType.INSEMINATION_RESULT]: 'Resultado de Inseminación',
            [NotificationType.PREGNANCY_CHECK]: 'Chequeo de Gestación',
            [NotificationType.WEIGHT_MILESTONE]: 'Hito de Peso',
            [NotificationType.LOW_STOCK_ALERT]: 'Alerta de Stock Bajo',
            [NotificationType.EXPIRATION_ALERT]: 'Alerta de Vencimiento',
            [NotificationType.GEOFENCE_ALERT]: 'Alerta de Geocerca',
            [NotificationType.MOVEMENT_ALERT]: 'Alerta de Movimiento',
            [NotificationType.SYSTEM_ALERT]: 'Alerta del Sistema',
            [NotificationType.TASK_REMINDER]: 'Recordatorio de Tarea',
            [NotificationType.REPORT_READY]: 'Reporte Listo',
            [NotificationType.PRODUCTION_ALERT]: 'Alerta de Producción',
            [NotificationType.REPRODUCTION_ALERT]: 'Alerta de Reproducción'

        };
        return labels[type] || type;
    }

    /**
     * Obtiene etiqueta del canal
     */
    getChannelLabel(channel: NotificationChannel): string {
        const labels = {
            [NotificationChannel.EMAIL]: 'Correo Electrónico',
            [NotificationChannel.SMS]: 'Mensaje de Texto',
            [NotificationChannel.PUSH]: 'Notificación Push',
            [NotificationChannel.IN_APP]: 'Notificación en App',
            [NotificationChannel.WHATSAPP]: 'WhatsApp'
        };
        return labels[channel] || channel;
    }

    /**
     * Obtiene etiqueta de la prioridad
     */
    getPriorityLabel(priority: NotificationPriority): string {
        const labels = {
            [NotificationPriority.LOW]: 'Baja',
            [NotificationPriority.MEDIUM]: 'Media',
            [NotificationPriority.HIGH]: 'Alta',
            [NotificationPriority.URGENT]: 'Urgente'
        };
        return labels[priority] || priority;
    }

    /**
     * Obtiene etiqueta del estado
     */
    getStatusLabel(status: NotificationStatus): string {
        const labels = {
            [NotificationStatus.PENDING]: 'Pendiente',
            [NotificationStatus.SENT]: 'Enviado',
            [NotificationStatus.DELIVERED]: 'Entregado',
            [NotificationStatus.READ]: 'Leído',
            [NotificationStatus.FAILED]: 'Fallido',
            [NotificationStatus.CANCELLED]: 'Cancelado'
        };
        return labels[status] || status;
    }

    /**
     * Envía notificaciones específicas para salud
     */
    async sendHealthAlert(data: {
        bovineId: string;
        bovineEarTag: string;
        alertType: 'critical' | 'warning' | 'info';
        message: string;
        details: string;
        veterinarianId?: string;
        ranchId: string;
        location?: { latitude: number; longitude: number };
    }): Promise<void> {
        try {
            // Obtener veterinarios del rancho
            const veterinarians = await this.getVeterinariansForRanch(data.ranchId);

            const notifications: CreateNotificationDTO[] = veterinarians.map(vet => ({
                userId: vet.id,
                type: NotificationType.HEALTH_ALERT,
                priority: data.alertType === 'critical' ? NotificationPriority.URGENT : NotificationPriority.HIGH,
                data: {
                    bovineId: data.bovineId,
                    bovineEarTag: data.bovineEarTag,
                    alertType: data.alertType,
                    message: data.message,
                    details: data.details,
                    location: data.location
                },
                metadata: {
                    bovineId: data.bovineId,
                    ranchId: data.ranchId
                }
            }));

            await this.sendBulkNotifications(notifications);

        } catch (error) {
            logger.error('Error enviando alerta de salud', this.context, { data }, ensureError(error));
        }
    }

    /**
     * Envía recordatorio de vacunación
     */
    async sendVaccinationReminder(data: {
        bovineId: string;
        bovineEarTag: string;
        vaccineName: string;
        dueDate: Date;
        veterinarianName: string;
        ranchId: string;
        ownerId: string;
    }): Promise<void> {
        try {
            await this.sendNotification({
                userId: data.ownerId,
                type: NotificationType.VACCINATION_REMINDER,
                priority: NotificationPriority.MEDIUM,
                data: {
                    bovineId: data.bovineId,
                    bovineEarTag: data.bovineEarTag,
                    vaccineName: data.vaccineName,
                    dueDate: data.dueDate,
                    veterinarianName: data.veterinarianName
                },
                metadata: {
                    bovineId: data.bovineId,
                    ranchId: data.ranchId
                }
            });

        } catch (error) {
            logger.error('Error enviando recordatorio de vacunación', this.context, { data }, ensureError(error));
        }
    }

    /**
     * Envía alerta de geocerca
     */
    async sendGeofenceAlert(data: {
        bovineId: string;
        bovineEarTag: string;
        geofenceId: string;
        geofenceName: string;
        event: 'entry' | 'exit';
        location: { latitude: number; longitude: number };
        ranchId: string;
    }): Promise<void> {
        try {
            // Obtener responsables del rancho
            const managers = await this.getRanchManagers(data.ranchId);

            const notifications: CreateNotificationDTO[] = managers.map(manager => ({
                userId: manager.id,
                type: NotificationType.GEOFENCE_ALERT,
                priority: NotificationPriority.HIGH,
                data: {
                    bovineId: data.bovineId,
                    bovineEarTag: data.bovineEarTag,
                    geofenceId: data.geofenceId,
                    geofenceName: data.geofenceName,
                    eventType: data.event,
                    location: data.location
                },
                metadata: {
                    bovineId: data.bovineId,
                    geofenceId: data.geofenceId,
                    ranchId: data.ranchId
                }
            }));

            await this.sendBulkNotifications(notifications);

        } catch (error) {
            logger.error('Error enviando alerta de geocerca', this.context, { data }, ensureError(error));
        }
    }

    /**
     * Obtiene veterinarios de un rancho (mock)
     */
    private async getVeterinariansForRanch(ranchId: string): Promise<any[]> {
        // TODO: Implementar consulta real
        return [{ id: 'vet-1' }, { id: 'vet-2' }];
    }

    /**
     * Obtiene administradores de un rancho (mock)
     */
    private async getRanchManagers(ranchId: string): Promise<any[]> {
        // TODO: Implementar consulta real
        return [{ id: 'manager-1' }];
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const notificationService = new NotificationService();