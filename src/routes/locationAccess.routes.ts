// routes/locationAccess.routes.ts
import { Router } from 'express';
import { locationAccessController } from '../controllers/locationAccess.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Consulta de acceso (verificación simple)
router.get('/:locationId/access', locationAccessController.canAccess);

// Gestión de accesos
router.get('/my-accesses', locationAccessController.getUserActiveAccesses);
router.post('/grant', locationAccessController.grantAccess);
router.post('/:accessId/revoke', locationAccessController.revokeAccess);
router.post('/:accessId/extend', locationAccessController.extendAccess);
router.post('/:accessId/record', locationAccessController.recordAccess);

// Administración (solo admin)
router.post('/cleanup-expired', locationAccessController.cleanupExpiredAccesses);

export default router;