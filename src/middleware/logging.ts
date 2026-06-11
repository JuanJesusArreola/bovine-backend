import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';

// Niveles de logging
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

// Tipos de eventos específicos del sistema ganadero
export enum CattleEventType {
  // Eventos de ganado
  CATTLE_CREATED = 'cattle_created',
  CATTLE_UPDATED = 'cattle_updated',
  CATTLE_DELETED = 'cattle_deleted',
  CATTLE_MOVED = 'cattle_moved',
  CATTLE_DECEASED = 'cattle_deceased',

  // Eventos de salud
  HEALTH_CHECKUP = 'health_checkup',
  ILLNESS_DIAGNOSED = 'illness_diagnosed',
  TREATMENT_STARTED = 'treatment_started',
  TREATMENT_COMPLETED = 'treatment_completed',
  RECOVERY_RECORDED = 'recovery_recorded',

  // Eventos de vacunación
  VACCINATION_SCHEDULED = 'vaccination_scheduled',
  VACCINATION_ADMINISTERED = 'vaccination_administered',
  VACCINATION_MISSED = 'vaccination_missed',
  VACCINE_REACTION = 'vaccine_reaction',

  // Eventos de reproducción
  BREEDING_PLANNED = 'breeding_planned',
  MATING_RECORDED = 'mating_recorded',
  PREGNANCY_DETECTED = 'pregnancy_detected',
  BIRTH_RECORDED = 'birth_recorded',
  WEANING_RECORDED = 'weaning_recorded',

  // Eventos de producción
  MILK_PRODUCTION_RECORDED = 'milk_production_recorded',
  WEIGHT_RECORDED = 'weight_recorded',
  FEED_CONSUMPTION_RECORDED = 'feed_consumption_recorded',

  // Eventos de inventario
  MEDICATION_USED = 'medication_used',
  MEDICATION_EXPIRED = 'medication_expired',
  INVENTORY_UPDATED = 'inventory_updated',
  SUPPLY_ORDERED = 'supply_ordered',

  // Eventos de seguridad
  LOGIN_ATTEMPT = 'login_attempt',
  LOGOUT = 'logout',
  PASSWORD_CHANGED = 'password_changed',
  PERMISSION_CHANGED = 'permission_changed',

  // Eventos del sistema
  BACKUP_CREATED = 'backup_created',
  DATA_EXPORTED = 'data_exported',
  DATA_IMPORTED = 'data_imported',
  SYSTEM_ERROR = 'system_error'
}

// Interface para logs estructurados
interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  eventType: CattleEventType | string;
  message: string;
  userId?: string;
  userEmail?: string;
  userRole?: UserRole;
  requestId?: string;

  // Datos específicos del evento
  cattleId?: string;
  cattleEarTag?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };

  // Datos de contexto HTTP
  method?: string;
  path?: string;
  statusCode?: number;
  responseTime?: number;
  ip?: string;
  userAgent?: string;

  // Datos adicionales del evento
  metadata?: {
    [key: string]: any;
  };

  // Stack trace para errores
  stack?: string;
  error?: {
    name: string;
    message: string;
    code?: string;
  };
}

// Interface para métricas de rendimiento
interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorCount: number;
  activeUsers: Set<string>;
  popularEndpoints: Map<string, number>;
  slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: string;
  }>;
}

// Configuración del logger
class CattleLogger {
  private static instance: CattleLogger;
  private performanceMetrics: PerformanceMetrics;

  private constructor() {
    this.performanceMetrics = {
      requestCount: 0,
      averageResponseTime: 0,
      errorCount: 0,
      activeUsers: new Set<string>(),
      popularEndpoints: new Map<string, number>(),
      slowQueries: []
    };
  }

  public static getInstance(): CattleLogger {
    if (!CattleLogger.instance) {
      CattleLogger.instance = new CattleLogger();
    }
    return CattleLogger.instance;
  }

