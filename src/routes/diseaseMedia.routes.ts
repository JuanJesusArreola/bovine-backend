// routes/diseaseMedia.routes.ts
// ============================================================================
// DISEASE MEDIA ROUTES
// ============================================================================
// Sub-rutas montadas bajo /api/diseases/:diseaseId/media
//
//   POST   /api/diseases/:diseaseId/media           — subir archivo (multipart → R2)
//   POST   /api/diseases/:diseaseId/media/url       — registrar URL externa
//   GET    /api/diseases/:diseaseId/media           — listar media
//   PATCH  /api/diseases/:diseaseId/media/:mediaId  — editar metadatos
//   DELETE /api/diseases/:diseaseId/media/:mediaId  — eliminar (+ R2)
// ============================================================================

import multer   from 'multer';
import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';

import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { sanitizeInput }                      from '../middleware/validation';
import { UserRole }                           from '../models/User';
import { diseaseMediaService }                from '../services/DiseaseMediaService';
import { DiseaseMediaType }                   from '../models/DiseaseMedia';
import { FILE_CONFIGS, FileCategory }         from '../middleware/upload';
import logger from '../utils/logger';

// ── Multer (memoryStorage — el buffer va directo a R2) ───────────────────────

const DISEASE_MEDIA_CONFIG = FILE_CONFIGS[FileCategory.DISEASE_MEDIA];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DISEASE_MEDIA_CONFIG.maxSize },
  fileFilter: (_req, file, cb) => {
    if (!DISEASE_MEDIA_CONFIG.allowedTypes.includes(file.mimetype)) {
      return cb(new Error(
        `Tipo no permitido: ${file.mimetype}. Permitidos: ${DISEASE_MEDIA_CONFIG.allowedTypes.join(', ')}`
      ));
    }
    cb(null, true);
  },
});

// ── Validadores ──────────────────────────────────────────────────────────────

const uuidParam = (name: string) =>
  param(name).isUUID().withMessage(`${name} debe ser UUID`);

const updateValidation = [
  body('title')        .optional().isString().trim().isLength({ max: 200 }),
  body('description')  .optional().isString().trim().isLength({ max: 2000 }),
  body('displayOrder') .optional().isInt({ min: 0 }),
  body('isReference')  .optional().isBoolean(),
  body('source')       .optional().isString().trim().isLength({ max: 200 }),
  body('symptomId')    .optional({ nullable: true }).isUUID().withMessage('symptomId debe ser UUID o null'),
];

const urlValidation = [
  body('externalUrl')   .isURL().withMessage('externalUrl debe ser una URL válida'),
  body('thumbnailUrl')  .optional().isURL(),
  body('title')         .optional().isString().trim().isLength({ max: 200 }),
  body('description')   .optional().isString().trim().isLength({ max: 2000 }),
  body('mediaType')     .optional().isIn(Object.values(DiseaseMediaType)),
  body('mimeType')      .optional().isString().trim(),
  body('isReference')   .optional().isBoolean(),
  body('source')        .optional().isString().trim().isLength({ max: 200 }),
  body('displayOrder')  .optional().isInt({ min: 0 }),
  body('symptomId')     .optional({ nullable: true }).isUUID(),
];

/** Roles que pueden subir/editar/eliminar media */
const canManageMedia = authorizeRoles(
  UserRole.SUPER_ADMIN,
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.RANCH_MANAGER,
  UserRole.VETERINARIAN,
);

// ── Router ───────────────────────────────────────────────────────────────────

const router = Router({ mergeParams: true }); // mergeParams para acceder a :diseaseId del padre
router.use(sanitizeInput);

// ── Middleware de error de multer ────────────────────────────────────────────

function handleMulterError(
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxMB = (DISEASE_MEDIA_CONFIG.maxSize / (1024 * 1024)).toFixed(0);
      res.status(400).json({ success: false, error: `El archivo supera el tamaño máximo de ${maxMB} MB` });
      return;
    }
    res.status(400).json({ success: false, error: err.message });
    return;
  }
  if (err instanceof Error && err.message) {
    res.status(400).json({ success: false, error: err.message });
    return;
  }
  next(err);
}

