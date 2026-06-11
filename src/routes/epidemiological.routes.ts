// routes/epidemiological.routes.ts
// ============================================================================
// EPIDEMIOLOGICAL ROUTES (Fase 4 + Fase 5)
// ============================================================================
//   GET  /api/epidemiology/snapshots                          — listar snapshots
//   GET  /api/epidemiology/snapshots/latest                   — último snapshot
//   GET  /api/epidemiology/top-diseases/:ranchId              — top enfermedades
//   GET  /api/epidemiology/trend/:ranchId                     — serie temporal
//   POST /api/epidemiology/compute                            — job manual (admin)
//   GET  /api/epidemiology/outbreak/:ranchId/:diseaseId       — línea de tiempo brote
//   POST /api/epidemiology/cases/:caseId/detect-contacts      — detectar contactos
//   GET  /api/epidemiology/cases/:caseId/contacts             — ver contactos de un caso
// ============================================================================

import { Router } from 'express';
import { query, param, body } from 'express-validator';
import { epidemiologicalController } from '../controllers/epidemiological.controller';
import { authenticateToken } from '../middleware/auth';
import { sanitizeInput } from '../middleware/validation';
import { requireMinimumRole } from '../middleware/role';
import { UserRole } from '../models/User';

const router = Router();
router.use(sanitizeInput);

// ── Helpers de validación ─────────────────────────────────────────────────────

const optionalUUID = (name: string) =>
  query(name).optional().isUUID().withMessage(`${name} debe ser UUID`);

const optionalDate = (name: string) =>
  query(name).optional().isISO8601().withMessage(`${name} debe ser fecha ISO`);

// ── Rutas ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/epidemiology/snapshots/latest
 * IMPORTANTE: declarar ANTES de /snapshots para que Express no lo trate como /:id
 */
router.get(
  '/snapshots/latest',
  authenticateToken,
  optionalUUID('ranchId'),
  optionalUUID('diseaseId'),
  epidemiologicalController.getLatest
);

/**
 * GET /api/epidemiology/snapshots
 */
router.get(
  '/snapshots',
  authenticateToken,
  optionalUUID('ranchId'),
  optionalUUID('diseaseId'),
  optionalDate('fromDate'),
  optionalDate('toDate'),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('offset').optional().isInt({ min: 0 }),
  epidemiologicalController.getSnapshots
);

/**
 * GET /api/epidemiology/top-diseases/:ranchId
 */
router.get(
  '/top-diseases/:ranchId',
  authenticateToken,
  param('ranchId').isUUID().withMessage('ranchId debe ser UUID'),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  epidemiologicalController.getTopDiseases
);

/**
 * GET /api/epidemiology/trend/:ranchId
 */
router.get(
  '/trend/:ranchId',
  authenticateToken,
  param('ranchId').isUUID().withMessage('ranchId debe ser UUID'),
  optionalUUID('diseaseId'),
  query('days').optional().isInt({ min: 1, max: 365 }),
  epidemiologicalController.getTrend
);

/**
 * POST /api/epidemiology/compute  (solo SUPER_ADMIN o superior)
 */
router.post(
  '/compute',
  authenticateToken,
  requireMinimumRole(UserRole.SUPER_ADMIN),
  body('date').optional().isISO8601().withMessage('date debe ser fecha ISO'),
  epidemiologicalController.compute
);

// ── Fase 5 — Propagación / línea de tiempo ───────────────────────────────────

/**
 * GET /api/epidemiology/outbreak/:ranchId/:diseaseId
 * Línea de tiempo clínica de todos los casos de una enfermedad en un rancho.
 * Incluye metadatos de la enfermedad, resumen del brote y cronología de casos.
 */
router.get(
  '/outbreak/:ranchId/:diseaseId',
  authenticateToken,
  param('ranchId').isUUID().withMessage('ranchId debe ser UUID'),
  param('diseaseId').isUUID().withMessage('diseaseId debe ser UUID'),
  epidemiologicalController.getOutbreakTimeline
);

/**
 * POST /api/epidemiology/cases/:caseId/detect-contacts
 * Ejecuta análisis espaciotemporal en BovineLocationHistory para el caso dado.
 * Crea CaseContact automáticos con los bovinos co-localizados en la ventana
 * de incubación de la enfermedad.
 */
router.post(
  '/cases/:caseId/detect-contacts',
  authenticateToken,
  param('caseId').isUUID().withMessage('caseId debe ser UUID'),
  epidemiologicalController.detectPotentialContacts
);

/**
 * GET /api/epidemiology/cases/:caseId/contacts
 * Devuelve todos los enlaces de contagio del caso: como fuente y como destino.
 */
router.get(
  '/cases/:caseId/contacts',
  authenticateToken,
  param('caseId').isUUID().withMessage('caseId debe ser UUID'),
  epidemiologicalController.getCaseContacts
);

/**
 * POST /api/epidemiology/contacts   (E-07)
 * Registro MANUAL de un enlace de contacto (DIRECT_CONTACT, SHARED_WATER, etc.).
 */
router.post(
  '/contacts',
  authenticateToken,
  body('sourceCaseId').isUUID().withMessage('sourceCaseId debe ser UUID'),
  body('targetCaseId').optional({ nullable: true }).isUUID(),
  body('targetBovineId').optional({ nullable: true }).isUUID(),
  body('contactType').isIn(['SAME_LOCATION', 'SHARED_PASTURE', 'DIRECT_CONTACT', 'SHARED_WATER', 'AUTO_DETECTED']),
  body('contactDate').optional().isISO8601(),
  body('confidence').optional().isFloat({ min: 0, max: 1 }),
  body('distanceMeters').optional().isFloat({ min: 0 }),
  body('locationId').optional({ nullable: true }).isUUID(),
  body('notes').optional().isString().isLength({ max: 2000 }),
  epidemiologicalController.createManualContact
);

/**
 * GET /api/epidemiology/herd-health/:ranchId   (E-02)
 * Índice de salud del hato: desglose por estado + cobertura + score 0-100.
 */
router.get(
  '/herd-health/:ranchId',
  authenticateToken,
  param('ranchId').isUUID().withMessage('ranchId debe ser UUID'),
  epidemiologicalController.getHerdHealthIndex
);

/**
 * GET /api/epidemiology/heatmap?ranchId=&diseaseId=&cellSize=   (E-06)
 */
router.get(
  '/heatmap',
  authenticateToken,
  query('ranchId').isUUID().withMessage('ranchId debe ser UUID'),
  query('diseaseId').optional().isUUID(),
  query('cellSize').optional().isFloat({ min: 0.0001, max: 1 }),
  epidemiologicalController.getHeatmap
);

/**
 * GET /api/epidemiology/alerts?ranchId=&status=   (E-03)
 */
router.get(
  '/alerts',
  authenticateToken,
  optionalUUID('ranchId'),
  query('status').optional().isIn(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']),
  epidemiologicalController.getAlerts
);

/**
 * PATCH /api/epidemiology/alerts/:id   (E-03 — acknowledge/resolve)
 */
router.patch(
  '/alerts/:id',
  authenticateToken,
  param('id').isUUID(),
  body('status').isIn(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']),
  epidemiologicalController.updateAlert
);

export default router;
