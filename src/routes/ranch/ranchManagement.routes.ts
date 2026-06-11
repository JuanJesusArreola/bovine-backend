// routes/ranchManagement.routes.ts
import { Router } from 'express';
import { ranchManagementController } from '../../controllers/ranch/ranchManagement.controller';
import { authenticateToken } from '../../middleware/auth';
import { validateId } from '../../middleware/validation';

const router = Router();

router.use(authenticateToken);

// RRHH
router.get('/:ranchId/hr', validateId('ranchId'), ranchManagementController.getHR);
router.put('/:ranchId/hr', validateId('ranchId'), ranchManagementController.createOrUpdateHR);
router.get('/:ranchId/hr/productivity', validateId('ranchId'), ranchManagementController.calculateProductivity);
router.get('/:ranchId/hr/turnover', validateId('ranchId'), ranchManagementController.analyzeTurnover);

// Emergencia
router.get('/:ranchId/emergency', validateId('ranchId'), ranchManagementController.getEmergencyPlan);
router.put('/:ranchId/emergency', validateId('ranchId'), ranchManagementController.createOrUpdateEmergencyPlan);
router.get('/:ranchId/emergency/readiness', validateId('ranchId'), ranchManagementController.assessReadiness);
router.get('/:ranchId/emergency/recommendations', validateId('ranchId'), ranchManagementController.getEmergencyRecommendations);

// Media
router.post('/:ranchId/media', validateId('ranchId'), ranchManagementController.uploadMedia);
router.get('/:ranchId/media', validateId('ranchId'), ranchManagementController.listMedia);
router.get('/media/:mediaId', validateId('mediaId'), ranchManagementController.getMediaById);
router.delete('/media/:mediaId', validateId('mediaId'), ranchManagementController.deleteMedia);

export default router;