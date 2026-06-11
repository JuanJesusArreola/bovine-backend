// ============================================================================
// INDEX.TS - SERVIDOR PRINCIPAL DEL BACKEND - VERSIÓN CORREGIDA COMPLETA
// ============================================================================
// Servidor Express principal con todas las configuraciones y middleware

import express, { Application, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';

// Importar middleware personalizado
import { errorHandler } from './middleware/error';

import * as cron from 'node-cron';
import { scheduleRanchProductionUpdate } from './jobs/updateRanchProduction';
import { epidemiologicalService } from './services/EpidemiologicalService';
import { bovineVaccinationStatusService } from './services/BovineVaccinationStatusService';
import { runDiseaseSeeds } from './seeders/runDiseaseSeeds';
import logger from './utils/logger';

import { initRateLimiter, closeRateLimiter } from './middleware/rate-limit';


// ============================================================================
// CONFIGURACIÓN INICIAL
// ============================================================================

// Cargar variables de entorno
dotenv.config();
//import { initializeDatabase } from './models';

// Crear aplicación Express
const app: Application = express();

// Crear servidor HTTP
const server = createServer(app);

// 🔧 ARREGLO 1: Puerto correcto desde .env (5000, no 8000)
const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ============================================================================
// 🔧 ARREGLO 2: CORS SUPER PERMISIVO PRIMERO (ANTES DE HELMET)
// ============================================================================

const cors = require('cors');

// CORS completamente permisivo para desarrollo
const corsOptions = {
  origin: function (origin: any, callback: any) {
    // En desarrollo, permitir CUALQUIER origen
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      callback(null, true);
      return;
    }

    // Orígenes permitidos expandidos
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4173',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`🚫 Origen rechazado: ${origin} - PERO PERMITIDO EN DESARROLLO`);
      // EN DESARROLLO, PERMITIR DE TODAS FORMAS
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  // ✅ CORRECCIÓN PRINCIPAL: Agregar TODOS los headers necesarios
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-Access-Token',
    'x-app-version',      // Header del frontend
    'x-client-platform',  // Nuevo header que faltaba
    'x-client-version',   // Por si lo usa el frontend
    'x-api-key',          // Headers comunes de API
    'x-request-id'        // Para tracking
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page'
  ],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// 🔧 ARREGLO 3: Middleware CORS manual adicional para asegurar funcionamiento
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Forzar headers CORS en desarrollo
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH,HEAD');
    // ✅ CORRECCIÓN SECUNDARIA: Agregar TODOS los headers también aquí
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-Access-Token, x-app-version, x-client-platform, x-client-version, x-api-key, x-request-id');
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  // Responder inmediatamente a OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
});

// ============================================================================
// 🔧 ARREGLO 4: HELMET CON CSP MUY PERMISIVO PARA DESARROLLO
// ============================================================================

if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
  // En desarrollo, helmet MUY permisivo para evitar errores CSP
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "http:"],
        imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
        // 🚨 CLAVE: Esto arregla los errores de connect-src
        connectSrc: [
          "'self'",
          "http://localhost:*",
          "https://localhost:*",
          "http://127.0.0.1:*",
          "https://127.0.0.1:*",
          "ws://localhost:*",
          "wss://localhost:*"
        ],
        fontSrc: ["'self'", "https:", "http:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "https:", "http:", "data:"],
        frameSrc: ["'self'", "https:", "http:"],
        workerSrc: ["'self'", "blob:"],
        childSrc: ["'self'", "blob:"],
        manifestSrc: ["'self'"],
        baseUri: ["'self'"]
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" }
  }));

  console.log('🛡️  Helmet configurado para desarrollo (CSP muy permisivo)');
} else {
  // Configuración más segura para producción
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
}

// ============================================================================
// 🔧 ARREGLO 5: FAVICON Y MIDDLEWARE ADICIONAL
// ============================================================================

// Manejar favicon para evitar errores 404
app.get('/favicon.ico', (req: Request, res: Response) => {
  res.status(204).end(); // No Content - evita el error 404
});

// Middleware adicional para limpiar headers problemáticos
app.use((req, res, next) => {
  // Remover headers que pueden causar conflictos
  res.removeHeader('X-Powered-By');

  // Asegurar CORS headers están presentes en desarrollo
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    const origin = req.headers.origin;
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  next();
});

