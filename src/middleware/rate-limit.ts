import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';
import { createClient, RedisClientType } from 'redis';
import { logMessage, LogLevel } from './logging';

// Interface para configuración de límites
interface RateLimitConfig {
  windowMs: number;       // Duración de la ventana en milisegundos
  maxRequests: number;    // Máximo de requests permitidos en la ventana
}

/**
 * Resultado de verificar el límite para una clave.
 * Contiene toda la información necesaria para los headers HTTP
 * y para decidir si permitir o rechazar el request.
 */
interface RateLimitResult {
  allowed: boolean;       // ¿Puede pasar el request?
  totalHits: number;      // Cuántos requests ha hecho en esta ventana
  remaining: number;      // Cuántos le quedan antes del límite
  resetTime: number;      // Timestamp (ms) cuando se resetea el contador
}

// Interface para almacenar datos de rate limiting
interface RateLimitData {
  count: number;
  resetTime: number;
  firstRequest: number;
}

// Tipos de endpoints con diferentes límites
export enum EndpointType {
  AUTH = 'auth',              // Autenticación
  CATTLE_READ = 'cattle_read', // Lectura de ganado
  CATTLE_WRITE = 'cattle_write', // Escritura de ganado
  HEALTH = 'health',          // Operaciones de salud
  VACCINATION = 'vaccination', // Vacunaciones
  REPORTS = 'reports',        // Generación de reportes
  MAPS = 'maps',             // Geolocalización
  FILES = 'files',           // Carga de archivos
  BULK_OPERATIONS = 'bulk',   // Operaciones masivas
  EXTERNAL_API = 'external'   // APIs externas
}

