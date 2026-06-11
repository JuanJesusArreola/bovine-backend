// ============================================================================
// INDEX.TS - EXPORTACIONES DEL MÓDULO CONFIG
// ============================================================================
// Archivo central para exportar todas las configuraciones del backend
// Facilita la importación de configuraciones desde otros módulos

// ============================================================================
// IMPORTACIONES DE CONFIGURACIONES
// ============================================================================

// Configuración de base de datos
import sequelize, { 
  getDatabaseManager,
  initializeDatabase,
  closeDatabase
} from './database';

// Configuración de autenticación
import authConfig, {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  validateEmail,
  generateRandomString,
  generateTokenResponse,
  UserRole
} from './auth';

// Configuración de CORS
import corsConfig, {
  getCorsMiddleware
} from './cors';

// Configuración de uploads
import {
  uploadConfigs,
  createUploadMiddleware,
  processImage,
  createThumbnails,
  getUploadConfig,
  validateFile,
  deleteFile,
  getFileUrl,
  getStorageStats,
  uploadErrorHandler
} from './upload';

// ============================================================================
// TIPOS Y INTERFACES
// ============================================================================

// Re-exportar tipos importantes para facilitar su uso
export type { DatabaseManagerConfig } from './database';
export type { JWTPayload, TokenResponse, AuthConfig } from './auth';
// Tipos de CORS se definen localmente
export type { 
  UploadConfig, 
  FileTypeConfig, 
  UploadedFileInfo, 
  ImageProcessingOptions,
  BasicFile,
  BasicRequest 
} from './upload';

// ============================================================================
// CONFIGURACIÓN GENERAL DE LA APLICACIÓN
// ============================================================================

interface AppConfig {
  // Información general de la aplicación
  app: {
    name: string;
    version: string;
    description: string;
    environment: string;
    port: number;
    host: string;
    baseUrl: string;
  };
  
  // Configuraciones de servicios
  services: {
    database: any; // Se obtiene dinámicamente del DatabaseManager
    auth: typeof authConfig;
    cors: typeof corsConfig;
    uploads: typeof uploadConfigs;
  };
  
  // Configuraciones de integración
  integrations: {
    maps: {
      provider: string;
      apiKey?: string;
    };
    notifications: {
      enabled: boolean;
      providers: string[];
    };
    analytics: {
      enabled: boolean;
      provider?: string;
    };
  };
}

// Configuración principal de la aplicación
const appConfig: AppConfig = {
  app: {
    name: process.env.APP_NAME || 'Cattle Management System',
    version: process.env.APP_VERSION || '1.0.0',
    description: 'Sistema de gestión integral para ganado bovino con geolocalización',
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '8000'),
    host: process.env.HOST || '0.0.0.0',
    baseUrl: process.env.BASE_URL || 'http://localhost:8000'
  },
  
  services: {
    database: getDatabaseManager().getConnectionInfo(),
    auth: authConfig,
    cors: corsConfig,
    uploads: uploadConfigs
  },
  
  integrations: {
    maps: {
      provider: process.env.MAPS_PROVIDER || 'leaflet',
      apiKey: process.env.MAPS_API_KEY
    },
    notifications: {
      enabled: process.env.NOTIFICATIONS_ENABLED === 'true',
      providers: (process.env.NOTIFICATION_PROVIDERS || 'email').split(',')
    },
    analytics: {
      enabled: process.env.ANALYTICS_ENABLED === 'true',
      provider: process.env.ANALYTICS_PROVIDER
    }
  }
};

// ============================================================================
// FUNCIONES DE INICIALIZACIÓN
// ============================================================================

/**
 * Inicializa todas las configuraciones del sistema
 * @returns Promise<boolean> - true si la inicialización fue exitosa
 */
export const initializeConfig = async (): Promise<boolean> => {
  try {
    console.log('🚀 Inicializando configuraciones del sistema...');
    
    // Verificar variables de entorno críticas
    const criticalEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER'];
    const missingVars = criticalEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.warn(`⚠️  Variables de entorno faltantes: ${missingVars.join(', ')}`);
    }
    
    // Probar conexión a base de datos
    const dbManager = getDatabaseManager();
    const dbConnected = await dbManager.testConnection();
    if (!dbConnected) {
      console.error('❌ No se pudo conectar a la base de datos');
      return false;
    }
    
    // Mostrar información de configuración
    console.log('📋 Configuración cargada:');
    console.log(`   Aplicación: ${appConfig.app.name} v${appConfig.app.version}`);
    console.log(`   Entorno: ${appConfig.app.environment}`);
    console.log(`   Puerto: ${appConfig.app.port}`);
    console.log(`   Base URL: ${appConfig.app.baseUrl}`);
    
    console.log('✅ Configuraciones inicializadas correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando configuraciones:', error);
    return false;
  }
};

/**
 * Valida que todas las configuraciones sean correctas
 * @returns object - Resultado de la validación
 */
export const validateConfig = (): { isValid: boolean; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Validar configuración de la aplicación
    if (!appConfig.app.name) {
      errors.push('Nombre de la aplicación no configurado');
    }
    
    if (appConfig.app.port < 1000 || appConfig.app.port > 65535) {
      errors.push('Puerto de la aplicación fuera del rango válido');
    }
    
    // Validar configuración de base de datos
    const dbManager = getDatabaseManager();
    const dbInfo = dbManager.getConnectionInfo();
    if (!dbInfo.host || !dbInfo.database || !dbInfo.username) {
      errors.push('Configuración de base de datos incompleta');
    }
    
    // Validar configuración de autenticación
    if (authConfig.jwt.accessTokenSecret.length < 32) {
      warnings.push('Secret de JWT muy corto, se recomienda al menos 32 caracteres');
    }
    
    if (appConfig.app.environment === 'production') {
      // Validaciones específicas de producción
      if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.includes('default')) {
        errors.push('Secret de JWT por defecto en producción');
      }
      
      if (appConfig.app.baseUrl.includes('localhost')) {
        warnings.push('Base URL apunta a localhost en producción');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    errors.push(`Error validando configuración: ${errorMessage}`);
    return { isValid: false, errors, warnings };
  }
};

