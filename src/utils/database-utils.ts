// Utils de base de datos autónomo sin dependencias externas
import { readFileSync } from 'fs';
import { join } from 'path';

// Cargar variables de entorno manualmente
const loadEnvVariables = (): void => {
  try {
    const envPath = join(process.cwd(), '.env');
    const envFile = readFileSync(envPath, 'utf8');
    
    envFile.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
  } catch (error) {
    console.log('📝 Archivo .env no encontrado, usando variables por defecto');
  }
};

// Cargar variables de entorno
loadEnvVariables();

// Interfaz para la configuración de la base de datos
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

// Interfaz para respuestas de consultas con metadatos
interface QueryResponse<T = any> {
  data: T[];
  count: number;
  success: boolean;
  message?: string;
}

// Interfaz para parámetros de paginación
interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

// Interfaz para filtros de búsqueda
interface SearchFilters {
  [key: string]: any;
}

// Interfaz para resultados de consulta (compatible con pg)
interface QueryResult<T = any> {
  rows: T[];
  rowCount: number | null;
  command: string;
  oid: number;
  fields: any[];
}

// Interfaz para cliente de base de datos
interface DatabaseClient {
  query(text: string, params?: any[]): Promise<QueryResult>;
  release(): void;
}

// Interfaz para pool de conexiones
interface DatabasePool {
  connect(): Promise<DatabaseClient>;
  query(text: string, params?: any[]): Promise<QueryResult>;
  end(): Promise<void>;
  on(event: string, listener: (err: Error) => void): void;
}

// Configuración de la base de datos
const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cattle_tracking_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.NODE_ENV === 'production',
  max: 20, // Máximo número de conexiones en el pool
  idleTimeoutMillis: 30000, // Tiempo de espera antes de cerrar conexiones inactivas
  connectionTimeoutMillis: 2000, // Tiempo de espera para conectarse
};

// Variable para el pool de conexiones
let pool: DatabasePool | null = null;

// Mock implementation para desarrollo sin PostgreSQL
class MockDatabaseClient implements DatabaseClient {
  async query(text: string, params?: any[]): Promise<QueryResult> {
    console.log('🔍 Mock Query:', text, params);
    return {
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: []
    };
  }

  release(): void {
    console.log('🔓 Mock client released');
  }
}

class MockDatabasePool implements DatabasePool {
  async connect(): Promise<DatabaseClient> {
    return new MockDatabaseClient();
  }

  async query(text: string, params?: any[]): Promise<QueryResult> {
    const client = await this.connect();
    const result = await client.query(text, params);
    client.release();
    return result;
  }

  async end(): Promise<void> {
    console.log('🔐 Mock pool ended');
  }

  on(event: string, listener: (err: Error) => void): void {
    console.log('👂 Mock pool event listener:', event);
  }
}

/**
 * Función para inicializar la conexión a la base de datos
 * @returns Promise<void>
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Intentar cargar PostgreSQL usando require dinámico
    let pgModule: any = null;
    try {
      // Evaluar require de forma dinámica para evitar errores de TypeScript
      pgModule = eval('require')('pg');
    } catch (requireError) {
      console.log('📦 Módulo pg no disponible, usando implementación mock');
    }
    
    if (pgModule && pgModule.Pool) {
      // Usar PostgreSQL real si está disponible
      const PostgreSQLPool = pgModule.Pool;
      pool = new PostgreSQLPool(dbConfig) as any;
      
      // Manejar errores del pool
      pool!.on('error', (err: Error) => {
        console.error('❌ Error inesperado en el pool de base de datos:', err);
      });
      
      console.log('✅ PostgreSQL inicializado correctamente');
    } else {
      // Usar implementación mock para desarrollo
      pool = new MockDatabasePool();
      console.log('⚠️ Usando implementación mock de base de datos');
    }
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    // Fallback a implementación mock
    pool = new MockDatabasePool();
    console.log('⚠️ Fallback a implementación mock de base de datos');
  }
};

/**
 * Función para verificar que el pool esté inicializado
 */
const ensurePoolInitialized = (): void => {
  if (!pool) {
    throw new Error('Base de datos no inicializada. Llama a initializeDatabase() primero.');
  }
};