// Configuraciones de límites por tipo de endpoint y rol
const RATE_LIMIT_CONFIGS: Record<EndpointType, Record<UserRole, RateLimitConfig>> = {
  [EndpointType.AUTH]: {
    [UserRole.VIEWER]: { windowMs: 15 * 60 * 1000, maxRequests: 10 },      // 10 intentos/15min
    [UserRole.WORKER]: { windowMs: 15 * 60 * 1000, maxRequests: 15 },      // 15 intentos/15min
    [UserRole.VETERINARIAN]: { windowMs: 15 * 60 * 1000, maxRequests: 20 }, // 20 intentos/15min
    [UserRole.MANAGER]: { windowMs: 15 * 60 * 1000, maxRequests: 25 },     // 25 intentos/15min
    [UserRole.SUPER_ADMIN]: { windowMs: 15 * 60 * 1000, maxRequests: 50 },       // 50 intentos/15min
    [UserRole.OWNER]: { windowMs: 15 * 60 * 1000, maxRequests: 100 },       // 100 intentos/15min,
    [UserRole.RANCH_MANAGER]: { windowMs: 60000, maxRequests: 45 },
  },
  [EndpointType.CATTLE_READ]: {
    [UserRole.VIEWER]: { windowMs: 60 * 1000, maxRequests: 30 },           // 30 req/min
    [UserRole.WORKER]: { windowMs: 60 * 1000, maxRequests: 60 },           // 60 req/min
    [UserRole.VETERINARIAN]: { windowMs: 60 * 1000, maxRequests: 100 },    // 100 req/min
    [UserRole.MANAGER]: { windowMs: 60 * 1000, maxRequests: 150 },         // 150 req/min
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 1000, maxRequests: 300 },           // 300 req/min
    [UserRole.OWNER]: { windowMs: 60 * 1000, maxRequests: 500 },            // 500 req/min
    [UserRole.RANCH_MANAGER]: { windowMs: 60 * 1000, maxRequests: 200 },
  },
  [EndpointType.CATTLE_WRITE]: {
    [UserRole.VIEWER]: { windowMs: 60 * 1000, maxRequests: 0 },            // Sin acceso
    [UserRole.WORKER]: { windowMs: 60 * 1000, maxRequests: 20 },           // 20 req/min
    [UserRole.VETERINARIAN]: { windowMs: 60 * 1000, maxRequests: 40 },     // 40 req/min
    [UserRole.MANAGER]: { windowMs: 60 * 1000, maxRequests: 80 },          // 80 req/min
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 1000, maxRequests: 150 },           // 150 req/min
    [UserRole.OWNER]: { windowMs: 60 * 1000, maxRequests: 300 },            // 300 req/min
    [UserRole.RANCH_MANAGER]: { windowMs: 60 * 1000, maxRequests: 100 },
  },
  [EndpointType.HEALTH]: {
    [UserRole.VIEWER]: { windowMs: 60 * 1000, maxRequests: 10 },           // 10 req/min
    [UserRole.WORKER]: { windowMs: 60 * 1000, maxRequests: 15 },           // 15 req/min
    [UserRole.VETERINARIAN]: { windowMs: 60 * 1000, maxRequests: 60 },     // 60 req/min (prioritario)
    [UserRole.MANAGER]: { windowMs: 60 * 1000, maxRequests: 40 },          // 40 req/min
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 1000, maxRequests: 80 },            // 80 req/min
    [UserRole.OWNER]: { windowMs: 60 * 1000, maxRequests: 120 },            // 120 req/min
    [UserRole.RANCH_MANAGER]: { windowMs: 60 * 1000, maxRequests: 60 },
  },
  [EndpointType.VACCINATION]: {
    [UserRole.VIEWER]: { windowMs: 60 * 1000, maxRequests: 5 },            // 5 req/min
    [UserRole.WORKER]: { windowMs: 60 * 1000, maxRequests: 20 },           // 20 req/min
    [UserRole.VETERINARIAN]: { windowMs: 60 * 1000, maxRequests: 50 },     // 50 req/min (prioritario)
    [UserRole.MANAGER]: { windowMs: 60 * 1000, maxRequests: 30 },          // 30 req/min
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 1000, maxRequests: 60 },            // 60 req/min
    [UserRole.OWNER]: { windowMs: 60 * 1000, maxRequests: 100 },            // 100 req/min
    [UserRole.RANCH_MANAGER]: { windowMs: 60 * 1000, maxRequests: 50 },
  },
  [EndpointType.REPORTS]: {
    [UserRole.VIEWER]: { windowMs: 60 * 60 * 1000, maxRequests: 5 },       // 5 reportes/hora
    [UserRole.WORKER]: { windowMs: 60 * 60 * 1000, maxRequests: 10 },      // 10 reportes/hora
    [UserRole.VETERINARIAN]: { windowMs: 60 * 60 * 1000, maxRequests: 20 }, // 20 reportes/hora
    [UserRole.MANAGER]: { windowMs: 60 * 60 * 1000, maxRequests: 50 },     // 50 reportes/hora
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 60 * 1000, maxRequests: 100 },      // 100 reportes/hora
    [UserRole.OWNER]: { windowMs: 60 * 60 * 1000, maxRequests: 200 },       // 200 reportes/hora
    [UserRole.RANCH_MANAGER]: { windowMs: 60 * 60 * 1000, maxRequests: 60 },
  },
  [EndpointType.MAPS]: {
    [UserRole.VIEWER]: { windowMs: 60 * 1000, maxRequests: 20 },           // 20 req/min
    [UserRole.WORKER]: { windowMs: 60 * 1000, maxRequests: 40 },           // 40 req/min
    [UserRole.VETERINARIAN]: { windowMs: 60 * 1000, maxRequests: 80 },     // 80 req/min
    [UserRole.MANAGER]: { windowMs: 60 * 1000, maxRequests: 100 },         // 100 req/min
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 1000, maxRequests: 150 },           // 150 req/min
    [UserRole.OWNER]: { windowMs: 60 * 1000, maxRequests: 200 },            // 200 req/min
    [UserRole.RANCH_MANAGER]: { windowMs: 60 * 1000, maxRequests: 100 }
  },
  [EndpointType.FILES]: {
    [UserRole.VIEWER]: { windowMs: 60 * 60 * 1000, maxRequests: 2 },       // 2 uploads/hora
    [UserRole.WORKER]: { windowMs: 60 * 60 * 1000, maxRequests: 10 },      // 10 uploads/hora
    [UserRole.VETERINARIAN]: { windowMs: 60 * 60 * 1000, maxRequests: 25 }, // 25 uploads/hora
    [UserRole.MANAGER]: { windowMs: 60 * 60 * 1000, maxRequests: 50 },     // 50 uploads/hora
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 60 * 1000, maxRequests: 100 },      // 100 uploads/hora
    [UserRole.OWNER]: { windowMs: 60 * 60 * 1000, maxRequests: 200 },       // 200 uploads/hora
    [UserRole.RANCH_MANAGER]: { windowMs: 60 * 60 * 1000, maxRequests: 50 }
  },
  [EndpointType.BULK_OPERATIONS]: {
    [UserRole.VIEWER]: { windowMs: 60 * 60 * 1000, maxRequests: 0 },       // Sin acceso
    [UserRole.WORKER]: { windowMs: 60 * 60 * 1000, maxRequests: 2 },       // 2 operaciones/hora
    [UserRole.VETERINARIAN]: { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 operaciones/hora
    [UserRole.MANAGER]: { windowMs: 60 * 60 * 1000, maxRequests: 10 },     // 10 operaciones/hora
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 60 * 1000, maxRequests: 20 },       // 20 operaciones/hora
    [UserRole.OWNER]: { windowMs: 60 * 60 * 1000, maxRequests: 50 },        // 50 operaciones/hora
    [UserRole.RANCH_MANAGER]: { windowMs: 60 * 60 * 1000, maxRequests: 10 }
  },
  [EndpointType.EXTERNAL_API]: {
    [UserRole.VIEWER]: { windowMs: 60 * 1000, maxRequests: 5 },            // 5 req/min
    [UserRole.WORKER]: { windowMs: 60 * 1000, maxRequests: 10 },           // 10 req/min
    [UserRole.VETERINARIAN]: { windowMs: 60 * 1000, maxRequests: 15 },     // 15 req/min
    [UserRole.MANAGER]: { windowMs: 60 * 1000, maxRequests: 25 },          // 25 req/min
    [UserRole.SUPER_ADMIN]: { windowMs: 60 * 1000, maxRequests: 50 },            // 50 req/min
    [UserRole.OWNER]: { windowMs: 60 * 1000, maxRequests: 100 },            // 100 req/min
    [UserRole.RANCH_MANAGER]: { windowMs: 60 * 1000, maxRequests: 25 }
  }
};

