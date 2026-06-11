// ============================================================================
// SISTEMA DE LOGGING PROFESIONAL
// ============================================================================

import fs from 'fs';
import path from 'path';
import { getEnvironmentConfig } from '../config/environments';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: Record<string, any>;
  stack?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
}

// ============================================================================
// CLASE LOGGER
// ============================================================================

export class Logger {
  private config: LoggerConfig;
  private logFilePath?: string;
  private currentFileSize: number = 0;

  constructor(config?: Partial<LoggerConfig>) {
    const envConfig = getEnvironmentConfig();
    
    this.config = {
      level: config?.level || envConfig.logging.level,
      enableConsole: config?.enableConsole ?? envConfig.logging.enableConsole,
      enableFile: config?.enableFile ?? envConfig.logging.enableFile,
      filePath: config?.filePath || envConfig.logging.filePath,
      maxFileSize: config?.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: config?.maxFiles || 5
    };

    if (this.config.enableFile && this.config.filePath) {
      this.setupLogFile();
    }
  }

  /**
   * Configura el archivo de log
   */
  private setupLogFile(): void {
    if (!this.config.filePath) return;

    // Crear directorio si no existe
    const logDir = path.dirname(this.config.filePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.logFilePath = this.config.filePath;
    this.currentFileSize = fs.existsSync(this.logFilePath) ? fs.statSync(this.logFilePath).size : 0;
  }

  /**
   * Verifica si el nivel de log debe ser registrado
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    return levels[level] <= levels[this.config.level];
  }

  /**
   * Formatea el mensaje de log
   */
  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const context = entry.context ? `[${entry.context}]` : '';
    const message = entry.message;
    const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    const stack = entry.stack ? `\n${entry.stack}` : '';

    return `${timestamp} ${level} ${context} ${message}${metadata}${stack}`;
  }

  /**
   * Escribe el log al archivo
   */
  private writeToFile(formattedMessage: string): void {
    if (!this.logFilePath || !this.config.enableFile) return;

    try {
      // Verificar si necesitamos rotar el archivo
      if (this.currentFileSize > this.config.maxFileSize!) {
        this.rotateLogFile();
      }

      fs.appendFileSync(this.logFilePath, formattedMessage + '\n');
      this.currentFileSize += Buffer.byteLength(formattedMessage + '\n');
    } catch (error) {
      console.error('Error escribiendo al archivo de log:', error);
    }
  }

  /**
   * Rota el archivo de log cuando alcanza el tamaño máximo
   */
  private rotateLogFile(): void {
    if (!this.logFilePath) return;

    try {
      // Crear backup del archivo actual
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupPath = `${this.logFilePath}.${timestamp}`;
      fs.renameSync(this.logFilePath, backupPath);

      // Crear nuevo archivo
      fs.writeFileSync(this.logFilePath, '');
      this.currentFileSize = 0;

      // Limpiar archivos antiguos
      this.cleanOldLogFiles();

      console.log(`Log rotado: ${path.basename(backupPath)}`);
    } catch (error) {
      console.error('Error rotando archivo de log:', error);
    }
  }