/**
 * Obtiene información completa del sistema
 * @returns object - Información del sistema
 */
export const getSystemInfo = () => {
  return {
    application: {
      name: appConfig.app.name,
      version: appConfig.app.version,
      environment: appConfig.app.environment,
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform
    },
    database: getDatabaseManager().getConnectionInfo(),
    cors: { enabled: true, middleware: 'getCorsMiddleware' },
    storage: getStorageStats(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
    }
  };
};

/**
 * Función para cerrar todos los servicios de manera ordenada
 * @returns Promise<void>
 */
export const gracefulShutdown = async (): Promise<void> => {
  try {
    console.log('🔄 Iniciando cierre ordenado del sistema...');
    
    // Cerrar conexión a base de datos
    await closeDatabase();
    
    console.log('✅ Sistema cerrado correctamente');
  } catch (error) {
    console.error('❌ Error durante el cierre del sistema:', error);
    throw error;
  }
};

// ============================================================================
// EXPORTACIONES PRINCIPALES
// ============================================================================

// Exportar configuración principal
export default appConfig;

// Exportar configuraciones específicas
export {
  // Base de datos
  sequelize,
  getDatabaseManager,
  initializeDatabase,
  closeDatabase,
  
  // Autenticación
  authConfig,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  validateEmail,
  generateRandomString,
  generateTokenResponse,
  UserRole,
  
  // CORS
  corsConfig,
  getCorsMiddleware,
  
  // Uploads
  uploadConfigs,
  createUploadMiddleware,
  processImage,
  createThumbnails,
  getUploadConfig,
  validateFile,
  deleteFile,
  getFileUrl,
  getStorageStats,
  uploadErrorHandler
};

// ============================================================================
// CONFIGURACIÓN DE VARIABLES DE ENTORNO
// ============================================================================

/**
 * Lista de todas las variables de entorno utilizadas
 * Para documentación y verificación
 */
export const ENV_VARIABLES = {
  // Aplicación general
  APP_NAME: 'Nombre de la aplicación',
  APP_VERSION: 'Versión de la aplicación',
  NODE_ENV: 'Entorno de ejecución (development, test, production)',
  PORT: 'Puerto del servidor',
  HOST: 'Host del servidor',
  BASE_URL: 'URL base de la aplicación',
  
  // Base de datos
  DB_HOST: 'Host de PostgreSQL',
  DB_PORT: 'Puerto de PostgreSQL',
  DB_NAME: 'Nombre de la base de datos',
  DB_USER: 'Usuario de la base de datos',
  DB_PASSWORD: 'Contraseña de la base de datos',
  
  // Base de datos de pruebas
  TEST_DB_HOST: 'Host de PostgreSQL para pruebas',
  TEST_DB_PORT: 'Puerto de PostgreSQL para pruebas',
  TEST_DB_NAME: 'Nombre de la base de datos de pruebas',
  TEST_DB_USER: 'Usuario de la base de datos de pruebas',
  TEST_DB_PASSWORD: 'Contraseña de la base de datos de pruebas',
  
  // Base de datos de producción
  PROD_DB_HOST: 'Host de PostgreSQL para producción',
  PROD_DB_PORT: 'Puerto de PostgreSQL para producción',
  PROD_DB_NAME: 'Nombre de la base de datos de producción',
  PROD_DB_USER: 'Usuario de la base de datos de producción',
  PROD_DB_PASSWORD: 'Contraseña de la base de datos de producción',
  
  // Autenticación
  JWT_ACCESS_SECRET: 'Secret para tokens de acceso',
  JWT_REFRESH_SECRET: 'Secret para tokens de actualización',
  JWT_ACCESS_EXPIRATION: 'Tiempo de expiración de tokens de acceso',
  JWT_REFRESH_EXPIRATION: 'Tiempo de expiración de tokens de actualización',
  JWT_ISSUER: 'Emisor de los tokens JWT',
  JWT_AUDIENCE: 'Audiencia de los tokens JWT',
  BCRYPT_SALT_ROUNDS: 'Rondas de salt para bcrypt',
  MAX_LOGIN_ATTEMPTS: 'Intentos máximos de login',
  LOCKOUT_DURATION: 'Duración del bloqueo en milisegundos',
  SESSION_TIMEOUT: 'Tiempo de expiración de sesión en milisegundos',
  
  // CORS
  FRONTEND_URL: 'URL del frontend',
  ADMIN_URL: 'URL del panel de administración',
  MOBILE_URL: 'URL de la aplicación móvil',
  ADDITIONAL_ORIGINS: 'Orígenes adicionales permitidos (separados por comas)',
  
  // Integraciones
  MAPS_PROVIDER: 'Proveedor de mapas (leaflet, google, etc.)',
  MAPS_API_KEY: 'API key para servicios de mapas',
  NOTIFICATIONS_ENABLED: 'Habilitar notificaciones (true/false)',
  NOTIFICATION_PROVIDERS: 'Proveedores de notificaciones (separados por comas)',
  ANALYTICS_ENABLED: 'Habilitar analytics (true/false)',
  ANALYTICS_PROVIDER: 'Proveedor de analytics'
} as const;