  /**
   * Método principal para escribir logs
   */
  public log(logData: StructuredLog): void {
    // En producción, esto se enviaría a un servicio de logging como ELK, Splunk, etc.
    const logString = this.formatLog(logData);

    switch (logData.level) {
      case LogLevel.ERROR:
        console.error(logString);
        break;
      case LogLevel.WARN:
        console.warn(logString);
        break;
      case LogLevel.INFO:
        console.info(logString);
        break;
      case LogLevel.DEBUG:
        if (process.env.NODE_ENV === 'development') {
          console.debug(logString);
        }
        break;
      case LogLevel.TRACE:
        if (process.env.LOG_LEVEL === 'trace') {
          console.trace(logString);
        }
        break;
    }

    // Almacenar métricas
    this.updateMetrics(logData);

    // Enviar logs críticos a sistemas de monitoreo
    if (logData.level === LogLevel.ERROR) {
      this.sendCriticalAlert(logData);
    }
  }

  /**
   * Formatear logs para mejor legibilidad
   */
  private formatLog(logData: StructuredLog): string {
    const emoji = this.getLogEmoji(logData.level, logData.eventType);

    if (process.env.NODE_ENV === 'development') {
      // Formato legible para desarrollo
      return `${emoji} [${logData.level.toUpperCase()}] ${logData.timestamp} - ${logData.message}
      Event: ${logData.eventType}
      User: ${logData.userEmail || 'Sistema'} (${logData.userRole || 'N/A'})
      ${logData.cattleEarTag ? `Ganado: ${logData.cattleEarTag}` : ''}
      ${logData.path ? `Endpoint: ${logData.method} ${logData.path}` : ''}
      ${logData.responseTime ? `Tiempo: ${logData.responseTime}ms` : ''}
      ${logData.metadata ? `Datos: ${JSON.stringify(logData.metadata, null, 2)}` : ''}`;
    } else {
      // Formato JSON para producción
      return JSON.stringify(logData);
    }
  }

  /**
   * Obtener emoji apropiado para el log
   */
  private getLogEmoji(level: LogLevel, eventType: string): string {
    if (level === LogLevel.ERROR) return '🚨';
    if (level === LogLevel.WARN) return '⚠️';

    // Emojis específicos por tipo de evento ganadero
    const eventEmojis: { [key: string]: string } = {
      [CattleEventType.CATTLE_CREATED]: '🐄',
      [CattleEventType.VACCINATION_ADMINISTERED]: '💉',
      [CattleEventType.ILLNESS_DIAGNOSED]: '🩺',
      [CattleEventType.BIRTH_RECORDED]: '🍼',
      [CattleEventType.CATTLE_MOVED]: '📍',
      [CattleEventType.MILK_PRODUCTION_RECORDED]: '🥛',
      [CattleEventType.LOGIN_ATTEMPT]: '🔐',
      [CattleEventType.DATA_EXPORTED]: '📊',
      [CattleEventType.BACKUP_CREATED]: '💾'
    };

    return eventEmojis[eventType] || '📝';
  }

  /**
   * Actualizar métricas de rendimiento
   */
  private updateMetrics(logData: StructuredLog): void {
    this.performanceMetrics.requestCount++;

    if (logData.userId) {
      this.performanceMetrics.activeUsers.add(logData.userId);
    }

    if (logData.level === LogLevel.ERROR) {
      this.performanceMetrics.errorCount++;
    }

    if (logData.path) {
      const current = this.performanceMetrics.popularEndpoints.get(logData.path) || 0;
      this.performanceMetrics.popularEndpoints.set(logData.path, current + 1);
    }

    if (logData.responseTime) {
      // Calcular promedio de tiempo de respuesta
      const currentAvg = this.performanceMetrics.averageResponseTime;
      const count = this.performanceMetrics.requestCount;
      this.performanceMetrics.averageResponseTime =
        (currentAvg * (count - 1) + logData.responseTime) / count;

      // Registrar consultas lentas
      if (logData.responseTime > 1000) {
        this.performanceMetrics.slowQueries.push({
          query: `${logData.method} ${logData.path}`,
          duration: logData.responseTime,
          timestamp: logData.timestamp
        });

        // Mantener solo las últimas 100 consultas lentas
        if (this.performanceMetrics.slowQueries.length > 100) {
          this.performanceMetrics.slowQueries.shift();
        }
      }
    }
  }

