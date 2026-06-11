// controllers/notification.controller.ts
import { Request, Response } from 'express';
import { notificationService, NotificationFilters } from '../services/NotificationService';
import { NotificationError } from '../utils/NotificationErrors';
import logger from '../utils/logger';

export class NotificationController {
    private readonly context = 'NotificationController';

    constructor() {
        this.listNotifications = this.listNotifications.bind(this);
        this.getUnreadCount = this.getUnreadCount.bind(this);
        this.getNotificationById = this.getNotificationById.bind(this);
        this.markAsRead = this.markAsRead.bind(this);
        this.markAllAsRead = this.markAllAsRead.bind(this);
        this.deleteNotification = this.deleteNotification.bind(this);
    }

    /**
     * GET /api/notifications
     * Lista notificaciones del usuario autenticado con filtros opcionales.
     */
    async listNotifications(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            // Construir filtros desde query params
            const filters: NotificationFilters = {
                userId, // siempre filtramos por el usuario autenticado
                type: req.query.type ? (req.query.type as string).split(',') as any : undefined,
                status: req.query.status ? (req.query.status as string).split(',') as any : undefined,
                priority: req.query.priority ? (req.query.priority as string).split(',') as any : undefined,
                startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
                read: req.query.read === 'true' ? true : req.query.read === 'false' ? false : undefined,
                limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
                offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
            };

            const { rows, count, unreadCount } = await notificationService.listNotifications(filters);

            // Formatear cada notificación para respuesta
            const data = rows.map(notif => notificationService.formatNotificationResponse(notif));

            res.json({
                success: true,
                data,
                pagination: {
                    total: count,
                    unread: unreadCount,
                    limit: filters.limit || 50,
                    offset: filters.offset || 0,
                },
            });
        } catch (error) {
            logger.error('Error en listNotifications', this.context, { query: req.query }, error as Error);
            if (error instanceof NotificationError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * GET /api/notifications/unread-count
     * Obtiene el número de notificaciones no leídas del usuario.
     */
    async getUnreadCount(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const count = await notificationService.getUnreadCount(userId);
            res.json({ success: true, data: { unreadCount: count } });
        } catch (error) {
            logger.error('Error en getUnreadCount', this.context, {}, error as Error);
            if (error instanceof NotificationError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * GET /api/notifications/:id
     * Obtiene una notificación específica por ID (debe pertenecer al usuario).
     */
    async getNotificationById(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { id } = req.params;
            const notification = await notificationService.getNotificationById(id, userId);
            if (!notification) {
                res.status(404).json({ success: false, error: 'Notificación no encontrada' });
                return;
            }

            const data = notificationService.formatNotificationResponse(notification);
            res.json({ success: true, data });
        } catch (error) {
            logger.error('Error en getNotificationById', this.context, { id: req.params.id }, error as Error);
            if (error instanceof NotificationError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * PATCH /api/notifications/:id/read
     * Marca una notificación como leída.
     */
    async markAsRead(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { id } = req.params;
            const notification = await notificationService.markAsRead(id, userId);
            const data = notificationService.formatNotificationResponse(notification);
            res.json({ success: true, data, message: 'Notificación marcada como leída' });
        } catch (error) {
            logger.error('Error en markAsRead', this.context, { id: req.params.id }, error as Error);
            if (error instanceof NotificationError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * POST /api/notifications/mark-all-read
     * Marca todas las notificaciones del usuario como leídas.
     */
    async markAllAsRead(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const count = await notificationService.markAllAsRead(userId);
            res.json({ success: true, data: { markedCount: count }, message: 'Todas las notificaciones marcadas como leídas' });
        } catch (error) {
            logger.error('Error en markAllAsRead', this.context, {}, error as Error);
            if (error instanceof NotificationError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * DELETE /api/notifications/:id
     * Elimina una notificación (soft delete).
     */
    async deleteNotification(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { id } = req.params;
            await notificationService.deleteNotification(id, userId);
            res.json({ success: true, message: 'Notificación eliminada' });
        } catch (error) {
            logger.error('Error en deleteNotification', this.context, { id: req.params.id }, error as Error);
            if (error instanceof NotificationError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }
}

export const notificationController = new NotificationController();