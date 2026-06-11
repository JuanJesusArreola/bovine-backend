// ============================================================================
// CONFIGURACIÓN POR AMBIENTES - SISTEMA PROFESIONAL
// ============================================================================

import { Options } from 'sequelize';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export type Environment = 'development' | 'test' | 'staging' | 'production';

export interface EnvironmentConfig {
  database: Options;
  server: {
    port: number;
    host: string;
    cors: {
      origin: string[];
      credentials: boolean;
    };
  };
  security: {
    jwt: {
      secret: string;
      refreshSecret: string;
      expiresIn: string;
      refreshExpiresIn: string;
    };
    bcrypt: {
      saltRounds: number;
    };
    rateLimit: {
      windowMs: number;
      max: number;
    };
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    enableConsole: boolean;
    enableFile: boolean;
    filePath?: string;
  };
  features: {
    enableSwagger: boolean;
    enableMetrics: boolean;
    enableBackup: boolean;
    enableMigrations: boolean;
  };
  backup: {
    enabled: boolean;
    schedule: string;
    retentionDays: number;
    storagePath: string;
  };
}

// ============================================================================
// CONFIGURACIÓN BASE
// ============================================================================

const baseDatabaseConfig: Partial<Options> = {
  dialect: 'postgres',
  timezone: '-06:00', // Zona horaria de México
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  },
  logging: false
};

// ============================================================================
// CONFIGURACIONES POR AMBIENTE
// ============================================================================

const environments: Record<Environment, EnvironmentConfig> = {
  // =============================================
  // DESARROLLO
  // =============================================
  development: {
    database: {
      ...baseDatabaseConfig,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'cattle_management_dev',
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      logging: console.log, // Mostrar SQL en desarrollo
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    } as Options,
    server: {
      port: parseInt(process.env.PORT || '3001'),
      host: process.env.HOST || 'localhost',
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:5173'],
        credentials: true
      }
    },
    security: {
      jwt: {
        secret: process.env.JWT_SECRET || 'dev_secret_key_change_in_production',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_key',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
      },
      bcrypt: {
        saltRounds: 10
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 100 // 100 requests por ventana
      }
    },
    logging: {
      level: 'debug',
      enableConsole: true,
      enableFile: false
    },
    features: {
      enableSwagger: true,
      enableMetrics: true,
      enableBackup: false,
      enableMigrations: true
    },
    backup: {
      enabled: false,
      schedule: '0 2 * * *', // 2 AM diario
      retentionDays: 7,
      storagePath: './backups'
    }
  },

  // =============================================
  // PRUEBAS
  // =============================================
  test: {
    database: {
      ...baseDatabaseConfig,
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME || 'cattle_management_test',
      username: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'password',
      logging: false, // Sin logging en pruebas
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    } as Options,
    server: {
      port: parseInt(process.env.TEST_PORT || '3002'),
      host: 'localhost',
      cors: {
        origin: ['http://localhost:3000'],
        credentials: true
      }
    },
    security: {
      jwt: {
        secret: 'test_secret_key',
        refreshSecret: 'test_refresh_secret_key',
        expiresIn: '1h',
        refreshExpiresIn: '24h'
      },
      bcrypt: {
        saltRounds: 4 // Menos rounds para pruebas más rápidas
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 1000 // Más requests para pruebas
      }
    },
    logging: {
      level: 'error',
      enableConsole: false,
      enableFile: false
    },
    features: {
      enableSwagger: false,
      enableMetrics: false,
      enableBackup: false,
      enableMigrations: true
    },
    backup: {
      enabled: false,
      schedule: '0 2 * * *',
      retentionDays: 1,
      storagePath: './test-backups'
    }
  },

  // =============================================
  // STAGING (PRE-PRODUCCIÓN)
  // =============================================
  staging: {
    database: {
      ...baseDatabaseConfig,
      host: process.env.STAGING_DB_HOST || 'localhost',
      port: parseInt(process.env.STAGING_DB_PORT || '5432'),
      database: process.env.STAGING_DB_NAME || 'cattle_management_staging',
      username: process.env.STAGING_DB_USER || 'postgres',
      password: process.env.STAGING_DB_PASSWORD || '',
      logging: false,
      pool: {
        max: 10,
        min: 2,
        acquire: 60000,
        idle: 300000
      },
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    } as Options,
    server: {
      port: parseInt(process.env.STAGING_PORT || '3001'),
      host: process.env.STAGING_HOST || '0.0.0.0',
      cors: {
        origin: process.env.STAGING_CORS_ORIGINS?.split(',') || ['https://staging.ganaderia.mx'],
        credentials: true
      }
    },
    security: {
      jwt: {
        secret: process.env.STAGING_JWT_SECRET || '',
        refreshSecret: process.env.STAGING_JWT_REFRESH_SECRET || '',
        expiresIn: process.env.STAGING_JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.STAGING_JWT_REFRESH_EXPIRES_IN || '7d'
      },
      bcrypt: {
        saltRounds: 12
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 200
      }
    },
    logging: {
      level: 'info',
      enableConsole: true,
      enableFile: true,
      filePath: './logs/staging.log'
    },
    features: {
      enableSwagger: true,
      enableMetrics: true,
      enableBackup: true,
      enableMigrations: true
    },
    backup: {
      enabled: true,
      schedule: '0 2 * * *',
      retentionDays: 14,
      storagePath: './backups/staging'
    }
  },

  // =============================================
  // PRODUCCIÓN
  // =============================================
  production: {
    database: {
      ...baseDatabaseConfig,
      host: process.env.PROD_DB_HOST || '',
      port: parseInt(process.env.PROD_DB_PORT || '5432'),
      database: process.env.PROD_DB_NAME || '',
      username: process.env.PROD_DB_USER || '',
      password: process.env.PROD_DB_PASSWORD || '',
      logging: false,
      pool: {
        max: 20,
        min: 5,
        acquire: 60000,
        idle: 300000
      },
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    } as Options,
    server: {
      port: parseInt(process.env.PORT || '3001'),
      host: process.env.HOST || '0.0.0.0',
      cors: {
        origin: process.env.PROD_CORS_ORIGINS?.split(',') || ['https://ganaderia.mx'],
        credentials: true
      }
    },
    security: {
      jwt: {
        secret: process.env.PROD_JWT_SECRET || '',
        refreshSecret: process.env.PROD_JWT_REFRESH_SECRET || '',
        expiresIn: process.env.PROD_JWT_EXPIRES_IN || '1h',
        refreshExpiresIn: process.env.PROD_JWT_REFRESH_EXPIRES_IN || '7d'
      },
      bcrypt: {
        saltRounds: 12
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 100
      }
    },
    logging: {
      level: 'warn',
      enableConsole: false,
      enableFile: true,
      filePath: './logs/production.log'
    },
    features: {
      enableSwagger: false,
      enableMetrics: true,
      enableBackup: true,
      enableMigrations: false // Solo migraciones manuales en producción
    },
    backup: {
      enabled: true,
      schedule: '0 2 * * *',
      retentionDays: 30,
      storagePath: './backups/production'
    }
  }
};

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