  /**
   * Enviar alertas críticas
   */
  private sendCriticalAlert(logData: StructuredLog): void {
    // TODO: Implementar notificaciones reales
    // - Webhook a Slack/Discord
    // - Email a administradores
    // - Push notifications
    // - Integración con PagerDuty, etc.

    console.error('🚨 ALERTA CRÍTICA DEL SISTEMA GANADERO 🚨', {
      message: logData.message,
      event: logData.eventType,
      user: logData.userEmail,
      cattle: logData.cattleEarTag,
      timestamp: logData.timestamp
    });
  }

  /**
   * Obtener métricas actuales
   */
  public getMetrics(): PerformanceMetrics {
    return {
      ...this.performanceMetrics,
      activeUsers: new Set(this.performanceMetrics.activeUsers), // Copia
      popularEndpoints: new Map(this.performanceMetrics.popularEndpoints), // Copia
      slowQueries: [...this.performanceMetrics.slowQueries] // Copia
    };
  }

  /**
   * Resetear métricas
   */
  public resetMetrics(): void {
    this.performanceMetrics = {
      requestCount: 0,
      averageResponseTime: 0,
      errorCount: 0,
      activeUsers: new Set<string>(),
      popularEndpoints: new Map<string, number>(),
      slowQueries: []
    };
  }
}

// Instancia singleton del logger
const logger = CattleLogger.getInstance();

/**
 * Middleware principal de logging para requests HTTP
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string ||
    `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Agregar requestId al request para uso posterior
  (req as any).requestId = requestId;

  // Log del request entrante
  logger.log({
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    eventType: 'http_request',
    message: `Request entrante: ${req.method} ${req.originalUrl}`,
    userId: req.userId,
    userEmail: req.user?.email,
    userRole: req.userRole,
    requestId: requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent'),
    metadata: {
      query: req.query,
      params: req.params,
      bodySize: req.get('content-length') || 0
    }
  });

  // Interceptar la respuesta para logear cuando termine
  const originalSend = res.send;
  res.send = function (data: any) {
    const responseTime = Date.now() - startTime;

    logger.log({
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO,
      eventType: 'http_response',
      message: `Response: ${req.method} ${req.originalUrl} - ${res.statusCode}`,
      userId: req.userId,
      userEmail: req.user?.email,
      userRole: req.userRole,
      requestId: requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: responseTime,
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      metadata: {
        responseSize: data ? JSON.stringify(data).length : 0
      }
    });

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Logger específico para eventos de ganado
 */
export const logCattleEvent = (
  eventType: CattleEventType,
  message: string,
  req: Request,
  metadata?: {
    cattleId?: string;
    cattleEarTag?: string;
    location?: { latitude: number; longitude: number; address?: string };
    [key: string]: any;
  }
): void => {
  logger.log({
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    eventType: eventType,
    message: message,
    userId: req.userId,
    userEmail: req.user?.email,
    userRole: req.userRole,
    requestId: (req as any).requestId,
    cattleId: metadata?.cattleId,
    cattleEarTag: metadata?.cattleEarTag,
    location: metadata?.location,
    metadata: metadata
  });
};

/**
 * Logger para errores específicos del sistema ganadero
 */
export const logCattleError = (
  error: Error,
  req: Request,
  context?: {
    cattleId?: string;
    cattleEarTag?: string;
    operation?: string;
    [key: string]: any;
  }
): void => {
  logger.log({
    timestamp: new Date().toISOString(),
    level: LogLevel.ERROR,
    eventType: CattleEventType.SYSTEM_ERROR,
    message: error.message,
    userId: req.userId,
    userEmail: req.user?.email,
    userRole: req.userRole,
    requestId: (req as any).requestId,
    cattleId: context?.cattleId,
    cattleEarTag: context?.cattleEarTag,
    method: req.method,
    path: req.originalUrl,
    stack: error.stack,
    error: {
      name: error.name,
      message: error.message,
      code: (error as any).code
    },
    metadata: context
  });
};

