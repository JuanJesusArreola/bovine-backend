// modules/bovine/errors/BovineErrors.ts
/**
 * ============================================================================
 * ERRORES PERSONALIZADOS DEL DOMINIO BOVINO
 * ============================================================================
 * 
 * Jerarquía de errores:
 * - BovineError (base)
 *   ├─ BovineNotFoundError (404)
 *   ├─ BovineValidationError (400)
 *   └─ BovineStatisticsError (500)
 */

/**
 * Error base del dominio bovino
 * Todos los errores específicos extienden de esta clase
 */
export class BovineError extends Error {
  constructor(
    message: string,
    public readonly code: string,           // Código único del error (ej: 'BOVINE_NOT_FOUND')
    public readonly statusCode: number = 500, // HTTP status code
    public readonly cause?: Error            // Error original (para debugging)
  ) {
    super(message);
    this.name = 'BovineError';
    
    // 👇 Esto mantiene el stack trace correcto en V8 (Node.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BovineError);
    }
  }

  /**
   * Método utilitario para logging
   */
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
 * Error cuando no se encuentra un bovino
 * HTTP Status: 404 Not Found
 */
export class BovineNotFoundError extends BovineError {
  constructor(bovineId: string) {
    super(
      `Bovino con ID ${bovineId} no encontrado`,
      'BOVINE_NOT_FOUND',
      404
    );
    this.name = 'BovineNotFoundError';
  }
}

/**
 * Error cuando se buscan estadísticas
 * HTTP Status: 500 Internal Server Error
 */
export class BovineStatisticsError extends BovineError {
  constructor(ranchId?: string, cause?: Error) {
    super(
      `Error calculando estadísticas${ranchId ? ` para rancho ${ranchId}` : ''}`,
      'STATISTICS_ERROR',
      500,
      cause
    );
    this.name = 'BovineStatisticsError';
  }
}

/**
 * Error de validación de datos
 * HTTP Status: 400 Bad Request
 */
export class BovineValidationError extends BovineError {
  constructor(message: string) {
    super(
      message,
      'BOVINE_VALIDATION_ERROR',
      400
    );
    this.name = 'BovineValidationError';
  }
}