// services/notification/NotificationChannelService.ts
import { NotificationChannel, NotificationPriority } from '../models/Notification';
import logger from '../utils/logger';
import { NotificationSendError } from '../utils/NotificationErrors';
import { emailService, EmailType, EmailPriority } from './EmailService';
import { smsService } from './sms'; // Asumiendo que existe
import { pushService } from './push'; // Asumiendo que existe
import { userPushService } from './UserPushService';

export interface ChannelMessage {
    to: string | string[];
    subject?: string;
    title?: string;
    body: string;
    data?: any;
    priority?: NotificationPriority;
}

export interface ChannelResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export class NotificationChannelService {
    private readonly context = 'NotificationChannelService';

    /**
     * Envía una notificación por el canal especificado
     */
    async send(
        channel: NotificationChannel,
        recipient: string,
        message: ChannelMessage
    ): Promise<ChannelResult> {
        try {
            switch (channel) {
                case NotificationChannel.EMAIL:
                    return await this.sendEmail(recipient, message);
                case NotificationChannel.SMS:
                    return await this.sendSMS(recipient, message);
                case NotificationChannel.PUSH:
                    return await this.sendPush(recipient, message);
                case NotificationChannel.IN_APP:
                    return await this.sendInApp(recipient, message);
                case NotificationChannel.WHATSAPP:
                    return await this.sendWhatsApp(recipient, message);
                default:
                    throw new NotificationSendError(channel, recipient,
                        new Error(`Canal no soportado: ${channel}`));
            }
        } catch (error) {
            logger.error(`Error enviando notificación por ${channel}`, this.context, {
                recipient,
                error: error instanceof Error ? error.message : 'Error desconocido'
            }, error as Error);

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido'
            };
        }
    }

    /**
     * Envía una notificación por email
     */
    private async sendEmail(
        recipient: string,
        message: ChannelMessage
    ): Promise<ChannelResult> {
        try {
            // Mapear prioridad de notificación a prioridad de email
            const priorityMap: Record<NotificationPriority, EmailPriority> = {
                [NotificationPriority.LOW]: EmailPriority.LOW,
                [NotificationPriority.MEDIUM]: EmailPriority.MEDIUM,
                [NotificationPriority.HIGH]: EmailPriority.HIGH,
                [NotificationPriority.URGENT]: EmailPriority.CRITICAL
            };

            const result = await emailService.sendEmail({
                to: recipient,
                template: EmailType.SYSTEM_NOTIFICATION,
                variables: {
                    title: message.subject || message.title || 'Nueva notificación',
                    message: message.body,
                    data: message.data,
                    year: new Date().getFullYear()
                },
                priority: message.priority ? priorityMap[message.priority] : EmailPriority.MEDIUM
            });

            return {
                success: true,
                messageId: result?.messageId
            };
        } catch (error) {
            throw new NotificationSendError(NotificationChannel.EMAIL, recipient, error as Error);
        }
    }

    /**
     * Envía una notificación por SMS
     */
    private async sendSMS(
        recipient: string,
        message: ChannelMessage
    ): Promise<ChannelResult> {
        try {
            // Asumiendo que existe smsService
            const result = await smsService.sendSMS(recipient, message.body);

            return {
                success: true,
                messageId: result?.messageId
            };
        } catch (error) {
            throw new NotificationSendError(NotificationChannel.SMS, recipient, error as Error);
        }
    }

    /**
     * Envía una notificación push
     */
    private async sendPush(
        recipient: string,
        message: ChannelMessage
    ): Promise<ChannelResult> {
        try {

            let tokens: string[] = [];
            // Si recipient es userId (empieza con 'user_')
            if (recipient.startsWith('user_')) {
                const userId = recipient.replace('user_', '');
                tokens = await userPushService.getActivePushTokens(userId);
            } else {
                // Es un token directo
                tokens = [recipient];
            }

            if (tokens.length === 0) {
                logger.warn('Sin tokens push activos', this.context, { recipient });
                return {
                    success: true, // Consideramos éxito porque no hay error técnico
                    messageId: 'no-tokens'
                };
            }

            const result = await pushService.sendPushNotification(tokens, {
                title: message.title || 'Notificación',
                body: message.body,
                data: {
                    ...message.data,
                    priority: message.priority,
                    timestamp: Date.now().toString()
                }
            });

            // Si hay tokens fallidos, desactivarlos
            if (result.failedTokens) {
                for (const failedToken of result.failedTokens) {
                    if (recipient.startsWith('user_')) {
                        const userId = recipient.replace('user_', '');
                        await userPushService.deactivatePushToken(userId, failedToken);
                    }
                }
            }

            return {
                success: result.status === 'sent' || result.status === 'partial',
                messageId: result.messageId,
                error: result.error
            };
        } catch (error) {
            throw new NotificationSendError(NotificationChannel.PUSH, recipient, error as Error);
        }
    }

    /**
     * Envía una notificación in-app
     */
    private async sendInApp(
        recipient: string,
        message: ChannelMessage
    ): Promise<ChannelResult> {
        // Las notificaciones in-app solo se guardan en BD
        // El frontend las consultará vía API o WebSocket
        return {
            success: true
        };
    }

    /**
     * Envía una notificación por WhatsApp
     */
    private async sendWhatsApp(
        recipient: string,
        message: ChannelMessage
    ): Promise<ChannelResult> {
        // Implementar cuando tengamos servicio de WhatsApp
        logger.warn('WhatsApp no implementado', this.context, { recipient });
        return {
            success: false,
            error: 'WhatsApp no implementado'
        };
    }

    /**
     * Mapea prioridad de notificación a prioridad de push
     */
    private mapPriority(priority?: NotificationPriority): 'low' | 'normal' | 'high' {
        switch (priority) {
            case NotificationPriority.LOW:
                return 'low';
            case NotificationPriority.HIGH:
            case NotificationPriority.URGENT:
                return 'high';
            default:
                return 'normal';
        }
    }

    /**
     * Verifica si un canal está disponible
     */
    isChannelAvailable(channel: NotificationChannel, recipient: string): boolean {
        // Verificar formato según canal
        switch (channel) {
            case NotificationChannel.EMAIL:
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);
            case NotificationChannel.SMS:
                return /^[\+]?[1-9][\d]{9,15}$/.test(recipient);
            case NotificationChannel.PUSH:
                return recipient.length > 0; // Token push
            case NotificationChannel.IN_APP:
                return true; // Siempre disponible para usuarios autenticados
            default:
                return false;
        }
    }
}

export const notificationChannelService = new NotificationChannelService();