// routes/disease.routes.ts
// ============================================================================
// DISEASE ROUTES
// ============================================================================
//   GET  /api/diseases                              — catálogo con filtros opcionales
//   GET  /api/diseases/search?q=                   — búsqueda en nombre + aliases
//   GET  /api/diseases/with-symptoms               — catálogo completo con síntomas
//   GET  /api/diseases/:slug                       — detalle por slug o UUID
//   POST /api/diseases/:diseaseId/media            — subir imagen (multipart)
//   POST /api/diseases/:diseaseId/media/url        — registrar URL externa
//   GET  /api/diseases/:diseaseId/media            — listar media de enfermedad
//   PATCH  /api/diseases/:diseaseId/media/:mediaId — editar metadatos
//   DELETE /api/diseases/:diseaseId/media/:mediaId — eliminar
// ============================================================================

import { Router } from 'express';
import { query, param } from 'express-validator';
import { diseaseController } from '../controllers/disease.controller';
import { authenticateToken } from '../middleware/auth';
import { sanitizeInput } from '../middleware/validation';
import diseaseMediaRoutes from './diseaseMedia.routes';

// ── Inline validators ────────────────────────────────────────────────────────

const getAllValidation = [
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('search debe tener entre 1 y 100 caracteres'),
  query('category')
    .optional()
    .isIn(['BACTERIAL', 'VIRAL', 'PARASITIC', 'FUNGAL', 'METABOLIC', 'GENETIC', 'OTHER'])
    .withMessage('Categoría inválida'),
  query('severity')
    .optional()
    .isIn(['LOW', 'MODERATE', 'HIGH', 'CRITICAL'])
    .withMessage('Severidad inválida'),
  query('isContagious')
    .optional()
    .isBoolean()
    .withMessage('isContagious debe ser true o false'),
  query('isZoonotic')
    .optional()
    .isBoolean()
    .withMessage('isZoonotic debe ser true o false'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page debe ser un entero mayor a 0'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit debe ser un entero entre 1 y 100'),
];

const searchValidation = [
  query('q')
    .exists()
    .withMessage('El parámetro q es obligatorio')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('q debe tener entre 2 y 100 caracteres'),
];

const slugValidation = [
  param('slug')
    .isString()
    .trim()
    .isLength({ min: 2, max: 250 })
    .withMessage('slug inválido'),
];

// ── Router ───────────────────────────────────────────────────────────────────

const router = Router();

router.use(sanitizeInput);

/**
 * GET /api/diseases
 */
router.get(
  '/',
  authenticateToken,
  ...getAllValidation,
  diseaseController.getAll
);

/**
 * GET /api/diseases/search?q=brucelosis
 * IMPORTANTE: debe ir ANTES de /:slug para que Express no interprete
 * "search" como un parámetro slug.
 */
router.get(
  '/search',
  authenticateToken,
  ...searchValidation,
  diseaseController.search
);

/**
 * GET /api/diseases/with-symptoms
 * IMPORTANTE: debe ir ANTES de /:slug por la misma razón.
 */
router.get(
  '/with-symptoms',
  authenticateToken,
  diseaseController.getWithSymptoms
);

/**
 * GET /api/diseases/:slug
 * Acepta slug URL-friendly (ej: fiebre-aftosa) o UUID.
 */
router.get(
  '/:slug',
  authenticateToken,
  ...slugValidation,
  diseaseController.getBySlug
);

// ── Sub-rutas de media (IMPORTANTE: después de /:slug para no colisionar) ────
// Express lo resuelve porque el segmento siguiente es :diseaseId/media
router.use('/:diseaseId/media', diseaseMediaRoutes);

export default router;
