// ============================================================================
// SISTEMA DE BACKUP AUTOMÁTICO - GESTIÓN PROFESIONAL
// ============================================================================

import { Sequelize } from 'sequelize';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as cron from 'node-cron';
import { getEnvironmentConfig } from '../config/environments';

const execAsync = promisify(exec);

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface BackupOptions {
  includeData?: boolean;
  includeSchema?: boolean;
  compression?: boolean;
  retentionDays?: number;
  customPath?: string;
}

export interface BackupResult {
  success: boolean;
  filePath?: string;
  size?: number;
  error?: string;
  timestamp: Date;
}

export interface BackupInfo {
  id: string;
  timestamp: Date;
  filePath: string;
  size: number;
  type: 'full' | 'schema' | 'data';
  environment: string;
}

// ============================================================================
// CLASE BACKUP MANAGER
// ============================================================================

export class BackupManager {
  private sequelize: Sequelize;
  private config: ReturnType<typeof getEnvironmentConfig>;
  private backupPath: string;
  private cronJob?: cron.ScheduledTask;

  constructor(sequelize: Sequelize) {
    this.sequelize = sequelize;
    this.config = getEnvironmentConfig();
    this.backupPath = this.config.backup.storagePath;
    
    // Crear directorio de backups si no existe
    this.ensureBackupDirectory();
  }