// Almacén en memoria para rate limiting (en producción usar Redis)
//const rateLimitStore = new Map<string, RateLimitData>();

// Límites especiales por IP para requests sin autenticación
const IP_RATE_LIMITS = {
  windowMs: 15 * 60 * 1000,   // 15 minutos
  maxRequests: 100            // 100 requests por IP
};

// ============================================================================
// STORE EN MEMORIA — FALLBACK CUANDO REDIS NO ESTÁ DISPONIBLE
// ============================================================================

/**
 * ¿Por qué mantener el store en memoria como fallback?
 *
 * Redis puede no estar disponible por:
 *   - Primera ejecución en desarrollo (Redis no instalado)
 *   - Corte temporal de red hacia el servidor Redis
 *   - Redis reiniciándose tras un crash
 *
 * Sin fallback, TODOS los requests fallarían con un 500 si Redis cae.
 * Con fallback, el rate limiting sigue funcionando (aunque sin persistencia)
 * hasta que Redis se recupere. El sistema degrada de forma controlada.
 */
interface MemoryRateLimitData {
  count: number;
  resetTime: number;
}

const memoryFallbackStore = new Map<string, MemoryRateLimitData>();

// Limpiar entradas expiradas del fallback cada 5 minutos
// (Redis hace esto automáticamente con TTL, en memoria lo hacemos manual)
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of memoryFallbackStore.entries()) {
    if (now > data.resetTime) {
      memoryFallbackStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Clase principal para manejo de rate limiting
 */
class RedisRateLimitStore {
  private static instance: RedisRateLimitStore;
  private client: RedisClientType | null = null;
  private isConnected = false;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_DELAY_MS = 5000;

  private constructor() { }

  public static getInstance(): RedisRateLimitStore {
    if (!RedisRateLimitStore.instance) {
      RedisRateLimitStore.instance = new RedisRateLimitStore();
    }
    return RedisRateLimitStore.instance;
  }
  public async connect(): Promise<void> {
    // Evitar múltiples conexiones simultáneas
    if (this.isConnected || this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.client = createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),

          /**
           * reconnectStrategy: función que decide cuánto esperar
           * antes de cada intento de reconexión.
           *
           * ¿Por qué retries * 500 con máximo 3000ms?
           * Exponential backoff ligero: no martillar Redis cada 100ms
           * pero tampoco esperar 30 segundos para reconectar.
           * Intento 1: 500ms, Intento 2: 1000ms, ... máximo 3000ms.
           * false = dejar de reintentar (después de MAX_RECONNECT_ATTEMPTS)
           */
          reconnectStrategy: (retries) => {
            if (retries > this.MAX_RECONNECT_ATTEMPTS) {
              logMessage(
                LogLevel.ERROR,
                'redis_reconnect_failed',
                `Redis: máximo de reconexiones alcanzado (${retries}). Usando fallback en memoria.`,
                { retries, host: process.env.REDIS_HOST }
              );
              return false; // Dejar de reintentar
            }
            const delay = Math.min(retries * 500, 3000);
            logMessage(
              LogLevel.WARN,
              'redis_reconnecting',
              `Redis: reintentando conexión en ${delay}ms (intento ${retries})`,
              { retries, delay }
            );
            return delay;
          }
        },

        // Prefijo para todas las claves de rate limiting
        // ¿Por qué un prefijo? Evita colisiones con otras claves de Redis
        // que usa Bull, sesiones, caché, etc. en el mismo servidor Redis.
        // ganadero:rl:user:abc123:auth  →  claramente es rate limiting
        // abc123:auth                  →  ambiguo, podría colisionar
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD || undefined,
        database: parseInt(process.env.REDIS_DB || '0'),
      }) as RedisClientType;
      this.client.on('connect', () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        logMessage(
          LogLevel.INFO,
          'redis_connected',
          'Rate limiter: conectado a Redis correctamente',
          { host: process.env.REDIS_HOST, db: process.env.REDIS_DB }
        );
      });

      this.client.on('error', (error) => {
        /**
         * ¿Por qué no lanzar el error aquí?
         * Este callback se dispara en cualquier momento, no dentro de
         * un try/catch. Lanzar aquí crashearía el proceso si no hay
         * un uncaughtException handler. Mejor loguear y dejar que
         * reconnectStrategy maneje la reconexión.
         */
        this.isConnected = false;
        logMessage(
          LogLevel.ERROR,
          'redis_error',
          `Rate limiter: error de Redis → usando fallback en memoria`,
          { error: error.message }
        );
      });

      this.client.on('reconnecting', () => {
        this.isConnected = false;
        this.reconnectAttempts++;
        logMessage(
          LogLevel.WARN,
          'redis_reconnecting',
          `Rate limiter: reconectando a Redis... (intento ${this.reconnectAttempts})`,
          {}
        );
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        logMessage(
          LogLevel.INFO,
          'redis_ready',
          'Rate limiter: Redis listo para recibir comandos',
          {}
        );
      });

      await this.client.connect();

    } catch (error) {
      this.isConnected = false;
      this.isConnecting = false;
      logMessage(
        LogLevel.WARN,
        'redis_connect_failed',
        'Rate limiter: no se pudo conectar a Redis. Usando fallback en memoria.',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
     * checkLimit — El corazón del rate limiter.
     *
     * Primero intenta con Redis. Si Redis no está disponible, usa el
     * store en memoria como respaldo.
     *
     * @param key      - Clave única del usuario/IP + endpoint
     * @param config   - windowMs y maxRequests para esta combinación
     */
  public async checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    // Prefijo para separar claves de rate limiting de otras claves Redis
    const redisKey = `ganadero:rl:${key}`;

    if (this.isConnected && this.client) {
      return this.checkLimitRedis(redisKey, config);
    }

    // Redis no disponible → usar fallback en memoria
    logMessage(
      LogLevel.WARN,
      'redis_fallback_used',
      'Rate limiter: usando fallback en memoria (Redis no disponible)',
      { key }
    );
    return this.checkLimitMemory(key, config);
  }

  /**
   * checkLimitRedis — Implementación con Redis usando operaciones atómicas.
   *
   * ¿QUÉ SON OPERACIONES ATÓMICAS Y POR QUÉ IMPORTAN?
   * ─────────────────────────────────────────────────────
   * "Atómico" = ocurre todo junto o no ocurre nada. No hay estado intermedio.
   *
   * SIN atomicidad (el problema):
   *   Instancia A lee contador = 99
   *   Instancia B lee contador = 99     ← mismo valor, ambas ven 99
   *   Instancia A escribe 100           ← A dice "permitido, límite es 100"
   *   Instancia B escribe 100           ← B dice "permitido, límite es 100"
   *   Real: se hicieron 101 requests, ambas dijeron que estaba bien (RACE CONDITION)
   *
   * CON atomicidad (INCR de Redis):
   *   INCR es una operación única e indivisible en Redis.
   *   Redis procesa comandos en un solo hilo → no hay race conditions.
   *   Instancia A ejecuta INCR → Redis retorna 100
   *   Instancia B ejecuta INCR → Redis retorna 101
   *   Instancia B recibe 101 > 100 → rechazada ✅
   *
   * ¿POR QUÉ INCR + EXPIRE Y NO SET?
   *   SET cada vez sobrescribiría el contador (siempre volvería a 1).
   *   INCR incrementa el valor existente, o lo crea en 1 si no existe.
   *   EXPIRE solo se llama cuando INCR crea la clave (resultado === 1)
   *   para establecer el TTL de la ventana. Si ya existe, no tocamos el TTL.
   *
   * ¿POR QUÉ NO USAR MULTI/EXEC (TRANSACCIONES DE REDIS)?
   *   INCR ya es atómico por sí solo. No necesitamos transacciones.
   *   MULTI/EXEC añadiría complejidad sin beneficio aquí.
   */
  private async checkLimitRedis(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    try {
      // INCR: incrementa el contador. Si la clave no existe, la crea con valor 1.
      // Retorna el valor DESPUÉS del incremento (ya con el request actual contado).
      const currentCount = await this.client!.incr(key);

      // Solo establecer el TTL cuando se CREA la clave (primera request de la ventana)
      // ¿Por qué solo en currentCount === 1?
      // Si lo hiciéramos cada vez, reiniciaríamos el TTL en cada request y
      // la ventana nunca expiraría mientras haya tráfico continuo.
      if (currentCount === 1) {
        // PEXPIRE: establece TTL en milisegundos (más preciso que EXPIRE en segundos)
        // Cuando el TTL llega a 0, Redis elimina la clave automáticamente.
        // El siguiente request creará una nueva clave → nueva ventana limpia.
        await this.client!.pExpire(key, config.windowMs);
      }

      // Obtener el TTL restante para calcular cuándo se resetea la ventana
      // PTTL retorna milisegundos restantes (-1 si no tiene TTL, -2 si no existe)
      const ttlMs = await this.client!.pTTL(key);
      const resetTime = ttlMs > 0
        ? Date.now() + ttlMs
        : Date.now() + config.windowMs;

      const allowed = currentCount <= config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - currentCount);

      return { allowed, totalHits: currentCount, remaining, resetTime };

    } catch (error) {
      // Error inesperado en Redis (timeout, OOM, etc.)
      // Caer al fallback en memoria para no bloquear el request
      logMessage(
        LogLevel.ERROR,
        'redis_check_error',
        'Error ejecutando INCR en Redis, usando fallback',
        { key, error: error instanceof Error ? error.message : String(error) }
      );
      return this.checkLimitMemory(key, config);
    }
  }

  /**
   * checkLimitMemory — Fallback en memoria cuando Redis no está disponible.
   *
   * Misma lógica que el store original, pero ahora es el plan B,
   * no el plan A. Funciona con Map() en el proceso actual.
   *
   * Limitación conocida: no es compartido entre instancias.
   * Pero si Redis cayó, al menos cada instancia protege a los usuarios
   * contra sus propios abusos.
   */
  private checkLimitMemory(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const data = memoryFallbackStore.get(key);

    if (!data || now > data.resetTime) {
      // Primera request en la ventana (o ventana expirada)
      const resetTime = now + config.windowMs;
      memoryFallbackStore.set(key, { count: 1, resetTime });
      return {
        allowed: true,
        totalHits: 1,
        remaining: config.maxRequests - 1,
        resetTime
      };
    }

    data.count++;
    memoryFallbackStore.set(key, data);

    return {
      allowed: data.count <= config.maxRequests,
      totalHits: data.count,
      remaining: Math.max(0, config.maxRequests - data.count),
      resetTime: data.resetTime
    };
  }

  /**
   * resetKey — Eliminar el contador de un usuario (para admin o tests).
   * DEL en Redis elimina la clave inmediatamente.
   */
  public async resetKey(key: string): Promise<void> {
    const redisKey = `ganadero:rl:${key}`;

    if (this.isConnected && this.client) {
      await this.client.del(redisKey);
    } else {
      memoryFallbackStore.delete(key);
    }
  }

  /**
   * getStats — Estadísticas del rate limiter para el endpoint de admin.
   *
   * ¿Por qué SCAN y no KEYS?
   * KEYS bloquea Redis mientras busca → en producción con miles de claves
   * puede congelar Redis varios segundos. SCAN itera en pequeños lotes
   * sin bloquear otros comandos. Es la forma correcta de buscar claves.
   */
  public async getStats(): Promise<{
    backend: 'redis' | 'memory';
    totalKeys: number;
    topConsumers: Array<{ key: string; hits: number }>;
  }> {
    if (!this.isConnected || !this.client) {
      const activeEntries = Array.from(memoryFallbackStore.entries())
        .filter(([, d]) => Date.now() <= d.resetTime);
      return {
        backend: 'memory',
        totalKeys: activeEntries.length,
        topConsumers: activeEntries
          .map(([key, data]) => ({ key, hits: data.count }))
          .sort((a, b) => b.hits - a.hits)
          .slice(0, 10)
      };
    }

    try {
      // SCAN con patrón: solo las claves de rate limiting
      const keys: string[] = [];
      for await (const batch of this.client.scanIterator({ MATCH: '...', COUNT: 100 })) {
        const items: string[] = Array.isArray(batch) ? batch : [batch as string];
        keys.push(...items);
      }

      // Obtener valores de las top 10 (evitar pipeline muy grande)
      const topKeys = keys.slice(0, 10);
      const topConsumers: Array<{ key: string; hits: number }> = [];

      for (const key of topKeys) {
        const value = await this.client.get(key);
        if (value) {
          topConsumers.push({
            key: key.replace('ganadero:rl:', ''),
            hits: parseInt(value)
          });
        }
      }

      return {
        backend: 'redis',
        totalKeys: keys.length,
        topConsumers: topConsumers.sort((a, b) => b.hits - a.hits)
      };

    } catch (error) {
      return { backend: 'redis', totalKeys: 0, topConsumers: [] };
    }
  }

  /**
   * isReady — Para verificar el estado desde health checks.
   */
  public isReady(): boolean {
    return this.isConnected;
  }

  /**
   * disconnect — Cerrar conexión limpiamente al apagar el servidor.
   * ¿Por qué importa un cierre limpio?
   * Redis mantiene conexiones abiertas. Si el proceso termina sin cerrarlas,
   * Redis las detectará como muertas después de un timeout, pero durante
   * ese tiempo ocupa recursos innecesariamente.
   */
  public async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      logMessage(LogLevel.INFO, 'redis_disconnected', 'Rate limiter: desconectado de Redis', {});
    }
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

