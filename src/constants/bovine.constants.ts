// constants/bovine.constants.ts
/**
 * ============================================================================
 * CONSTANTES DEL DOMINIO BOVINO
 * ============================================================================
 * 
 * PROPÓSITO:
 *   Centralizar todos los valores constantes relacionados con bovinos.
 *   Esto facilita el mantenimiento y evita "magic numbers" en el código.
 * 
 * BENEFICIOS:
 *   - Un solo lugar para modificar valores
 *   - Tipado fuerte con 'as const'
 *   - Reutilización entre servicios
 *   - Documentación implícita
 */

import { CattleType, HealthStatus, GenderType } from '../models/Bovine';

/**
 * Constantes del dominio bovino
 * 
 * Usamos 'as const' para que TypeScript infiera los tipos literales
 * y no solo 'string'. Esto da mejor autocompletado.
 */
export const BOVINE_CONSTANTS = {
    /**
     * Edades mínimas requeridas por tipo de bovino (en meses)
     * 
     * RANCHOS:
     * - Toros (BULL): Mínimo 18 meses para reproducción
     * - Vacas (COW): Mínimo 15 meses para primer servicio
     * - Terneros (CALF): Sin edad mínima
     * - General (CATTLE): Sin edad mínima
     */
    MIN_AGE_MONTHS: {
        [CattleType.BULL]: 18,
        [CattleType.COW]: 15,
        [CattleType.CALF]: 0,
        [CattleType.CATTLE]: 0
    } as const,

    /**
     * Límites de peso para validación (en kg)
     * 
     * Basado en razas comunes:
     * - Mínimo: 1 kg (ternero recién nacido)
     * - Máximo: 2000 kg (toro adulto de raza grande)
     */
    WEIGHT: {
        MIN: 1,
        MAX: 2000
    } as const,

    /**
     * Colores para visualización en mapas de Leaflet
     * 
     * Formato: Hexadecimal
     * - HEALTHY: Verde (#10b981) - Buen estado
     * - SICK: Rojo (#ef4444) - Enfermo
     * - RECOVERING: Naranja (#f59e0b) - En recuperación
     * - QUARANTINE: Púrpura (#8b5cf6) - Aislado
     * - DECEASED: Gris (#6b7280) - Fallecido
     */
    HEALTH_COLORS: {
        [HealthStatus.HEALTHY]: '#10b981',      // Verde
        [HealthStatus.SICK]: '#ef4444',         // Rojo
        [HealthStatus.RECOVERING]: '#f59e0b',   // Naranja
        [HealthStatus.QUARANTINE]: '#8b5cf6',   // Púrpura
        [HealthStatus.DECEASED]: '#6b7280',     // Gris
        [HealthStatus.UNKNOWN]: '#9ca3af'       // Gris claro
    } as const,

    /**
     * Etiquetas en español para mostrar en UI
     */
    HEALTH_LABELS: {
        [HealthStatus.HEALTHY]: 'Saludable',
        [HealthStatus.SICK]: 'Enfermo',
        [HealthStatus.RECOVERING]: 'Recuperándose',
        [HealthStatus.QUARANTINE]: 'Cuarentena',
        [HealthStatus.DECEASED]: 'Fallecido',
        [HealthStatus.UNKNOWN]: 'Desconocido'
    } as const,

    /**
     * Intensidades para mapa de calor (heatmap)
     * 
     * Valores de 0 a 1 que determinan la opacidad/intensidad
     * en el gradiente del heatmap de Leaflet:
     * - Crítico/Sick: 0.9 (muy intenso)
     * - Recuperándose: 0.6 (medio)
     * - Saludable: 0.3 (bajo)
     * - Fallecido: 0.1 (casi invisible)
     */
    HEAT_INTENSITY: {
        [HealthStatus.HEALTHY]: 0.3,
        [HealthStatus.RECOVERING]: 0.6,
        [HealthStatus.SICK]: 0.9,
        [HealthStatus.QUARANTINE]: 0.8,
        [HealthStatus.DECEASED]: 0.1,
        [HealthStatus.UNKNOWN]: 0.2
    } as const,

    /**
     * Tamaños de grid para clustering según nivel de zoom
     * 
     * 📐 FÓRMULA: 1 grado ≈ 111 km en el ecuador
     * 
     * Zoom 8  (país/estado)    → 0.1°  ≈ 11 km
     * Zoom 10 (región)         → 0.05° ≈ 5.5 km
     * Zoom 12 (municipio)      → 0.02° ≈ 2.2 km
     * Zoom 14 (rancho grande)  → 0.01° ≈ 1.1 km
     * Zoom 16 (rancho pequeño) → 0.005° ≈ 550 m
     */
    GRID_SIZES: {
        ZOOM_8: 0.1,    // 11km - nivel país/estado
        ZOOM_10: 0.05,   // 5.5km - nivel región
        ZOOM_12: 0.02,   // 2.2km - nivel municipio
        ZOOM_14: 0.01,   // 1.1km - nivel rancho grande
        ZOOM_16: 0.005   // 550m - nivel rancho/instalaciones
    } as const,

    /**
     * Opciones de paginación para listados
     */
    PAGINATION: {
        DEFAULT_LIMIT: 20,
        MAX_LIMIT: 100,
        DEFAULT_PAGE: 1
    } as const,

    /**
     * Umbrales para alertas
     */
    ALERT_THRESHOLDS: {
        /**
         * Días sin movimiento para considerar "inmovilidad"
         */
        IMMOBILITY_DAYS: 1,

        /**
         * Velocidad máxima normal para bovinos (km/h)
         * Un bovino caminando normalmente va a 3-5 km/h
         * Corriendo puede llegar a 15-20 km/h
         */
        MAX_NORMAL_SPEED: 15,

        /**
         * Porcentaje de batería para alerta baja
         */
        LOW_BATTERY_PERCENT: 15
    } as const,

    /**
     * Intervalos para tareas programadas (en minutos)
     */
    SCHEDULED_TASKS: {
        REFRESH_SNAPSHOTS: 60,     // Cada hora
        CLEANUP_OLD_DATA: 24 * 60, // Cada día
        CHECK_ALERTS: 15            // Cada 15 minutos
    } as const,

    /**
     * Límites de la API
     */
    API_LIMITS: {
        MAX_BATCH_SIZE: 100,        // Máximo puntos por batch en tracking
        MAX_POINTS_PER_PATH: 1000,  // Máximo puntos en una ruta
        CACHE_TTL: 300               // Tiempo de caché en segundos (5 min)
    } as const,

    /**
     * Validaciones de datos
     */
    VALIDATION: {
        EAR_TAG_MIN_LENGTH: 3,
        EAR_TAG_MAX_LENGTH: 50,
        BREED_MIN_LENGTH: 2,
        NAME_MAX_LENGTH: 100,
        NOTES_MAX_LENGTH: 1000
    } as const,

    /**
     * Tipos de movimiento para análisis
     */
    MOVEMENT_PATTERNS: {
        GRAZING: 'GRAZING',
        RESTING: 'RESTING',
        WALKING: 'WALKING',
        RUNNING: 'RUNNING',
        UNKNOWN: 'UNKNOWN'
    } as const,

    /**
     * Unidades de medida
     */
    UNITS: {
        WEIGHT: 'kg',
        DISTANCE: 'km',
        SPEED: 'km/h',
        TEMPERATURE: '°C',
        BATTERY: '%'
    } as const,

    /**
  * Intervalos de chequeo según estado de salud (en días)
  * 
  * Estos valores determinan cada cuántos días se debe programar
  * un chequeo de salud automático según el estado actual del bovino.
  * 
  * - HEALTHY: 30 días (chequeo rutinario mensual)
  * - RECOVERING: 7 días (seguimiento semanal)
  * - SICK: 3 días (control frecuente)
  * - QUARANTINE: 1 día (supervisión diaria)
  * - DECEASED: 0 (no aplica)
  */
    CHECK_INTERVALS: {
        [HealthStatus.HEALTHY]: 30,
        [HealthStatus.RECOVERING]: 7,
        [HealthStatus.SICK]: 3,
        [HealthStatus.QUARANTINE]: 1,
        [HealthStatus.DECEASED]: 0,
        [HealthStatus.UNKNOWN]: 30,
    } as const,

    /**
     * Umbrales para signos vitales normales en bovinos
     * 
     * Valores de referencia basados en estándares veterinarios:
     * 
     * TEMPERATURA:
     *   - Mínimo normal: 37.5°C
     *   - Máximo normal: 39.5°C
     *   - Por encima: fiebre
     *   - Por debajo: hipotermia
     * 
     * FRECUENCIA CARDÍACA:
     *   - Mínimo normal: 48 latidos/minuto
     *   - Máximo normal: 84 latidos/minuto
     *   - Taquicardia: > 84
     *   - Bradicardia: < 48
     * 
     * FRECUENCIA RESPIRATORIA:
     *   - Mínimo normal: 10 respiraciones/minuto
     *   - Máximo normal: 30 respiraciones/minuto
     *   - Taquipnea: > 30
     *   - Bradipnea: < 10
     */
    VITAL_SIGNS_THRESHOLDS: {
        TEMPERATURE: {
            MIN: 37.5,
            MAX: 39.5,
            UNIT: '°C',
            DESCRIPTION: 'Temperatura corporal'
        },
        HEART_RATE: {
            MIN: 48,
            MAX: 84,
            UNIT: 'lpm',
            DESCRIPTION: 'Frecuencia cardíaca'
        },
        RESPIRATORY_RATE: {
            MIN: 10,
            MAX: 30,
            UNIT: 'rpm',
            DESCRIPTION: 'Frecuencia respiratoria'
        }
    } as const,
    /**
     * Umbrales para detección de anomalías en tracking
     */
    ANOMALY_THRESHOLDS: {
        /**
         * Velocidad máxima normal (km/h)
         * Un bovino caminando normalmente va a 3-5 km/h
         * Corriendo puede llegar a 15-20 km/h
         */
        MAX_NORMAL_SPEED: 15,

        /**
         * Tiempo sin movimiento para considerar inmovilidad (minutos)
         */
        IMMOBILITY_MINUTES: 30,

        /**
         * Distancia mínima para considerar movimiento significativo (metros)
         */
        MIN_MOVEMENT_DISTANCE: 5,

        /**
         * Tiempo sin datos para considerar dispositivo offline (minutos)
         */
        OFFLINE_MINUTES: 30
    } as const,

    /**
     * Factores de conversión
     */
    CONVERSION: {
        MS_TO_KMH: 3.6,           // m/s → km/h
        MINUTES_TO_MS: 60 * 1000,
        HOURS_TO_MS: 60 * 60 * 1000,
        DAYS_TO_MS: 24 * 60 * 60 * 1000
    } as const,

    /**
     * Intervalos de tiempo para análisis
     */
    TIME_INTERVALS: {
        RECENT_MINUTES: 15,        // Últimos 15 minutos
        LAST_HOUR: 60,             // Última hora
        LAST_DAY: 24 * 60,         // Último día
        LAST_WEEK: 7 * 24 * 60     // Última semana
    } as const,

    /**
     * Configuración de WebSocket
     */
    WEBSOCKET: {
        PING_INTERVAL: 30000,      // 30 segundos
        RECONNECT_DELAY: 5000,     // 5 segundos
        MAX_RETRIES: 5
    } as const,

    /**
 * Límites para validaciones
 */
    LOCATION_LIMITS: {
        MIN_ENTRY_DURATION: 1,           // Mínimo 1 minuto para considerar una entrada válida
        MAX_ENTRY_DURATION: 365 * 24 * 60, // Máximo 1 año en minutos
        OVERLAP_TOLERANCE_MINUTES: 5      // Tolerancia para solapamientos (5 min)
    } as const,

    /**
     * Tipos de reportes disponibles
     */
    REPORT_TYPES: {
        DAILY: 'daily',
        WEEKLY: 'weekly',
        MONTHLY: 'monthly',
        CUSTOM: 'custom'
    } as const,

    /**
     * ========================================================================
     * CLASIFICACIÓN ETARIA — FUENTE ÚNICA DE VERDAD (B-04 / B-05)
     * ========================================================================
     * Umbrales de edad (en MESES) que definen la etapa del bovino.
     * Toda lógica de edad (isAdult, clasificación, presets de filtro) debe
     * derivar de aquí. NO duplicar estos números en otros archivos.
     *
     *   0  – 12 meses  → Becerro / Becerra  (CALF)
     *   12 – 24 meses  → Novillo / Vaquilla (YOUNG)
     *   ≥ 24 meses     → Toro / Vaca        (ADULT)
     */
    AGE_CLASSIFICATION: {
        CALF_MAX_MONTHS: 12,    // límite superior de cría (exclusivo)
        ADULT_MIN_MONTHS: 24,   // a partir de aquí es adulto (inclusive)
    } as const,

    /**
     * Edad reproductiva mínima por SEXO (en meses).
     * Usado por validaciones y, a futuro, por candidatos madre/padre.
     *   Macho (toro):  ≥ 18 meses
     *   Hembra (vaca): ≥ 15 meses
     */
    REPRODUCTIVE_MIN_MONTHS: {
        MALE: 18,
        FEMALE: 15,
    } as const,

    /**
     * Rangos preset de edad (en MESES) para el filtro `?ageGroup=`.
     * `max` ausente = sin límite superior.
     */
    AGE_GROUP_RANGES: {
        calf:  { min: 0,  max: 12 },   // becerro/becerra
        young: { min: 12, max: 24 },   // novillo/vaquilla
        adult: { min: 24 },            // toro/vaca (sin tope)
    } as const,

} as const;

