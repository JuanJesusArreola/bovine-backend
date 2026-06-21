import { Router } from 'express';
import { eventController } from '../controllers/event.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateId } from '../middleware/validation';
import { UserRole } from '../models/User';

const router = Router();

// Gestores que pueden crear/editar/borrar/reagendar eventos.
const EVENT_MANAGER_ROLES = [
  UserRole.MANAGER,
  UserRole.RANCH_MANAGER,
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
];

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas especiales (deben ir antes de /:id) — lectura abierta a autenticados
router.get('/upcoming', eventController.getUpcomingEvents);
router.get('/overdue', eventController.getOverdueEvents);
router.get('/bovine/:bovineId', eventController.getEventsByBovine);

// Lectura: cualquier rol autenticado
router.get('/', eventController.listEvents);
router.get('/:id', validateId('id'), eventController.getEventById);

// Escritura (crear/editar/borrar): solo gestores
router.post('/', authorizeRoles(...EVENT_MANAGER_ROLES), eventController.createEvent);
router.put('/:id', authorizeRoles(...EVENT_MANAGER_ROLES), validateId('id'), eventController.updateEvent);
router.delete('/:id', authorizeRoles(...EVENT_MANAGER_ROLES), validateId('id'), eventController.deleteEvent);

// Acciones de ejecución (start/complete/cancel/reportDelay): el asignado
// (trabajador/veterinario) O un gestor. El scoping se valida en el controlador.
router.post('/:id/start', validateId('id'), eventController.startEvent);
router.post('/:id/complete', validateId('id'), eventController.completeEvent);
router.post('/:id/cancel', validateId('id'), eventController.cancelEvent);
router.post('/:id/report-delay', validateId('id'), eventController.reportDelay);

// Reagendar (posponer): solo gestores.
router.post('/:id/postpone', authorizeRoles(...EVENT_MANAGER_ROLES), validateId('id'), eventController.postponeEvent);

export default router;