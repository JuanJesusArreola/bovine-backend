// ============================================================================
// SISTEMA DE MIGRACIONES - GESTIÓN PROFESIONAL
// ============================================================================

import { Sequelize, QueryInterface, DataTypes } from 'sequelize';
import fs from 'fs';
import path from 'path';
import { getEnvironmentConfig } from '../config/environments';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface Migration {
  id: string;
  name: string;
  timestamp: Date;
  executed: boolean;
  executedAt?: Date;
  rollback?: () => Promise<void>;
}

export interface MigrationResult {
  success: boolean;
  executed: string[];
  failed: string[];
  errors: string[];
}

export interface MigrationOptions {
  force?: boolean;
  rollback?: boolean;
  to?: string;
  dryRun?: boolean;
}

// ============================================================================
// CLASE MIGRATION MANAGER
// ============================================================================

export class MigrationManager {
  private sequelize: Sequelize;
  private queryInterface: QueryInterface;
  private migrationsPath: string;
  private config: ReturnType<typeof getEnvironmentConfig>;

  constructor(sequelize: Sequelize) {
    this.sequelize = sequelize;
    this.queryInterface = sequelize.getQueryInterface();
    this.migrationsPath = path.join(process.cwd(), 'src', 'migrations', 'files');
    this.config = getEnvironmentConfig();
    
    // Crear directorio de migraciones si no existe
    this.ensureMigrationsDirectory();
  }

