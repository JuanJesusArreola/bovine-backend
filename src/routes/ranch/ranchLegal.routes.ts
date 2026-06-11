// routes/ranchLegal.routes.ts
import { Router } from 'express';
import { ranchLegalController } from '../../controllers/ranch/ranchLegal.controller';
import { authenticateToken } from '../../middleware/auth';
import { validateId } from '../../middleware/validation';

const router = Router();

router.use(authenticateToken);

// Propiedad (ownership)
router.get('/:ranchId/ownership', validateId('ranchId'), ranchLegalController.getOwnership);
router.put('/:ranchId/ownership', validateId('ranchId'), ranchLegalController.createOrUpdateOwnership);
router.get('/:ranchId/legal-representative', validateId('ranchId'), ranchLegalController.getLegalRepresentative);
router.get('/:ranchId/is-corporate', validateId('ranchId'), ranchLegalController.isCorporateOwner);

// Certificaciones
router.get('/:ranchId/certifications/valid', validateId('ranchId'), ranchLegalController.getValidCertifications);
router.get('/:ranchId/certifications/expiring', validateId('ranchId'), ranchLegalController.getExpiringCertifications);
router.post('/:ranchId/certifications', validateId('ranchId'), ranchLegalController.createCertification);
router.put('/certifications/:id', validateId('id'), ranchLegalController.updateCertification);
router.delete('/certifications/:id', validateId('id'), ranchLegalController.deleteCertification);
router.post('/certifications/:id/renew', validateId('id'), ranchLegalController.renewCertification);

// Licencias
router.get('/:ranchId/licenses/valid', validateId('ranchId'), ranchLegalController.getValidLicenses);
router.post('/:ranchId/licenses', validateId('ranchId'), ranchLegalController.createLicense);
router.put('/licenses/:id', validateId('id'), ranchLegalController.updateLicense);
router.delete('/licenses/:id', validateId('id'), ranchLegalController.deleteLicense);

// Seguros
router.get('/:ranchId/insurances/coverage', validateId('ranchId'), ranchLegalController.getCoverageSummary);
router.post('/:ranchId/insurances', validateId('ranchId'), ranchLegalController.createInsurance);
router.put('/insurances/:id', validateId('id'), ranchLegalController.updateInsurance);
router.post('/insurances/:id/claim', validateId('id'), ranchLegalController.recordClaim);
router.post('/insurances/:id/renew', validateId('id'), ranchLegalController.renewInsurance);

export default router;