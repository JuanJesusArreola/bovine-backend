// Importaciones del sistema profesional
import { Sequelize } from 'sequelize';
import { getEnvironmentConfig, validateEnvironmentVariables } from './environments';
import { MigrationManager } from '../migrations/MigrationManager';
import { BackupManager } from '../backup/BackupManager';
import logger from '../utils/logger';

// ============================================================================
// P-01 — COERCIÓN DE TIPOS NUMÉRICOS DE POSTGRES
// ============================================================================
// Por defecto el driver `pg` devuelve NUMERIC/DECIMAL (OID 1700) como STRING
// para no perder precisión. Eso causaba que campos como tasas/montos llegaran
// como "12.50" y rompía operaciones tipo `value.toFixed()` o cálculos directos.
// Forzamos NUMERIC → number a nivel global (una sola vez, al cargar el módulo).
// Nota: con valores extremadamente grandes parseFloat puede perder precisión;
// en este dominio (pesos, tasas, montos) es seguro.
// Usamos require porque `@types/pg` no está instalado (evita dependencia de tipos).
// ============================================================================
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { types: pgTypes } = require('pg');
pgTypes.setTypeParser(1700, (val: string | null) => (val === null ? null : parseFloat(val)));

// ============================================================================
// INTERFACES Y TIPOS
// ============================================================================

interface DatabaseManagerConfig {
  enableMigrations: boolean;
  enableBackup: boolean;
  enableLogging: boolean;
  autoSync: boolean;
  forceSync: boolean;
  alterSync: boolean;
}

// ============================================================================
// CLASE DATABASE MANAGER PROFESIONAL
// ============================================================================

export class DatabaseManager {
  private sequelize: Sequelize;
  private migrationManager?: MigrationManager;
  private backupManager?: BackupManager;
  private config: ReturnType<typeof getEnvironmentConfig>;
  private managerConfig: DatabaseManagerConfig;

  constructor(managerConfig?: Partial<DatabaseManagerConfig>) {
    // Validar variables de entorno
    const validation = validateEnvironmentVariables();
    if (!validation.isValid) {
      throw new Error(`❌ Variables de entorno faltantes: ${validation.missing.join(', ')}`);
    }

    // Obtener configuración del ambiente
    this.config = getEnvironmentConfig();

    // Configuración del manager
    this.managerConfig = {
      enableMigrations: managerConfig?.enableMigrations ?? this.config.features.enableMigrations,
      enableBackup: managerConfig?.enableBackup ?? this.config.features.enableBackup,
      enableLogging: managerConfig?.enableLogging ?? true,
      autoSync: managerConfig?.autoSync ?? true,
      forceSync: managerConfig?.forceSync ?? true,
      alterSync: managerConfig?.alterSync ?? false
    };

    // Crear instancia de Sequelize
    this.sequelize = new Sequelize(this.config.database);

    // Inicializar managers
    this.initializeManagers();

    logger.info('🗄️ DatabaseManager inicializado', 'Database', {
      environment: this.config.database.database,
      host: this.config.database.host,
      features: this.managerConfig
    });
  }

  /**
   * Inicializa los managers de migraciones y backup
   */
  private initializeManagers(): void {
    if (this.managerConfig.enableMigrations) {
      this.migrationManager = new MigrationManager(this.sequelize);
      logger.info('📋 MigrationManager inicializado', 'Database');
    }

    if (this.managerConfig.enableBackup) {
      this.backupManager = new BackupManager(this.sequelize);
      logger.info('💾 BackupManager inicializado', 'Database');
    }
  }

  /**
   * Obtiene la instancia de Sequelize
   */
  public getSequelize(): Sequelize {
    return this.sequelize;
  }

  /**
   * Obtiene el MigrationManager
   */
  public getMigrationManager(): MigrationManager | undefined {
    return this.migrationManager;
  }

  /**
   * Obtiene el BackupManager
   */
  public getBackupManager(): BackupManager | undefined {
    return this.backupManager;
  }

  /**
   * Inicializa la base de datos completamente
   */
  public async initialize(): Promise<void> {
    try {
      logger.start('Inicialización completa de base de datos', 'Database');

      // 1. Probar conexión
      await this.testConnection();

       await this.enablePostGIS();

      // 2. Ejecutar migraciones si están habilitadas
      if (this.managerConfig.enableMigrations && this.migrationManager) {
        await this.runMigrations();
      }

      // 3. Sincronizar modelos si está habilitado
      if (this.managerConfig.autoSync) {
        await this.syncDatabase();
      }

      // 4. Programar backups si están habilitados
      if (this.managerConfig.enableBackup && this.backupManager) {
        this.scheduleBackups();
      }

      logger.end('Inicialización completa de base de datos', 'Database');

    } catch (error) {
      logger.fail('Inicialización completa de base de datos', error as Error, 'Database');
      throw error;
    }
  }

