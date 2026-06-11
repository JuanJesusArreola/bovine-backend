// routes/upload.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import { FileCategory, FILE_CONFIGS } from '../middleware/upload';
import { storageService } from '../container';
import { UserRole } from '../models/User';
import logger from '../utils/logger';

/**
 * ============================================================================
 * RUTAS DE UPLOAD — Cloudflare R2
 * ============================================================================
 *
 * Endpoint genérico para subir archivos a Cloudflare R2.
 * Usa multer memoryStorage (buffer en RAM) en vez de diskStorage.
 *
 * POST /api/uploads
 *   - Body (multipart/form-data):
 *     file     — archivo binario (requerido)
 *     category — FileCategory enum (requerido)
 *   - Headers: Authorization: Bearer <token>
 *   - Response: UploadResult con URL pública, storagePath, metadata
 *
 * DELETE /api/uploads
 *   - Body (JSON): { storagePath: string }
 *   - Headers: Authorization: Bearer <token>
 */

const router = Router();
const context = 'UploadRoutes';

// ============================================================================
// MULTER — memoryStorage (buffer, no disco)
// ============================================================================

/**
 * Crea una instancia de multer con memoryStorage y límites según la categoría.
 * Se invoca dinámicamente dentro de la ruta porque la categoría viene en el body,
 * y necesitamos parsear el multipart primero para leerla.
 *
 * Usamos un límite global conservador (50MB) y validamos por categoría después.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB máximo global
    files: 1,
  },
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Valida que la categoría sea válida y que el rol del usuario tenga permiso.
 * Valida tipo MIME y tamaño contra FILE_CONFIGS.
 */
function validateUpload(
  file: Express.Multer.File,
  category: string,
  userRole: UserRole
): { valid: true } | { valid: false; status: number; error: string } {
  // Validar categoría
  if (!Object.values(FileCategory).includes(category as FileCategory)) {
    return {
      valid: false,
      status: 400,
      error: `Categoría inválida: "${category}". Categorías permitidas: ${Object.values(FileCategory).join(', ')}`,
    };
  }

  const config = FILE_CONFIGS[category as FileCategory];

  // Validar rol
  if (!config.allowedRoles.includes(userRole)) {
    return {
      valid: false,
      status: 403,
      error: `Rol "${userRole}" no autorizado para subir archivos de categoría "${category}"`,
    };
  }

  // Validar tipo MIME
  if (!config.allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      status: 400,
      error: `Tipo de archivo no permitido: ${file.mimetype}. Tipos permitidos para ${category}: ${config.allowedTypes.join(', ')}`,
    };
  }

  // Validar tamaño (el buffer ya se cargó, pero cortamos aquí con error descriptivo)
  if (file.size > config.maxSize) {
    const maxMB = (config.maxSize / (1024 * 1024)).toFixed(0);
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      status: 400,
      error: `Archivo demasiado grande (${fileMB} MB). Máximo para ${category}: ${maxMB} MB`,
    };
  }

  return { valid: true };
}

// ============================================================================
// POST /api/uploads — Subir archivo a R2
// ============================================================================

router.post(
  '/',
  authenticateToken,
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file;
      const { category } = req.body;

      // Archivo requerido
      if (!file) {
        res.status(400).json({
          success: false,
          error: { code: 'FILE_REQUIRED', message: 'No se recibió ningún archivo. Envíe un archivo en el campo "file".' },
        });
        return;
      }

      // Categoría requerida
      if (!category) {
        res.status(400).json({
          success: false,
          error: { code: 'CATEGORY_REQUIRED', message: 'El campo "category" es requerido.' },
        });
        return;
      }

      // Validar todo (categoría, rol, MIME, tamaño)
      const userRole = req.userRole || UserRole.VIEWER;
      const validation = validateUpload(file, category, userRole);

      if (!validation.valid) {
        res.status(validation.status).json({
          success: false,
          error: { code: 'UPLOAD_VALIDATION_ERROR', message: validation.error },
        });
        return;
      }

      // Determinar si se genera thumbnail (solo para categorías que lo tengan configurado)
      const config = FILE_CONFIGS[category as FileCategory];
      const thumbnailConfig = config.thumbnailSizes?.[0]; // Usamos el tamaño "small" por defecto

      const thumbnail = thumbnailConfig
        ? { width: thumbnailConfig.width, height: thumbnailConfig.height, suffix: thumbnailConfig.name }
        : undefined;

      // Subir a R2
      const result = await storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        category, // usa la categoría como carpeta en R2
        thumbnail
      );

      logger.info(
        `Upload exitoso: ${result.storagePath} por usuario ${req.userId}`,
        context
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error en upload', context, { error });
      res.status(500).json({
        success: false,
        error: { code: 'UPLOAD_ERROR', message: 'Error interno al subir el archivo' },
      });
    }
  }
);

// ============================================================================
// DELETE /api/uploads — Eliminar archivo de R2
// ============================================================================

router.delete(
  '/',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { storagePath } = req.body;

      if (!storagePath || typeof storagePath !== 'string') {
        res.status(400).json({
          success: false,
          error: { code: 'STORAGE_PATH_REQUIRED', message: 'El campo "storagePath" es requerido (string).' },
        });
        return;
      }

      // Verificar que existe antes de eliminar
      const exists = await storageService.exists(storagePath);
      if (!exists) {
        res.status(404).json({
          success: false,
          error: { code: 'FILE_NOT_FOUND', message: `Archivo no encontrado: ${storagePath}` },
        });
        return;
      }

      await storageService.delete(storagePath);

      logger.info(
        `Archivo eliminado: ${storagePath} por usuario ${req.userId}`,
        context
      );

      res.json({
        success: true,
        message: 'Archivo eliminado correctamente',
      });
    } catch (error) {
      logger.error('Error eliminando archivo', context, { error });
      res.status(500).json({
        success: false,
        error: { code: 'DELETE_ERROR', message: 'Error interno al eliminar el archivo' },
      });
    }
  }
);

// ============================================================================
// MIDDLEWARE DE ERRORES DE MULTER (captura errores como LIMIT_FILE_SIZE)
// ============================================================================

router.use((error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: 'El archivo excede el tamaño máximo permitido (50 MB)',
      LIMIT_FILE_COUNT: 'Solo se permite un archivo por request',
      LIMIT_UNEXPECTED_FILE: 'Campo de archivo inesperado. Use el campo "file"',
    };

    res.status(400).json({
      success: false,
      error: {
        code: error.code,
        message: messages[error.code] || `Error de upload: ${error.message}`,
      },
    });
    return;
  }

  next(error);
});

export default router;