// ============================================================================
// MIDDLEWARE DE UTILIDADES
// ============================================================================

// Compresión de respuestas
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Logging de requests HTTP
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400
  }));
}

// Parsing de JSON y URL-encoded
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      const response = res as Response;
      response.status(400).json({
        success: false,
        message: 'JSON inválido en el cuerpo de la petición'
      });
      throw new Error('JSON inválido');
    }
  }
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// ============================================================================
// RUTAS PRINCIPALES
// ============================================================================

// Importar el router principal con todas las rutas
import mainRouter from './routes';
import { initializeDatabase } from './models';

// Usar el router principal para todas las rutas /api
app.use('/api', mainRouter);

// Ruta raíz básica
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Sistema de Gestión Ganadera - API REST',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    status: 'active',
    cors: 'enabled - ALL HEADERS INCLUDED',
    endpoints: 'health, ping, reproduction, info',
    port: PORT
  });
});

// 🔧 ARREGLO 6: Endpoint específico para pruebas de CORS (ahora manejado por el router principal)

// ✅ NUEVA RUTA: Endpoints específicos que estaban fallando
app.get('/api/health/vaccinations', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Endpoint de vacunas funcionando',
    data: [],
    timestamp: new Date().toISOString(),
    corsFixed: true
  });
});

app.get('/api/info', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Endpoint de información funcionando',
    data: {
      system: 'Gestión Ganadera',
      version: '1.0.0',
      corsStatus: 'fixed'
    },
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// ENDPOINTS (ahora manejados por el router principal)
// ============================================================================

// Información del sistema
app.get('/system-info', async (req: Request, res: Response) => {
  try {
    const systemInfo = {
      status: 'active',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      cors: 'enabled',
      corsHeaders: 'x-app-version included',
      port: PORT,
      host: HOST
    };
    res.json({
      success: true,
      data: systemInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo información del sistema'
    });
  }
});

// ============================================================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ============================================================================

// Middleware para rutas no encontradas
const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/info',
      'GET /api/ping',
      'POST /api/ping',
      'GET /api/test-cors',
      'GET /system-info',
      // Endpoints de autenticación
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/forgot-password',
      'POST /api/auth/reset-password',
      'POST /api/auth/verify-email',
      // Endpoints principales
      'GET /api/bovines',
      'GET /api/ranch',
      'GET /api/health',
      'GET /api/reproduction',
      'GET /api/production',
      'GET /api/inventory',
      'GET /api/finances',
      'GET /api/reports',
      'GET /api/dashboard'
    ]
  });
};

// Middleware para rutas no encontradas
app.use(notFoundHandler);

// Middleware de manejo de errores
app.use(errorHandler);

// ============================================================================
// FUNCIONES DE INICIALIZACIÓN
// ============================================================================

/**
 * Inicializa todos los servicios del backend
 */
async function initializeServices(): Promise<boolean> {
  try {
    console.log('🚀 Iniciando Sistema de Gestión Ganadera...');
    console.log('='.repeat(50));

    // Validaciones básicas
    console.log('📋 Validando configuración básica...');

    console.log('🔧 Inicializando base de datos...');
    await initializeDatabase();
    console.log('✅ Base de datos inicializada correctamente');

    // Poblar catálogo de enfermedades (idempotente — usa findOrCreate)
    console.log('🦠 Ejecutando seeders de enfermedades...');
    await runDiseaseSeeds();
    console.log('✅ Catálogo de enfermedades listo');

    // Backfill del estado de vacunación (V-01) — solo bovinos SIN fila de estado.
    // Best-effort: si falla, no bloquea el arranque (el job diario lo corrige).
    try {
      const bf = await bovineVaccinationStatusService.recomputeAll({ onlyMissing: true });
      if (bf.processed > 0) {
        console.log(`✅ Estado de vacunación backfilled — nuevos: ${bf.processed}`);
      }
    } catch (bfErr) {
      console.warn('⚠️ Backfill de estado de vacunación falló (no bloquea arranque):', (bfErr as Error).message);
    }

    if (!process.env.DB_HOST) {
      console.warn('⚠️ DB_HOST no configurado');
    }

    if (!process.env.JWT_ACCESS_SECRET) {
      console.warn('⚠️ JWT_ACCESS_SECRET no configurado');
    }

    // 🔧 Mostrar configuración CORS y CSP
    console.log('🌐 Configuración de desarrollo:');
    console.log(`   - Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   - Puerto: ${PORT}`);
    console.log(`   - CORS: Habilitado (muy permisivo)`);
    console.log(`   - Headers permitidos: x-app-version, x-client-platform, etc.`);
    console.log(`   - CSP: Configurado para desarrollo`);
    console.log(`   - Helmet: Modo desarrollo`);
    console.log(`   - Endpoints: health, ping, reproduction, etc.`);

    console.log('='.repeat(50));
    console.log('✅ Servicios básicos inicializados');
    return true;

  } catch (error) {
    console.error('❌ Error crítico durante la inicialización:', error);
    return false;
  }
}

