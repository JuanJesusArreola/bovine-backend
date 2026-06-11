// utils/NotificationErrors.ts}
import { NotificationChannel, NotificationType } from '../models/Notification'

export class NotificationError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly statusCode: number = 500,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'NotificationError';
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, NotificationError);
        }
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            stack: this.stack,
            cause: this.cause?.message
        };
    }
}

export class NotificationNotFoundError extends NotificationError {
    constructor(notificationId: string) {
        super(
            `Notificación con ID ${notificationId} no encontrada`,
            'NOTIFICATION_NOT_FOUND',
            404
        );
        this.name = 'NotificationNotFoundError';
    }
}

export class NotificationValidationError extends NotificationError {
    constructor(message: string) {
        super(message, 'NOTIFICATION_VALIDATION_ERROR', 400);
        this.name = 'NotificationValidationError';
    }
}

export class ChannelNotAvailableError2 extends NotificationError {
    constructor(channel: NotificationChannel, notificationType: NotificationType) {
        super(
            `El canal ${channel} no está disponible para notificaciones de tipo ${notificationType}`,
            'CHANNEL_NOT_AVAILABLE',
            400
        );
        this.name = 'ChannelNotAvailableError';
    }
}

export class NotificationSendError extends NotificationError {
    constructor(
        channel: string,
        recipient: string,
        cause?: Error
    ) {
        super(
            `Error enviando notificación por ${channel} a ${recipient}`,
            'NOTIFICATION_SEND_ERROR',
            500,
            cause
        );
        this.name = 'NotificationSendError';
    }
}

export class NotificationQuotaError extends NotificationError {
    constructor(userId: string, limit: number, period: string) {
        super(
            `Usuario ${userId} ha excedido el límite de ${limit} notificaciones por ${period}`,
            'NOTIFICATION_QUOTA_ERROR',
            429
        );
        this.name = 'NotificationQuotaError';
    }
}