  /**
   * Limpia archivos de log antiguos
   */
  private cleanOldLogFiles(): void {
    if (!this.logFilePath) return;

    try {
      const logDir = path.dirname(this.logFilePath);
      const logBaseName = path.basename(this.logFilePath);
      
      const files = fs.readdirSync(logDir)
        .filter(file => file.startsWith(logBaseName) && file !== logBaseName)
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          stats: fs.statSync(path.join(logDir, file))
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

      // Eliminar archivos excedentes
      const filesToDelete = files.slice(this.config.maxFiles! - 1);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        console.log(`Archivo de log eliminado: ${file.name}`);
      }
    } catch (error) {
      console.error('Error limpiando archivos de log antiguos:', error);
    }
  }

  /**
   * Registra un mensaje de log
   */
  private log(level: LogLevel, message: string, context?: string, metadata?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      metadata,
      stack: error?.stack
    };

    const formattedMessage = this.formatMessage(entry);

    // Escribir a consola
    if (this.config.enableConsole) {
      const consoleMethod = level === 'error' ? console.error :
                           level === 'warn' ? console.warn :
                           level === 'info' ? console.info :
                           console.log;
      
      consoleMethod(formattedMessage);
    }

    // Escribir a archivo
    this.writeToFile(formattedMessage);
  }

  /**
   * Log de error
   */
  public error(message: string, context?: string, metadata?: Record<string, any>, error?: Error): void {
    this.log('error', message, context, metadata, error);
  }

  /**
   * Log de advertencia
   */
  public warn(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log('warn', message, context, metadata);
  }

  /**
   * Log de información
   */
  public info(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log('info', message, context, metadata);
  }

  /**
   * Log de debug
   */
  public debug(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log('debug', message, context, metadata);
  }

  /**
   * Log de inicio de operación
   */
  public start(operation: string, context?: string, metadata?: Record<string, any>): void {
    this.info(`Iniciando: ${operation}`, context, metadata);
  }

  /**
   * Log de finalización de operación
   */
  public end(operation: string, context?: string, metadata?: Record<string, any>): void {
    this.info(`Completado: ${operation}`, context, metadata);
  }

  /**
   * Log de operación fallida
   */
  public fail(operation: string, error: Error, context?: string, metadata?: Record<string, any>): void {
    this.error(`Falló: ${operation}`, context, metadata, error);
  }

  /**
   * Log de progreso
   */
  public progress(operation: string, current: number, total: number, context?: string): void {
    const percentage = Math.round((current / total) * 100);
    this.info(`Progreso: ${operation} (${current}/${total} - ${percentage}%)`, context);
  }

  /**
   * Log de métricas
   */
  public metrics(operation: string, metrics: Record<string, number>, context?: string): void {
    this.info(`Métricas: ${operation}`, context, metrics);
  }

  /**
   * Log de seguridad
   */
  public security(event: string, context?: string, metadata?: Record<string, any>): void {
    this.warn(`Seguridad: ${event}`, context, metadata);
  }

  /**
   * Log de base de datos
   */
  public database(operation: string, context?: string, metadata?: Record<string, any>): void {
    this.debug(`Base de datos: ${operation}`, context, metadata);
  }

  /**
   * Log de API
   */
  public api(method: string, endpoint: string, statusCode: number, duration: number, context?: string): void {
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
    this.log(level, `API: ${method} ${endpoint} - ${statusCode} (${duration}ms)`, context);
  }

  /**
   * Log de autenticación
   */
  public auth(event: string, context?: string, metadata?: Record<string, any>): void {
    this.info(`Autenticación: ${event}`, context, metadata);
  }

  /**
   * Log de validación
   */
  public validation(operation: string, errors: string[], context?: string): void {
    this.warn(`Validación: ${operation}`, context, { errors });
  }

  /**
   * Obtiene estadísticas del logger
   */
  public getStats(): {
    logFileExists: boolean;
    logFileSize: number;
    logFileAge?: number;
  } {
    const stats = {
      logFileExists: false,
      logFileSize: 0,
      logFileAge: undefined as number | undefined
    };

    if (this.logFilePath && fs.existsSync(this.logFilePath)) {
      const fileStats = fs.statSync(this.logFilePath);
      stats.logFileExists = true;
      stats.logFileSize = fileStats.size;
      stats.logFileAge = Date.now() - fileStats.mtime.getTime();
    }

    return stats;
  }

  /**
   * Limpia el archivo de log actual
   */
  public clearLogFile(): void {
    if (this.logFilePath && fs.existsSync(this.logFilePath)) {
      fs.writeFileSync(this.logFilePath, '');
      this.currentFileSize = 0;
      console.log('🧹 Archivo de log limpiado');
    }
  }
}

// ============================================================================
// INSTANCIA GLOBAL DEL LOGGER
// ============================================================================

// Crear instancia global del logger
const logger = new Logger();

// Exportar instancia global y clase
export default logger;

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

/**
 * Crea un logger personalizado
 */
export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new Logger(config);
}

/**
 * Middleware de logging para Express
 */
export function createLoggingMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // Log de request
    logger.info(`Request: ${req.method} ${req.path}`, 'HTTP', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined
    });

    // Interceptar response
    const originalSend = res.send;
    res.send = function(data: any) {
      const duration = Date.now() - startTime;
      
      // Log de response
      logger.api(req.method, req.path, res.statusCode, duration, 'HTTP');
      
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Wrapper para funciones async con logging automático
 */
export function withLogging<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operationName: string,
  context?: string
) {
  return async (...args: T): Promise<R> => {
    logger.start(operationName, context);
    
    try {
      const result = await fn(...args);
      logger.end(operationName, context);
      return result;
    } catch (error) {
      logger.fail(operationName, error as Error, context);
      throw error;
    }
  };
}