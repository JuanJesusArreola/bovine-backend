// controllers/bovineMedia.controller.ts
// ============================================================================
// BOVINE MEDIA CONTROLLER
// ============================================================================
// Endpoints:
//   GET    /api/bovines/:id/media                 → lista agrupada por tipo
//   POST   /api/bovines/:id/media                 → sube (multipart) a R2 + DB
//   DELETE /api/bovines/:id/media/*               → wildcard storagePath
// ============================================================================

import { Request, Response } from 'express';
import {
  bovineMediaService,
  BovineMediaType,
} from '../services/BovineMediaService';
import { BovineError } from '../utils/BovineErrors';
import logger from '../utils/logger';

const VALID_MEDIA_TYPES: BovineMediaType[] = ['images', 'documents', 'videos'];

export class BovineMediaController {
  private readonly context = 'BovineMediaController';

  constructor() {
    this.listMedia = this.listMedia.bind(this);
    this.uploadMedia = this.uploadMedia.bind(this);
    this.deleteMedia = this.deleteMedia.bind(this);
  }

  /**
   * GET /api/bovines/:id/media
   */
  async listMedia(req: Request, res: Response): Promise<void> {
    try {
      const { id: bovineId } = req.params;
      const data = await bovineMediaService.listMedia(bovineId);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en listMedia', this.context, { params: req.params }, error as Error);
      this.handleError(error, res);
    }
  }

  /**
   * POST /api/bovines/:id/media
   *
   * Body (multipart/form-data):
   *   file      — binario (requerido)
   *   mediaType — 'images' | 'documents' | 'videos' (requerido)
   *   caption   — string (opcional)
   */
  async uploadMedia(req: Request, res: Response): Promise<void> {
    try {
      const { id: bovineId } = req.params;
      const file = req.file;
      const mediaType = req.body?.mediaType as BovineMediaType;
      const caption = req.body?.caption as string | undefined;
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado', code: 'UNAUTHORIZED' });
        return;
      }
      if (!file) {
        res.status(400).json({
          success: false,
          error: 'No se recibió ningún archivo. Envíe el archivo en el campo "file".',
          code: 'FILE_REQUIRED',
        });
        return;
      }
      if (!mediaType || !VALID_MEDIA_TYPES.includes(mediaType)) {
        res.status(400).json({
          success: false,
          error: `mediaType requerido. Permitidos: ${VALID_MEDIA_TYPES.join(', ')}`,
          code: 'INVALID_MEDIA_TYPE',
        });
        return;
      }

      const result = await bovineMediaService.uploadMedia(
        bovineId,
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        mediaType,
        userId,
        { caption }
      );

      res.status(201).json({ success: true, data: result, message: 'Archivo subido' });
    } catch (error) {
      logger.error('Error en uploadMedia', this.context, { params: req.params, body: req.body }, error as Error);
      this.handleError(error, res);
    }
  }

  /**
   * DELETE /api/bovines/:id/media/*
   * El path después de `/media/` es el `storagePath` (puede tener `/`).
   */
  async deleteMedia(req: Request, res: Response): Promise<void> {
    try {
      const { id: bovineId } = req.params;
      // Wildcard: req.params[0] contiene el path completo
      const storagePath = (req.params as any)[0] as string;

      if (!storagePath) {
        res.status(400).json({
          success: false,
          error: 'storagePath requerido en la URL',
          code: 'STORAGE_PATH_REQUIRED',
        });
        return;
      }

      await bovineMediaService.deleteMedia(bovineId, storagePath);
      res.json({ success: true, message: 'Archivo eliminado' });
    } catch (error) {
      logger.error('Error en deleteMedia', this.context, { params: req.params }, error as Error);
      this.handleError(error, res);
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  private handleError(error: unknown, res: Response): void {
    if (error instanceof BovineError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    } else {
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
}

export const bovineMediaController = new BovineMediaController();
