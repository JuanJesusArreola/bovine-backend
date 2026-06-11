// utils/EventErrors.ts
/**
 * ============================================================================
 * ERRORES PERSONALIZADOS DEL DOMINIO DE EVENTOS
 * ============================================================================
 * 
 * Jerarquía de errores:
 * - EventError (base)
 *   ├─ EventNotFoundError (404)
 *   ├─ EventValidationError (400)
 *   ├─ EventSchedulingError (400)
 *   ├─ EventCompletionError (400)
 *   └─ EventRecurrenceError (400)
 */

/**
 * Error base del dominio de eventos
 */
export class EventError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly statusCode: number = 500,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'EventError';
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, EventError);
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

/**
 * Error cuando no se encuentra un evento
 * HTTP Status: 404 Not Found
 */
export class EventNotFoundError extends EventError {
    constructor(eventId: string) {
        super(
            `Evento con ID ${eventId} no encontrado`,
            'EVENT_NOT_FOUND',
            404
        );
        this.name = 'EventNotFoundError';
    }
}

/**
 * Error de validación de datos de evento
 * HTTP Status: 400 Bad Request
 */
export class EventValidationError extends EventError {
    constructor(message: string) {
        super(
            message,
            'EVENT_VALIDATION_ERROR',
            400
        );
        this.name = 'EventValidationError';
    }
}

/**
 * Error en la programación de eventos
 * HTTP Status: 400 Bad Request
 */
export class EventSchedulingError extends EventError {
    constructor(message: string) {
        super(
            message,
            'EVENT_SCHEDULING_ERROR',
            400
        );
        this.name = 'EventSchedulingError';
    }
}

/**
 * Error al completar un evento
 * HTTP Status: 400 Bad Request
 */
export class EventCompletionError extends EventError {
    constructor(message: string, cause?: Error) {
        super(
            message,
            'EVENT_COMPLETION_ERROR',
            400,
            cause
        );
        this.name = 'EventCompletionError';
    }
}

/**
 * Error en eventos recurrentes
 * HTTP Status: 400 Bad Request
 */
export class EventRecurrenceError extends EventError {
    constructor(message: string) {
        super(
            message,
            'EVENT_RECURRENCE_ERROR',
            400
        );
        this.name = 'EventRecurrenceError';
    }
}

/**
 * Error de conflicto de horarios
 * HTTP Status: 409 Conflict
 */
export class EventConflictError extends EventError {
    constructor(message: string) {
        super(
            message,
            'EVENT_CONFLICT_ERROR',
            409
        );
        this.name = 'EventConflictError';
    }
}

/**
 * Error de permisos para eventos
 * HTTP Status: 403 Forbidden
 */
export class EventPermissionError extends EventError {
    constructor(message: string = 'No tiene permisos para realizar esta acción sobre el evento') {
        super(
            message,
            'EVENT_PERMISSION_ERROR',
            403
        );
        this.name = 'EventPermissionError';
    }
}

/**
 * Error de dependencia (ej: falta registro de salud asociado)
 * HTTP Status: 409 Conflict
 */
export class EventDependencyError extends EventError {
    constructor(message: string) {
        super(
            message,
            'EVENT_DEPENDENCY_ERROR',
            409
        );
        this.name = 'EventDependencyError';
    }
}