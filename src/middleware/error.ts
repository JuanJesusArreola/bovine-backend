import { Request, Response, NextFunction } from 'express';
import { ApiError } from './auth';
import { randomUUID } from 'crypto';

// Interface para respuesta de error estandarizada
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
    method: string;
  };
  requestId?: string;
}

// Interface para logging de errores
interface ErrorLog {
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  userId?: string;
  userEmail?: string;
  path: string;
  method: string;
  ip: string;
  userAgent?: string;
  body?: any;
  params?: any;
  query?: any;
}

// Tipos de errores específicos del sistema ganadero
export enum CattleErrorCodes {
  // Errores de ganado
  CATTLE_NOT_FOUND = 'CATTLE_NOT_FOUND',
  INVALID_EAR_TAG = 'INVALID_EAR_TAG',
  DUPLICATE_EAR_TAG = 'DUPLICATE_EAR_TAG',
  CATTLE_ALREADY_DECEASED = 'CATTLE_ALREADY_DECEASED',

  // Errores de vacunación
  VACCINATION_NOT_FOUND = 'VACCINATION_NOT_FOUND',
  VACCINE_EXPIRED = 'VACCINE_EXPIRED',
  VACCINATION_TOO_RECENT = 'VACCINATION_TOO_RECENT',
  INVALID_VACCINE_DOSE = 'INVALID_VACCINE_DOSE',

  // Errores de salud
  HEALTH_RECORD_NOT_FOUND = 'HEALTH_RECORD_NOT_FOUND',
  INVALID_DIAGNOSIS = 'INVALID_DIAGNOSIS',
  TREATMENT_CONFLICT = 'TREATMENT_CONFLICT',

  // Errores de geolocalización
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  LOCATION_OUT_OF_BOUNDS = 'LOCATION_OUT_OF_BOUNDS',
  GPS_UNAVAILABLE = 'GPS_UNAVAILABLE',

  // Errores de archivos
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_CORRUPTED = 'FILE_CORRUPTED',

  // Errores de base de datos
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  QUERY_TIMEOUT = 'QUERY_TIMEOUT',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',

  // Errores de validación específicos
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  INVALID_WEIGHT_VALUE = 'INVALID_WEIGHT_VALUE',
  INVALID_AGE_VALUE = 'INVALID_AGE_VALUE',
  INVALID_BREED = 'INVALID_BREED',
  INVALID_GENDER = 'INVALID_GENDER'
}

/**
 * Función para obtener IP del cliente de forma segura
 */
const getClientIP = (req: Request): string => {
  return req.ip ||
    req.socket?.remoteAddress ||
    (req.connection as any)?.remoteAddress ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    'unknown';
};

/**
 * Función para crear logs estructurados de errores
 */
const createErrorLog = (error: Error, req: Request): ErrorLog => {
  return {
    timestamp: new Date().toISOString(),
    level: error instanceof ApiError && error.statusCode < 500 ? 'warn' : 'error',
    message: error.message,
    stack: error.stack,
    userId: req.userId,
    userEmail: req.user?.email,
    path: req.originalUrl || req.url,
    method: req.method,
    ip: getClientIP(req),
    userAgent: req.get('User-Agent'),
    body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
    params: Object.keys(req.params || {}).length > 0 ? req.params : undefined,
    query: Object.keys(req.query || {}).length > 0 ? req.query : undefined
  };
};

// ✅ Sanitizar campos sensibles antes de loguear
const SENSITIVE_FIELDS = ['password', 'confirmPassword', 'currentPassword', 'newPassword', 'token'];
const sanitizeBody = (body: any) => {
  if (!body || typeof body !== 'object') return body;
  return Object.fromEntries(
    Object.entries(body).map(([k, v]) =>
      [k, SENSITIVE_FIELDS.includes(k) ? '[REDACTED]' : v]
    )
  );
};

/**
 * Función para enviar notificaciones de errores críticos
 * En producción, esto enviaría emails, webhooks, etc.
 */
