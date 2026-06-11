// constants/notification.constants.ts
import {
    NotificationType,
    NotificationChannel,
    NotificationPriority,
    NotificationStatus
} from '../models/Notification';

export const NOTIFICATION_CONSTANTS = {
    /**
     * Límites de reintentos por prioridad
     */
    RETRY_LIMITS: {
        [NotificationPriority.LOW]: 2,
        [NotificationPriority.MEDIUM]: 3,
        [NotificationPriority.HIGH]: 5,
        [NotificationPriority.URGENT]: 10
    } as const,

    /**
     * Intervalos entre reintentos (en minutos)
     */
    RETRY_INTERVALS: {
        [NotificationPriority.LOW]: 60,
        [NotificationPriority.MEDIUM]: 30,
        [NotificationPriority.HIGH]: 15,
        [NotificationPriority.URGENT]: 5
    } as const,

    /**
     * Tiempo de expiración por prioridad (en minutos)
     */
    EXPIRATION_TIMES: {
        [NotificationPriority.LOW]: 7 * 24 * 60,      // 7 días
        [NotificationPriority.MEDIUM]: 3 * 24 * 60,   // 3 días
        [NotificationPriority.HIGH]: 24 * 60,         // 24 horas
        [NotificationPriority.URGENT]: 60               // 1 hora
    } as const,

    /**
     * Canales disponibles por tipo de notificación
     */
    AVAILABLE_CHANNELS: {
        [NotificationType.HEALTH_ALERT]: [
            NotificationChannel.EMAIL,
            NotificationChannel.SMS,
            NotificationChannel.PUSH,
            NotificationChannel.IN_APP
        ],
        [NotificationType.VACCINATION_REMINDER]: [
            NotificationChannel.EMAIL,
            NotificationChannel.SMS,
            NotificationChannel.PUSH,
            NotificationChannel.IN_APP
        ],
        [NotificationType.TREATMENT_REMINDER]: [
            NotificationChannel.EMAIL,
            NotificationChannel.SMS,
            NotificationChannel.PUSH,
            NotificationChannel.IN_APP
        ],
        [NotificationType.BIRTH_ALERT]: [
            NotificationChannel.EMAIL,
            NotificationChannel.SMS,
            NotificationChannel.PUSH,
            NotificationChannel.IN_APP
        ],
        [NotificationType.WEANING_ALERT]: [
            NotificationChannel.EMAIL,
            NotificationChannel.IN_APP
        ],
        [NotificationType.HEAT_DETECTION]: [
            NotificationChannel.EMAIL,
            NotificationChannel.PUSH,
            NotificationChannel.IN_APP
        ],
        [NotificationType.INSEMINATION_RESULT]: [
            NotificationChannel.EMAIL,
            NotificationChannel.IN_APP
        ],
        [NotificationType.PREGNANCY_CHECK]: [
            NotificationChannel.EMAIL,
            NotificationChannel.PUSH,
            NotificationChannel.IN_APP
        ],
        [NotificationType.WEIGHT_MILESTONE]: [
            NotificationChannel.EMAIL,
            NotificationChannel.IN_APP
        ],
        [NotificationType.LOW_STOCK_ALERT]: [
            NotificationChannel.EMAIL,
            NotificationChannel.IN_APP
        ],
        [NotificationType.EXPIRATION_ALERT]: [
            NotificationChannel.EMAIL,
            NotificationChannel.IN_APP
        ],
        [NotificationType.GEOFENCE_ALERT]: [
            NotificationChannel.SMS,
            NotificationChannel.PUSH,
            NotificationChannel.IN_APP
        ],
        [NotificationType.MOVEMENT_ALERT]: [
            NotificationChannel.SMS,
            NotificationChannel.PUSH,
            NotificationChannel.IN_APP
        ],
        [NotificationType.SYSTEM_ALERT]: [
            NotificationChannel.EMAIL,
            NotificationChannel.IN_APP
        ],
        [NotificationType.TASK_REMINDER]: [
            NotificationChannel.EMAIL,
            NotificationChannel.PUSH,
            NotificationChannel.IN_APP
        ],
        [NotificationType.REPORT_READY]: [
            NotificationChannel.EMAIL,
            NotificationChannel.IN_APP
        ],
        [NotificationType.PRODUCTION_ALERT]: [
            NotificationChannel.EMAIL,
            NotificationChannel.SMS,
            NotificationChannel.PUSH,
            NotificationChannel.IN_APP
        ],
        [NotificationType.REPRODUCTION_ALERT]: [
            NotificationChannel.EMAIL,
            NotificationChannel.SMS,
            NotificationChannel.PUSH,
            NotificationChannel.IN_APP
        ],
    } as const,

    /**
     * Prioridad por defecto según tipo
     */
    DEFAULT_PRIORITY: {
        [NotificationType.HEALTH_ALERT]: NotificationPriority.HIGH,
        [NotificationType.VACCINATION_REMINDER]: NotificationPriority.MEDIUM,
        [NotificationType.TREATMENT_REMINDER]: NotificationPriority.MEDIUM,
        [NotificationType.BIRTH_ALERT]: NotificationPriority.HIGH,
        [NotificationType.WEANING_ALERT]: NotificationPriority.MEDIUM,
        [NotificationType.HEAT_DETECTION]: NotificationPriority.HIGH,
        [NotificationType.INSEMINATION_RESULT]: NotificationPriority.MEDIUM,
        [NotificationType.PREGNANCY_CHECK]: NotificationPriority.HIGH,
        [NotificationType.WEIGHT_MILESTONE]: NotificationPriority.LOW,
        [NotificationType.LOW_STOCK_ALERT]: NotificationPriority.MEDIUM,
        [NotificationType.EXPIRATION_ALERT]: NotificationPriority.MEDIUM,
        [NotificationType.GEOFENCE_ALERT]: NotificationPriority.HIGH,
        [NotificationType.MOVEMENT_ALERT]: NotificationPriority.HIGH,
        [NotificationType.SYSTEM_ALERT]: NotificationPriority.HIGH,
        [NotificationType.TASK_REMINDER]: NotificationPriority.MEDIUM,
        [NotificationType.REPORT_READY]: NotificationPriority.LOW,
        [NotificationType.PRODUCTION_ALERT]: NotificationPriority.MEDIUM,
        [NotificationType.REPRODUCTION_ALERT]: NotificationPriority.HIGH,
    } as const,

    /**
     * Títulos por defecto según tipo
     */
    DEFAULT_TITLES: {
        [NotificationType.HEALTH_ALERT]: '🚨 Alerta de Salud',
        [NotificationType.VACCINATION_REMINDER]: '💉 Recordatorio de Vacunación',
        [NotificationType.BIRTH_ALERT]: '🐄 ¡Nuevo Nacimiento!',
        [NotificationType.LOW_STOCK_ALERT]: '📦 Stock Bajo',
        [NotificationType.GEOFENCE_ALERT]: '📍 Alerta de Ubicación',
        [NotificationType.REPORT_READY]: '📊 Reporte Listo',
        [NotificationType.PRODUCTION_ALERT]: '⚠️ Alerta de Producción',
        [NotificationType.REPRODUCTION_ALERT]: '🐄 Alerta Reproductiva',
        [NotificationType.TREATMENT_REMINDER]: '💊 Recordatorio de Tratamiento',
        [NotificationType.WEANING_ALERT]: '🐄 Alerta de Destete',
        [NotificationType.HEAT_DETECTION]: '🔥 Detección de Celo',
        [NotificationType.INSEMINATION_RESULT]: '🤰 Resultado de Inseminación',
        [NotificationType.PREGNANCY_CHECK]: '🤰 Chequeo de Gestación',
        [NotificationType.WEIGHT_MILESTONE]: '⚖️ Hito de Peso',
        [NotificationType.EXPIRATION_ALERT]: '⏰ Alerta de Vencimiento',
        [NotificationType.MOVEMENT_ALERT]: '🚶 Alerta de Movimiento',
        [NotificationType.SYSTEM_ALERT]: '⚙️ Alerta del Sistema',
        [NotificationType.TASK_REMINDER]: '✅ Recordatorio de Tarea',
    } as const,

    /**
     * Etiquetas en español
     */
    TYPE_LABELS: {
        [NotificationType.HEALTH_ALERT]: 'Alerta de Salud',
        [NotificationType.VACCINATION_REMINDER]: 'Recordatorio de Vacunación',
        [NotificationType.TREATMENT_REMINDER]: 'Recordatorio de Tratamiento',
        [NotificationType.BIRTH_ALERT]: 'Alerta de Nacimiento',
        [NotificationType.WEANING_ALERT]: 'Alerta de Destete',
        [NotificationType.HEAT_DETECTION]: 'Detección de Celo',
        [NotificationType.INSEMINATION_RESULT]: 'Resultado de Inseminación',
        [NotificationType.PREGNANCY_CHECK]: 'Chequeo de Gestación',
        [NotificationType.WEIGHT_MILESTONE]: 'Hito de Peso',
        [NotificationType.LOW_STOCK_ALERT]: 'Alerta de Stock Bajo',
        [NotificationType.EXPIRATION_ALERT]: 'Alerta de Vencimiento',
        [NotificationType.GEOFENCE_ALERT]: 'Alerta de Geocerca',
        [NotificationType.MOVEMENT_ALERT]: 'Alerta de Movimiento',
        [NotificationType.SYSTEM_ALERT]: 'Alerta del Sistema',
        [NotificationType.TASK_REMINDER]: 'Recordatorio de Tarea',
        [NotificationType.REPORT_READY]: 'Reporte Listo',
        [NotificationType.PRODUCTION_ALERT]: 'Alerta de Producción',
        [NotificationType.REPRODUCTION_ALERT]: 'Alerta Reproductiva',
    } as const,

    CHANNEL_LABELS: {
        [NotificationChannel.EMAIL]: 'Correo Electrónico',
        [NotificationChannel.SMS]: 'Mensaje de Texto',
        [NotificationChannel.PUSH]: 'Notificación Push',
        [NotificationChannel.IN_APP]: 'Notificación en App',
        [NotificationChannel.WHATSAPP]: 'WhatsApp'
    } as const,

    PRIORITY_LABELS: {
        [NotificationPriority.LOW]: 'Baja',
        [NotificationPriority.MEDIUM]: 'Media',
        [NotificationPriority.HIGH]: 'Alta',
        [NotificationPriority.URGENT]: 'Urgente'
    } as const,

    STATUS_LABELS: {
        [NotificationStatus.PENDING]: 'Pendiente',
        [NotificationStatus.SENT]: 'Enviado',
        [NotificationStatus.DELIVERED]: 'Entregado',
        [NotificationStatus.READ]: 'Leído',
        [NotificationStatus.FAILED]: 'Fallido',
        [NotificationStatus.CANCELLED]: 'Cancelado'
    } as const,

    /**
     * Configuración de procesamiento por lotes
     */
    BATCH_PROCESSING: {
        MAX_BATCH_SIZE: 100,
        INTERVAL_MS: 5000,  // 5 segundos
        CONCURRENT_BATCHES: 3
    } as const,

    /**
     * Límites de la API
     */
    API_LIMITS: {
        MAX_NOTIFICATIONS_PER_REQUEST: 50,
        MAX_SCHEDULE_DAYS: 30,
        CACHE_TTL: 300  // 5 minutos
    } as const
} as const;

export const {
    RETRY_LIMITS,
    RETRY_INTERVALS,
    EXPIRATION_TIMES,
    AVAILABLE_CHANNELS,
    DEFAULT_PRIORITY,
    DEFAULT_TITLES,
    TYPE_LABELS,
    CHANNEL_LABELS,
    PRIORITY_LABELS,
    STATUS_LABELS,
    BATCH_PROCESSING,
    API_LIMITS
} = NOTIFICATION_CONSTANTS;

export type NotificationConstants = typeof NOTIFICATION_CONSTANTS;
export type RetryLimits = typeof RETRY_LIMITS;
export type AvailableChannels = typeof AVAILABLE_CHANNELS;