  /**
   * Prueba la conexión a la base de datos
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.sequelize.authenticate();
      logger.info('Conexión a base de datos establecida', 'Database', {
        host: this.config.database.host,
        database: this.config.database.database
      });
      return true;
    } catch (error) {
      logger.fail('Conexión a base de datos', error as Error, 'Database');
      return false;
    }
  }

  /**
   * Sincroniza la base de datos con los modelos
   */
  public async syncDatabase(): Promise<void> {
    try {
      logger.start('Sincronización de base de datos', 'Database');

      const options = {
        force: this.managerConfig.forceSync,
        alter: this.managerConfig.alterSync,
        logging: this.managerConfig.enableLogging ? console.log : false
      };

      if (options.force) {
        logger.warn('Eliminando y recreando todas las tablas', 'Database');
      } else if (options.alter) {
        logger.info('Modificando tablas existentes', 'Database');
      } else {
        logger.info('Creando tablas que no existen', 'Database');
      }

      await this.sequelize.sync(options);
      logger.end('Sincronización de base de datos', 'Database');

    } catch (error) {
      logger.fail('Sincronización de base de datos', error as Error, 'Database');
      throw error;
    }
  }

  /**
   * Ejecuta migraciones pendientes
   */
  public async runMigrations(): Promise<void> {
    if (!this.migrationManager) {
      logger.warn('MigrationManager no disponible', 'Database');
      return;
    }

    try {
      logger.start('Ejecución de migraciones', 'Database');
      const result = await this.migrationManager.runMigrations();

      if (result.success) {
        logger.end('Ejecución de migraciones', 'Database', {
          executed: result.executed.length,
          failed: result.failed.length
        });
      } else {
        logger.fail('Ejecución de migraciones', new Error(result.errors.join(', ')), 'Database');
      }
    } catch (error) {
      logger.fail('Ejecución de migraciones', error as Error, 'Database');
      throw error;
    }
  }

  /**
   * Programa backups automáticos
   */
  public scheduleBackups(): void {
    if (!this.backupManager) {
      logger.warn('BackupManager no disponible', 'Database');
      return;
    }

    this.backupManager.scheduleBackups();
    logger.info('Backups automáticos programados', 'Database');
  }

  /**
   * Cierra la conexión a la base de datos
   */
  public async closeConnection(): Promise<void> {
    try {
      // Detener backups programados
      if (this.backupManager) {
        this.backupManager.stopScheduledBackups();
      }

      await this.sequelize.close();
      logger.info('Conexión a base de datos cerrada', 'Database');
    } catch (error) {
      logger.fail('Cerrar conexión a base de datos', error as Error, 'Database');
      throw error;
    }
  }
  /**
     * Obtiene información del estado de la conexión
     */
  public getConnectionInfo() {
    return {
      environment: this.config.database.database,
      host: this.config.database.host,
      port: this.config.database.port,
      database: this.config.database.database,
      username: this.config.database.username,
      isConnected: true,
      poolInfo: this.config.database.pool,
      features: {
        migrations: this.managerConfig.enableMigrations,
        backup: this.managerConfig.enableBackup,
        logging: this.managerConfig.enableLogging
      }
    };
  }

  /**
   * Obtiene estadísticas de la base de datos
   */
  public async getDatabaseStats(): Promise<Record<string, any>> {
    try {
      const [results] = await this.sequelize.query(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples
        FROM pg_stat_user_tables 
        ORDER BY schemaname, tablename
      `);

      return {
        tables: results,
        connectionInfo: this.getConnectionInfo(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas de base de datos', 'Database', {}, error as Error);
      throw error;
    }
  }

  /**
 * Habilita la extensión PostGIS en la base de datos si no existe.
 * Necesaria para índices espaciales y funciones geográficas.
 */
  private async enablePostGIS(): Promise<void> {
    try {
      logger.info('Habilitando extensión PostGIS (si no existe)', 'Database');
      await this.sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
      logger.info('Extensión PostGIS verificada/creada correctamente', 'Database');
    } catch (error) {
      logger.fail('Error al habilitar PostGIS', error as Error, 'Database');
      throw new Error('PostGIS no está disponible en el servidor. Asegúrate de instalarlo.');
    }
  }
}

// ============================================================================
// INSTANCIA GLOBAL Y EXPORTACIONES
// ============================================================================

// Crear instancia global del DatabaseManager
let databaseManager: DatabaseManager;

/**
 * Obtiene la instancia global del DatabaseManager
 */
export function getDatabaseManager(): DatabaseManager {
  if (!databaseManager) {
    databaseManager = new DatabaseManager();
  }
  return databaseManager;
}

/**
 * Inicializa la base de datos globalmente
 */
export async function initializeDatabase(): Promise<DatabaseManager> {
  const manager = getDatabaseManager();
  await manager.initialize();
  return manager;
}

/**
 * Cierra la conexión global de la base de datos
 */
export async function closeDatabase(): Promise<void> {
  if (databaseManager) {
    await databaseManager.closeConnection();
  }
}

// Exportar la instancia de Sequelize para compatibilidad
export const sequelize = getDatabaseManager().getSequelize();

// Exportar por defecto la instancia de Sequelize para compatibilidad
export default sequelize;

// Exportar tipos
export type { DatabaseManagerConfig };