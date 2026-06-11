#!/usr/bin/env ts-node

// ============================================================================
// SCRIPT DE GESTIÓN DE BASE DE DATOS - LÍNEA DE COMANDOS
// ============================================================================

import { getDatabaseManager, initializeDatabase, closeDatabase } from '../src/config/database';
import { MigrationManager } from '../src/migrations/MigrationManager';
import { BackupManager } from '../src/backup/BackupManager';
import logger from '../src/utils/Logger';

// ============================================================================
// FUNCIONES PRINCIPALES
// ============================================================================

/**
 * Muestra la ayuda del script
 */
function showHelp(): void {
  console.log(`
🗄️  GESTIÓN DE BASE DE DATOS - SISTEMA PROFESIONAL
====================================================

COMANDOS DISPONIBLES:

📊 INFORMACIÓN:
  status              - Estado de la base de datos
  info                - Información detallada
  stats               - Estadísticas de la base de datos

🔄 SINCRONIZACIÓN:
  sync                - Sincronizar modelos con la base de datos
  sync --force        - Forzar recreación de tablas
  sync --alter        - Modificar tablas existentes

📋 MIGRACIONES:
  migration create <name>  - Crear nueva migración
  migration up             - Ejecutar migraciones pendientes
  migration down           - Revertir última migración
  migration status         - Estado de migraciones

💾 BACKUPS:
  backup full         - Crear backup completo
  backup schema       - Crear backup de esquema
  backup data         - Crear backup de datos
  backup list         - Listar backups disponibles
  backup clean [days] - Limpiar backups antiguos
  backup stats        - Estadísticas de backups

🔧 MANTENIMIENTO:
  init                - Inicialización completa
  test                - Probar conexión
  reset               - Resetear base de datos (¡CUIDADO!)

OPCIONES:
  --help, -h          - Mostrar esta ayuda
  --verbose, -v       - Modo verbose
  --dry-run           - Simular sin ejecutar

EJEMPLOS:
  npm run db status
  npm run db migration create add_users_table
  npm run db backup full
  npm run db sync --force
`);
}

/**
 * Maneja el comando de estado
 */
