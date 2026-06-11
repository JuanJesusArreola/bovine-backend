// Constantes de configuración del servidor
export const SERVER_CONFIG = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_VERSION: 'v1',
  BASE_PATH: `/api/v1`,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  JWT_SECRET: process.env.JWT_SECRET || 'cattle-tracking-secret-key',
  JWT_EXPIRES_IN: '24h',
  BCRYPT_ROUNDS: 12,
} as const;

// Constantes de base de datos
export const DATABASE = {
  MAX_CONNECTIONS: 20,
  IDLE_TIMEOUT: 30000,
  CONNECTION_TIMEOUT: 2000,
  QUERY_TIMEOUT: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
} as const;

// Estados de salud del ganado
export const CATTLE_HEALTH_STATUS = {
  HEALTHY: 'healthy',
  SICK: 'sick',
  RECOVERING: 'recovering',
  QUARANTINE: 'quarantine',
  DECEASED: 'deceased',
  UNKNOWN: 'unknown',
} as const;

// Tipos de animales
export const CATTLE_TYPES = {
  COW: 'cow',
  BULL: 'bull',
  CALF: 'calf',
  HEIFER: 'heifer',
  STEER: 'steer',
  OX: 'ox',
} as const;

// Razas de ganado comunes
export const CATTLE_BREEDS = {
  HOLSTEIN: 'holstein',
  ANGUS: 'angus',
  HEREFORD: 'hereford',
  CHAROLAIS: 'charolais',
  SIMMENTAL: 'simmental',
  BRAHMAN: 'brahman',
  LIMOUSIN: 'limousin',
  SHORTHORN: 'shorthorn',
  JERSEY: 'jersey',
  GUERNSEY: 'guernsey',
  BROWN_SWISS: 'brown_swiss',
  AYRSHIRE: 'ayrshire',
  SANTA_GERTRUDIS: 'santa_gertrudis',
  BRANGUS: 'brangus',
  BEEFMASTER: 'beefmaster',
  GELBVIEH: 'gelbvieh',
  CORRIENTE: 'corriente',
  CRIOLLO: 'criollo',
  NELORE: 'nelore',
  GYR: 'gyr',
  INDO_BRASIL: 'indo_brasil',
  MIXED: 'mixed',
  OTHER: 'other',
} as const;

// Tipos de eventos/tratamientos
export const EVENT_TYPES = {
  VACCINATION: 'vaccination',
  ILLNESS: 'illness',
  TREATMENT: 'treatment',
  PREGNANCY_CHECK: 'pregnancy_check',
  BIRTH: 'birth',
  WEANING: 'weaning',
  BREEDING: 'breeding',
  INJURY: 'injury',
  SURGERY: 'surgery',
  DEWORMING: 'deworming',
  HOOF_TRIMMING: 'hoof_trimming',
  WEIGHT_CHECK: 'weight_check',
  BODY_CONDITION_SCORE: 'body_condition_score',
  LOCATION_UPDATE: 'location_update',
  TRANSFER: 'transfer',
  DEATH: 'death',
  SALE: 'sale',
  PURCHASE: 'purchase',
  OTHER: 'other',
} as const;

// Tipos de vacunas comunes
export const VACCINE_TYPES = {
  // Vacunas virales
  IBR: 'ibr', // Rinotraqueítis Infecciosa Bovina
  BVD: 'bvd', // Diarrea Viral Bovina
  PI3: 'pi3', // Parainfluenza 3
  BRSV: 'brsv', // Virus Sincitial Respiratorio Bovino
  
  // Vacunas bacterianas
  CLOSTRIDIUM: 'clostridium',
  BLACKLEG: 'blackleg', // Carbón Sintomático
  ANTHRAX: 'anthrax', // Carbón Bacteridiano
  PASTEURELLA: 'pasteurella',
  MANNHEIMIA: 'mannheimia',
  
  // Vacunas reproductivas
  BRUCELLOSIS: 'brucellosis',
  LEPTOSPIROSIS: 'leptospirosis',
  CAMPYLOBACTER: 'campylobacter',
  TRICHOMONAS: 'trichomonas',
  
  // Otras vacunas
  RABIES: 'rabies', // Rabia
  FOOT_AND_MOUTH: 'foot_and_mouth', // Fiebre Aftosa
  LUMPY_SKIN: 'lumpy_skin', // Dermatosis Nodular
  HEMORRHAGIC_SEPTICEMIA: 'hemorrhagic_septicemia',
  
  // Vacunas combinadas
  FIVE_WAY: 'five_way',
  SEVEN_WAY: 'seven_way',
  NINE_WAY: 'nine_way',
  
  OTHER: 'other',
} as const;

