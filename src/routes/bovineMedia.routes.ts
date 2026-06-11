// routes/bovineMedia.routes.ts
// ============================================================================
// BOVINE MEDIA ROUTES
// ============================================================================
// Endpoints compuestos bajo /api/bovines/:id/media:
//   GET    /:id/media        → listar agrupado por tipo
//   POST   /:id/media        → sube archivo (multipart) a R2 + RanchMedia
//   DELETE /:id/media/*       → wildcard storagePath
// ============================================================================

import { Router } from 'express';
import multer from 'multer';
import { bovineMediaController } from '../controllers/bovineMedia.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateId } from '../middleware/validation';
import { UserRole } from '../models/User';

const router = Router();

// Multer en memoria — el StorageService recibe el buffer.
// Límite global 100MB (videos); cada FileCategory valida tamaño real en el service.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 1,
  },
});

const WRITE_ROLES = [
  UserRole.WORKER,
  UserRole.VETERINARIAN,
  UserRole.MANAGER,
  UserRole.RANCH_MANAGER,
  UserRole.SUPER_ADMIN,
  UserRole.OWNER,
];

const DELETE_ROLES = [
  UserRole.MANAGER,
  UserRole.RANCH_MANAGER,
  UserRole.SUPER_ADMIN,
  UserRole.OWNER,
  UserRole.VETERINARIAN, // un veterinario puede borrar documentos médicos que él mismo subió
];

router.use(authenticateToken);

// ============================================================================
// GET /api/bovines/:id/media
// ============================================================================
router.get('/:id/media', validateId('id'), bovineMediaController.listMedia);

// ============================================================================
// POST /api/bovines/:id/media
// ============================================================================
router.post(
  '/:id/media',
  validateId('id'),
  authorizeRoles(...WRITE_ROLES),
  upload.single('file'),
  bovineMediaController.uploadMedia
);

// ============================================================================
// DELETE /api/bovines/:id/media/*
// El wildcard captura el storagePath completo (puede contener slashes).
// Ej: DELETE /api/bovines/abc123/media/bovine_images/abc123/2026-04/foo.jpg
// ============================================================================
router.delete(
  '/:id/media/*',
  validateId('id'),
  authorizeRoles(...DELETE_ROLES),
  bovineMediaController.deleteMedia
);

export default router;