// ============================================================================
// HELPERS DE CLASIFICACIÓN ETARIA (derivados — B-05)
// ============================================================================

export type AgeGroup = keyof typeof BOVINE_CONSTANTS.AGE_GROUP_RANGES;
export type BovineClassificationCode = 'CALF' | 'YOUNG' | 'ADULT';

export interface BovineClassification {
    code: BovineClassificationCode;  // etapa (independiente del sexo)
    label: string;                   // etiqueta en español (según sexo)
}

/**
 * Indica si una edad (en meses) corresponde a un adulto (≥ 24m).
 */
export function isAdultAge(ageMonths: number): boolean {
    return ageMonths >= BOVINE_CONSTANTS.AGE_CLASSIFICATION.ADULT_MIN_MONTHS;
}

/**
 * Clasifica un bovino por edad (meses) + sexo. Derivado, sin persistencia.
 *   < 12m         → CALF  (Becerro/Becerra/Cría)
 *   12m – < 24m   → YOUNG (Novillo/Vaquilla/Joven)
 *   ≥ 24m         → ADULT (Toro/Vaca/Adulto)
 */
export function classifyBovine(ageMonths: number, gender?: GenderType | string | null): BovineClassification {
    const { CALF_MAX_MONTHS, ADULT_MIN_MONTHS } = BOVINE_CONSTANTS.AGE_CLASSIFICATION;
    const isMale = gender === GenderType.MALE;
    const isFemale = gender === GenderType.FEMALE;

    if (ageMonths < CALF_MAX_MONTHS) {
        return { code: 'CALF', label: isMale ? 'Becerro' : isFemale ? 'Becerra' : 'Cría' };
    }
    if (ageMonths < ADULT_MIN_MONTHS) {
        return { code: 'YOUNG', label: isMale ? 'Novillo' : isFemale ? 'Vaquilla' : 'Joven' };
    }
    return { code: 'ADULT', label: isMale ? 'Toro' : isFemale ? 'Vaca' : 'Adulto' };
}

