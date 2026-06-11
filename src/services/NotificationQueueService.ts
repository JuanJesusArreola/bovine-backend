// services/notification/NotificationQueueService.ts
import { Op } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import Notification, { NotificationStatus, NotificationPriority, NotificationChannel } from '../models/Notification';
import { notificationChannelService } from './NotificationChannelService';
import { NotificationService } from './NotificationService';
import { BATCH_PROCESSING, RETRY_INTERVALS } from '../constants/notification.constants';
import User, { NotificationPreference } from '../models/User';


export class NotificationQueueService {
    private readonly context = 'NotificationQueueService';
    private isProcessing = false;
    private processingInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.startQueueProcessor();
    }

    /**
     * Inicia el procesamiento de la cola
     */
    private startQueueProcessor(): void {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }

        this.processingInterval = setInterval(
            () => this.processQueue(),
            BATCH_PROCESSING.INTERVAL_MS
        );

        logger.info('Procesador de cola de notificaciones iniciado', this.context);
    }

    /**
     * Detiene el procesamiento de la cola
     */
    stopQueueProcessor(): void {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            logger.info('Procesador de cola de notificaciones detenido', this.context);
        }
    }

    /**
     * Procesa la cola de notificaciones
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing) {
            logger.debug('Ya hay un proceso de cola en ejecución', this.context);
            return;
        }

        this.isProcessing = true;

        try {
            // Procesar por lotes según prioridad
            await this.processPriorityLevel(NotificationPriority.URGENT);
            await this.processPriorityLevel(NotificationPriority.HIGH);
            await this.processPriorityLevel(NotificationPriority.MEDIUM);
            await this.processPriorityLevel(NotificationPriority.LOW);

        } catch (error) {
            logger.error('Error procesando cola de notificaciones', this.context, {}, error as Error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Procesa notificaciones de un nivel de prioridad específico
     */
    private async processPriorityLevel(priority: NotificationPriority): Promise<void> {
        const transaction = await sequelize.transaction();

        try {
            // Obtener notificaciones pendientes de esta prioridad
            const notifications = await Notification.findAll({
                where: {
                    status: NotificationStatus.PENDING,
                    priority,
                    [Op.and]: [
                        {
                            [Op.or]: [
                                { scheduledFor: { [Op.is]: null } as any },
                                { scheduledFor: { [Op.lte]: new Date() } }
                            ]
                        },
                        {
                            [Op.or]: [
                                { expiresAt: { [Op.is]: null } as any},
                                { expiresAt: { [Op.gt]: new Date() } }
                            ]
                        }
                    ]
                },
                limit: BATCH_PROCESSING.MAX_BATCH_SIZE,
                order: [
                    ['priority', 'DESC'],
                    ['createdAt', 'ASC']
                ],
                transaction
            });

            if (notifications.length === 0) {
                await transaction.commit();
                return;
            }

            logger.debug(`Procesando ${notifications.length} notificaciones de prioridad ${priority}`, this.context);

            // Procesar cada notificación
            for (const notification of notifications) {
                await this.processNotification(notification, transaction);
            }

            await transaction.commit();

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error procesando lote de prioridad ${priority}`, this.context, {}, error as Error);
        }
    }

    /**
     * Procesa una notificación individual
     */
    private async processNotification(
        notification: Notification,
        transaction: any
    ): Promise<void> {
        try {
            // Obtener información del usuario (simplificado)
            const user = await this.getUserInfo(notification.userId);

            if (!user) {
                await notification.update({
                    status: NotificationStatus.FAILED,
                    error: 'Usuario no encontrado'
                }, { transaction });
                return;
            }

            // Obtener el canal y destinatario según preferencias del usuario
            const { channel, recipient } = await this.getChannelAndRecipient(notification, user);

            if (!channel || !recipient) {
                await notification.update({
                    status: NotificationStatus.FAILED,
                    error: 'No hay canales disponibles para este usuario'
                }, { transaction });
                return;
            }

            // Enviar notificación
            const result = await notificationChannelService.send(
                channel,
                recipient,
                {
                    to: recipient,
                    subject: notification.title,
                    title: notification.title,
                    body: notification.content,
                    data: notification.data,
                    priority: notification.priority
                }
            );

            if (result.success) {
                // Actualizar estado según el canal
                if (channel === 'IN_APP') {
                    await notification.update({
                        status: NotificationStatus.DELIVERED,
                        deliveredAt: new Date(),
                        data: {
                            ...notification.data,
                            channelMessageId: result.messageId
                        }
                    }, { transaction });
                } else {
                    await notification.update({
                        status: NotificationStatus.SENT,
                        sentAt: new Date(),
                        data: {
                            ...notification.data,
                            channelMessageId: result.messageId
                        }
                    }, { transaction });
                }
            } else {
                await this.handleFailure(notification, result.error || 'Error desconocido', transaction);
            }

        } catch (error) {
            await this.handleFailure(
                notification,
                error instanceof Error ? error.message : 'Error desconocido',
                transaction
            );
        }
    }

    /**
     * Maneja el fallo de envío
     */
    private async handleFailure(
        notification: Notification,
        error: string,
        transaction: any
    ): Promise<void> {
        const retryCount = notification.retryCount + 1;

        if (retryCount >= notification.maxRetries) {
            // Máximo de reintentos alcanzado
            await notification.update({
                status: NotificationStatus.FAILED,
                error,
                retryCount
            }, { transaction });
        } else {
            // Reprogramar para reintentar
            const retryInterval = RETRY_INTERVALS[notification.priority] * 60 * 1000;
            const nextAttempt = new Date(Date.now() + retryInterval);

            await notification.update({
                status: NotificationStatus.PENDING,
                error,
                retryCount,
                scheduledFor: nextAttempt
            }, { transaction });
        }
    }

    /**
     * Obtiene información del usuario (simplificado)
     */
    private async getUserInfo(userId: string): Promise<any> {

        return await User.findByPk(userId, {
            attributes: [
                'id', 'email', 'contactInfo', 'pushTokens', 'systemSettings'
            ]
        });
    }

    /**
     * Determina el canal y destinatario para la notificación
     */
    private async getChannelAndRecipient(
        notification: Notification,
        user: User
    ): Promise<{ channel?: NotificationChannel; recipient?: string }> {
        // Primero intentar con el canal especificado en la notificación
        if (notification.channel) {
            const recipient = this.getRecipientForChannel(user, notification.channel);
            if (recipient) {
                return { channel: notification.channel, recipient };
            }
        }

        // Obtener canales disponibles según preferencias
        const availableChannels = this.getAvailableChannelsFromPreferences(user);

        for (const channel of availableChannels) {
            const recipient = this.getRecipientForChannel(user, channel);
            if (recipient) {
                return { channel, recipient };
            }
        }

        return {};
    }

    /**
     * Obtiene el destinatario para un canal específico
     */
    private getRecipientForChannel(user: User, channel: NotificationChannel): string | undefined {
        switch (channel) {
            case NotificationChannel.EMAIL:
                return user.email;
            case NotificationChannel.SMS:
            case NotificationChannel.WHATSAPP:
                return user.contactInfo?.primaryPhone;
            case NotificationChannel.PUSH:
                // Devolver el primer token activo
                return user.pushTokens?.find(t => t.active)?.token;
            case NotificationChannel.IN_APP:
                return user.id; // Para notificaciones in-app, el destinatario es el userId
            default:
                return undefined;
        }
    }

    private getAvailableChannelsFromPreferences(user: User): NotificationChannel[] {
        const prefs = user.systemSettings?.notifications;
        const channels: NotificationChannel[] = [];

        if (!prefs) {
            // Si no hay preferencias, devolver canales básicos que tengan datos
            if (user.email) channels.push(NotificationChannel.EMAIL);
            if (user.contactInfo?.primaryPhone) channels.push(NotificationChannel.SMS);
            if (user.pushTokens?.some(t => t.active)) channels.push(NotificationChannel.PUSH);
            channels.push(NotificationChannel.IN_APP); // siempre disponible
            return channels;
        }

        // Evaluar cada canal según preferencia (asumimos que si no es NONE, está disponible)
        if (prefs.email !== NotificationPreference.NONE && user.email) {
            channels.push(NotificationChannel.EMAIL);
        }
        if (prefs.sms !== NotificationPreference.NONE && user.contactInfo?.primaryPhone) {
            channels.push(NotificationChannel.SMS);
        }
        if (prefs.push !== NotificationPreference.NONE && user.pushTokens?.some(t => t.active)) {
            channels.push(NotificationChannel.PUSH);
        }
        if (prefs.whatsapp !== NotificationPreference.NONE && user.contactInfo?.primaryPhone) {
            channels.push(NotificationChannel.WHATSAPP);
        }
        // IN_APP siempre disponible si el usuario está activo
        channels.push(NotificationChannel.IN_APP);

        return channels;
    }
}

export const notificationQueueService = new NotificationQueueService();