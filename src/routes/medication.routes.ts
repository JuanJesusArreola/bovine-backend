// routes/medication.routes.ts
import { Router } from 'express';
import { medicationController } from '../controllers/medication.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateId } from '../middleware/validation';
import { UserRole } from '../models/User';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// ==============================================================
// Rutas de consulta pública (accesibles para cualquier rol autenticado)
// ==============================================================
router.get('/', medicationController.listMedications);
router.get('/type/:type/label', medicationController.getMedicationTypeLabel);
router.post('/storage-labels', medicationController.getStorageRequirementsLabels);
router.post('/calculate-dose', medicationController.calculateDose);
router.get('/:id', validateId('id'), medicationController.getMedicationById);
router.get('/:id/summary', validateId('id'), medicationController.getMedicationSummary);
router.get('/:id/safety-warnings', validateId('id'), medicationController.getSafetyWarnings);
router.get('/:medicationId/species/:species/compatibility', medicationController.checkCompatibilityWithSpecies);
router.post('/check-compatibility', medicationController.checkCompatibilityWithConditions);

// ==============================================================
// Rutas de escritura (solo administradores y veterinarios)
// ==============================================================
router.post(
  '/',
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.VETERINARIAN),
  medicationController.createMedication
);
router.put(
  '/:id',
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.VETERINARIAN),
  validateId('id'),
  medicationController.updateMedication
);
router.delete(
  '/:id',
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.VETERINARIAN),
  validateId('id'),
  medicationController.deleteMedication
);

export default router;