// Severidad de enfermedades
export const ILLNESS_SEVERITY = {
  MILD: 'mild',
  MODERATE: 'moderate',
  SEVERE: 'severe',
  CRITICAL: 'critical',
} as const;

// Estados de tratamiento
export const TREATMENT_STATUS = {
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  OVERDUE: 'overdue',
} as const;

// Roles de usuario
export const USER_ROLES = {
  ADMIN: 'admin',
  VETERINARIAN: 'veterinarian',
  FARM_MANAGER: 'farm_manager',
  WORKER: 'worker',
  VIEWER: 'viewer',
} as const;

// Estados de usuario
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
} as const;

// Configuración de geolocalización
export const GEOLOCATION = {
  DEFAULT_RADIUS_KM: 1,
  MAX_RADIUS_KM: 50,
  MIN_RADIUS_KM: 0.1,
  COORDINATES_PRECISION: 6, // Número de decimales
  MAX_LATITUDE: 90,
  MIN_LATITUDE: -90,
  MAX_LONGITUDE: 180,
  MIN_LONGITUDE: -180,
} as const;

// Configuración de paginación
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
} as const;

// Formatos de fecha y hora
export const DATE_FORMATS = {
  DATE_ONLY: 'YYYY-MM-DD',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
  DATETIME_WITH_TZ: 'YYYY-MM-DD HH:mm:ss Z',
  TIME_ONLY: 'HH:mm:ss',
  DISPLAY_DATE: 'DD/MM/YYYY',
  DISPLAY_DATETIME: 'DD/MM/YYYY HH:mm',
} as const;

// Configuración de archivos
export const FILE_CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'text/plain', 'application/msword'],
  IMAGE_UPLOAD_PATH: '/uploads/images/',
  DOCUMENT_UPLOAD_PATH: '/uploads/documents/',
} as const;

// Mensajes de error comunes
export const ERROR_MESSAGES = {
  // Errores generales
  INTERNAL_SERVER_ERROR: 'Error interno del servidor',
  VALIDATION_ERROR: 'Error de validación',
  NOT_FOUND: 'Recurso no encontrado',
  UNAUTHORIZED: 'No autorizado',
  FORBIDDEN: 'Acceso prohibido',
  BAD_REQUEST: 'Solicitud incorrecta',
  
  // Errores de autenticación
  INVALID_CREDENTIALS: 'Credenciales inválidas',
  TOKEN_EXPIRED: 'Token expirado',
  TOKEN_INVALID: 'Token inválido',
  USER_NOT_FOUND: 'Usuario no encontrado',
  
  // Errores de ganado
  CATTLE_NOT_FOUND: 'Animal no encontrado',
  CATTLE_ALREADY_EXISTS: 'El animal ya existe',
  INVALID_CATTLE_ID: 'ID de animal inválido',
  
  // Errores de eventos
  EVENT_NOT_FOUND: 'Evento no encontrado',
  INVALID_EVENT_TYPE: 'Tipo de evento inválido',
  EVENT_DATE_INVALID: 'Fecha de evento inválida',
  
  // Errores de geolocalización
  INVALID_COORDINATES: 'Coordenadas inválidas',
  LOCATION_NOT_FOUND: 'Ubicación no encontrada',
  INVALID_RADIUS: 'Radio de búsqueda inválido',
  
  // Errores de archivo
  FILE_TOO_LARGE: 'Archivo demasiado grande',
  INVALID_FILE_TYPE: 'Tipo de archivo no permitido',
  FILE_UPLOAD_ERROR: 'Error al subir archivo',
  
  // Errores de base de datos
  DATABASE_CONNECTION_ERROR: 'Error de conexión a la base de datos',
  DATABASE_QUERY_ERROR: 'Error en consulta de base de datos',
  TRANSACTION_ERROR: 'Error en transacción',
} as const;

// Mensajes de éxito
export const SUCCESS_MESSAGES = {
  CATTLE_CREATED: 'Animal registrado exitosamente',
  CATTLE_UPDATED: 'Animal actualizado exitosamente',
  CATTLE_DELETED: 'Animal eliminado exitosamente',
  
  EVENT_CREATED: 'Evento registrado exitosamente',
  EVENT_UPDATED: 'Evento actualizado exitosamente',
  EVENT_DELETED: 'Evento eliminado exitosamente',
  
  USER_CREATED: 'Usuario creado exitosamente',
  USER_UPDATED: 'Usuario actualizado exitosamente',
  
  LOGIN_SUCCESS: 'Inicio de sesión exitoso',
  LOGOUT_SUCCESS: 'Cierre de sesión exitoso',
  
  FILE_UPLOADED: 'Archivo subido exitosamente',
} as const;

