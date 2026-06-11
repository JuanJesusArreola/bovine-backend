import { Router } from 'express';
import { eventController } from '../controllers/event.controller';
import { authenticateToken } from '../middleware/auth';
import { validateId } from '../middleware/validation';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas especiales (deben ir antes de /:id)
router.get('/upcoming', eventController.getUpcomingEvents);
router.get('/overdue', eventController.getOverdueEvents);
router.get('/bovine/:bovineId', eventController.getEventsByBovine);

// CRUD y acciones
router.get('/', eventController.listEvents);
router.get('/:id', validateId('id'), eventController.getEventById);
router.post('/', eventController.createEvent); // Opcional: agregar validación con validate('createEvent')
router.put('/:id', validateId('id'), eventController.updateEvent);
router.delete('/:id', validateId('id'), eventController.deleteEvent);

// Acciones sobre eventos
router.post('/:id/start', validateId('id'), eventController.startEvent);
router.post('/:id/complete', validateId('id'), eventController.completeEvent);
router.post('/:id/cancel', validateId('id'), eventController.cancelEvent);
router.post('/:id/postpone', validateId('id'), eventController.postponeEvent);

export default router;