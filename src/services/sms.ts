// services/sms.ts
import logger from '../utils/logger';

export interface SMSOptions {
    to: string;
    message: string;
    from?: string;
}

export interface SMSResult {
    messageId: string;
    status: 'sent' | 'delivered' | 'failed';
    error?: string;
}

class SMSService {
    private readonly context = 'SMSService';

    /**
     * Envía un SMS
     */
    async sendSMS(to: string, message: string): Promise<SMSResult> {
        try {
            logger.info(`Enviando SMS a ${to}`, this.context, {
                to,
                messageLength: message.length
            });

            // TODO: Implementar con proveedor real (Twilio, etc.)
            // Ejemplo con Twilio:
            // const client = require('twilio')(accountSid, authToken);
            // const result = await client.messages.create({
            //     body: message,
            //     from: process.env.SMS_FROM,
            //     to
            // });

            // Simulación de envío exitoso
            return {
                messageId: `sms_${Date.now()}`,
                status: 'sent'
            };

        } catch (error) {
            logger.error('Error enviando SMS', this.context, {
                to
            }, error as Error);

            return {
                messageId: '',
                status: 'failed',
                error: error instanceof Error ? error.message : 'Error desconocido'
            };
        }
    }
}

export const smsService = new SMSService();
export default smsService;