const rateLimitStore = RedisRateLimitStore.getInstance();

/**
 * initRateLimiter — Inicializar la conexión Redis al arrancar la app.
 *
 * Llamar esto en tu app.ts o server.ts ANTES de registrar las rutas:
 *
 *   import { initRateLimiter } from './middleware/rate-limit';
 *   await initRateLimiter();
 *   app.use('/api', router);
 *
 * ¿Por qué exportar la inicialización separada del uso?
 * Permite que las rutas se registren en cualquier orden.
 * Si la conexión Redis estuviera en el primer uso (lazy),
 * el primer request real pagaría el costo de conectar.
 */
export const initRateLimiter = async (): Promise<void> => {
  await rateLimitStore.connect();
};

/**
 * Cierre limpio al apagar el servidor.
 * Llamar en el handler de SIGTERM/SIGINT:
 *
 *   process.on('SIGTERM', async () => {
 *       await closeRateLimiter();
 *       process.exit(0);
 *   });
 */
export const closeRateLimiter = async (): Promise<void> => {
  await rateLimitStore.disconnect();
};

// ============================================================================
// GENERADOR DE CLAVE
// ============================================================================

/**
 * generateRateLimitKey — Construye la clave única para cada combinación
 * usuario/IP + tipo de endpoint.
 *
 * Formato para usuario autenticado: user:<userId>:<endpointType>
 * Formato para IP anónima:          ip:<ipAddress>:<endpointType>
 *
 * ¿Por qué usar userId Y NO solo IP para usuarios autenticados?
 * Un usuario en oficina comparte IP con 50 colegas (NAT corporativo).
 * Usar solo IP penalizaría a todos por las acciones de uno.
 * userId identifica al individuo exacto que está haciendo las requests.
 *
 * ¿Por qué usar IP para anónimos?
 * No tenemos userId. La IP es lo único que identifica al visitante.
 * Es imperfecta (NAT, VPN) pero es lo disponible.
 *
 * req.ip toma el primer valor de X-Forwarded-For si trust proxy está activo.
 * Asegúrate de tener app.set('trust proxy', 1) si estás detrás de nginx/load balancer.
 */
