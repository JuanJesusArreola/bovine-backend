import { Options } from 'sequelize';

export const isProduction = process.env.NODE_ENV === 'production';

export function env(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

export function requiredEnv(name: string, aliases: string[] = []): string {
  const names = [name, ...aliases];
  for (const key of names) {
    const value = env(key);
    if (value) return value;
  }
  throw new Error(`Variable de entorno requerida no configurada: ${names.join(' o ')}`);
}

export function productionSecret(name: string, aliases: string[] = [], fallback?: string): string {
  if (isProduction) return requiredEnv(name, aliases);
  return env(name, fallback) || fallback || `${name.toLowerCase()}_dev_secret`;
}

export function parseBooleanEnv(name: string, fallback = false): boolean {
  const value = env(name);
  if (value === undefined) return fallback;
  return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
}

export function buildPostgresConfig(prefix = ''): Partial<Options> {
  const databaseUrl = env(`${prefix}DATABASE_URL`) || env('DATABASE_URL');
  if (databaseUrl) {
    const url = new URL(databaseUrl);
    return {
      host: url.hostname,
      port: Number(url.port || 5432),
      database: url.pathname.replace(/^\//, ''),
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      dialectOptions: {
        ssl: isProduction ? { require: true, rejectUnauthorized: false } : undefined,
      },
    };
  }

  return {
    host: env(`${prefix}DB_HOST`) || env('DB_HOST'),
    port: Number(env(`${prefix}DB_PORT`) || env('DB_PORT') || 5432),
    database: env(`${prefix}DB_NAME`) || env('DB_NAME'),
    username: env(`${prefix}DB_USER`) || env(`${prefix}DB_USERNAME`) || env('DB_USER') || env('DB_USERNAME'),
    password: env(`${prefix}DB_PASSWORD`) || env('DB_PASSWORD'),
  };
}

export function getRedisUrl(): string | undefined {
  return env('REDIS_URL') || env('REDIS_TLS_URL');
}