const notifyCriticalError = async (errorLog: ErrorLog): Promise<void> => {
  try {
    // TODO: Implementar notificaciones reales
    // - Envío de emails a administradores
    // - Webhooks a Slack/Discord
    // - Integración con servicios de monitoreo (Sentry, etc.)

    if (errorLog.level === 'error') {
      console.error('🚨 ERROR CRÍTICO EN SISTEMA GANADERO:', {
        message: errorLog.message,
        path: errorLog.path,
        user: errorLog.userEmail,
        timestamp: errorLog.timestamp
      });
    }
  } catch (notificationError) {
    console.error('Error al enviar notificación de error crítico:', notificationError);
  }
};

/**
 * Middleware principal de manejo de errores
 * Captura todos los errores y los formatea de manera consistente
 */
export const errorHandler = async (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Crear log del error
    const errorLog = createErrorLog(error, req);

    // Log del error en consola (en producción sería un logger profesional)
    if (errorLog.level === 'error') {
      console.error('❌ Error del sistema:', errorLog);
    } else {
      console.warn('⚠️ Advertencia del sistema:', errorLog);
    }

    // Notificar errores críticos
    if (errorLog.level === 'error') {
      await notifyCriticalError(errorLog);
    }

    // Determinar el código de estado y mensaje
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'Error interno del servidor';
    let details: any = undefined;

    if (error instanceof ApiError) {
      statusCode = error.statusCode;
      errorCode = error.code;
      message = error.message;
    } else if (error.name === 'ValidationError') {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
      message = 'Error de validación de datos';
      details = error.message;
    } else if (error.name === 'CastError') {
      statusCode = 400;
      errorCode = 'INVALID_ID_FORMAT';
      message = 'Formato de ID inválido';
    } else if (error.name === 'MongoError' || error.name === 'SequelizeError') {
      statusCode = 500;
      errorCode = 'DATABASE_ERROR';
      message = 'Error de base de datos';

      // En desarrollo, mostrar detalles del error de BD
      if (process.env.NODE_ENV === 'development') {
        details = error.message;
      }
    } else if (error.name === 'MulterError') {
      statusCode = 400;
      errorCode = 'FILE_UPLOAD_ERROR';
      message = 'Error en la carga de archivo';
      details = error.message;
    } else if (error.message.includes('ECONNREFUSED')) {
      statusCode = 503;
      errorCode = 'SERVICE_UNAVAILABLE';
      message = 'Servicio temporalmente no disponible';
    } else if (error.name === 'JsonWebTokenError') {
      statusCode = 401;
      errorCode = 'INVALID_TOKEN';
      message = 'Token de autenticación inválido';
    } else if (error.name === 'TokenExpiredError') {
      statusCode = 401;
      errorCode = 'EXPIRED_TOKEN';
      message = 'Token de autenticación expirado';
    }

    // Generar ID único para el request (para tracking)
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();

    // Crear respuesta de error estandarizada
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message: message,
        details: details,
        timestamp: new Date().toISOString(),
        path: req.originalUrl || req.url,
        method: req.method
      },
      requestId: requestId
    };

    // En desarrollo, incluir stack trace
    if (process.env.NODE_ENV === 'development') {
      (errorResponse.error as any).stack = error.stack;
    }

    // Enviar respuesta de error
    res.status(statusCode).json(errorResponse);

  } catch (handlerError) {
    // Si hay error en el manejo de errores, enviar respuesta mínima
    console.error('Error crítico en el manejador de errores:', handlerError);

    res.status(500).json({
      success: false,
      error: {
        code: 'CRITICAL_ERROR_HANDLER_FAILURE',
        message: 'Error crítico en el sistema',
        timestamp: new Date().toISOString(),
        path: req.originalUrl || req.url,
        method: req.method
      }
    });
  }
};

/**
 * Middleware para capturar errores de rutas no encontradas (404)
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new ApiError(
    404,
    `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    'ROUTE_NOT_FOUND'
  );

  next(error);
};

/**
 * Middleware para validar que las respuestas sean exitosas
 */