function generateRateLimitKey(req: Request, endpointType: EndpointType): string {
  const userId = req.userId || null;
  const ip = req.ip || req.socket.remoteAddress || 'unknown'; // ← fixed: .connection deprecado

  return userId
    ? `user:${userId}:${endpointType}`
    : `ip:${ip}:${endpointType}`;
}

// ============================================================================
// MIDDLEWARE PRINCIPAL
// ============================================================================

/**
 * createRateLimit — Genera el middleware de rate limiting para un endpoint.
 *
 * Es una función que retorna un middleware (Higher-Order Function).
 * ¿Por qué este patrón y no un middleware directo?
 * Permite parametrizar el tipo de endpoint en el momento de definir la ruta:
 *
 *   router.post('/login', createRateLimit(EndpointType.AUTH), ...)
 *   router.get('/bovines', createRateLimit(EndpointType.CATTLE_READ), ...)
 *
 * Cada ruta tiene su propio límite configurado según el tipo de operación.
 *
 * ¿Por qué async? checkLimit es async (habla con Redis).
 * Los middlewares de Express soportan async si manejas los errores con next().
 */
export const createRateLimit = (endpointType: EndpointType) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // ── 1. Determinar configuración según rol ──────────────────────
      let config: RateLimitConfig;

      if (!req.user || !req.userRole) {
        config = IP_RATE_LIMITS;
      } else {
        const userRole = req.userRole as UserRole;
        config = RATE_LIMIT_CONFIGS[endpointType][userRole];
      }

      // ── 2. Acceso denegado si maxRequests es 0 ────────────────────
      // Ejemplo: VIEWER en CATTLE_WRITE tiene maxRequests: 0
      // No tiene sentido hacer una consulta a Redis para esto.
      if (config.maxRequests === 0) {
        logMessage(
          LogLevel.WARN,
          'rate_limit_zero',
          `Acceso denegado por política de rol: ${req.userRole} no puede hacer ${endpointType}`,
          { userId: req.userId, path: req.originalUrl, userRole: req.userRole }
        );
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED_BY_ROLE',
            message: 'Tu rol no tiene acceso a esta operación',
            timestamp: new Date().toISOString(),
            path: req.originalUrl
          }
        });
        return;
      }

      // ── 3. Generar clave y consultar Redis ────────────────────────
      const key = generateRateLimitKey(req, endpointType);
      const result = await rateLimitStore.checkLimit(key, config);

      // ── 4. Establecer headers informativos ────────────────────────
      // Estos headers son estándar (RFC 6585) y permiten al cliente
      // saber cuántos requests le quedan y cuándo puede reintentar.
      // El frontend puede usarlos para mostrar un mensaje proactivo.
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
        'X-RateLimit-Window': config.windowMs.toString(),
        'X-RateLimit-Backend': rateLimitStore.isReady() ? 'redis' : 'memory'
      });

      // ── 5. Verificar si se excedió el límite ──────────────────────
      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);

        res.set({
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Hit': result.totalHits.toString()
        });

        logMessage(
          LogLevel.WARN,
          'rate_limit_exceeded',
          `Rate limit excedido: ${req.userRole || 'anónimo'} en ${endpointType}`,
          {
            userId: req.userId,
            userEmail: req.user?.email,
            userRole: req.userRole,
            endpointType,
            ip: req.ip,
            path: req.originalUrl,
            totalHits: result.totalHits,
            limit: config.maxRequests,
            resetTime: new Date(result.resetTime).toISOString(),
            backend: rateLimitStore.isReady() ? 'redis' : 'memory'
          }
        );

        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Demasiadas solicitudes. Por favor, intente más tarde.',
            details: {
              limit: config.maxRequests,
              windowMs: config.windowMs,
              retryAfter,
              resetTime: new Date(result.resetTime).toISOString()
            },
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
            method: req.method
          }
        });
        return;
      }

      // ── 6. Advertencia cuando se acerca al límite (80%) ───────────
      // Permite al cliente saber que debe reducir su tasa de requests
      // antes de ser bloqueado.
      if (result.remaining <= config.maxRequests * 0.2) {
        logMessage(
          LogLevel.INFO,
          'rate_limit_warning',
          `Usuario al ${Math.round((result.totalHits / config.maxRequests) * 100)}% del límite`,
          {
            userId: req.userId,
            userRole: req.userRole,
            endpointType,
            remaining: result.remaining,
            totalHits: result.totalHits,
            limit: config.maxRequests
          }
        );
      }

      next();

    } catch (error) {
      // Error inesperado (que no fue manejado dentro de checkLimit)
      // Aplicamos "fail open": permitimos el request pero logueamos.
      logMessage(
        LogLevel.ERROR,
        'rate_limit_error',
        `Error inesperado en rate limiter: ${error instanceof Error ? error.message : error}`,
        {
          userId: req.userId,
          endpointType,
          path: req.originalUrl,
          error: error instanceof Error ? error.stack : String(error)
        }
      );
      // Permitir el request en lugar de devolver un 500
      next();
    }
  };
};

