import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticateToken } from '../middleware/auth';
import { validateId } from '../middleware/validation';

const router = Router();

router.use(authenticateToken);

router.get('/', notificationController.listNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.get('/:id', validateId('id'), notificationController.getNotificationById);
router.patch('/:id/read', validateId('id'), notificationController.markAsRead);
router.post('/mark-all-read', notificationController.markAllAsRead);
router.delete('/:id', validateId('id'), notificationController.deleteNotification);

export default router;