  /**
   * Asegura que el directorio de migraciones existe
   */
  private ensureMigrationsDirectory(): void {
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true });
      console.log(`📁 Directorio de migraciones creado: ${this.migrationsPath}`);
    }
  }

  /**
   * Crea la tabla de migraciones si no existe
   */
  private async createMigrationsTable(): Promise<void> {
    try {
      await this.queryInterface.createTable('sequelize_migrations', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        migration_id: {
          type: DataTypes.STRING(255),
          allowNull: false,
          unique: true
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        executed_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });

      console.log('✅ Tabla de migraciones creada');
    } catch (error) {
      // La tabla ya existe, continuar
      console.log('📋 Tabla de migraciones ya existe');
    }
  }

  /**
   * Genera un ID único para la migración
   */
  private generateMigrationId(): string {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    return `${timestamp}`;
  }

  /**
   * Crea un nuevo archivo de migración
   */
  public async createMigration(name: string): Promise<string> {
    const migrationId = this.generateMigrationId();
    const fileName = `${migrationId}_${name}.ts`;
    const filePath = path.join(this.migrationsPath, fileName);

    const template = `// ============================================================================
// MIGRACIÓN: ${name}
// ID: ${migrationId}
// Fecha: ${new Date().toISOString()}
// ============================================================================

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🚀 Ejecutando migración: ${name}');
  
  // =============================================
  // AQUÍ VA TU CÓDIGO DE MIGRACIÓN
  // =============================================
  
  // Ejemplo: Crear tabla
  // await queryInterface.createTable('nueva_tabla', {
  //   id: {
  //     type: DataTypes.INTEGER,
  //     primaryKey: true,
  //     autoIncrement: true
  //   },
  //   nombre: {
  //     type: DataTypes.STRING(255),
  //     allowNull: false
  //   },
  //   created_at: {
  //     type: DataTypes.DATE,
  //     allowNull: false,
  //     defaultValue: DataTypes.NOW
  //   },
  //   updated_at: {
  //     type: DataTypes.DATE,
  //     allowNull: false,
  //     defaultValue: DataTypes.NOW
  //   }
  // });

  console.log('✅ Migración ${name} ejecutada correctamente');
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🔄 Revirtiendo migración: ${name}');
  
  // =============================================
  // AQUÍ VA TU CÓDIGO DE ROLLBACK
  // =============================================
  
  // Ejemplo: Eliminar tabla
  // await queryInterface.dropTable('nueva_tabla');

  console.log('✅ Migración ${name} revertida correctamente');
};

export const info = {
  id: '${migrationId}',
  name: '${name}',
  description: 'Descripción de la migración',
  author: 'Sistema de Migraciones',
  version: '1.0.0'
};
`;

    fs.writeFileSync(filePath, template);
    console.log(`✅ Migración creada: ${fileName}`);
    console.log(`📁 Ubicación: ${filePath}`);
    
    return migrationId;
  }

  /**
   * Obtiene todas las migraciones disponibles
   */
  public getAvailableMigrations(): Migration[] {
    const migrations: Migration[] = [];
    
    if (!fs.existsSync(this.migrationsPath)) {
      return migrations;
    }

    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.ts'))
      .sort();

    for (const file of files) {
      const match = file.match(/^(\d{14})_(.+)\.ts$/);
      if (match) {
        const [, timestamp, name] = match;
        const migration: Migration = {
          id: timestamp,
          name,
          timestamp: new Date(
            parseInt(timestamp.slice(0, 4)),
            parseInt(timestamp.slice(4, 6)) - 1,
            parseInt(timestamp.slice(6, 8)),
            parseInt(timestamp.slice(8, 10)),
            parseInt(timestamp.slice(10, 12)),
            parseInt(timestamp.slice(12, 14))
          ),
          executed: false
        };
        migrations.push(migration);
      }
    }

    return migrations;
  }

  /**
   * Obtiene el estado de las migraciones
   */
  public async getMigrationStatus(): Promise<Migration[]> {
    await this.createMigrationsTable();
    
    const availableMigrations = this.getAvailableMigrations();
    const executedMigrations = await this.getExecutedMigrations();
    
    // Marcar migraciones como ejecutadas
    for (const migration of availableMigrations) {
      migration.executed = executedMigrations.includes(migration.id);
    }

    return availableMigrations;
  }

  /**
   * Obtiene las migraciones ejecutadas
   */
  private async getExecutedMigrations(): Promise<string[]> {
    try {
      const [results] = await this.sequelize.query(
        'SELECT migration_id FROM sequelize_migrations ORDER BY executed_at ASC'
      );
      return (results as any[]).map(row => row.migration_id);
    } catch (error) {
      return [];
    }
  }

  /**
   * Ejecuta todas las migraciones pendientes
   */
  public async runMigrations(options: MigrationOptions = {}): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      executed: [],
      failed: [],
      errors: []
    };

    try {
      console.log('🚀 Iniciando ejecución de migraciones...');
      
      await this.createMigrationsTable();
      
      const status = await this.getMigrationStatus();
      const pendingMigrations = status.filter(m => !m.executed);

      if (pendingMigrations.length === 0) {
        console.log('✅ No hay migraciones pendientes');
        return result;
      }

      console.log(`📋 Encontradas ${pendingMigrations.length} migraciones pendientes`);

      for (const migration of pendingMigrations) {
        try {
          if (options.dryRun) {
            console.log(`🔍 [DRY RUN] Ejecutaría migración: ${migration.name}`);
            result.executed.push(migration.id);
            continue;
          }

          console.log(`🔄 Ejecutando migración: ${migration.name}`);
          
          // Importar y ejecutar la migración
          const migrationFile = path.join(this.migrationsPath, `${migration.id}_${migration.name}.ts`);
          const migrationModule = await import(migrationFile);
          
          if (typeof migrationModule.up !== 'function') {
            throw new Error(`Migración ${migration.name} no tiene función 'up'`);
          }

          await migrationModule.up(this.queryInterface);
          
          // Registrar migración como ejecutada
          await this.sequelize.query(
            'INSERT INTO sequelize_migrations (migration_id, name, executed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
            {
              replacements: [migration.id, migration.name, new Date(), new Date(), new Date()]
            }
          );

          result.executed.push(migration.id);
          console.log(`✅ Migración ${migration.name} ejecutada correctamente`);

        } catch (error) {
          const errorMsg = `Error en migración ${migration.name}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          
          result.failed.push(migration.id);
          result.errors.push(errorMsg);
          result.success = false;

          if (!options.force) {
            console.error('🛑 Deteniendo ejecución de migraciones debido a error');
            break;
          }
        }
      }

      console.log(`✅ Ejecución de migraciones completada`);
      console.log(`📊 Ejecutadas: ${result.executed.length}, Fallidas: ${result.failed.length}`);

    } catch (error) {
      console.error('❌ Error ejecutando migraciones:', error);
      result.success = false;
      result.errors.push(`Error general: ${error}`);
    }

    return result;
  }

  /**
   * Revierte migraciones
   */
  public async rollbackMigrations(options: MigrationOptions = {}): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      executed: [],
      failed: [],
      errors: []
    };

    try {
      console.log('🔄 Iniciando rollback de migraciones...');
      
      const status = await this.getMigrationStatus();
      const executedMigrations = status.filter(m => m.executed).reverse();

      if (executedMigrations.length === 0) {
        console.log('✅ No hay migraciones para revertir');
        return result;
      }

      const migrationsToRollback = options.to 
        ? executedMigrations.slice(0, executedMigrations.findIndex(m => m.id === options.to) + 1)
        : executedMigrations.slice(0, 1); // Por defecto, solo la última

      console.log(`📋 Revirtiendo ${migrationsToRollback.length} migraciones`);

      for (const migration of migrationsToRollback) {
        try {
          if (options.dryRun) {
            console.log(`🔍 [DRY RUN] Revertiría migración: ${migration.name}`);
            result.executed.push(migration.id);
            continue;
          }

          console.log(`🔄 Revirtiendo migración: ${migration.name}`);
          
          // Importar y ejecutar rollback
          const migrationFile = path.join(this.migrationsPath, `${migration.id}_${migration.name}.ts`);
          const migrationModule = await import(migrationFile);
          
          if (typeof migrationModule.down !== 'function') {
            throw new Error(`Migración ${migration.name} no tiene función 'down'`);
          }

          await migrationModule.down(this.queryInterface);
          
          // Eliminar registro de migración ejecutada
          await this.sequelize.query(
            'DELETE FROM sequelize_migrations WHERE migration_id = ?',
            {
              replacements: [migration.id]
            }
          );

          result.executed.push(migration.id);
          console.log(`✅ Migración ${migration.name} revertida correctamente`);

        } catch (error) {
          const errorMsg = `Error revirtiendo migración ${migration.name}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          
          result.failed.push(migration.id);
          result.errors.push(errorMsg);
          result.success = false;

          if (!options.force) {
            console.error('🛑 Deteniendo rollback debido a error');
            break;
          }
        }
      }

      console.log(`✅ Rollback de migraciones completado`);
      console.log(`📊 Revertidas: ${result.executed.length}, Fallidas: ${result.failed.length}`);

    } catch (error) {
      console.error('❌ Error en rollback de migraciones:', error);
      result.success = false;
      result.errors.push(`Error general: ${error}`);
    }

    return result;
  }

  /**
   * Obtiene el estado actual de las migraciones
   */
  public async getStatus(): Promise<void> {
    console.log('📊 Estado de las migraciones:');
    console.log('================================');
    
    const status = await this.getMigrationStatus();
    
    if (status.length === 0) {
      console.log('📭 No hay migraciones disponibles');
      return;
    }

    for (const migration of status) {
      const statusIcon = migration.executed ? '✅' : '⏳';
      const executedAt = migration.executed ? ' (ejecutada)' : ' (pendiente)';
      console.log(`${statusIcon} ${migration.id} - ${migration.name}${executedAt}`);
    }

    const executedCount = status.filter(m => m.executed).length;
    const pendingCount = status.length - executedCount;
    
    console.log('================================');
    console.log(`📊 Total: ${status.length} | Ejecutadas: ${executedCount} | Pendientes: ${pendingCount}`);
  }
}

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

