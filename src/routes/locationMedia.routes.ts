// routes/locationMedia.routes.ts
// ============================================================================
// LOCATION MEDIA ROUTES
// ============================================================================
// Endpoints compuestos bajo /api/locations/:id/media
// Permiten al frontend subir/borrar archivos en una sola llamada.
// ============================================================================

import { Router } from 'express';
import multer from 'multer';
import { locationMediaController } from '../controllers/locationMedia.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { validateId } from '../middleware/validation';
import { UserRole } from '../models/User';

const router = Router();

// Multer en memoria (100MB límite global para videos; categorías validan tamaño real)
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
];

// Autenticación para todas las rutas
router.use(authenticateToken);

// ============================================================================
// GET /api/locations/:id/media
// Lista todos los archivos (images, documents, videos, maps) de la ubicación.
// ============================================================================
router.get(
  '/:id/media',
  validateId('id'),
  locationMediaController.listMedia
);

// ============================================================================
// POST /api/locations/:id/media
// Body multipart: file (binario) + mediaType (images|documents|videos|maps)
// Sube a R2 y agrega la URL al array correspondiente de LocationInfo.
// ============================================================================
router.post(
  '/:id/media',
  validateId('id'),
  authorizeRoles(...WRITE_ROLES),
  upload.single('file'),
  locationMediaController.uploadMedia
);

// ============================================================================
// DELETE /api/locations/:id/media/*storagePath
// Ej: DELETE /api/locations/abc123/media/location_images/2026/04/foo.jpg
// Query opcional: ?mediaType=images  (acelera búsqueda)
// Elimina de R2 y quita la URL del array de LocationInfo.
// ============================================================================
router.delete(
  '/:id/media/*',
  validateId('id'),
  authorizeRoles(...DELETE_ROLES),
  locationMediaController.deleteMedia
);

export default router;
