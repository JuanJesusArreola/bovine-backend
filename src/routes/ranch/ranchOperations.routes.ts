// routes/ranchOperations.routes.ts
import { Router } from 'express';
import { ranchOperationsController } from '../../controllers/ranch/ranchOperations.controller';
import { authenticateToken } from '../../middleware/auth';
import { validateId } from '../../middleware/validation';

const router = Router();

router.use(authenticateToken);

// Producción
router.get('/:ranchId/production/:year', validateId('ranchId'), ranchOperationsController.getProduction);
router.post('/:ranchId/production', validateId('ranchId'), ranchOperationsController.createProduction);
router.put('/:ranchId/production/:year', validateId('ranchId'), ranchOperationsController.updateProduction);
router.get('/:ranchId/production-trends', validateId('ranchId'), ranchOperationsController.getProductionTrends);
router.get('/:ranchId/industry-comparison/:year', validateId('ranchId'), ranchOperationsController.compareWithIndustry);

// Sostenibilidad
router.get('/:ranchId/sustainability', validateId('ranchId'), ranchOperationsController.getSustainability);
router.put('/:ranchId/sustainability', validateId('ranchId'), ranchOperationsController.createOrUpdateSustainability);
router.patch('/:ranchId/sustainability/goal/:goalIndex', validateId('ranchId'), ranchOperationsController.updateGoalProgress);

// Tecnología
router.get('/:ranchId/technology', validateId('ranchId'), ranchOperationsController.getTechnology);
router.put('/:ranchId/technology', validateId('ranchId'), ranchOperationsController.createOrUpdateTechnology);
router.get('/:ranchId/tech-readiness', validateId('ranchId'), ranchOperationsController.getTechReadiness);
router.get('/:ranchId/tech-recommendations', validateId('ranchId'), ranchOperationsController.recommendTechInvestments);

// Finanzas
router.get('/:ranchId/financial/:year', validateId('ranchId'), ranchOperationsController.getFinancial);
router.post('/:ranchId/financial', validateId('ranchId'), ranchOperationsController.createFinancial);
router.put('/:ranchId/financial/:year', validateId('ranchId'), ranchOperationsController.updateFinancial);
router.get('/:ranchId/financial/:year/profitability', validateId('ranchId'), ranchOperationsController.calculateProfitability);
router.get('/:ranchId/financial/:year/revenue-analysis', validateId('ranchId'), ranchOperationsController.analyzeRevenueStreams);
router.get('/:ranchId/financial/:year/compare', validateId('ranchId'), ranchOperationsController.compareWithPreviousYears);

export default router;