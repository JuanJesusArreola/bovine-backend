// services/push.ts
import * as admin from 'firebase-admin';
import logger from '../utils/logger';

// Inicializar Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        // O con archivo:
        // credential: admin.credential.cert(require('path/to/service-account.json'))
    });
}

export interface PushNotification {
    title: string;
    body: string;
    data?: Record<string, string>; // FCM requiere strings
}

export interface PushResult {
    messageId?: string;
    status: 'sent' | 'failed' | 'partial';
    successCount: number;
    failureCount: number;
    failedTokens?: string[];  // ✅ Debe ser string[], no objeto
    error?: string;
}

class PushService {
    private readonly context = 'PushService';

    async sendPushNotification(
        tokens: string[],
        notification: PushNotification
    ): Promise<PushResult> {
        try {
            if (!tokens.length) {
                throw new Error('No hay tokens para enviar');
            }

            logger.info(`Enviando push a ${tokens.length} dispositivos`, this.context);

            const message = {
                notification: {
                    title: notification.title,
                    body: notification.body
                },
                data: notification.data || {},
                tokens: tokens
            };

            // Enviar notificación multicast
            const response = await admin.messaging().sendEachForMulticast(message);

            // Identificar tokens fallidos
            const failedTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                    logger.warn(`Token fallido: ${tokens[idx]}`, this.context, {
                        error: resp.error?.message
                    });
                }
            });

            return {
                messageId: response.responses[0]?.messageId || '',
                status: response.failureCount === 0 ? 'sent' :
                    response.successCount === 0 ? 'failed' : 'partial',
                successCount: response.successCount,
                failureCount: response.failureCount,
                failedTokens: failedTokens.length ? failedTokens : undefined,
            };

        } catch (error) {
            logger.error('Error enviando push notification', this.context, {
                tokenCount: tokens.length
            }, error as Error);

            return {
                messageId: '',
                status: 'failed',
                successCount: 0,
                failureCount: tokens.length,  // todos fallaron
                error: error instanceof Error ? error.message : 'Error desconocido'
            };
        }
    }

    /**
     * Envía a un solo dispositivo
     */
    async sendToDevice(
        token: string,
        notification: PushNotification
    ): Promise<PushResult> {
        return this.sendPushNotification([token], notification);
    }

    /**
     * Envía a un tema (todos los suscritos)
     */
    async sendToTopic(
        topic: string,
        notification: PushNotification
    ): Promise<PushResult> {
        try {
            const message = {
                notification: {
                    title: notification.title,
                    body: notification.body
                },
                data: notification.data,
                topic: topic
            };

            const response = await admin.messaging().send(message);

            return {
                messageId: response,
                status: 'sent',
                successCount: 1,
                failureCount: 0
            };

        } catch (error) {
            return {
                messageId: '',
                status: 'failed',
                successCount: 0,
                failureCount: 1,
                error: error instanceof Error ? error.message : 'Error desconocido'

            };
        }
    }
}

export const pushService = new PushService();
export default pushService;