/**
 * Obtiene la configuración del ambiente actual
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const env = (process.env.NODE_ENV as Environment) || 'development';
  
  if (!environments[env]) {
    throw new Error(`❌ Ambiente no válido: ${env}. Ambientes disponibles: ${Object.keys(environments).join(', ')}`);
  }

  return environments[env];
}

/**
 * Valida que todas las variables de entorno requeridas estén presentes
 */
export function validateEnvironmentVariables(): { isValid: boolean; missing: string[] } {
  const config = getEnvironmentConfig();
  const missing: string[] = [];

  // Validar variables de base de datos
  if (!config.database.host) missing.push('DB_HOST');
  if (!config.database.database) missing.push('DB_NAME');
  if (!config.database.username) missing.push('DB_USERNAME');
  if (!config.database.password) missing.push('DB_PASSWORD');

  // Validar variables de seguridad
  if (!config.security.jwt.secret) missing.push('JWT_SECRET');
  if (!config.security.jwt.refreshSecret) missing.push('JWT_REFRESH_SECRET');

  return {
    isValid: missing.length === 0,
    missing
  };
}

/**
 * Obtiene información del ambiente actual
 */
export function getEnvironmentInfo() {
  const env = (process.env.NODE_ENV as Environment) || 'development';
  const config = getEnvironmentConfig();
  
  return {
    environment: env,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    database: {
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      username: config.database.username
    },
    server: {
      port: config.server.port,
      host: config.server.host
    },
    features: config.features
  };
}

// ============================================================================
// EXPORTACIONES
// ============================================================================

export { environments };
export default getEnvironmentConfig;