/**
 * Crea una instancia del MigrationManager
 */
export function createMigrationManager(sequelize: Sequelize): MigrationManager {
  return new MigrationManager(sequelize);
}

/**
 * Ejecuta migraciones desde línea de comandos
 */
export async function runMigrationsCLI(): Promise<void> {
  const { sequelize } = await import('../models');
  const migrationManager = createMigrationManager(sequelize);
  
  const args = process.argv.slice(2);
  const command = args[0];
  const options: MigrationOptions = {};

  // Parsear opciones
  if (args.includes('--force')) options.force = true;
  if (args.includes('--dry-run')) options.dryRun = true;
  if (args.includes('--to')) {
    const toIndex = args.indexOf('--to');
    options.to = args[toIndex + 1];
  }

  try {
    switch (command) {
      case 'create':
        const name = args[1];
        if (!name) {
          console.error('❌ Debe especificar un nombre para la migración');
          process.exit(1);
        }
        await migrationManager.createMigration(name);
        break;

      case 'up':
        const upResult = await migrationManager.runMigrations(options);
        if (!upResult.success) {
          process.exit(1);
        }
        break;

      case 'down':
        const downResult = await migrationManager.rollbackMigrations(options);
        if (!downResult.success) {
          process.exit(1);
        }
        break;

      case 'status':
        await migrationManager.getStatus();
        break;

      default:
        console.log('📋 Comandos disponibles:');
        console.log('  create <name>     - Crear nueva migración');
        console.log('  up                - Ejecutar migraciones pendientes');
        console.log('  down              - Revertir última migración');
        console.log('  status            - Mostrar estado de migraciones');
        console.log('');
        console.log('Opciones:');
        console.log('  --force           - Continuar aunque haya errores');
        console.log('  --dry-run         - Mostrar qué se ejecutaría sin hacerlo');
        console.log('  --to <migration>  - Ejecutar hasta migración específica');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

export default MigrationManager;

if (require.main === module) {
  runMigrationsCLI();
}
