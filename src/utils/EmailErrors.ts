// utils/EmailErrors.ts
export class EmailError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly statusCode: number = 500,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'EmailError';
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, EmailError);
        }
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            statusCode: this.statusCode,
            cause: this.cause?.message
        };
    }
}

export class EmailTemplateNotFoundError extends EmailError {
    constructor(templateName: string) {
        super(
            'TEMPLATE_NOT_FOUND',
            `Plantilla de email no encontrada: ${templateName}`,
            404
        );
        this.name = 'EmailTemplateNotFoundError';
    }
}

export class EmailSendError extends EmailError {
    constructor(recipient: string, cause?: Error) {
        super(
            'SEND_ERROR',
            `Error enviando email a ${recipient}`,
            500,
            cause
        );
        this.name = 'EmailSendError';
    }
}

export class EmailValidationError extends EmailError {
    constructor(message: string) {
        super('VALIDATION_ERROR', message, 400);
        this.name = 'EmailValidationError';
    }
}

export class EmailQueueError extends EmailError {
    constructor(operation: string, cause?: Error) {
        super(
            'QUEUE_ERROR',
            `Error en operación de cola: ${operation}`,
            500,
            cause
        );
        this.name = 'EmailQueueError';
    }
}

export class EmailQuotaExceededError extends EmailError {
    constructor(limit: number, period: string) {
        super(
            'QUOTA_EXCEEDED',
            `Límite de ${limit} emails por ${period} excedido`,
            429
        );
        this.name = 'EmailQuotaExceededError';
    }
}