  /**
   * Asegura que el directorio de backups existe
   */
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupPath)) {
      fs.mkdirSync(this.backupPath, { recursive: true });
      console.log(`📁 Directorio de backups creado: ${this.backupPath}`);
    }
  }

  /**
   * Genera un nombre único para el backup
   */
  private generateBackupFileName(type: 'full' | 'schema' | 'data'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const environment = this.config.database.database || 'unknown';
    return `${environment}_${type}_${timestamp}.sql`;
  }

  /**
   * Obtiene la configuración de PostgreSQL para pg_dump
   */
  private getPgDumpConfig(): string {
    const dbConfig = this.config.database;
    return `PGPASSWORD="${dbConfig.password}" pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database}`;
  }

  /**
   * Crea un backup completo de la base de datos
   */
  public async createFullBackup(options: BackupOptions = {}): Promise<BackupResult> {
    const startTime = new Date();
    
    try {
      console.log('💾 Iniciando backup completo...');
      
      const fileName = this.generateBackupFileName('full');
      const filePath = path.join(this.backupPath, fileName);
      
      // Configurar opciones de pg_dump
      let pgDumpCommand = this.getPgDumpConfig();
      
      if (options.includeSchema !== false) {
        pgDumpCommand += ' --schema-only';
      }
      
      if (options.includeData !== false) {
        pgDumpCommand += ' --data-only';
      }
      
      if (options.compression) {
        pgDumpCommand += ' --compress=9';
      }
      
      pgDumpCommand += ` > "${filePath}"`;
      
      console.log(`🔄 Ejecutando: ${pgDumpCommand.replace(/PGPASSWORD="[^"]*"/, 'PGPASSWORD="***"')}`);
      
      // Ejecutar backup
      await execAsync(pgDumpCommand);
      
      // Verificar que el archivo se creó correctamente
      if (!fs.existsSync(filePath)) {
        throw new Error('El archivo de backup no se creó correctamente');
      }
      
      const stats = fs.statSync(filePath);
      const size = stats.size;
      
      if (size === 0) {
        throw new Error('El archivo de backup está vacío');
      }
      
      console.log(`✅ Backup completo creado: ${fileName} (${this.formatFileSize(size)})`);
      
      return {
        success: true,
        filePath,
        size,
        timestamp: startTime
      };
      
    } catch (error) {
      console.error('❌ Error creando backup completo:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: startTime
      };
    }
  }

  /**
   * Crea un backup solo del esquema
   */
  public async createSchemaBackup(options: BackupOptions = {}): Promise<BackupResult> {
    const startTime = new Date();
    
    try {
      console.log('📋 Iniciando backup de esquema...');
      
      const fileName = this.generateBackupFileName('schema');
      const filePath = path.join(this.backupPath, fileName);
      
      let pgDumpCommand = this.getPgDumpConfig();
      pgDumpCommand += ' --schema-only --no-owner --no-privileges';
      
      if (options.compression) {
        pgDumpCommand += ' --compress=9';
      }
      
      pgDumpCommand += ` > "${filePath}"`;
      
      await execAsync(pgDumpCommand);
      
      const stats = fs.statSync(filePath);
      const size = stats.size;
      
      console.log(`✅ Backup de esquema creado: ${fileName} (${this.formatFileSize(size)})`);
      
      return {
        success: true,
        filePath,
        size,
        timestamp: startTime
      };
      
    } catch (error) {
      console.error('❌ Error creando backup de esquema:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: startTime
      };
    }
  }

  /**
   * Crea un backup solo de los datos
   */
  public async createDataBackup(options: BackupOptions = {}): Promise<BackupResult> {
    const startTime = new Date();
    
    try {
      console.log('📊 Iniciando backup de datos...');
      
      const fileName = this.generateBackupFileName('data');
      const filePath = path.join(this.backupPath, fileName);
      
      let pgDumpCommand = this.getPgDumpConfig();
      pgDumpCommand += ' --data-only --no-owner --no-privileges';
      
      if (options.compression) {
        pgDumpCommand += ' --compress=9';
      }
      
      pgDumpCommand += ` > "${filePath}"`;
      
      await execAsync(pgDumpCommand);
      
      const stats = fs.statSync(filePath);
      const size = stats.size;
      
      console.log(`✅ Backup de datos creado: ${fileName} (${this.formatFileSize(size)})`);
      
      return {
        success: true,
        filePath,
        size,
        timestamp: startTime
      };
      
    } catch (error) {
      console.error('❌ Error creando backup de datos:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: startTime
      };
    }
  }

  /**
   * Restaura la base de datos desde un backup
   */
  public async restoreBackup(backupFilePath: string): Promise<BackupResult> {
    const startTime = new Date();
    
    try {
      console.log(`🔄 Iniciando restauración desde: ${backupFilePath}`);
      
      if (!fs.existsSync(backupFilePath)) {
        throw new Error(`El archivo de backup no existe: ${backupFilePath}`);
      }
      
      const dbConfig = this.config.database;
      const restoreCommand = `PGPASSWORD="${dbConfig.password}" psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} < "${backupFilePath}"`;
      
      console.log(`🔄 Ejecutando restauración...`);
      await execAsync(restoreCommand);
      
      console.log(`✅ Base de datos restaurada correctamente`);
      
      return {
        success: true,
        timestamp: startTime
      };
      
    } catch (error) {
      console.error('❌ Error restaurando backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: startTime
      };
    }
  }

  /**
   * Obtiene información de todos los backups disponibles
   */
  public getBackupInfo(): BackupInfo[] {
    const backups: BackupInfo[] = [];
    
    if (!fs.existsSync(this.backupPath)) {
      return backups;
    }
    
    const files = fs.readdirSync(this.backupPath)
      .filter(file => file.endsWith('.sql'))
      .sort()
      .reverse(); // Más recientes primero
    
    for (const file of files) {
      const filePath = path.join(this.backupPath, file);
      const stats = fs.statSync(filePath);
      
      // Parsear nombre del archivo para extraer información
      const match = file.match(/^(.+)_(full|schema|data)_(.+)\.sql$/);
      if (match) {
        const [, environment, type, timestamp] = match;
        const backup: BackupInfo = {
          id: timestamp,
          timestamp: new Date(timestamp.replace(/-/g, ':').replace('T', ' ')),
          filePath,
          size: stats.size,
          type: type as 'full' | 'schema' | 'data',
          environment
        };
        backups.push(backup);
      }
    }
    
    return backups;
  }

  /**
   * Limpia backups antiguos según la política de retención
   */
  public async cleanOldBackups(retentionDays?: number): Promise<{ deleted: number; errors: string[] }> {
    const days = retentionDays || this.config.backup.retentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const backups = this.getBackupInfo();
    const toDelete = backups.filter(backup => backup.timestamp < cutoffDate);
    
    let deleted = 0;
    const errors: string[] = [];
    
    console.log(`🧹 Limpiando backups anteriores a ${cutoffDate.toISOString()} (${days} días)`);
    
    for (const backup of toDelete) {
      try {
        fs.unlinkSync(backup.filePath);
        deleted++;
        console.log(`🗑️ Eliminado: ${path.basename(backup.filePath)}`);
      } catch (error) {
        const errorMsg = `Error eliminando ${backup.filePath}: ${error}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    console.log(`✅ Limpieza completada: ${deleted} archivos eliminados, ${errors.length} errores`);
    
    return { deleted, errors };
  }

  /**
   * Programa backups automáticos
   */
  public scheduleBackups(): void {
    if (!this.config.backup.enabled) {
      console.log('📋 Backups automáticos deshabilitados');
      return;
    }
    
    const schedule = this.config.backup.schedule;
    console.log(`⏰ Programando backups automáticos: ${schedule}`);
    
    this.cronJob = cron.schedule(schedule, async () => {
      console.log('🕐 Ejecutando backup programado...');
      
      try {
        const result = await this.createFullBackup({
          compression: true,
          retentionDays: this.config.backup.retentionDays
        });
        
        if (result.success) {
          console.log('✅ Backup programado completado exitosamente');
          
          // Limpiar backups antiguos
          await this.cleanOldBackups();
        } else {
          console.error('❌ Error en backup programado:', result.error);
        }
      } catch (error) {
        console.error('❌ Error en backup programado:', error);
      }
    }, {
      timezone: 'America/Mexico_City'
    });
    
    console.log('✅ Backups automáticos programados correctamente');
  }

  /**
   * Detiene los backups programados
   */
  public stopScheduledBackups(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
      console.log('⏹️ Backups automáticos detenidos');
    }
  }

  /**
   * Formatea el tamaño del archivo en formato legible
   */
  private formatFileSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Obtiene estadísticas de los backups
   */
  public getBackupStats(): {
    totalBackups: number;
    totalSize: number;
    oldestBackup?: Date;
    newestBackup?: Date;
    byType: Record<string, number>;
  } {
    const backups = this.getBackupInfo();
    
    const stats = {
      totalBackups: backups.length,
      totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : undefined,
      newestBackup: backups.length > 0 ? backups[0].timestamp : undefined,
      byType: {} as Record<string, number>
    };
    
    // Contar por tipo
    for (const backup of backups) {
      stats.byType[backup.type] = (stats.byType[backup.type] || 0) + 1;
    }
    
    return stats;
  }
}

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

/**
 * Crea una instancia del BackupManager
 */
export function createBackupManager(sequelize: Sequelize): BackupManager {
  return new BackupManager(sequelize);
}

/**
 * Ejecuta backups desde línea de comandos
 */
export async function runBackupCLI(): Promise<void> {
  const { sequelize } = await import('../models');
  const backupManager = createBackupManager(sequelize);
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'full':
        const fullResult = await backupManager.createFullBackup({
          compression: true
        });
        if (!fullResult.success) {
          process.exit(1);
        }
        break;

      case 'schema':
        const schemaResult = await backupManager.createSchemaBackup({
          compression: true
        });
        if (!schemaResult.success) {
          process.exit(1);
        }
        break;

      case 'data':
        const dataResult = await backupManager.createDataBackup({
          compression: true
        });
        if (!dataResult.success) {
          process.exit(1);
        }
        break;

      case 'list':
        const backups = backupManager.getBackupInfo();
        console.log('📋 Backups disponibles:');
        console.log('================================');
        for (const backup of backups) {
          const size = backupManager['formatFileSize'](backup.size);
          console.log(`${backup.timestamp.toISOString()} - ${backup.type} - ${size}`);
        }
        break;

      case 'clean':
        const retentionDays = args[1] ? parseInt(args[1]) : undefined;
        await backupManager.cleanOldBackups(retentionDays);
        break;

      case 'stats':
        const stats = backupManager.getBackupStats();
        console.log('📊 Estadísticas de backups:');
        console.log('================================');
        console.log(`Total de backups: ${stats.totalBackups}`);
        console.log(`Tamaño total: ${backupManager['formatFileSize'](stats.totalSize)}`);
        console.log(`Backup más antiguo: ${stats.oldestBackup?.toISOString() || 'N/A'}`);
        console.log(`Backup más reciente: ${stats.newestBackup?.toISOString() || 'N/A'}`);
        console.log('Por tipo:');
        for (const [type, count] of Object.entries(stats.byType)) {
          console.log(`  ${type}: ${count}`);
        }
        break;

      default:
        console.log('📋 Comandos disponibles:');
        console.log('  full              - Crear backup completo');
        console.log('  schema            - Crear backup de esquema');
        console.log('  data              - Crear backup de datos');
        console.log('  list              - Listar backups disponibles');
        console.log('  clean [days]      - Limpiar backups antiguos');
        console.log('  stats             - Mostrar estadísticas');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

export default BackupManager;