/**
 * Indica si una edad (en meses) alcanza la edad reproductiva mínima según sexo.
 * Para gender UNKNOWN devuelve false (no se puede determinar).
 */
export function isReproductiveAge(ageMonths: number, gender?: GenderType | string | null): boolean {
    const { MALE, FEMALE } = BOVINE_CONSTANTS.REPRODUCTIVE_MIN_MONTHS;
    if (gender === GenderType.MALE)   return ageMonths >= MALE;
    if (gender === GenderType.FEMALE) return ageMonths >= FEMALE;
    return false;
}

/**
 * Resuelve un preset de grupo etario a un rango { min, max } en meses.
 * Devuelve null si el preset no es válido.
 */
export function resolveAgeGroup(group: string): { min?: number; max?: number } | null {
    const ranges = BOVINE_CONSTANTS.AGE_GROUP_RANGES as Record<string, { min?: number; max?: number }>;
    return ranges[group] ?? null;
}



/**
 * Tipo derivado para TypeScript (autocompletado)
 */
export type BovineConstants = typeof BOVINE_CONSTANTS;
/**
 * Tipo para los intervalos de chequeo
 */
export type CheckInterval = typeof CHECK_INTERVALS;

/**
 * Tipo para los umbrales de signos vitales
 */
export type VitalSignsThresholds = typeof VITAL_SIGNS_THRESHOLDS;

