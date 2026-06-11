// routes/bovineDiseaseCase.routes.ts
// ============================================================================
// BOVINE DISEASE CASE ROUTES (Fase 2)
// ============================================================================
//   POST   /api/bovine-cases                    — abrir caso
//   GET    /api/bovine-cases                    — listar con filtros
//   GET    /api/bovine-cases/:id                — detalle completo
//   PATCH  /api/bovine-cases/:id                — actualizar campos
//   POST   /api/bovine-cases/:id/close          — cerrar caso
//   POST   /api/bovine-cases/:id/symptoms       — agregar síntoma
//   DELETE /api/bovine-cases/:id/symptoms/:sid  — quitar síntoma
//   POST   /api/bovine-cases/:id/treatments     — agregar tratamiento
//   POST   /api/bovine-cases/:id/lab-tests      — agregar prueba de lab
//   PATCH  /api/bovine-cases/lab-tests/:lid     — actualizar resultado
// ============================================================================

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { bovineDiseaseCase_Controller } from '../controllers/bovineDiseaseCase.controller';
import { authenticateToken } from '../middleware/auth';
import { sanitizeInput } from '../middleware/validation';

const router = Router();
router.use(sanitizeInput);

// ── Validators ───────────────────────────────────────────────────────────────

const SEVERITIES  = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
const STATUSES    = ['SUSPECTED', 'CONFIRMED', 'RECOVERING', 'RECOVERED', 'DECEASED', 'DISCARDED'];
const OUTCOMES    = ['RECOVERED', 'DECEASED', 'TRANSFERRED', 'UNKNOWN'];
const INTENSITIES = ['MILD', 'MODERATE', 'SEVERE'];
const LAB_STATUS  = ['PENDING', 'POSITIVE', 'NEGATIVE', 'INCONCLUSIVE'];
const APP_ROUTES  = ['INTRAMUSCULAR', 'SUBCUTANEOUS', 'INTRANASAL', 'ORAL', 'INTRADERMAL', 'OTHER'];

const openCaseValidation = [
  body('bovineId').isUUID().withMessage('bovineId debe ser UUID'),
  body('diseaseId').isUUID().withMessage('diseaseId debe ser UUID'),
  body('ranchId').isUUID().withMessage('ranchId debe ser UUID'),
  body('severity').isIn(SEVERITIES).withMessage('severity inválido'),
  body('status').optional().isIn(STATUSES).withMessage('status inválido'),
  body('diagnosedBy').optional().isString().trim().isLength({ max: 200 }),
  body('diagnosedAt').optional().isISO8601().withMessage('diagnosedAt debe ser fecha ISO'),
  body('notes').optional().isString().trim().isLength({ max: 2000 }),
];

const closeCaseValidation = [
  body('outcome').isIn(OUTCOMES).withMessage('outcome inválido'),
  body('resolvedAt').optional().isISO8601(),
  body('notes').optional().isString().trim().isLength({ max: 2000 }),
];

const updateCaseValidation = [
  body('status').optional().isIn(STATUSES),
  body('severity').optional().isIn(SEVERITIES),
  body('diagnosedBy').optional().isString().trim().isLength({ max: 200 }),
  body('notes').optional().isString().trim().isLength({ max: 2000 }),
];

const addSymptomValidation = [
  body('symptomId').isUUID().withMessage('symptomId debe ser UUID'),
  body('intensity').optional().isIn(INTENSITIES),
  body('observedAt').optional().isISO8601(),
  body('notes').optional().isString().trim().isLength({ max: 500 }),
];

const addTreatmentValidation = [
  body('treatmentName').isString().trim().isLength({ min: 2, max: 300 }),
  body('dosage').optional().isString().trim().isLength({ max: 200 }),
  body('applicationRoute').optional().isIn(APP_ROUTES),
  body('administeredAt').optional().isISO8601(),
  body('administeredBy').optional().isString().trim().isLength({ max: 200 }),
  body('durationDays').optional().isInt({ min: 1 }),
  body('withdrawalPeriodDays').optional().isInt({ min: 0 }),
  body('notes').optional().isString().trim().isLength({ max: 1000 }),
];

