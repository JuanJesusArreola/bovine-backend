// controllers/event.controller.ts
import { Request, Response } from 'express';
import { eventService, EventFilters } from '../services/EventService';
import { EventError } from '../utils/EventErrors';
import logger from '../utils/logger';

export class EventController {
    private readonly context = 'EventController';

    constructor() {
        this.listEvents = this.listEvents.bind(this);
        this.getUpcomingEvents = this.getUpcomingEvents.bind(this);
        this.getOverdueEvents = this.getOverdueEvents.bind(this);
        this.getEventsByBovine = this.getEventsByBovine.bind(this);
        this.getEventById = this.getEventById.bind(this);
        this.createEvent = this.createEvent.bind(this);
        this.updateEvent = this.updateEvent.bind(this);
        this.deleteEvent = this.deleteEvent.bind(this);
        this.startEvent = this.startEvent.bind(this);
        this.completeEvent = this.completeEvent.bind(this);
        this.cancelEvent = this.cancelEvent.bind(this);
        this.postponeEvent = this.postponeEvent.bind(this);
    }

    /**
     * GET /api/events
     * Lista eventos con filtros opcionales.
     */
    async listEvents(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            // Construir filtros desde query params
            const filters: EventFilters = {
                bovineId: req.query.bovineId as string,
                ranchId: req.query.ranchId as string,
                eventType: req.query.eventType ? (req.query.eventType as string).split(',') as any : undefined,
                status: req.query.status ? (req.query.status as string).split(',') as any : undefined,
                priority: req.query.priority ? (req.query.priority as string).split(',') as any : undefined,
                startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
                assignedTo: req.query.assignedTo as string,
                veterinarianId: req.query.veterinarianId as string,
                isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
            };

            const pagination = {
                page: req.query.page ? parseInt(req.query.page as string) : 1,
                limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
            };

            const { rows, count } = await eventService.listEvents(filters, pagination);

            // Formatear cada evento
            const data = rows.map(event => eventService.formatEventResponse(event));

            res.json({
                success: true,
                data,
                pagination: {
                    total: count,
                    page: pagination.page,
                    limit: pagination.limit,
                    pages: Math.ceil(count / pagination.limit),
                },
            });
        } catch (error) {
            logger.error('Error en listEvents', this.context, { query: req.query }, error as Error);
            if (error instanceof EventError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * GET /api/events/upcoming
     * Lista eventos próximos (próximos N días) de un rancho.
     */
    async getUpcomingEvents(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const ranchId = req.query.ranchId as string;
            if (!ranchId) {
                res.status(400).json({ success: false, error: 'ranchId es requerido' });
                return;
            }

            const days = req.query.days ? parseInt(req.query.days as string) : 7;
            const events = await eventService.getUpcomingEvents(ranchId, days);
            const data = events.map(event => eventService.formatEventResponse(event));
            res.json({ success: true, data });
        } catch (error) {
            logger.error('Error en getUpcomingEvents', this.context, { query: req.query }, error as Error);
            if (error instanceof EventError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * GET /api/events/overdue
     * Lista eventos atrasados de un rancho.
     */
    async getOverdueEvents(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const ranchId = req.query.ranchId as string;
            if (!ranchId) {
                res.status(400).json({ success: false, error: 'ranchId es requerido' });
                return;
            }

            const events = await eventService.getOverdueEvents(ranchId);
            const data = events.map(event => eventService.formatEventResponse(event));
            res.json({ success: true, data });
        } catch (error) {
            logger.error('Error en getOverdueEvents', this.context, { query: req.query }, error as Error);
            if (error instanceof EventError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * GET /api/events/bovine/:bovineId
     * Lista eventos de un bovino específico.
     */
    async getEventsByBovine(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { bovineId } = req.params;
            const status = req.query.status ? (req.query.status as string).split(',') as any : undefined;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

            const events = await eventService.getEventsByBovine(bovineId, status, limit);
            const data = events.map(event => eventService.formatEventResponse(event));
            res.json({ success: true, data });
        } catch (error) {
            logger.error('Error en getEventsByBovine', this.context, { bovineId: req.params.bovineId }, error as Error);
            if (error instanceof EventError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * GET /api/events/:id
     * Obtiene un evento por ID.
     */
    async getEventById(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { id } = req.params;
            const event = await eventService.getEventById(id);
            if (!event) {
                res.status(404).json({ success: false, error: 'Evento no encontrado' });
                return;
            }

            // Aquí podrías verificar que el usuario tenga acceso al rancho/bovino, pero lo dejamos al servicio.
            const data = eventService.formatEventResponse(event);
            res.json({ success: true, data });
        } catch (error) {
            logger.error('Error en getEventById', this.context, { id: req.params.id }, error as Error);
            if (error instanceof EventError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * POST /api/events
     * Crea un nuevo evento.
     */
    async createEvent(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            // El DTO CreateEventDTO se construye a partir del body, pero debemos asegurar que el usuario autenticado sea el creador.
            // También podríamos validar con un middleware de validación.
            const eventData = {
                ...req.body,
                createdBy: userId, // Aseguramos que el creador es el usuario autenticado
            };

            const event = await eventService.createEvent(eventData);
            const data = eventService.formatEventResponse(event);
            res.status(201).json({ success: true, data, message: 'Evento creado exitosamente' });
        } catch (error) {
            logger.error('Error en createEvent', this.context, { body: req.body }, error as Error);
            if (error instanceof EventError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * PUT /api/events/:id
     * Actualiza un evento existente.
     */
    async updateEvent(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { id } = req.params;
            const eventData = {
                id,
                ...req.body,
            };

            const event = await eventService.updateEvent(id, eventData);
            const data = eventService.formatEventResponse(event);
            res.json({ success: true, data, message: 'Evento actualizado exitosamente' });
        } catch (error) {
            logger.error('Error en updateEvent', this.context, { id: req.params.id, body: req.body }, error as Error);
            if (error instanceof EventError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * DELETE /api/events/:id
     * Elimina un evento (soft delete).
     */
    async deleteEvent(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { id } = req.params;
            await eventService.deleteEvent(id);
            res.json({ success: true, message: 'Evento eliminado' });
        } catch (error) {
            logger.error('Error en deleteEvent', this.context, { id: req.params.id }, error as Error);
            if (error instanceof EventError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * POST /api/events/:id/start
     * Marca un evento como en progreso.
     */
    async startEvent(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { id } = req.params;
            const event = await eventService.startEvent(id, userId);
            const data = eventService.formatEventResponse(event);
            res.json({ success: true, data, message: 'Evento iniciado' });
        } catch (error) {
            logger.error('Error en startEvent', this.context, { id: req.params.id }, error as Error);
            if (error instanceof EventError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * POST /api/events/:id/complete
     * Completa un evento y lo vincula con un registro de salud.
     */
    async completeEvent(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { id } = req.params;
            const { healthRecordId } = req.body;
            if (!healthRecordId) {
                res.status(400).json({ success: false, error: 'healthRecordId es requerido' });
                return;
            }

            const event = await eventService.completeEvent(id, healthRecordId, userId);
            const data = eventService.formatEventResponse(event);
            res.json({ success: true, data, message: 'Evento completado' });
        } catch (error) {
            logger.error('Error en completeEvent', this.context, { id: req.params.id, body: req.body }, error as Error);
            if (error instanceof EventError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * POST /api/events/:id/cancel
     * Cancela un evento.
     */
    async cancelEvent(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { id } = req.params;
            const { reason } = req.body;
            if (!reason) {
                res.status(400).json({ success: false, error: 'reason es requerido' });
                return;
            }

            const event = await eventService.cancelEvent(id, reason, userId);
            const data = eventService.formatEventResponse(event);
            res.json({ success: true, data, message: 'Evento cancelado' });
        } catch (error) {
            logger.error('Error en cancelEvent', this.context, { id: req.params.id, body: req.body }, error as Error);
            if (error instanceof EventError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * POST /api/events/:id/postpone
     * Pospone un evento.
     */
    async postponeEvent(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { id } = req.params;
            const { newDate, reason } = req.body;
            if (!newDate) {
                res.status(400).json({ success: false, error: 'newDate es requerido' });
                return;
            }
            if (!reason) {
                res.status(400).json({ success: false, error: 'reason es requerido' });
                return;
            }

            const event = await eventService.postponeEvent(id, new Date(newDate), reason, userId);
            const data = eventService.formatEventResponse(event);
            res.json({ success: true, data, message: 'Evento pospuesto' });
        } catch (error) {
            logger.error('Error en postponeEvent', this.context, { id: req.params.id, body: req.body }, error as Error);
            if (error instanceof EventError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }
}

export const eventController = new EventController();