/**
 * Tipo para los rangos de temperatura
 */
export type TemperatureRange = typeof VITAL_SIGNS_THRESHOLDS.TEMPERATURE;

/**
 * Tipo para los rangos de frecuencia cardíaca
 */
export type HeartRateRange = typeof VITAL_SIGNS_THRESHOLDS.HEART_RATE;

/**
 * Tipo para los rangos de frecuencia respiratoria
 */
export type RespiratoryRateRange = typeof VITAL_SIGNS_THRESHOLDS.RESPIRATORY_RATE;

export type AnomalyThresholds = typeof ANOMALY_THRESHOLDS;
export type ConversionFactors = typeof CONVERSION;
export type TimeIntervals = typeof TIME_INTERVALS;
export type WebSocketConfig = typeof WEBSOCKET;

/**
 * Exportación individual para imports específicos
 */
export const {
    MIN_AGE_MONTHS,
    WEIGHT,
    HEALTH_COLORS,
    HEALTH_LABELS,
    HEAT_INTENSITY,
    GRID_SIZES,
    PAGINATION,
    ALERT_THRESHOLDS,
    SCHEDULED_TASKS,
    API_LIMITS,
    VALIDATION,
    MOVEMENT_PATTERNS,
    UNITS,
    CHECK_INTERVALS,
    VITAL_SIGNS_THRESHOLDS,
    ANOMALY_THRESHOLDS,
    CONVERSION,
    TIME_INTERVALS,
    WEBSOCKET,
    LOCATION_LIMITS,
    REPORT_TYPES
} = BOVINE_CONSTANTS;