const addLabTestValidation = [
  body('testName').isString().trim().isLength({ min: 2, max: 300 }),
  body('requestedAt').optional().isISO8601(),
  body('labName').optional().isString().trim().isLength({ max: 200 }),
  body('notes').optional().isString().trim().isLength({ max: 1000 }),
];

const updateLabTestValidation = [
  body('resultStatus').isIn(LAB_STATUS).withMessage('resultStatus inválido'),
  body('resultAt').optional().isISO8601(),
  body('resultDetail').optional().isString().trim().isLength({ max: 2000 }),
  body('notes').optional().isString().trim().isLength({ max: 1000 }),
];

const uuidParam = (name: string) =>
  param(name).isUUID().withMessage(`${name} debe ser UUID`);

// ── Rutas ─────────────────────────────────────────────────────────────────────

// IMPORTANTE: la ruta /lab-tests/:labTestId debe declararse ANTES de /:id
// para que Express no trate "lab-tests" como un :id

/**
 * PATCH /api/bovine-cases/lab-tests/:labTestId
 */
router.patch(
  '/lab-tests/:labTestId',
  authenticateToken,
  uuidParam('labTestId'),
  ...updateLabTestValidation,
  bovineDiseaseCase_Controller.updateLabTest
);

/**
 * POST /api/bovine-cases
 */
router.post(
  '/',
  authenticateToken,
  ...openCaseValidation,
  bovineDiseaseCase_Controller.openCase
);

/**
 * GET /api/bovine-cases
 */
router.get(
  '/',
  authenticateToken,
  query('bovineId').optional().isUUID(),
  query('diseaseId').optional().isUUID(),
  query('ranchId').optional().isUUID(),
  query('status').optional().isString(),
  query('severity').optional().isString(),
  query('search').optional().isString().trim().isLength({ max: 200 }),
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }).withMessage('page debe ser entero ≥ 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit debe estar entre 1 y 100'),
  bovineDiseaseCase_Controller.getCases
);

/**
 * GET /api/bovine-cases/:id
 */
router.get(
  '/:id',
  authenticateToken,
  uuidParam('id'),
  bovineDiseaseCase_Controller.getCaseById
);

/**
 * PATCH /api/bovine-cases/:id
 */
router.patch(
  '/:id',
  authenticateToken,
  uuidParam('id'),
  ...updateCaseValidation,
  bovineDiseaseCase_Controller.updateCase
);

/**
 * POST /api/bovine-cases/:id/close
 */
router.post(
  '/:id/close',
  authenticateToken,
  uuidParam('id'),
  ...closeCaseValidation,
  bovineDiseaseCase_Controller.closeCase
);

/**
 * POST /api/bovine-cases/:id/symptoms
 */
router.post(
  '/:id/symptoms',
  authenticateToken,
  uuidParam('id'),
  ...addSymptomValidation,
  bovineDiseaseCase_Controller.addSymptom
);

/**
 * DELETE /api/bovine-cases/:id/symptoms/:symptomId
 */
router.delete(
  '/:id/symptoms/:symptomId',
  authenticateToken,
  uuidParam('id'),
  uuidParam('symptomId'),
  bovineDiseaseCase_Controller.removeSymptom
);

/**
 * POST /api/bovine-cases/:id/treatments
 */
router.post(
  '/:id/treatments',
  authenticateToken,
  uuidParam('id'),
  ...addTreatmentValidation,
  bovineDiseaseCase_Controller.addTreatment
);

/**
 * POST /api/bovine-cases/:id/lab-tests
 */
router.post(
  '/:id/lab-tests',
  authenticateToken,
  uuidParam('id'),
  ...addLabTestValidation,
  bovineDiseaseCase_Controller.addLabTest
);

export default router;
