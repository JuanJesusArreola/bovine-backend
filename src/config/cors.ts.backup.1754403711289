// ============================================================================
// CORS.TS - CONFIGURACIÓN DE CORS (CROSS-ORIGIN RESOURCE SHARING)
// ============================================================================
// Configuración para manejo de solicitudes entre diferentes dominios
// Incluye configuraciones para desarrollo, testing y producción

// Importaciones condicionales para evitar errores antes de instalar dependencias
let cors: any;

try {
  cors = require('cors');
} catch (error) {
  console.warn('⚠️  Dependencia CORS no instalada aún. Ejecuta: npm install cors @types/cors');
}

// ============================================================================
// INTERFACES Y TIPOS
// ============================================================================

interface CorsConfig {
  origin: string[] | string | boolean | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  preflightContinue: boolean;
  optionsSuccessStatus: number;
}

interface EnvironmentCorsConfig {
  development: CorsConfig;
  test: CorsConfig;
  production: CorsConfig;
}

// ============================================================================
// CONFIGURACIÓN DE DOMINIOS PERMITIDOS
// ============================================================================

// Dominios permitidos para desarrollo
const developmentOrigins = [
  'http://localhost:3000',      // React app en desarrollo
  'http://localhost:5173',      // Vite dev server
  'http://localhost:4173',      // Vite preview
  'http://127.0.0.1:3000',      // Localhost alternativo
  'http://127.0.0.1:5173',      // Vite dev server alternativo
  'http://192.168.1.1:3000',    // Red local común
  'http://192.168.0.1:3000',    // Red local común alternativa
];

// Dominios permitidos para testing
const testOrigins = [
  'http://localhost:3000',
  'http://localhost:8080',      // Servidor de pruebas
  'http://127.0.0.1:3000',
];

// Dominios permitidos para producción (deben ser específicos)
const productionOrigins = [
  process.env.FRONTEND_URL || 'https://cattle-management.com',
  process.env.ADMIN_URL || 'https://admin.cattle-management.com',
  process.env.MOBILE_URL || 'https://mobile.cattle-management.com',
  // Agregar dominios adicionales desde variables de entorno
  ...(process.env.ADDITIONAL_ORIGINS ? process.env.ADDITIONAL_ORIGINS.split(',') : [])
].filter(Boolean); // Filtrar valores undefined o vacíos

// ============================================================================
// CONFIGURACIÓN CORS POR ENTORNO
// ============================================================================

const corsConfig: EnvironmentCorsConfig = {
  // Configuración para desarrollo - más permisiva
  development: {
    origin: developmentOrigins,
    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
      'HEAD'
    ],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'X-Access-Token',
      'X-Key',
      'X-Ranch-ID',           // Header personalizado para identificar rancho
      'X-User-Role',          // Header personalizado para rol de usuario
      'X-Device-ID',          // Header para identificar dispositivo móvil
      'X-App-Version',        // Header para versión de la aplicación
      'X-Platform',           // Header para plataforma (web, mobile, etc.)
    ],
    exposedHeaders: [
      'X-Total-Count',        // Para paginación
      'X-Page-Count',         // Para paginación
      'X-Current-Page',       // Para paginación
      'X-Rate-Limit',         // Para límites de API
      'X-Rate-Remaining',     // Para límites de API
      'X-Response-Time',      // Para debugging de performance
    ],
    credentials: true,        // Permitir cookies y headers de autenticación
    maxAge: 86400,           // Cache preflight por 24 horas
    preflightContinue: false,
    optionsSuccessStatus: 200 // Para compatibilidad con navegadores legacy
  },

  // Configuración para testing - controlada
  test: {
    origin: testOrigins,
    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Access-Token',
      'X-Ranch-ID',
      'X-User-Role'
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count',
      'X-Current-Page'
    ],
    credentials: true,
    maxAge: 3600,            // Cache preflight por 1 hora en testing
    preflightContinue: false,
    optionsSuccessStatus: 200
  },

  // Configuración para producción - estricta y segura
  production: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Verificar si el origen está en la lista de permitidos
      if (!origin || productionOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Log del intento de acceso no autorizado
        console.warn(`🚫 CORS: Origen no autorizado intentó acceder: ${origin}`);
        callback(new Error('No permitido por política CORS'), false);
      }
    },
    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Access-Token',
      'X-Ranch-ID',
      'X-User-Role',
      'X-Device-ID',
      'X-App-Version',
      'X-Platform'
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count',
      'X-Current-Page',
      'X-Rate-Limit',
      'X-Rate-Remaining'
    ],
    credentials: true,
    maxAge: 86400,           // Cache preflight por 24 horas en producción
    preflightContinue: false,
    optionsSuccessStatus: 200
  }
};

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

