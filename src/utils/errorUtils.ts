// utils/errorUtils.ts
/**
 * ============================================================================
 * UTILIDADES PARA MANEJO PROFESIONAL DE ERRORES
 * ============================================================================
 * 
 * PROPÓSITO:
 *   TypeScript 4.0+ hace que los errores en catch sean de tipo 'unknown'
 *   por seguridad. Estas funciones convierten 'unknown' a algo utilizable.
 * 
 * PROBLEMA:
 *   try { ... } catch (error) {
 *     error.message // ❌ Error: 'error' is type 'unknown'
 *   }
 * 
 * SOLUCIÓN:
 *   Usar estas funciones para extraer el mensaje de forma segura
 */

/**
 * Extrae un mensaje de error de cualquier tipo de excepción
 * 
 * ¿CÓMO FUNCIONA?
 *   Comprueba el tipo de 'error' paso a paso:
 *   1. Si es instancia de Error → usa error.message
 *   2. Si es string → lo usa directamente
 *   3. Si es objeto con propiedad 'message' → extrae esa propiedad
 *   4. Si es otro tipo → lo convierte a string con JSON.stringify
 *   5. Si todo falla → retorna 'Error desconocido'
 * 
 * @param error - El error capturado (tipo unknown)
 * @returns Mensaje de error como string
 * 
 * @example
 * try {
 *   algo.peligroso();
 * } catch (error) {
 *   const mensaje = getErrorMessage(error);
 *   console.log('Error:', mensaje);
 * }
 */
export function getErrorMessage(error: unknown): string {
  // Caso 1: Es un objeto Error (lo más común)
  if (error instanceof Error) {
    return error.message;
  }
  
  // Caso 2: Es un string (alguien hizo throw 'error')
  if (typeof error === 'string') {
    return error;
  }
  
  // Caso 3: Es un objeto con propiedad message (errores de API, etc.)
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    if (typeof msg === 'string') {
      return msg;
    }
    return String(msg);
  }
  
  // Caso 4: Es un número, boolean, etc.
  if (error !== null && error !== undefined) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  
  // Caso 5: No sabemos qué es
  return 'Error desconocido';
}

/**
 * Convierte cualquier error a una instancia de Error
 * 
 * ¿POR QUÉ ES ÚTIL?
 *   El logger de la aplicación espera recibir un objeto Error
 *   para poder mostrar el stack trace. Esta función asegura
 *   que siempre tengamos un objeto Error.
 * 
 * @param error - El error capturado (unknown)
 * @returns Instancia de Error
 * 
 * @example
 * try {
 *   await operacion();
 * } catch (error) {
 *   const err = ensureError(error);
 *   logger.error('Falló', err); // Ahora tiene stack trace
 * }
 */
export function ensureError(error: unknown): Error {
  // Si ya es Error, lo retornamos directamente
  if (error instanceof Error) {
    return error;
  }
  
  // Si es string, creamos un nuevo Error
  if (typeof error === 'string') {
    return new Error(error);
  }
  
  // Si es objeto, intentamos convertirlo
  if (error && typeof error === 'object') {
    try {
      return new Error(JSON.stringify(error));
    } catch {
      return new Error(String(error));
    }
  }
  
  // Si es primitivo, lo convertimos
  if (error !== null && error !== undefined) {
    return new Error(String(error));
  }
  
  // Caso por defecto
  return new Error('Error desconocido');
}

/**
 * Ejecuta una función y captura cualquier error convirtiéndolo
 * a un tipo específico de error
 * 
 * @param fn - Función a ejecutar
 * @param errorFactory - Función que crea el error personalizado
 * @returns Resultado de la función
 * 
 * @example
 * const resultado = tryOrThrow(
 *   () => JSON.parse(data),
 *   (msg) => new ValidationError('JSON inválido: ' + msg)
 * );
 */
export function tryOrThrow<T, E extends Error>(
  fn: () => T,
  errorFactory: (message: string) => E
): T {
  try {
    return fn();
  } catch (error) {
    throw errorFactory(getErrorMessage(error));
  }
}

/**
 * Versión asíncrona de tryOrThrow
 */
export async function tryOrThrowAsync<T, E extends Error>(
  fn: () => Promise<T>,
  errorFactory: (message: string) => E
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw errorFactory(getErrorMessage(error));
  }
}

/**
 * Crea un decorador de métodos que automáticamente envuelve
 * el método en try/catch con logging
 * 
 * @param contextName - Nombre del contexto para logging
 * @returns Decorador
 * 
 * @example
 * class MiClase {
 *   @withErrorHandling('MiClase')
 *   async metodoPeligroso() {
 *     // código que puede fallar
 *   }
 * }
 */
export function withErrorHandling(contextName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const err = ensureError(error);
        logger?.error?.(
          `Error en ${propertyKey}`,
          contextName,
          { args: args.slice(0, 2) }, // Solo primeros args para no exponer datos sensibles
          err
        );
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Error de validación simple (solución rápida)
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Nota: logger se importa dinámicamente para evitar dependencias circulares
let logger: any;
try {
  logger = require('./logger').default;
} catch {
  // Si no hay logger, usamos console
  logger = {
    error: (msg: string, ctx?: string, meta?: any, err?: Error) => 
      console.error(`[${ctx}] ${msg}`, meta, err)
  };
}