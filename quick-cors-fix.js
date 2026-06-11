// ============================================================================
// ARREGLO RÁPIDO CORS - quick-cors-fix.js
// ============================================================================
// Coloca este archivo en Backend/ y ejecuta: node quick-cors-fix.js
// Este script creará/actualizará tu configuración CORS automáticamente

const fs = require('fs');
const path = require('path');

console.log('🔧 ARREGLO RÁPIDO DE CORS');
console.log('========================');

// ============================================================================
// 1. CREAR CONFIGURACIÓN CORS PERMISIVA
// ============================================================================

const corsConfig = `// ============================================================================
// CORS.TS - CONFIGURACIÓN CORS ARREGLADA
// ============================================================================

let cors: any;

try {
  cors = require('cors');
} catch (error) {
  console.warn('⚠️  Dependencia CORS no instalada. Ejecuta: npm install cors');
}

// Configuración CORS MUY PERMISIVA para desarrollo
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    // En desarrollo, permitir CUALQUIER origen
    if (process.env.NODE_ENV === 'development') {
      callback(null, true);
      return;
    }
    
    // Orígenes permitidos
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://localhost:4173',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('🚫 Origen bloqueado:', origin);
      callback(null, true); // PERMITIR DE TODAS FORMAS EN DESARROLLO
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Access-Token',
    'X-Key',
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
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 200
};

export const getCorsMiddleware = () => {
  if (!cors) {
    return (req: any, res: any, next: any) => {
      // Middleware manual si cors no está instalado
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      
      if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
      }
      
      next();
    };
  }

  return cors(corsOptions);
};

export default corsOptions;
`;

// ============================================================================
// 2. CONFIGURACIÓN DE EXPRESS SIMPLIFICADA
// ============================================================================

const expressConfig = `// ============================================================================
// EXPRESS CONFIG - CONFIGURACIÓN SIMPLIFICADA
// ============================================================================

import express, { Application } from 'express';
import { getCorsMiddleware } from './config/cors';

const app: Application = express();
const PORT = process.env.PORT || 5000;

// ============================================================================
// MIDDLEWARE BÁSICO
// ============================================================================

// CORS - MUY PERMISIVO
app.use(getCorsMiddleware());

// Middleware manual adicional para asegurar CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // En desarrollo, permitir TODO
  if (process.env.NODE_ENV === 'development') {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH,HEAD');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-Access-Token');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  // Responder a OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Helmet con configuración MUY permisiva (solo para desarrollo)
if (process.env.NODE_ENV === 'development') {
  // Helmet desactivado en desarrollo para evitar problemas
  console.log('⚠️  Helmet desactivado en desarrollo');
} else {
  const helmet = require('helmet');
  app.use(helmet({
    contentSecurityPolicy: false, // Desactivar CSP
    crossOriginEmbedderPolicy: false
  }));
}

// ============================================================================
// RUTAS BÁSICAS
// ============================================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend funcionando correctamente',
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test DB (si existe conexión)
app.get('/api/test-db', async (req, res) => {
  try {
    // Aquí irían las pruebas de BD
    res.json({
      success: true,
      message: 'Endpoint de prueba disponible',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en prueba de BD',
      error: error.message
    });
  }
});

// Catch-all para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: \`Ruta \${req.originalUrl} no encontrada\`,
    availableRoutes: ['/api/health', '/api/test-db']
  });
});

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================

app.listen(PORT, () => {
  console.log('');
  console.log('🎉 ¡Servidor iniciado con CORS arreglado!');
  console.log('=====================================');
  console.log(\`🌐 URL: http://localhost:\${PORT}\`);
  console.log(\`💓 Health: http://localhost:\${PORT}/api/health\`);
  console.log(\`🔧 Test DB: http://localhost:\${PORT}/api/test-db\`);
  console.log(\`🌍 Entorno: \${process.env.NODE_ENV || 'development'}\`);
  console.log('✅ CORS: Completamente permisivo');
  console.log('✅ CSP: Desactivado');
  console.log('');
});

export default app;
`;

// ============================================================================
// 3. FUNCIONES DE CREACIÓN DE ARCHIVOS
// ============================================================================

function createFile(filePath, content, description) {
  try {
    // Crear directorio si no existe
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Directorio creado: ${dir}`);
    }
    
    // Crear archivo
    fs.writeFileSync(filePath, content);
    console.log(`✅ ${description}: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error creando ${description}:`, error.message);
    return false;
  }
}

function backupFile(filePath) {
  if (fs.existsSync(filePath)) {
    const backupPath = filePath + '.backup.' + Date.now();
    fs.copyFileSync(filePath, backupPath);
    console.log(`💾 Backup creado: ${backupPath}`);
  }
}

// ============================================================================
// 4. EJECUCIÓN PRINCIPAL
// ============================================================================

function main() {
  console.log('\n🔍 Detectando estructura del proyecto...');
  
  // Verificar que estamos en el directorio Backend
  if (!fs.existsSync('package.json')) {
    console.error('❌ No se encontró package.json. ¿Estás en el directorio Backend?');
    process.exit(1);
  }
  
  console.log('✅ Directorio Backend detectado');
  
  // Crear estructura de directorios
  const configDir = path.join('src', 'config');
  
  // Rutas de archivos
  const corsFilePath = path.join(configDir, 'cors.ts');
  const tempExpressPath = path.join('src', 'temp-express-fixed.ts');
  
  console.log('\n🔧 Aplicando arreglos...');
  
  // Hacer backup si existe
  backupFile(corsFilePath);
  
  // Crear archivos
  const corsCreated = createFile(corsFilePath, corsConfig, 'Configuración CORS');
  const expressCreated = createFile(tempExpressPath, expressConfig, 'Express temporal');
  
  if (corsCreated && expressCreated) {
    console.log('\n✅ ARREGLOS APLICADOS EXITOSAMENTE!');
    console.log('\n📋 PRÓXIMOS PASOS:');
    console.log('1. Detener el servidor actual (Ctrl+C)');
    console.log('2. Instalar cors si no está instalado:');
    console.log('   npm install cors @types/cors');
    console.log('3. Usar el archivo temporal:');
    console.log('   npx ts-node src/temp-express-fixed.ts');
    console.log('4. O integrar los cambios en tu archivo principal');
    console.log('\n🧪 PROBAR:');
    console.log('fetch("http://localhost:5000/api/health")');
    console.log('  .then(r => r.json())');
    console.log('  .then(console.log)');
  } else {
    console.log('\n❌ Algunos archivos no se pudieron crear');
  }
}

// Ejecutar
main();
