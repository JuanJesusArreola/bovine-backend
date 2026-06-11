// utils/HealthErrors.ts

export class HealthError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly cause?: Error;

    constructor(message: string, code: string = 'HEALTH_ERROR', statusCode: number = 500, cause?: Error) {
        super(message);
        this.name = 'HealthError';
        this.code = code;
        this.statusCode = statusCode;
        this.cause = cause;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, HealthError);
        }
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            stack: this.stack,
            cause: this.cause?.message,
        };
    }
}

export class HealthNotFoundError extends HealthError {
    constructor(message: string = 'Registro de salud no encontrado') {
        super(message, 'HEALTH_NOT_FOUND', 404);
        this.name = 'HealthNotFoundError';
    }
}

export class HealthValidationError extends HealthError {
    constructor(message: string) {
        super(message, 'HEALTH_VALIDATION_ERROR', 400);
        this.name = 'HealthValidationError';
    }
}

export class HealthCreationError extends HealthError {
    constructor(message: string, cause?: Error) {
        super(message, 'HEALTH_CREATION_ERROR', 500, cause);
        this.name = 'HealthCreationError';
    }
}

export class BovineNotFoundError extends HealthError {
    constructor(bovineId: string) {
        super(`Bovino con ID ${bovineId} no encontrado`, 'BOVINE_NOT_FOUND', 404);
        this.name = 'BovineNotFoundError';
    }
}

export class EventNotFoundError extends HealthError {
    constructor(eventId: string) {
        super(`Evento con ID ${eventId} no encontrado`, 'EVENT_NOT_FOUND', 404);
        this.name = 'EventNotFoundError';
    }
}