/**
 * Obtiene la configuración CORS para el entorno actual
 * @returns CorsConfig - Configuración CORS del entorno actual
 */
export const getCurrentCorsConfig = (): CorsConfig => {
  const environment = (process.env.NODE_ENV as keyof EnvironmentCorsConfig) || 'development';
  return corsConfig[environment];
};

/**
 * Obtiene el middleware de CORS configurado para Express
 * @returns Function - Middleware de CORS configurado
 */
export const getCorsMiddleware = () => {
  if (!cors) {
    // Middleware mock si CORS no está disponible
    return (req: any, res: any, next: any) => {
      console.warn('⚠️  CORS middleware not available - dependencies not installed');
      next();
    };
  }

  const config = getCurrentCorsConfig();
  return cors(config);
};

/**
 * Valida si un origen está permitido
 * @param origin - Origen a validar
 * @returns boolean - true si está permitido, false si no
 */
export const isOriginAllowed = (origin: string): boolean => {
  const environment = (process.env.NODE_ENV as keyof EnvironmentCorsConfig) || 'development';
  const config = corsConfig[environment];

  if (typeof config.origin === 'boolean') {
    return config.origin;
  }

  if (typeof config.origin === 'string') {
    return config.origin === origin;
  }

  if (Array.isArray(config.origin)) {
    return config.origin.includes(origin);
  }

  // Si es una función, no podemos validar fácilmente aquí
  return true;
};

/**
 * Agrega un origen permitido dinámicamente (solo en desarrollo)
 * @param origin - Origen a agregar
 * @returns boolean - true si se agregó exitosamente
 */
export const addAllowedOrigin = (origin: string): boolean => {
  const environment = process.env.NODE_ENV || 'development';
  
  if (environment !== 'development') {
    console.warn('🚫 No se pueden agregar orígenes dinámicamente en producción');
    return false;
  }

  const config = corsConfig.development;
  if (Array.isArray(config.origin)) {
    if (!config.origin.includes(origin)) {
      config.origin.push(origin);
      console.log(`✅ Origen agregado a CORS: ${origin}`);
      return true;
    }
  }

  return false;
};

/**
 * Obtiene información sobre la configuración CORS actual
 * @returns object - Información de la configuración CORS
 */
export const getCorsInfo = () => {
  const environment = process.env.NODE_ENV || 'development';
  const config = getCurrentCorsConfig();
  
  return {
    environment,
    allowedOrigins: Array.isArray(config.origin) ? config.origin : 'Configuración dinámica',
    allowedMethods: config.methods,
    credentialsEnabled: config.credentials,
    maxAge: config.maxAge,
    customHeaders: config.allowedHeaders.filter(header => 
      !['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'].includes(header)
    )
  };
};

/**
 * Middleware personalizado para logging de CORS
 * @param req - Request object
 * @param res - Response object
 * @param next - Next function
 */
export const corsLoggingMiddleware = (req: any, res: any, next: any) => {
  const origin = req.headers.origin;
  const method = req.method;
  
  if (method === 'OPTIONS') {
    console.log(`🔍 CORS Preflight: ${origin} -> ${method} ${req.path}`);
  } else if (origin) {
    console.log(`🌐 CORS Request: ${origin} -> ${method} ${req.path}`);
  }
  
  next();
};

// ============================================================================
// CONFIGURACIÓN DE HEADERS DE SEGURIDAD ADICIONALES
// ============================================================================

/**
 * Middleware para headers de seguridad adicionales
 * @param req - Request object
 * @param res - Response object
 * @param next - Next function
 */
export const securityHeadersMiddleware = (req: any, res: any, next: any) => {
  // Prevenir ataques XSS
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Política de referrer
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy básica
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:;");
  }
  
  next();
};

// ============================================================================
// EXPORTACIONES
// ============================================================================

// Exportar configuración como default
export default corsConfig;

// Exportar tipos
export type { CorsConfig, EnvironmentCorsConfig };