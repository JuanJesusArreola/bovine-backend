// constants/event.constants.ts
/**
 * ============================================================================
 * CONSTANTES DEL DOMINIO DE EVENTOS
 * ============================================================================
 * 
 * PROPÓSITO:
 *   Centralizar todos los valores constantes relacionados con eventos
 *   programados. Esto facilita el mantenimiento y evita "magic numbers".
 */

import { EventType, EventStatus, EventPriority, RecurrenceType } from '../models/Event';

// ============================================================================
// CONSTANTES DEL DOMINIO DE EVENTOS
// ============================================================================

export const EVENT_CONSTANTS = {
    /**
     * Límites de tiempo para eventos
     */
    TIME_LIMITS: {
        /** Antelación mínima para programar un evento (en horas) */
        MIN_SCHEDULE_HOURS: 1,

        /** Antelación máxima para programar un evento (en días) */
        MAX_SCHEDULE_DAYS: 365,

        /** Tiempo máximo de duración de un evento (en horas) */
        MAX_EVENT_DURATION_HOURS: 24,

        /** Tiempo para recordatorio antes del evento (en horas) */
        REMINDER_HOURS: 24,

        /** Tiempo para considerar un evento como "próximo" (en días) */
        UPCOMING_DAYS: 7,

        /** Tiempo para considerar un evento como "atrasado" (en horas) */
        OVERDUE_HOURS: 1
    } as const,

    /**
     * Límites de recurrencia
     */
    RECURRENCE_LIMITS: {
        /** Número máximo de ocurrencias para eventos recurrentes */
        MAX_OCCURRENCES: 100,

        /** Intervalo máximo entre recurrencias (en días) */
        MAX_INTERVAL_DAYS: 365,

        /** Profundidad máxima del árbol de recurrencias */
        MAX_RECURRENCE_DEPTH: 10
    } as const,

    /**
     * Costos estimados por tipo de evento (valores por defecto)
     */
    ESTIMATED_COSTS: {
        [EventType.VACCINATION]: 150,
        [EventType.HEALTH_CHECK]: 300,
        [EventType.TREATMENT]: 500,
        [EventType.MEDICATION]: 200,
        [EventType.SURGERY]: 2000,
        [EventType.REPRODUCTION]: 400,
        [EventType.PREGNANCY_CHECK]: 250,
        [EventType.BIRTH]: 800,
        [EventType.WEANING]: 100,
        [EventType.WEIGHING]: 50,
        [EventType.MOVEMENT]: 0,
        [EventType.QUARANTINE]: 100,
        [EventType.OTHER]: 100
    } as const,

    /**
     * Duración estimada por tipo de evento (en minutos)
     */
    ESTIMATED_DURATIONS: {
        [EventType.VACCINATION]: 15,
        [EventType.HEALTH_CHECK]: 30,
        [EventType.TREATMENT]: 45,
        [EventType.MEDICATION]: 10,
        [EventType.SURGERY]: 120,
        [EventType.REPRODUCTION]: 20,
        [EventType.PREGNANCY_CHECK]: 30,
        [EventType.BIRTH]: 180,
        [EventType.WEANING]: 60,
        [EventType.WEIGHING]: 10,
        [EventType.MOVEMENT]: 30,
        [EventType.QUARANTINE]: 15,
        [EventType.OTHER]: 30
    } as const,

    /**
     * Requerimientos por tipo de evento
     */
    REQUIREMENTS: {
        [EventType.VACCINATION]: {
            requiresVeterinarian: true,
            requiresEquipment: ['jeringa', 'aguja', 'termo'],
            requiresFacility: 'corral'
        },
        [EventType.HEALTH_CHECK]: {
            requiresVeterinarian: true,
            requiresEquipment: ['estetoscopio', 'termómetro'],
            requiresFacility: 'corral'
        },
        [EventType.TREATMENT]: {
            requiresVeterinarian: true,
            requiresEquipment: ['botiquín'],
            requiresFacility: 'clínica'
        },
        [EventType.SURGERY]: {
            requiresVeterinarian: true,
            requiresEquipment: ['quirúrgico', 'anestesia'],
            requiresFacility: 'quirófano'
        },
        [EventType.REPRODUCTION]: {
            requiresVeterinarian: false,
            requiresEquipment: [],
            requiresFacility: 'corral'
        },
        [EventType.MOVEMENT]: {
            requiresVeterinarian: false,
            requiresEquipment: [],
            requiresFacility: ''
        }
    } as const,

    /**
     * Etiquetas en español para tipos de evento
     */
    EVENT_TYPE_LABELS: {
        [EventType.VACCINATION]: 'Vacunación',
        [EventType.HEALTH_CHECK]: 'Chequeo de salud',
        [EventType.TREATMENT]: 'Tratamiento',
        [EventType.MEDICATION]: 'Medicación',
        [EventType.SURGERY]: 'Cirugía',
        [EventType.REPRODUCTION]: 'Reproducción',
        [EventType.PREGNANCY_CHECK]: 'Chequeo de gestación',
        [EventType.BIRTH]: 'Parto',
        [EventType.WEANING]: 'Destete',
        [EventType.WEIGHING]: 'Pesaje',
        [EventType.MOVEMENT]: 'Movimiento',
        [EventType.QUARANTINE]: 'Cuarentena',
        [EventType.OTHER]: 'Otro'
    } as const,

    /**
     * Etiquetas en español para estados
     */
    STATUS_LABELS: {
        [EventStatus.SCHEDULED]: 'Programado',
        [EventStatus.IN_PROGRESS]: 'En progreso',
        [EventStatus.COMPLETED]: 'Completado',
        [EventStatus.CANCELLED]: 'Cancelado',
        [EventStatus.POSTPONED]: 'Pospuesto'
    } as const,

    /**
     * Etiquetas en español para prioridades
     */
    PRIORITY_LABELS: {
        [EventPriority.LOW]: 'Baja',
        [EventPriority.MEDIUM]: 'Media',
        [EventPriority.HIGH]: 'Alta',
        [EventPriority.CRITICAL]: 'Crítica',
        [EventPriority.EMERGENCY]: 'Emergencia'
    } as const,

    /**
     * Colores para visualización en calendario
     */
    PRIORITY_COLORS: {
        [EventPriority.LOW]: '#10b981',      // Verde
        [EventPriority.MEDIUM]: '#3b82f6',    // Azul
        [EventPriority.HIGH]: '#f59e0b',      // Naranja
        [EventPriority.CRITICAL]: '#ef4444',  // Rojo
        [EventPriority.EMERGENCY]: '#7f1d1d'  // Rojo oscuro
    } as const,

    /**
     * Opciones de recurrencia disponibles
     */
    RECURRENCE_OPTIONS: {
        [RecurrenceType.NONE]: 'No recurrente',
        [RecurrenceType.DAILY]: 'Diario',
        [RecurrenceType.WEEKLY]: 'Semanal',
        [RecurrenceType.MONTHLY]: 'Mensual',
        [RecurrenceType.QUARTERLY]: 'Trimestral',
        [RecurrenceType.YEARLY]: 'Anual',
        [RecurrenceType.CUSTOM]: 'Personalizado'
    } as const,

    /**
     * Días de la semana (para recurrencia semanal)
     */
    DAYS_OF_WEEK: {
        SUNDAY: 0,
        MONDAY: 1,
        TUESDAY: 2,
        WEDNESDAY: 3,
        THURSDAY: 4,
        FRIDAY: 5,
        SATURDAY: 6
    } as const,

    /**
     * Nombres de días en español
     */
    DAY_NAMES: {
        0: 'Domingo',
        1: 'Lunes',
        2: 'Martes',
        3: 'Miércoles',
        4: 'Jueves',
        5: 'Viernes',
        6: 'Sábado'
    } as const,

    /**
     * Validaciones de fechas
     */
    DATE_VALIDATIONS: {
        /** Años mínimos para programar */
        MIN_YEAR: new Date().getFullYear(),

        /** Años máximos para programar */
        MAX_YEAR: new Date().getFullYear() + 5,

        /** Formato de fecha esperado */
        DATE_FORMAT: 'YYYY-MM-DD',

        /** Formato de hora esperado */
        TIME_FORMAT: 'HH:mm'
    } as const,

    /**
     * Límites de paginación
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
        /** Días antes para recordatorio */
        REMINDER_DAYS: 1,

        /** Horas antes para recordatorio urgente */
        URGENT_REMINDER_HOURS: 6,

        /** Intentos máximos de notificación */
        MAX_NOTIFICATION_ATTEMPTS: 3,

        /** Intervalo entre intentos (minutos) */
        RETRY_INTERVAL_MINUTES: 15
    } as const,

    /**
     * Tipos de notificaciones para eventos
     */
    NOTIFICATION_TYPES: {
        REMINDER: 'REMINDER',
        OVERDUE: 'OVERDUE',
        CANCELLED: 'CANCELLED',
        POSTPONED: 'POSTPONED',
        COMPLETED: 'COMPLETED',
        ASSIGNED: 'ASSIGNED'
    } as const,

    /**
     * Mensajes de notificación por defecto
     */
    DEFAULT_NOTIFICATION_MESSAGES: {
        [EventType.VACCINATION]: 'Recordatorio de vacunación programada',
        [EventType.HEALTH_CHECK]: 'Recordatorio de chequeo de salud',
        [EventType.TREATMENT]: 'Recordatorio de tratamiento',
        [EventType.MEDICATION]: 'Recordatorio de medicación',
        [EventType.SURGERY]: 'Cirugía programada',
        [EventType.REPRODUCTION]: 'Evento reproductivo programado',
        [EventType.PREGNANCY_CHECK]: 'Chequeo de gestación programado',
        [EventType.BIRTH]: 'Parto programado',
        [EventType.WEANING]: 'Destete programado',
        [EventType.WEIGHING]: 'Pesaje programado',
        [EventType.MOVEMENT]: 'Movimiento programado',
        [EventType.QUARANTINE]: 'Cuarentena programada',
        [EventType.OTHER]: 'Evento programado'
    } as const,

    /**
     * Horarios laborables (para validaciones)
     */
    BUSINESS_HOURS: {
        START: 8,  // 8:00 AM
        END: 18,   // 6:00 PM
        WEEKEND_WORKING: false
    } as const,

    /**
     * Límites de la API
     */
    API_LIMITS: {
        MAX_BATCH_SIZE: 50,
        MAX_RECURRENCE_GENERATION: 100,
        CACHE_TTL: 300 // 5 minutos en segundos
    } as const,
    /**
    * Orden de prioridad para ordenar eventos por estado
    * Útil para listados donde queremos mostrar primero los programados,
    * luego en progreso, etc.
    */
    STATUS_PRIORITY: {
        [EventStatus.SCHEDULED]: 1,      // Programados primero
        [EventStatus.IN_PROGRESS]: 2,    // En progreso segundo
        [EventStatus.POSTPONED]: 3,      // Pospuestos tercero
        [EventStatus.COMPLETED]: 4,       // Completados cuarto
        [EventStatus.CANCELLED]: 5        // Cancelados al final
    } as const,
} as const;

