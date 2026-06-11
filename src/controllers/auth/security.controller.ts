// controllers/auth/security.controller.ts
import { Request, Response } from 'express';
import { securityEventService } from '../../services/auth';
import { EventSeverity } from '../../models/SecurityEvent';
import logger from '../../utils/logger';

export class SecurityController {
    private readonly context = 'SecurityController';

    constructor() {
        this.listEvents = this.listEvents.bind(this);
        this.getUnresolvedEvents = this.getUnresolvedEvents.bind(this);
        this.getEventById = this.getEventById.bind(this);
        this.resolveEvent = this.resolveEvent.bind(this);
        this.resolveEvents = this.resolveEvents.bind(this);
        this.getStats = this.getStats.bind(this);
    }

    /**
     * GET /api/security/events
     * Lista eventos de seguridad (solo admin)
     */
    async listEvents(req: Request, res: Response): Promise<void> {
        try {
            const {
                userId,
                eventType,
                severity,
                resolved,
                ipAddress,
                startDate,
                endDate,
                limit = 50,
                offset = 0
            } = req.query;

            const filters = {
                userId: userId as string,
                eventType: eventType ? (eventType as string).split(',') as any[] : undefined,
                severity: severity ? (severity as string).split(',') as EventSeverity[] : undefined,
                resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
                ipAddress: ipAddress as string,
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                limit: parseInt(limit as string),
                offset: parseInt(offset as string)
            };

            const { rows, count } = await securityEventService.listEvents(filters);

            res.json({
                success: true,
                data: rows.map(event => ({
                    id: event.id,
                    eventType: event.event_type,
                    eventTypeLabel: securityEventService.getEventTypeLabel(event.event_type),
                    severity: event.severity,
                    severityLabel: securityEventService.getSeverityLabel(event.severity),
                    description: event.description,
                    userId: event.user_id,
                    userEmail: (event as any).user?.email,
                    ipAddress: event.ip_address,
                    userAgent: event.user_agent,
                    location: event.location,
                    resolved: event.resolved,
                    resolvedAt: event.resolved_at,
                    resolvedBy: event.resolved_by,
                    createdAt: event.created_at
                })),
                total: count,
                pagination: {
                    limit: filters.limit,
                    offset: filters.offset,
                    hasMore: (Number(offset) || 0) + rows.length < count
                }
            });

        } catch (error) {
            logger.error('Error en listEvents', this.context, { query: req.query }, error as Error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * GET /api/security/events/unresolved
     * Obtiene eventos no resueltos (solo admin)
     */
    async getUnresolvedEvents(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 50;

            const events = await securityEventService.getUnresolvedEvents(limit);

            res.json({
                success: true,
                data: events.map(event => ({
                    id: event.id,
                    eventType: event.event_type,
                    eventTypeLabel: securityEventService.getEventTypeLabel(event.event_type),
                    severity: event.severity,
                    severityLabel: securityEventService.getSeverityLabel(event.severity),
                    description: event.description,
                    userId: event.user_id,
                    ipAddress: event.ip_address,
                    createdAt: event.created_at,
                    timeElapsed: securityEventService.getTimeElapsed(event)
                })),
                count: events.length
            });

        } catch (error) {
            logger.error('Error en getUnresolvedEvents', this.context, {}, error as Error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * GET /api/security/events/:id
     * Obtiene un evento por ID
     */
    async getEventById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const event = await securityEventService.getEventById(id);

            if (!event) {
                res.status(404).json({
                    success: false,
                    error: 'Evento no encontrado'
                });
                return;
            }

            res.json({
                success: true,
                data: {
                    id: event.id,
                    eventType: event.event_type,
                    eventTypeLabel: securityEventService.getEventTypeLabel(event.event_type),
                    severity: event.severity,
                    severityLabel: securityEventService.getSeverityLabel(event.severity),
                    description: event.description,
                    userId: event.user_id,
                    userEmail: (event as any).user?.email,
                    ipAddress: event.ip_address,
                    userAgent: event.user_agent,
                    location: event.location,
                    deviceInfo: event.device_info,
                    sessionId: event.session_id,
                    tokenId: event.token_id,
                    additionalData: event.additional_data,
                    resolved: event.resolved,
                    resolvedAt: event.resolved_at,
                    resolvedBy: event.resolved_by,
                    resolutionNotes: event.resolution_notes,
                    createdAt: event.created_at
                }
            });

        } catch (error) {
            logger.error('Error en getEventById', this.context, { id: req.params.id }, error as Error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * POST /api/security/events/:id/resolve
     * Marca un evento como resuelto (solo admin)
     */
    async resolveEvent(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            const { notes } = req.body;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'No autenticado'
                });
                return;
            }

            const event = await securityEventService.resolveEvent(id, userId, notes);

            if (!event) {
                res.status(404).json({
                    success: false,
                    error: 'Evento no encontrado'
                });
                return;
            }

            res.json({
                success: true,
                data: {
                    id: event.id,
                    resolved: event.resolved,
                    resolvedAt: event.resolved_at,
                    resolvedBy: event.resolved_by
                },
                message: 'Evento marcado como resuelto'
            });

        } catch (error) {
            logger.error('Error en resolveEvent', this.context, { id: req.params.id }, error as Error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * POST /api/security/events/resolve-batch
     * Marca múltiples eventos como resueltos (solo admin)
     */
    async resolveEvents(req: Request, res: Response): Promise<void> {
        try {
            const { eventIds, notes } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'No autenticado'
                });
                return;
            }

            if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'Lista de IDs de eventos requerida'
                });
                return;
            }

            const count = await securityEventService.resolveEvents(eventIds, userId, notes);

            res.json({
                success: true,
                data: { resolved: count },
                message: `${count} eventos marcados como resueltos`
            });

        } catch (error) {
            logger.error('Error en resolveEvents', this.context, { body: req.body }, error as Error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * GET /api/security/stats
     * Obtiene estadísticas de eventos de seguridad
     */
    async getStats(req: Request, res: Response): Promise<void> {
        try {
            const days = parseInt(req.query.days as string) || 7;

            const stats = await securityEventService.getEventStats(days);

            res.json({
                success: true,
                data: {
                    period: { days },
                    total: stats.total,
                    byType: stats.byType,
                    bySeverity: stats.bySeverity,
                    critical: stats.critical,
                    unresolved: stats.unresolved,
                    resolved: stats.total - stats.unresolved,
                    resolutionRate: stats.total > 0
                        ? ((stats.total - stats.unresolved) / stats.total) * 100
                        : 100
                }
            });

        } catch (error) {
            logger.error('Error en getStats', this.context, { query: req.query }, error as Error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }
}

export const securityController = new SecurityController();