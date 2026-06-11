// routes/push.routes.ts
import { Router } from 'express';
import { pushController } from '../controllers/push.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Registrar un token push
router.post('/tokens', pushController.registerToken.bind(pushController));

// Eliminar un token push
router.delete('/tokens/:token', pushController.removeToken.bind(pushController));

// Obtener estadísticas de tokens del usuario
router.get('/tokens/stats', pushController.getStats.bind(pushController));

export default router;