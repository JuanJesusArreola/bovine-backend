// routes/health.routes.ts
import { Router } from 'express';
import { healthController } from '../controllers/health.controller';
import { diagnosisController } from '../controllers/diagnosis.controller';
import { treatmentController } from '../controllers/treatment.controller';
import { laboratoryController } from '../controllers/laboratory.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateId } from '../middleware/validation';
import { UserRole } from '../models/User';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// ── Rutas de consulta ────────────────────────────────────────────────────────

// GET /api/health/records — listado paginado global
// IMPORTANTE: debe ir ANTES de /records/:id para que Express no interprete
// "records" como parámetro :id.
router.get(
    '/records',
    authorizeRoles(UserRole.VETERINARIAN, UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
    healthController.getHealthRecords
);

router.get('/bovine/:bovineId/history', validateId('bovineId'), healthController.getBovineHealthHistory);
router.get('/bovine/:bovineId/summary', validateId('bovineId'), healthController.getHealthSummary);
router.get('/records/:id', validateId('id'), healthController.getHealthRecordById);

// ── Rutas de escritura ───────────────────────────────────────────────────────

router.post(
    '/records',
    authorizeRoles(UserRole.VETERINARIAN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    healthController.createHealthRecord
);

router.patch(
    '/records/:id',
    validateId('id'),
    authorizeRoles(UserRole.VETERINARIAN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    healthController.updateHealthRecord
);

router.delete(
    '/records/:id',
    validateId('id'),
    authorizeRoles(UserRole.VETERINARIAN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    healthController.deleteHealthRecord
);

// Rutas de diagnóstico
router.post(
    '/diagnosis/record',
    authorizeRoles(UserRole.VETERINARIAN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    diagnosisController.recordDiagnosis
);
router.post(
    '/diagnosis/confirm',
    authorizeRoles(UserRole.VETERINARIAN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    diagnosisController.confirmDiagnosis
);
router.get(
    '/diagnosis/stats',
    authorizeRoles(UserRole.VETERINARIAN, UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
    diagnosisController.getDiagnosisStats
);

// Rutas de tratamiento
router.post(
  '/treatment/start',
  authorizeRoles(UserRole.VETERINARIAN, UserRole.SUPER_ADMIN, UserRole.OWNER),
  treatmentController.startTreatment
);
router.post(
  '/treatment/medication/record',
  authorizeRoles(UserRole.VETERINARIAN, UserRole.SUPER_ADMIN, UserRole.OWNER),
  treatmentController.recordMedicationAdministration
);
router.post(
  '/treatment/complete',
  authorizeRoles(UserRole.VETERINARIAN, UserRole.SUPER_ADMIN, UserRole.OWNER),
  treatmentController.completeTreatment
);
router.get(
  '/treatment/withdrawal/:healthId',
  authorizeRoles(UserRole.VETERINARIAN, UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
  treatmentController.checkWithdrawalPeriods
);

// Rutas de laboratorio
router.post(
  '/laboratory/results',
  authorizeRoles(UserRole.VETERINARIAN, UserRole.SUPER_ADMIN, UserRole.OWNER),
  laboratoryController.addLaboratoryResults
);
router.get(
  '/laboratory/abnormal/:healthId',
  authorizeRoles(UserRole.VETERINARIAN, UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
  laboratoryController.getAbnormalResults
);
router.get(
  '/laboratory/bovine/:bovineId/abnormal',
  authorizeRoles(UserRole.VETERINARIAN, UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
  laboratoryController.getAbnormalResultsByBovine
);
router.get(
  '/laboratory/ranch/:ranchId/abnormal',
  authorizeRoles(UserRole.VETERINARIAN, UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
  laboratoryController.getAbnormalResultsByRanch
);


export default router;