/**
 * Función para probar la conexión a la base de datos
 * @returns Promise<boolean> - True si la conexión es exitosa
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    ensurePoolInitialized();
    const client = await pool!.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Conexión a la base de datos establecida correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error al conectar con la base de datos:', error);
    return false;
  }
};

/**
 * Función para ejecutar consultas SQL con manejo de errores
 * @param query - Consulta SQL a ejecutar
 * @param params - Parámetros para la consulta (opcional)
 * @returns Promise<QueryResult> - Resultado de la consulta
 */
export const executeQuery = async (
  query: string,
  params?: any[]
): Promise<QueryResult> => {
  ensurePoolInitialized();
  const client = await pool!.connect();
  try {
    const startTime = Date.now();
    const result = await client.query(query, params);
    const executionTime = Date.now() - startTime;
    
    // Log de consultas en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Query ejecutada en ${executionTime}ms:`, query);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error ejecutando consulta:', error);
    console.error('📝 Query:', query);
    console.error('📋 Parámetros:', params);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Función para ejecutar múltiples consultas en una transacción
 * @param queries - Array de objetos con query y params
 * @returns Promise<QueryResult[]> - Array de resultados
 */
export const executeTransaction = async (
  queries: Array<{ query: string; params?: any[] }>
): Promise<QueryResult[]> => {
  ensurePoolInitialized();
  const client = await pool!.connect();
  try {
    await client.query('BEGIN');
    
    const results: QueryResult[] = [];
    for (const { query, params } of queries) {
      const result = await client.query(query, params);
      results.push(result);
    }
    
    await client.query('COMMIT');
    console.log('✅ Transacción completada exitosamente');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en transacción, realizando rollback:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Función para insertar un registro y devolver el ID generado
 * @param tableName - Nombre de la tabla
 * @param data - Datos a insertar
 * @returns Promise<number> - ID del registro insertado
 */
export const insertAndGetId = async (
  tableName: string,
  data: Record<string, any>
): Promise<number> => {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, index) => `$${index + 1}`);
  
  const query = `
    INSERT INTO ${tableName} (${keys.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING id
  `;
  
  const result = await executeQuery(query, values);
  return result.rows[0]?.id || 0;
};

/**
 * Función para actualizar registros con condiciones
 * @param tableName - Nombre de la tabla
 * @param data - Datos a actualizar
 * @param conditions - Condiciones WHERE
 * @returns Promise<number> - Número de filas afectadas
 */
export const updateRecord = async (
  tableName: string,
  data: Record<string, any>,
  conditions: Record<string, any>
): Promise<number> => {
  const dataKeys = Object.keys(data);
  const dataValues = Object.values(data);
  const conditionKeys = Object.keys(conditions);
  const conditionValues = Object.values(conditions);
  
  // Crear placeholders para los datos
  const setClause = dataKeys
    .map((key, index) => `${key} = $${index + 1}`)
    .join(', ');
  
  // Crear placeholders para las condiciones
  const whereClause = conditionKeys
    .map((key, index) => `${key} = $${dataKeys.length + index + 1}`)
    .join(' AND ');
  
  const query = `
    UPDATE ${tableName}
    SET ${setClause}, updated_at = CURRENT_TIMESTAMP
    WHERE ${whereClause}
  `;
  
  const allValues = [...dataValues, ...conditionValues];
  const result = await executeQuery(query, allValues);
  return result.rowCount || 0;
};

/**
 * Función para obtener registros con paginación y filtros
 * @param tableName - Nombre de la tabla
 * @param options - Opciones de consulta
 * @returns Promise<QueryResponse> - Datos paginados
 */
export const getRecordsWithPagination = async <T = any>(
  tableName: string,
  options: {
    select?: string[];
    filters?: SearchFilters;
    pagination?: PaginationParams;
    orderBy?: string;
    joins?: string;
  } = {}
): Promise<QueryResponse<T>> => {
  const {
    select = ['*'],
    filters = {},
    pagination = {},
    orderBy = 'created_at DESC',
    joins = ''
  } = options;
  
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;
  
  // Construir cláusulas WHERE
  const filterKeys = Object.keys(filters);
  const filterValues = Object.values(filters);
  const whereClause = filterKeys.length > 0
    ? `WHERE ${filterKeys.map((key, index) => `${key} = $${index + 1}`).join(' AND ')}`
    : '';
  
  // Consulta para obtener datos
  const dataQuery = `
    SELECT ${select.join(', ')}
    FROM ${tableName} ${joins}
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${filterKeys.length + 1} OFFSET $${filterKeys.length + 2}
  `;
  
  // Consulta para contar total de registros
  const countQuery = `
    SELECT COUNT(*) as total
    FROM ${tableName} ${joins}
    ${whereClause}
  `;
  
  try {
    const [dataResult, countResult] = await Promise.all([
      executeQuery(dataQuery, [...filterValues, limit, offset]),
      executeQuery(countQuery, filterValues)
    ]);
    
    return {
      data: dataResult.rows,
      count: parseInt(countResult.rows[0]?.total || '0'),
      success: true
    };
  } catch (error) {
    console.error('❌ Error obteniendo registros paginados:', error);
    return {
      data: [],
      count: 0,
      success: false,
      message: 'Error al obtener los registros'
    };
  }
};

/**
 * Función para eliminar registros (soft delete)
 * @param tableName - Nombre de la tabla
 * @param id - ID del registro a eliminar
 * @returns Promise<boolean> - True si se eliminó correctamente
 */
export const softDelete = async (
  tableName: string,
  id: number
): Promise<boolean> => {
  try {
    const query = `
      UPDATE ${tableName}
      SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
    `;
    
    const result = await executeQuery(query, [id]);
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('❌ Error realizando soft delete:', error);
    return false;
  }
};

/**
 * Función para buscar registros por coordenadas geográficas
 * @param tableName - Nombre de la tabla
 * @param latitude - Latitud
 * @param longitude - Longitud
 * @param radiusKm - Radio de búsqueda en kilómetros
 * @returns Promise<QueryResult> - Registros dentro del radio
 */
export const findByLocation = async (
  tableName: string,
  latitude: number,
  longitude: number,
  radiusKm: number = 1
): Promise<QueryResult> => {
  const query = `
    SELECT *, 
           ST_Distance(
             ST_GeogFromText('POINT(' || longitude || ' ' || latitude || ')'),
             ST_GeogFromText('POINT($2 $1)')
           ) / 1000 as distance_km
    FROM ${tableName}
    WHERE ST_DWithin(
      ST_GeogFromText('POINT(' || longitude || ' ' || latitude || ')'),
      ST_GeogFromText('POINT($2 $1)'),
      $3 * 1000
    )
    AND deleted_at IS NULL
    ORDER BY distance_km ASC
  `;
  
  return executeQuery(query, [latitude, longitude, radiusKm]);
};

/**
 * Función para validar que una tabla exista
 * @param tableName - Nombre de la tabla
 * @returns Promise<boolean> - True si la tabla existe
 */
export const tableExists = async (tableName: string): Promise<boolean> => {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )
  `;
  
  try {
    const result = await executeQuery(query, [tableName]);
    return result.rows[0]?.exists || false;
  } catch (error) {
    console.error('❌ Error verificando existencia de tabla:', error);
    return false;
  }
};

/**
 * Función para cerrar el pool de conexiones
 */
export const closePool = async (): Promise<void> => {
  try {
    if (pool) {
      await pool.end();
      console.log('🔐 Pool de conexiones cerrado correctamente');
    }
  } catch (error) {
    console.error('❌ Error cerrando pool de conexiones:', error);
  }
};

// Función para sanitizar datos de entrada
export const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    // Remover caracteres peligrosos para SQL injection
    return input.trim().replace(/[<>'"]/g, '');
  }
  return input;
};

// Función para validar formato de coordenadas
export const validateCoordinates = (lat: number, lng: number): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
};

// Función para obtener el pool (puede ser null)
export const getPool = (): DatabasePool | null => pool;

// Función para obtener la configuración de la base de datos
export const getDatabaseConfig = (): DatabaseConfig => ({ ...dbConfig });

// Exportar tipos para uso en otros módulos
export type {
  DatabaseConfig,
  QueryResponse,
  PaginationParams,
  SearchFilters,
  QueryResult,
  DatabaseClient,
  DatabasePool
};