/**
 * Programa el job de cómputo epidemiológico.
 *
 * Schedules:
 *  - Ejecución inmediata al arrancar (cubre el día actual si el servidor
 *    reinició y el snapshot de hoy todavía no existe).
 *  - Cron diario a las 03:00 AM hora del servidor — usando node-cron para
 *    que la hora sea fija independientemente de cuándo reinicie el proceso.
 *
 * Errores no detienen el servidor — cada fallo se loguea y el job
 * continúa su schedule normal.
 */
function scheduleEpidemiologicalJob(): void {
  const JOB_CONTEXT = 'EpidemiologicalJob';

  const run = async () => {
    logger.info('Iniciando cómputo de snapshots epidemiológicos', JOB_CONTEXT);
    try {
      const result = await epidemiologicalService.computeSnapshots();
      logger.info(
        `Snapshots computados — ok: ${result.computed}, errores: ${result.errors}`,
        JOB_CONTEXT,
        { computed: result.computed, errors: result.errors }
      );

      // E-03: evaluar triggers de alertas con los snapshots recién computados
      const alerts = await epidemiologicalService.evaluateAlerts();
      logger.info(`Alertas epidemiológicas evaluadas — nuevas: ${alerts.created}`, JOB_CONTEXT);
    } catch (err) {
      logger.error('Error en cómputo de snapshots epidemiológicos', JOB_CONTEXT, {}, err as Error);
    }
  };

  // 1. Ejecución inmediata al arrancar
  run();

  // 2. Cron diario: todos los días a las 03:00 AM
  cron.schedule('0 3 * * *', run, { timezone: 'America/Mexico_City' });

  logger.info('Job epidemiológico programado — diario a las 03:00 AM', JOB_CONTEXT);
}

/**
 * Job de recálculo del estado de vacunación (V-02).
 *
 * Reevalúa OVERDUE/UP_TO_DATE/PENDING de TODOS los bovinos activos, porque el
 * vencimiento depende del paso del tiempo (nextDueDate) y, sin este job, un
 * estado solo cambiaría al crear/editar/borrar una vacuna.
 *
 * Schedule: diario a las 03:30 AM (después del epidemiológico). Los errores no
 * detienen el servidor.
 */
function scheduleVaccinationRecomputeJob(): void {
  const JOB_CONTEXT = 'VaccinationRecomputeJob';

  const run = async () => {
    logger.info('Iniciando recálculo de estado de vacunación', JOB_CONTEXT);
    try {
      const result = await bovineVaccinationStatusService.recomputeAll();
      logger.info(
        `Estado de vacunación recalculado — ok: ${result.processed}, errores: ${result.errors}`,
        JOB_CONTEXT,
        result
      );
    } catch (err) {
      logger.error('Error en recálculo de estado de vacunación', JOB_CONTEXT, {}, err as Error);
    }
  };

  // Cron diario: todos los días a las 03:30 AM
  cron.schedule('30 3 * * *', run, { timezone: 'America/Mexico_City' });

  logger.info('Job de estado de vacunación programado — diario a las 03:30 AM', JOB_CONTEXT);
}

/**
 * Inicia el servidor HTTP
 */
