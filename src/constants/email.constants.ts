// constants/email.constants.ts
import { EmailType, EmailPriority } from '../enums/email.enums';

export const EMAIL_CONSTANTS = {
    /**
     * Configuración de reintentos por prioridad
     */
    RETRY_CONFIG: {
        [EmailPriority.LOW]: {
            maxAttempts: 2,
            backoffMinutes: 10
        },
        [EmailPriority.MEDIUM]: {
            maxAttempts: 3,
            backoffMinutes: 5
        },
        [EmailPriority.HIGH]: {
            maxAttempts: 5,
            backoffMinutes: 2
        },
        [EmailPriority.CRITICAL]: {
            maxAttempts: 10,
            backoffMinutes: 1
        }
    } as const,

    /**
     * Tiempo de expiración de emails en cola (horas)
     */
    EXPIRATION_HOURS: {
        [EmailPriority.LOW]: 72,
        [EmailPriority.MEDIUM]: 48,
        [EmailPriority.HIGH]: 24,
        [EmailPriority.CRITICAL]: 6
    } as const,

    /**
     * Límites de la API
     */
    API_LIMITS: {
        MAX_RECIPIENTS_PER_BATCH: 100,
        MAX_ATTACHMENTS_PER_EMAIL: 10,
        MAX_ATTACHMENT_SIZE_MB: 25,
        QUEUE_CLEANUP_DAYS: 7
    } as const,

    /**
     * Asuntos por defecto según tipo
     */
    DEFAULT_SUBJECTS: {
        [EmailType.WELCOME]: '¡Bienvenido al Sistema Ganadero UJAT! 🐄',
        [EmailType.PASSWORD_RESET]: 'Restablece tu contraseña - Sistema Ganadero UJAT',
        [EmailType.VACCINATION_REMINDER]: '🏥 Recordatorio de Vacunación',
        [EmailType.HEALTH_ALERT]: '🚨 ALERTA DE SALUD',
        [EmailType.WEEKLY_REPORT]: '📊 Reporte Semanal',
        [EmailType.EMAIL_VERIFICATION]: 'Verifica tu cuenta - Sistema Ganadero UJAT',
        [EmailType.SYSTEM_NOTIFICATION]: '🔔 Notificación del Sistema',
        [EmailType.EMERGENCY_ALERT]: '🚨 ALERTA DE EMERGENCIA',
        [EmailType.ACCOUNT_LOCKED]: '🔒 Cuenta Bloqueada - Acción Requerida',
        [EmailType.PROFILE_UPDATED]: '📝 Perfil Actualizado'
    } as const,

    /**
     * Etiquetas en español
     */
    TYPE_LABELS: {
        [EmailType.WELCOME]: 'Bienvenida',
        [EmailType.PASSWORD_RESET]: 'Restablecer Contraseña',
        [EmailType.VACCINATION_REMINDER]: 'Recordatorio de Vacunación',
        [EmailType.HEALTH_ALERT]: 'Alerta de Salud',
        [EmailType.WEEKLY_REPORT]: 'Reporte Semanal',
        [EmailType.EMAIL_VERIFICATION]: 'Verificación de Email',
        [EmailType.SYSTEM_NOTIFICATION]: 'Notificación del Sistema',
        [EmailType.EMERGENCY_ALERT]: 'Alerta de Emergencia',
        [EmailType.ACCOUNT_LOCKED]: 'Cuenta Bloqueada',
        [EmailType.PROFILE_UPDATED]: 'Perfil Actualizado'
    } as const,

    PRIORITY_LABELS: {
        [EmailPriority.LOW]: 'Baja',
        [EmailPriority.MEDIUM]: 'Media',
        [EmailPriority.HIGH]: 'Alta',
        [EmailPriority.CRITICAL]: 'Crítica'
    } as const
} as const;

export const {
    RETRY_CONFIG,
    EXPIRATION_HOURS,
    API_LIMITS,
    DEFAULT_SUBJECTS,
    TYPE_LABELS,
    PRIORITY_LABELS
} = EMAIL_CONSTANTS;