/**
 * Logger para actividades veterinarias
 */
export const logVeterinaryActivity = (
  activity: 'diagnosis' | 'treatment' | 'vaccination' | 'checkup',
  cattleEarTag: string,
  details: string,
  req: Request,
  location?: { latitude: number; longitude: number; address?: string }
): void => {
  const eventTypes = {
    diagnosis: CattleEventType.ILLNESS_DIAGNOSED,
    treatment: CattleEventType.TREATMENT_STARTED,
    vaccination: CattleEventType.VACCINATION_ADMINISTERED,
    checkup: CattleEventType.HEALTH_CHECKUP
  };

  logger.log({
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    eventType: eventTypes[activity],
    message: `Actividad veterinaria: ${activity} en ganado ${cattleEarTag}`,
    userId: req.userId,
    userEmail: req.user?.email,
    userRole: req.userRole,
    requestId: (req as any).requestId,
    cattleEarTag: cattleEarTag,
    location: location,
    metadata: {
      activity: activity,
      details: details,
      veterinarian: req.user?.email
    }
  });
};

/**
 * Logger para cambios de ubicación del ganado
 */
export const logLocationChange = (
  cattleEarTag: string,
  fromLocation: { latitude: number; longitude: number; address?: string },
  toLocation: { latitude: number; longitude: number; address?: string },
  req: Request,
  reason?: string
): void => {
  logger.log({
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    eventType: CattleEventType.CATTLE_MOVED,
    message: `Ganado ${cattleEarTag} movido de ${fromLocation.address || 'ubicación desconocida'} a ${toLocation.address || 'nueva ubicación'}`,
    userId: req.userId,
    userEmail: req.user?.email,
    userRole: req.userRole,
    requestId: (req as any).requestId,
    cattleEarTag: cattleEarTag,
    location: toLocation,
    metadata: {
      fromLocation: fromLocation,
      toLocation: toLocation,
      reason: reason,
      distance: calculateDistance(fromLocation, toLocation)
    }
  });
};

/**
 * Función helper para calcular distancia entre dos puntos
 */
function calculateDistance(
  point1: { latitude: number; longitude: number },
  point2: { latitude: number; longitude: number }
): number {
  const R = 6371; // Radio de la Tierra en kilómetros
  const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distancia en kilómetros
}

/**
 * Middleware para logging automático de operaciones CRUD
 */
export const auditTrail = (operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE', resource: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send;

    res.send = function (data: any) {
      // Solo logear operaciones exitosas
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logger.log({
          timestamp: new Date().toISOString(),
          level: LogLevel.INFO,
          eventType: `${resource.toLowerCase()}_${operation.toLowerCase()}` as CattleEventType,
          message: `${operation} en ${resource}: ${req.method} ${req.originalUrl}`,
          userId: req.userId,
          userEmail: req.user?.email,
          userRole: req.userRole,
          requestId: (req as any).requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          metadata: {
            operation: operation,
            resource: resource,
            resourceId: req.params.id || req.body.id,
            changes: operation === 'UPDATE' ? req.body : undefined
          }
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Función para obtener métricas del sistema
 */
export const getSystemMetrics = (): PerformanceMetrics => {
  return logger.getMetrics();
};

/**
 * Función para resetear métricas
 */
export const resetSystemMetrics = (): void => {
  logger.resetMetrics();
};

/**
 * Función para logging manual desde cualquier parte de la aplicación
 */
export const logMessage = (
  level: LogLevel,
  eventType: CattleEventType | string,
  message: string,
  metadata?: any
): void => {
  logger.log({
    timestamp: new Date().toISOString(),
    level: level,
    eventType: eventType,
    message: message,
    metadata: metadata
  });
};