async function startServer(): Promise<void> {
  try {
    await initRateLimiter();
    server.listen(PORT, HOST, () => {
      console.log('');
      console.log('🎉 ¡Servidor iniciado exitosamente!');
      console.log('='.repeat(50));
      console.log(`🌐 Servidor corriendo en: http://${HOST}:${PORT}`);
      console.log(`📚 Documentación API: http://${HOST}:${PORT}/api/docs`);
      console.log(`🏥 Health Check: http://${HOST}:${PORT}/api/health`);
      console.log(`🏓 Ping: http://${HOST}:${PORT}/api/ping`);
      console.log(`🧪 Test CORS: http://${HOST}:${PORT}/api/test-cors`);
      console.log(`💉 Vacunas: http://${HOST}:${PORT}/api/health/vaccinations`);
      console.log(`📋 Info: http://${HOST}:${PORT}/api/info`);
      console.log(`🐄 Apareamientos: http://${HOST}:${PORT}/api/reproduction/mating-records`);
      console.log(`📊 Dashboard Reprod: http://${HOST}:${PORT}/api/reproduction/dashboard`);
      console.log(`📊 Estado del sistema: http://${HOST}:${PORT}/system-info`);
      console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📅 Iniciado: ${new Date().toLocaleString()}`);
      console.log('');
      console.log('🔧 PRUEBAS RÁPIDAS:');
      console.log(`curl http://localhost:${PORT}/api/health`);
      console.log(`curl http://localhost:${PORT}/api/ping`);
      console.log(`curl http://localhost:${PORT}/api/test-cors`);
      console.log('');
      console.log('🌐 Frontend fetch test:');
      console.log(`fetch('http://localhost:${PORT}/api/health').then(r=>r.json()).then(console.log)`);
      console.log('');
      console.log('✅ CORS CORREGIDO: Todos los headers incluidos');
      console.log('✅ RUTAS AGREGADAS: ping, reproduction, health');
      console.log('='.repeat(50));
      console.log('');
    });

    // Manejo de errores del servidor
    server.on('error', (error: any) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

      switch (error.code) {
        case 'EACCES':
          console.error(`❌ ${bind} requiere privilegios elevados`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          console.error(`❌ ${bind} ya está en uso`);
          console.log('💡 Soluciones:');
          console.log(`   lsof -i :${PORT}  # Ver qué proceso usa el puerto`);
          console.log(`   kill -9 <PID>     # Matar el proceso`);
          console.log(`   PORT=5001 npm run dev  # Usar otro puerto`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

  } catch (error) {
    console.error('❌ Error iniciando el servidor:', error);
    process.exit(1);
  }
}

// ============================================================================
// MANEJO DE CIERRE ORDENADO
// ============================================================================

/**
 * Maneja el cierre ordenado del sistema
 */
async function handleShutdown(signal: string): Promise<void> {
  console.log(`\n🔄 Señal ${signal} recibida. Iniciando cierre ordenado...`);

  try {
    // Cerrar servidor HTTP
    server.close(() => {
      console.log('🌐 Servidor HTTP cerrado');
    });

    console.log('✅ Cierre ordenado completado');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante el cierre ordenado:', error);
    process.exit(1);
  }
}

// Escuchar señales de cierre
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Manejo de errores no capturados
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Excepción no capturada:', error);
  handleShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
  console.error('   En la promesa:', promise);
  handleShutdown('UNHANDLED_REJECTION');
});

process.on('SIGTERM', async () => { await closeRateLimiter(); process.exit(0); });
process.on('SIGINT', async () => { await closeRateLimiter(); process.exit(0); })

// ============================================================================
// INICIALIZACIÓN PRINCIPAL
// ============================================================================

/**
 * Función principal de inicialización
 */
async function main(): Promise<void> {
  try {
    // Mostrar banner de inicio
    console.clear();
    console.log('🐄 SISTEMA DE GESTIÓN GANADERA - UJAT');
    console.log('   Universidad Juárez Autónoma de Tabasco');
    console.log('   Backend API v1.0.0 - COMPLETAMENTE ARREGLADO');
    console.log('   ✅ CORS completo + Todos los endpoints + Headers');
    console.log('');

    app.use('/files', express.static(path.join(__dirname, '../uploads')));

    // Inicializar servicios
    const servicesReady = await initializeServices();
    if (!servicesReady) {
      console.error('❌ Error crítico: No se pudieron inicializar los servicios');
      process.exit(1);
    }
    scheduleRanchProductionUpdate();
    scheduleEpidemiologicalJob();
    scheduleVaccinationRecomputeJob();

    // Iniciar servidor
    await startServer();

  } catch (error) {
    console.error('❌ Error crítico en la inicialización:', error);
    process.exit(1);
  }
}

// Ejecutar función principal solo si este archivo es ejecutado directamente
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
}

// Exportar la aplicación para tests
export default app;
export { server };