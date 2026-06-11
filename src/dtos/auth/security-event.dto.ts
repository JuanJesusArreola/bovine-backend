// dtos/auth/security-event.dto.ts
import { EventType, EventSeverity } from '../../models/SecurityEvent';

/**
 * DTO para respuesta de evento de seguridad
 */
export interface SecurityEventResponseDTO {
    id: string;
    eventType: EventType;
    eventTypeLabel: string;
    severity: EventSeverity;
    severityLabel: string;
    description: string;
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    userAgent?: string;
    location?: {
        country?: string;
        region?: string;
        city?: string;
        latitude?: number;
        longitude?: number;
        timezone?: string;
    };
    resolved: boolean;
    resolvedAt?: Date;
    resolvedBy?: string;
    createdAt: Date;
}

/**
 * DTO para respuesta detallada de evento de seguridad
 */
export interface SecurityEventDetailResponseDTO extends SecurityEventResponseDTO {
    deviceInfo?: {
        type?: string;
        os?: string;
        browser?: string;
        version?: string;
    };
    sessionId?: string;
    tokenId?: string;
    additionalData?: Record<string, any>;
    resolutionNotes?: string;
}

/**
 * DTO para filtros de listado de eventos
 */
export interface SecurityEventFiltersDTO {
    userId?: string;
    eventType?: EventType[];
    severity?: EventSeverity[];
    resolved?: boolean;
    ipAddress?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}

/**
 * DTO para estadísticas de eventos de seguridad
 */
export interface SecurityEventStatsResponseDTO {
    period: {
        days: number;
    };
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    critical: number;
    unresolved: number;
    resolved: number;
    resolutionRate: number;
}

/**
 * DTO para resolver evento
 */
export interface ResolveEventRequestDTO {
    notes?: string;
}

/**
 * DTO para resolver múltiples eventos
 */
export interface ResolveEventsRequestDTO {
    eventIds: string[];
    notes?: string;
}