// ── Rutas ────────────────────────────────────────────────────────────────────

/**
 * POST /api/diseases/:diseaseId/media
 * Sube una imagen/video (multipart/form-data, campo "file") → Cloudflare R2.
 * Campos adicionales opcionales: title, description, isReference, source,
 * displayOrder, symptomId.
 */
router.post(
  '/',
  authenticateToken,
  canManageMedia,
  upload.single('file'),
  handleMulterError,
  uuidParam('diseaseId'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No se proporcionó ningún archivo' });
        return;
      }

      const uploadedBy = (req as any).user?.id;

      const data = await diseaseMediaService.createFromUpload({
        diseaseId:    req.params.diseaseId,
        symptomId:    req.body.symptomId   || undefined,
        title:        req.body.title       || undefined,
        description:  req.body.description || undefined,
        isReference:  req.body.isReference === 'true',
        source:       req.body.source      || undefined,
        displayOrder: req.body.displayOrder ? parseInt(req.body.displayOrder, 10) : 0,
        uploadedBy,
        // Datos del archivo en memoria (memoryStorage)
        buffer:       req.file.buffer,
        originalname: req.file.originalname,
        mimeType:     req.file.mimetype,
        sizeBytes:    req.file.size,
      });

      res.status(201).json({ success: true, data });
    } catch (error) {
      logger.error('Error en POST disease media (upload)', 'diseaseMedia.routes', {}, error as Error);
      const msg = (error as Error).message ?? 'Error subiendo imagen';
      const status = msg.includes('no encontrada') ? 404 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }
);

/**
 * POST /api/diseases/:diseaseId/media/url
 * Registra una imagen/video desde URL externa (no sube archivo a R2).
 */
router.post(
  '/url',
  authenticateToken,
  canManageMedia,
  uuidParam('diseaseId'),
  ...urlValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const uploadedBy = (req as any).user?.id;
      const data = await diseaseMediaService.createFromUrl({
        ...req.body,
        diseaseId:  req.params.diseaseId,
        uploadedBy,
      });
      res.status(201).json({ success: true, data });
    } catch (error) {
      logger.error('Error en POST disease media (url)', 'diseaseMedia.routes', {}, error as Error);
      const msg = (error as Error).message ?? 'Error registrando URL de imagen';
      const status = msg.includes('no encontrada') ? 404 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }
);

/**
 * GET /api/diseases/:diseaseId/media
 * Lista todas las imágenes/videos de una enfermedad, ordenadas por displayOrder.
 */
router.get(
  '/',
  authenticateToken,
  uuidParam('diseaseId'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await diseaseMediaService.getByDisease(req.params.diseaseId);
      res.json({ success: true, data, total: data.length });
    } catch (error) {
      logger.error('Error en GET disease media', 'diseaseMedia.routes', {}, error as Error);
      res.status(500).json({ success: false, error: 'Error obteniendo imágenes de la enfermedad' });
    }
  }
);

/**
 * PATCH /api/diseases/:diseaseId/media/:mediaId
 * Edita los metadatos de un recurso (título, descripción, orden, etc.).
 */
router.patch(
  '/:mediaId',
  authenticateToken,
  canManageMedia,
  uuidParam('diseaseId'),
  uuidParam('mediaId'),
  ...updateValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await diseaseMediaService.update(req.params.mediaId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en PATCH disease media', 'diseaseMedia.routes', {}, error as Error);
      const msg = (error as Error).message ?? 'Error actualizando imagen';
      const status = msg.includes('no encontrado') ? 404 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }
);

/**
 * DELETE /api/diseases/:diseaseId/media/:mediaId
 * Elimina el registro y el archivo de R2 (si aplica).
 */
router.delete(
  '/:mediaId',
  authenticateToken,
  canManageMedia,
  uuidParam('diseaseId'),
  uuidParam('mediaId'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await diseaseMediaService.remove(req.params.mediaId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error en DELETE disease media', 'diseaseMedia.routes', {}, error as Error);
      const msg = (error as Error).message ?? 'Error eliminando imagen';
      const status = msg.includes('no encontrado') ? 404 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }
);

export default router;
