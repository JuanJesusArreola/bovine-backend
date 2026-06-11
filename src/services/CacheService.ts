// services/CacheService.ts
// ============================================================================
// CACHE SERVICE — Redis con fallback en memoria
// ============================================================================
// Wrapper unificado de cache para el backend. Intenta Redis primero; si no
// está disponible (no hay env var, no conecta, error) usa Map en memoria.
//
// Comportamiento:
//   - get/set/del son siempre seguros: si Redis falla, no rompen nada.
//   - JSON serialization automática.
//   - TTL en segundos (consistente con la API de Redis).
//   - Keys se prefijan automáticamente con `bovino:` (configurable).
//
// Uso:
//   import { cacheService } from './CacheService';
//   await cacheService.set('bovine:full:123', data, 300);
//   const cached = await cacheService.get<MyType>('bovine:full:123');
//
// Para deshabilitar Redis (forzar memoria), set CACHE_BACKEND=memory.
// ============================================================================

import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const KEY_PREFIX = process.env.REDIS_PREFIX || 'bovino:cache:';
const BACKEND = (process.env.CACHE_BACKEND || 'auto').toLowerCase(); // 'redis' | 'memory' | 'auto'

// ============================================================================
// IN-MEMORY FALLBACK
// ============================================================================

interface MemoryEntry {
  value: string;       // ya serializado a JSON
  expiresAt: number;   // epoch ms
}

class MemoryCache {
  private store = new Map<string, MemoryEntry>();

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  delByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

// ============================================================================
// CACHE SERVICE
// ============================================================================

export class CacheService {
  private readonly context = 'CacheService';
  private redis: RedisClientType | null = null;
  private redisReady = false;
  private connecting = false;
  private readonly memory = new MemoryCache();
  private readonly disabledRedis: boolean;

  constructor() {
    this.disabledRedis = BACKEND === 'memory';
    if (!this.disabledRedis) {
      // Inicializar conexión en background; los reads/writes ya pueden suceder
      // sobre memory mientras Redis se conecta.
      this.connect().catch((err) => {
        logger.warn(
          `Cache: Redis no disponible al arranque, usando memoria`,
          this.context,
          { error: ensureError(err).message }
        );
      });
    }
  }

  // ==========================================================================
  // CONEXIÓN
  // ==========================================================================

  private async connect(): Promise<void> {
    if (this.connecting || this.redisReady) return;
    this.connecting = true;

    try {
      this.redis = createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          reconnectStrategy: (retries) => {
            if (retries > 5) {
              logger.warn(
                `Cache: Redis máximo de reintentos alcanzado, usando memoria`,
                this.context,
                { retries }
              );
              return false;
            }
            return Math.min(retries * 500, 3000);
          },
        },
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD || undefined,
        database: parseInt(process.env.REDIS_DB || '0'),
      }) as RedisClientType;

      this.redis.on('error', (err) => {
        // No lanzar; solo loggear y marcar como no listo.
        if (this.redisReady) {
          logger.warn(
            `Cache: error de Redis, fallback a memoria`,
            this.context,
            { error: err.message }
          );
        }
        this.redisReady = false;
      });

      this.redis.on('ready', () => {
        this.redisReady = true;
        logger.info(`Cache: Redis listo`, this.context);
      });

      this.redis.on('end', () => {
        this.redisReady = false;
      });

      await this.redis.connect();
    } catch (err) {
      this.redisReady = false;
      // Silencioso — los callers usarán memory.
    } finally {
      this.connecting = false;
    }
  }

  // ==========================================================================
  // API PÚBLICA
  // ==========================================================================

  /**
   * Lee un valor del cache. Retorna `null` si no existe o expiró.
   * Falla suave: si Redis truena, intenta memoria; si todo falla, devuelve null.
   */
  async get<T = any>(key: string): Promise<T | null> {
    const fullKey = this.prefixed(key);

    // Intentar Redis si está listo
    if (this.redisReady && this.redis) {
      try {
        const raw = await this.redis.get(fullKey);
        if (raw !== null) return JSON.parse(raw) as T;
      } catch (err) {
        logger.warn(
          `Cache.get: fallo de Redis, intentando memoria`,
          this.context,
          { key: fullKey, error: ensureError(err).message }
        );
      }
    }

    // Fallback memoria
    const mem = this.memory.get(fullKey);
    if (mem === null) return null;
    try {
      return JSON.parse(mem) as T;
    } catch {
      return null;
    }
  }

  /**
   * Escribe en cache. Si Redis está listo escribe en ambos (warm fallback);
   * si no, solo en memoria.
   */
  async set<T = any>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const fullKey = this.prefixed(key);
    const serialized = JSON.stringify(value);

    // Memoria primero (siempre, como warm fallback ante caída de Redis)
    this.memory.set(fullKey, serialized, ttlSeconds);

    // Redis si disponible
    if (this.redisReady && this.redis) {
      try {
        await this.redis.set(fullKey, serialized, { EX: ttlSeconds });
      } catch (err) {
        logger.warn(
          `Cache.set: fallo de Redis (memoria persistió)`,
          this.context,
          { key: fullKey, error: ensureError(err).message }
        );
      }
    }
  }

  /**
   * Borra una clave del cache. Limpia ambos backends.
   */
  async del(key: string): Promise<void> {
    const fullKey = this.prefixed(key);

    this.memory.del(fullKey);

    if (this.redisReady && this.redis) {
      try {
        await this.redis.del(fullKey);
      } catch (err) {
        logger.warn(
          `Cache.del: fallo de Redis`,
          this.context,
          { key: fullKey, error: ensureError(err).message }
        );
      }
    }
  }

  /**
   * Borra todas las claves que empiecen con un prefijo. Útil para invalidar
   * grupos (ej. todas las del bovino X).
   *
   * Redis: usa SCAN + DEL en batches.
   * Memoria: itera el Map.
   */
  async delByPrefix(prefix: string): Promise<void> {
    const fullPrefix = this.prefixed(prefix);

    this.memory.delByPrefix(fullPrefix);

    if (this.redisReady && this.redis) {
      try {
        // SCAN para evitar bloquear el server con KEYS *
        const iter = this.redis.scanIterator({ MATCH: `${fullPrefix}*`, COUNT: 100 });
        const toDelete: string[] = [];
        for await (const key of iter as any) {
          toDelete.push(key as string);
          if (toDelete.length >= 100) {
            await this.redis.del(toDelete.splice(0, toDelete.length));
          }
        }
        if (toDelete.length > 0) {
          await this.redis.del(toDelete);
        }
      } catch (err) {
        logger.warn(
          `Cache.delByPrefix: fallo de Redis`,
          this.context,
          { prefix: fullPrefix, error: ensureError(err).message }
        );
      }
    }
  }

  /**
   * Estado actual del backend. Útil para health checks.
   */
  status(): { redisReady: boolean; memoryEntries: number; backend: string } {
    return {
      redisReady: this.redisReady,
      memoryEntries: this.memory.size(),
      backend: BACKEND,
    };
  }

  /**
   * Cierre limpio (llamar en shutdown del servidor).
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        // ignore
      }
    }
    this.redisReady = false;
  }

  // ==========================================================================
  // INTERNOS
  // ==========================================================================

  private prefixed(key: string): string {
    return key.startsWith(KEY_PREFIX) ? key : KEY_PREFIX + key;
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const cacheService = new CacheService();