// ============================================================================
// EXPORTACIONES INDIVIDUALES
// ============================================================================

export const {
    TIME_LIMITS,
    RECURRENCE_LIMITS,
    ESTIMATED_COSTS,
    ESTIMATED_DURATIONS,
    REQUIREMENTS,
    EVENT_TYPE_LABELS,
    STATUS_LABELS,
    PRIORITY_LABELS,
    PRIORITY_COLORS,
    RECURRENCE_OPTIONS,
    DAYS_OF_WEEK,
    DAY_NAMES,
    DATE_VALIDATIONS,
    PAGINATION,
    ALERT_THRESHOLDS,
    NOTIFICATION_TYPES,
    DEFAULT_NOTIFICATION_MESSAGES,
    BUSINESS_HOURS,
    API_LIMITS,
    STATUS_PRIORITY
} = EVENT_CONSTANTS;

// ============================================================================
// TIPOS DERIVADOS
// ============================================================================

export type EventConstants = typeof EVENT_CONSTANTS;
export type TimeLimits = typeof TIME_LIMITS;
export type RecurrenceLimits = typeof RECURRENCE_LIMITS;
export type EstimatedCosts = typeof ESTIMATED_COSTS;
export type EstimatedDurations = typeof ESTIMATED_DURATIONS;
export type Requirements = typeof REQUIREMENTS;
export type EventTypeLabels = typeof EVENT_TYPE_LABELS;
export type StatusLabels = typeof STATUS_LABELS;
export type PriorityLabels = typeof PRIORITY_LABELS;
export type PriorityColors = typeof PRIORITY_COLORS;
export type RecurrenceOptions = typeof RECURRENCE_OPTIONS;
export type DaysOfWeek = typeof DAYS_OF_WEEK;
export type DayNames = typeof DAY_NAMES;
export type DateValidations = typeof DATE_VALIDATIONS;
export type EventPagination = typeof PAGINATION;
export type EventAlertThresholds = typeof ALERT_THRESHOLDS;
export type NotificationTypes = typeof NOTIFICATION_TYPES;
export type DefaultNotificationMessages = typeof DEFAULT_NOTIFICATION_MESSAGES;
export type BusinessHours = typeof BUSINESS_HOURS;
export type EventApiLimits = typeof API_LIMITS;