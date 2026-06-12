// config/redis.ts
import { env, getRedisUrl as getConfiguredRedisUrl } from './env';

/**
 * Configuración de Redis para el sistema de colas
 * Soporta diferentes entornos (desarrollo, prueba, producción)
 */

interface RedisConfig {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
    keyPrefix?: string;
    tls?: boolean;
    retryStrategy?: (times: number) => number | false;
}

function parseRedisUrl(url?: string): Partial<RedisConfig> {
    if (!url) return {};
    const parsed = new URL(url);
    return {
        host: parsed.hostname,
        port: parseInt(parsed.port || '6379'),
        username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        db: parsed.pathname && parsed.pathname !== '/' ? parseInt(parsed.pathname.slice(1)) : undefined,
        tls: parsed.protocol === 'rediss:',
    };
}

const redisUrlConfig = parseRedisUrl(getConfiguredRedisUrl());

// Configuración base
const baseConfig: RedisConfig = {
    host: env('REDIS_HOST', 'localhost')!,
    port: parseInt(env('REDIS_PORT', '6379')!),
    username: env('REDIS_USERNAME'),
    password: env('REDIS_PASSWORD'),
    db: parseInt(env('REDIS_DB', '0')!),
    keyPrefix: env('REDIS_PREFIX', 'ganadero:')!,
    retryStrategy: (times: number) => {
        // Estrategia de reintento: esperar más cada vez
        if (times > 10) {
            console.error('Redis: Demasiados reintentos, deteniendo...');
            return false; // Detener reintentos
        }
        // Esperar: 2s, 4s, 8s, 16s, 32s, etc.
        return Math.min(times * 2000, 60000);
    }
};

// Configuración específica por entorno
const envConfigs: Record<string, Partial<RedisConfig>> = {
    development: {
        // En desarrollo, usamos valores por defecto
        host: 'localhost',
        port: 6379,
        // No password en desarrollo local
    },
    test: {
        // Para pruebas, podemos usar una DB diferente
        host: 'localhost',
        port: 6379,
        db: 1, // DB separada para no interferir con desarrollo
    },
    staging: {
        // En staging, podría tener password
        host: env('REDIS_HOST', 'redis-staging.ganadero-ujat.com')!,
        port: parseInt(env('REDIS_PORT', '6379')!),
        username: env('REDIS_USERNAME'),
        password: env('REDIS_PASSWORD'),
        tls: true, // Staging usualmente requiere TLS
    },
    production: {
        // En producción, configuración robusta
        host: env('REDIS_HOST', redisUrlConfig.host)!,
        port: parseInt(env('REDIS_PORT', redisUrlConfig.port?.toString() || '6379')!),
        username: env('REDIS_USERNAME', redisUrlConfig.username),
        password: env('REDIS_PASSWORD', redisUrlConfig.password),
        db: parseInt(env('REDIS_DB', redisUrlConfig.db?.toString() || '0')!),
        tls: true, // Siempre TLS en producción
        retryStrategy: (times: number) => {
            // En producción, reintentar más veces
            if (times > 20) {
                console.error('Redis producción: Fallo crítico de conexión');
                return false;
            }
            return Math.min(times * 1000, 30000);
        }
    }
};

// Determinar entorno actual
const environment = process.env.NODE_ENV || 'development';

// Combinar configuraciones
const redisConfig: RedisConfig = {
    ...baseConfig,
    ...(envConfigs[environment] || envConfigs.development),
    ...redisUrlConfig,
};

// Validar configuración requerida en producción
if (environment === 'production' && !redisConfig.host) {
    throw new Error('REDIS_URL o REDIS_HOST es requerido en producción');
}

// Exportar configuración
export default redisConfig;

// También exportar objetos útiles para el queue service
export const queueNames = {
    email: 'email-queue',
    notification: 'notification-queue',
    report: 'report-queue',
    backup: 'backup-queue'
} as const;

export type QueueName = keyof typeof queueNames;

// Configuración específica para Bull (nuestro queue service)
export const bullConfig = {
    redis: redisConfig,
    defaultJobOptions: {
        attempts: 3, // Intentar 3 veces por defecto
        backoff: {
            type: 'exponential',
            delay: 5000 // 5 segundos iniciales
        },
        removeOnComplete: 100, // Mantener últimos 100 completados
        removeOnFail: 500, // Mantener últimos 500 fallidos
        timeout: 30000 // 30 segundos timeout por job
    },
    settings: {
        lockDuration: 30000, // 30 segundos de lock
        stalledInterval: 30000, // Verificar jobs stalled cada 30s
        maxStalledCount: 2 // Máximo 2 reintentos por stalled
    }
};

// Función helper para obtener URL de Redis (útil para debugging)
export function getRedisUrl(): string {
    const { host, port, password } = redisConfig;
    if (password) {
        return `redis://:${password}@${host}:${port}`;
    }
    return `redis://${host}:${port}`;
}