// ============================================================================
// UTILIDADES EXPORTADAS
// ============================================================================

/**
 * getRateLimitStats — Para el endpoint de administración.
 * Permite ver qué usuarios/IPs están más cerca de su límite.
 */
export const getRateLimitStats = async () => {
  return rateLimitStore.getStats();
};

/**
 * resetUserRateLimit — Para administradores que necesiten
 * liberar el límite de un usuario específico manualmente.
 */
export const resetUserRateLimit = async (
  userId: string,
  endpointType?: EndpointType
): Promise<void> => {
  if (endpointType) {
    await rateLimitStore.resetKey(`user:${userId}:${endpointType}`);
  } else {
    // Resetear todos los endpoints del usuario
    for (const type of Object.values(EndpointType)) {
      await rateLimitStore.resetKey(`user:${userId}:${type}`);
    }
  }
};

/**
 * emergencyBypass — Para situaciones de emergencia veterinaria.
 * Misma lógica que antes, sin cambios funcionales.
 */
export const emergencyBypass = (req: Request, res: Response, next: NextFunction): void => {
  const emergencyToken = req.headers['x-emergency-token'] as string;
  const validToken = process.env.EMERGENCY_BYPASS_TOKEN;

  if (emergencyToken && validToken && emergencyToken === validToken) {
    logMessage(
      LogLevel.WARN,
      'emergency_bypass_used',
      'Rate limit bypass de emergencia activado',
      {
        userId: req.userId,
        userEmail: req.user?.email,
        path: req.originalUrl,
        ip: req.ip
      }
    );
    res.set('X-Rate-Limit-Bypassed', 'emergency');
    return next();
  }

  next();
};

/**
 * veterinaryPriorityLimit — Sin cambios funcionales.
 * Ahora async porque checkLimit es async.
 */
export const veterinaryPriorityLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.userRole !== UserRole.VETERINARIAN) {
    return next();
  }

  const priorityConfig: RateLimitConfig = {
    windowMs: 60 * 1000,
    maxRequests: 200
  };

  const key = `user:${req.userId}:veterinary_priority`;
  const result = await rateLimitStore.checkLimit(key, priorityConfig);

  if (!result.allowed) {
    res.status(429).json({
      success: false,
      error: {
        code: 'VETERINARY_RATE_LIMIT_EXCEEDED',
        message: 'Límite de operaciones veterinarias de emergencia excedido',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  next();
};