export const validateResponse = (req: Request, res: Response, next: NextFunction): void => {
  const originalSend = res.send;

  res.send = function (data: any) {
    try {
      // Validar que las respuestas exitosas tengan el formato correcto
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            if (!parsed.hasOwnProperty('success')) {
              console.warn(`⚠️ Respuesta sin campo 'success' en ${req.originalUrl}`);
            }
          } catch (e) {
            // No es JSON, continuar normalmente
          }
        }
      }
    } catch (validationError) {
      console.error('Error validando respuesta:', validationError);
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Función helper para crear errores específicos del sistema ganadero
 */
export const createCattleError = (
  code: CattleErrorCodes,
  customMessage?: string,
  details?: any
): ApiError => {
  const errorMessages: Record<CattleErrorCodes, string> = {
    // Errores de ganado
    [CattleErrorCodes.CATTLE_NOT_FOUND]: 'Animal no encontrado',
    [CattleErrorCodes.INVALID_EAR_TAG]: 'Número de arete inválido',
    [CattleErrorCodes.DUPLICATE_EAR_TAG]: 'El número de arete ya existe',
    [CattleErrorCodes.CATTLE_ALREADY_DECEASED]: 'El animal ya está marcado como fallecido',

    // Errores de vacunación
    [CattleErrorCodes.VACCINATION_NOT_FOUND]: 'Registro de vacunación no encontrado',
    [CattleErrorCodes.VACCINE_EXPIRED]: 'La vacuna está vencida',
    [CattleErrorCodes.VACCINATION_TOO_RECENT]: 'Vacunación muy reciente, debe esperar',
    [CattleErrorCodes.INVALID_VACCINE_DOSE]: 'Dosis de vacuna inválida',

    // Errores de salud
    [CattleErrorCodes.HEALTH_RECORD_NOT_FOUND]: 'Registro de salud no encontrado',
    [CattleErrorCodes.INVALID_DIAGNOSIS]: 'Diagnóstico inválido',
    [CattleErrorCodes.TREATMENT_CONFLICT]: 'Conflicto con tratamiento actual',

    // Errores de geolocalización
    [CattleErrorCodes.INVALID_COORDINATES]: 'Coordenadas GPS inválidas',
    [CattleErrorCodes.LOCATION_OUT_OF_BOUNDS]: 'Ubicación fuera de los límites del rancho',
    [CattleErrorCodes.GPS_UNAVAILABLE]: 'GPS no disponible',

    // Errores de archivos
    [CattleErrorCodes.INVALID_FILE_TYPE]: 'Tipo de archivo no permitido',
    [CattleErrorCodes.FILE_TOO_LARGE]: 'Archivo demasiado grande',
    [CattleErrorCodes.FILE_CORRUPTED]: 'Archivo corrupto o dañado',

    // Errores de base de datos
    [CattleErrorCodes.DATABASE_CONNECTION_ERROR]: 'Error de conexión a la base de datos',
    [CattleErrorCodes.QUERY_TIMEOUT]: 'Tiempo de espera agotado en la consulta',
    [CattleErrorCodes.CONSTRAINT_VIOLATION]: 'Violación de restricción de base de datos',

    // Errores de validación específicos
    [CattleErrorCodes.INVALID_DATE_RANGE]: 'Rango de fechas inválido',
    [CattleErrorCodes.INVALID_WEIGHT_VALUE]: 'Valor de peso inválido',
    [CattleErrorCodes.INVALID_AGE_VALUE]: 'Valor de edad inválido',
    [CattleErrorCodes.INVALID_BREED]: 'Raza no válida',
    [CattleErrorCodes.INVALID_GENDER]: 'Género no válido'
  };

  const message = customMessage || errorMessages[code];
  const statusCode = code.includes('NOT_FOUND') ? 404 :
    code.includes('DUPLICATE') || code.includes('INVALID') ? 400 : 500;

  const error = new ApiError(statusCode, message, code);

  if (details) {
    (error as any).details = details;
  }

  return error;
};

/**
 * Wrapper para funciones async que automáticamente captura errores
 */
export const asyncErrorHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Exportaciones adicionales para compatibilidad
export default errorHandler;
export { ApiError } from './auth';