async function handleStatus(): Promise<void> {
  try {
    const manager = getDatabaseManager();
    const isConnected = await manager.testConnection();
    const info = manager.getConnectionInfo();
    
    console.log('\n📊 ESTADO DE LA BASE DE DATOS');
    console.log('================================');
    console.log(`Estado: ${isConnected ? '✅ Conectado' : '❌ Desconectado'}`);
    console.log(`Ambiente: ${info.environment}`);
    console.log(`Host: ${info.host}:${info.port}`);
    console.log(`Base de datos: ${info.database}`);
    console.log(`Usuario: ${info.username}`);
    console.log(`Pool: ${info.poolInfo?.max || 0} conexiones máximas`);
    console.log(`Características:`);
    console.log(`  - Migraciones: ${info.features.migrations ? '✅' : '❌'}`);
    console.log(`  - Backups: ${info.features.backup ? '✅' : '❌'}`);
    console.log(`  - Logging: ${info.features.logging ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Error obteniendo estado:', error);
    process.exit(1);
  }
}

/**
 * Maneja el comando de información
 */
async function handleInfo(): Promise<void> {
  try {
    const manager = getDatabaseManager();
    const stats = await manager.getDatabaseStats();
    
    console.log('\n📋 INFORMACIÓN DETALLADA');
    console.log('=========================');
    console.log(JSON.stringify(stats, null, 2));
    
  } catch (error) {
    console.error('❌ Error obteniendo información:', error);
    process.exit(1);
  }
}

/**
 * Maneja el comando de sincronización
 */
async function handleSync(force: boolean = false, alter: boolean = false): Promise<void> {
  try {
    const manager = getDatabaseManager();
    
    if (force) {
      console.log('⚠️  ADVERTENCIA: Se eliminarán y recrearán todas las tablas');
    }
    
    await manager.syncDatabase();
    console.log('✅ Sincronización completada');
    
  } catch (error) {
    console.error('❌ Error en sincronización:', error);
    process.exit(1);
  }
}

/**
 * Maneja los comandos de migración
 */
async function handleMigration(command: string, ...args: string[]): Promise<void> {
  try {
    const manager = getDatabaseManager();
    const migrationManager = manager.getMigrationManager();
    
    if (!migrationManager) {
      console.error('❌ MigrationManager no disponible');
      process.exit(1);
    }
    
    switch (command) {
      case 'create':
        const name = args[0];
        if (!name) {
          console.error('❌ Debe especificar un nombre para la migración');
          process.exit(1);
        }
        await migrationManager.createMigration(name);
        break;
        
      case 'up':
        const upResult = await migrationManager.runMigrations();
        if (!upResult.success) {
          console.error('❌ Error ejecutando migraciones');
          process.exit(1);
        }
        break;
        
      case 'down':
        const downResult = await migrationManager.rollbackMigrations();
        if (!downResult.success) {
          console.error('❌ Error revirtiendo migraciones');
          process.exit(1);
        }
        break;
        
      case 'status':
        await migrationManager.getStatus();
        break;
        
      default:
        console.error(`❌ Comando de migración no válido: ${command}`);
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

/**
 * Maneja los comandos de backup
 */
async function handleBackup(command: string, ...args: string[]): Promise<void> {
  try {
    const manager = getDatabaseManager();
    const backupManager = manager.getBackupManager();
    
    if (!backupManager) {
      console.error('❌ BackupManager no disponible');
      process.exit(1);
    }
    
    switch (command) {
      case 'full':
        const fullResult = await backupManager.createFullBackup({ compression: true });
        if (!fullResult.success) {
          console.error('❌ Error creando backup completo');
          process.exit(1);
        }
        break;
        
      case 'schema':
        const schemaResult = await backupManager.createSchemaBackup({ compression: true });
        if (!schemaResult.success) {
          console.error('❌ Error creando backup de esquema');
          process.exit(1);
        }
        break;
        
      case 'data':
        const dataResult = await backupManager.createDataBackup({ compression: true });
        if (!dataResult.success) {
          console.error('❌ Error creando backup de datos');
          process.exit(1);
        }
        break;
        
      case 'list':
        const backups = backupManager.getBackupInfo();
        console.log('\n📋 BACKUPS DISPONIBLES');
        console.log('======================');
        for (const backup of backups) {
          const size = (backupManager as any).formatFileSize(backup.size);
          console.log(`${backup.timestamp.toISOString()} - ${backup.type} - ${size}`);
        }
        break;
        
      case 'clean':
        const days = args[0] ? parseInt(args[0]) : undefined;
        await backupManager.cleanOldBackups(days);
        break;
        
      case 'stats':
        const stats = backupManager.getBackupStats();
        console.log('\n📊 ESTADÍSTICAS DE BACKUPS');
        console.log('===========================');
        console.log(`Total de backups: ${stats.totalBackups}`);
        console.log(`Tamaño total: ${(backupManager as any).formatFileSize(stats.totalSize)}`);
        console.log(`Backup más antiguo: ${stats.oldestBackup?.toISOString() || 'N/A'}`);
        console.log(`Backup más reciente: ${stats.newestBackup?.toISOString() || 'N/A'}`);
        console.log('Por tipo:');
        for (const [type, count] of Object.entries(stats.byType)) {
          console.log(`  ${type}: ${count}`);
        }
        break;
        
      default:
        console.error(`❌ Comando de backup no válido: ${command}`);
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error en backup:', error);
    process.exit(1);
  }
}

/**
 * Maneja la inicialización completa
 */
async function handleInit(): Promise<void> {
  try {
    console.log('🚀 Iniciando inicialización completa...');
    await initializeDatabase();
    console.log('✅ Inicialización completada');
    
  } catch (error) {
    console.error('❌ Error en inicialización:', error);
    process.exit(1);
  }
}

/**
 * Maneja la prueba de conexión
 */
async function handleTest(): Promise<void> {
  try {
    const manager = getDatabaseManager();
    const isConnected = await manager.testConnection();
    
    if (isConnected) {
      console.log('✅ Conexión exitosa');
    } else {
      console.log('❌ Error de conexión');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error probando conexión:', error);
    process.exit(1);
  }
}

/**
 * Maneja el reset de la base de datos
 */
async function handleReset(): Promise<void> {
  try {
    console.log('⚠️  ADVERTENCIA: Esto eliminará TODOS los datos');
    console.log('Presiona Ctrl+C para cancelar o Enter para continuar...');
    
    // Esperar entrada del usuario
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', async () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      
      console.log('🔄 Reseteando base de datos...');
      await handleSync(true);
      console.log('✅ Reset completado');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error en reset:', error);
    process.exit(1);
  }
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  const command = args[0];
  const subCommand = args[1];
  const options = args.slice(2);
  
  try {
    switch (command) {
      case 'status':
        await handleStatus();
        break;
        
      case 'info':
        await handleInfo();
        break;
        
      case 'sync':
        const force = options.includes('--force');
        const alter = options.includes('--alter');
        await handleSync(force, alter);
        break;
        
      case 'migration':
        await handleMigration(subCommand, ...options);
        break;
        
      case 'backup':
        await handleBackup(subCommand, ...options);
        break;
        
      case 'init':
        await handleInit();
        break;
        
      case 'test':
        await handleTest();
        break;
        
      case 'reset':
        await handleReset();
        break;
        
      default:
        console.error(`❌ Comando no reconocido: ${command}`);
        showHelp();
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando comando:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

export default main;