// Configuración de validación
export const VALIDATION_RULES = {
  // Reglas para ganado
  CATTLE_TAG_MIN_LENGTH: 3,
  CATTLE_TAG_MAX_LENGTH: 20,
  CATTLE_NAME_MAX_LENGTH: 50,
  CATTLE_WEIGHT_MIN: 1,
  CATTLE_WEIGHT_MAX: 2000, // kg
  
  // Reglas para usuarios
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 100,
  EMAIL_MAX_LENGTH: 100,
  
  // Reglas para eventos
  EVENT_DESCRIPTION_MAX_LENGTH: 500,
  EVENT_NOTES_MAX_LENGTH: 1000,
  
  // Reglas para archivos
  FILENAME_MAX_LENGTH: 255,
} as const;

// Configuración de notificaciones
export const NOTIFICATION_TYPES = {
  VACCINATION_DUE: 'vaccination_due',
  TREATMENT_OVERDUE: 'treatment_overdue',
  HEALTH_ALERT: 'health_alert',
  LOCATION_ALERT: 'location_alert',
  PREGNANCY_CHECK_DUE: 'pregnancy_check_due',
  WEIGHT_CHECK_DUE: 'weight_check_due',
  QUARANTINE_ALERT: 'quarantine_alert',
  MEDICATION_EXPIRY: 'medication_expiry',
  SYSTEM_MAINTENANCE: 'system_maintenance',
  USER_ACTIVITY: 'user_activity',
} as const;

// Configuración de calendario
export const CALENDAR_CONFIG = {
  DEFAULT_VIEW: 'month',
  AVAILABLE_VIEWS: ['day', 'week', 'month', 'year'],
  EVENT_COLORS: {
    vaccination: '#10B981', // Verde
    illness: '#EF4444',     // Rojo
    treatment: '#F59E0B',   // Amarillo
    birth: '#8B5CF6',       // Púrpura
    breeding: '#EC4899',    // Rosa
    checkup: '#3B82F6',     // Azul
    other: '#6B7280',       // Gris
  },
  REMINDER_INTERVALS: [
    { label: '1 día antes', value: 1 },
    { label: '3 días antes', value: 3 },
    { label: '1 semana antes', value: 7 },
    { label: '2 semanas antes', value: 14 },
    { label: '1 mes antes', value: 30 },
  ],
} as const;

// Configuración de reportes
export const REPORT_TYPES = {
  HEALTH_SUMMARY: 'health_summary',
  VACCINATION_SCHEDULE: 'vaccination_schedule',
  BREEDING_REPORT: 'breeding_report',
  LOCATION_TRACKING: 'location_tracking',
  INVENTORY_REPORT: 'inventory_report',
  FINANCIAL_SUMMARY: 'financial_summary',
  PERFORMANCE_METRICS: 'performance_metrics',
  TREATMENT_HISTORY: 'treatment_history',
} as const;

// Configuración de backup
export const BACKUP_CONFIG = {
  FREQUENCY: 'daily', // daily, weekly, monthly
  RETENTION_DAYS: 30,
  BACKUP_PATH: '/backups/',
  COMPRESSION: true,
  ENCRYPTION: true,
} as const;

// Estados HTTP comunes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Configuración de logging
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
} as const;

// Configuración de cache
export const CACHE_CONFIG = {
  DEFAULT_TTL: 3600, // 1 hora en segundos
  SHORT_TTL: 300,    // 5 minutos
  LONG_TTL: 86400,   // 24 horas
  CACHE_PREFIX: 'cattle_app:',
} as const;

// Tipos de datos para TypeScript
export type CattleHealthStatus = typeof CATTLE_HEALTH_STATUS[keyof typeof CATTLE_HEALTH_STATUS];
export type CattleType = typeof CATTLE_TYPES[keyof typeof CATTLE_TYPES];
export type CattleBreed = typeof CATTLE_BREEDS[keyof typeof CATTLE_BREEDS];
export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];
export type VaccineType = typeof VACCINE_TYPES[keyof typeof VACCINE_TYPES];
export type IllnessSeverity = typeof ILLNESS_SEVERITY[keyof typeof ILLNESS_SEVERITY];
export type TreatmentStatus = typeof TREATMENT_STATUS[keyof typeof TREATMENT_STATUS];
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];
export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
export type ReportType = typeof REPORT_TYPES[keyof typeof REPORT_TYPES];
export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];