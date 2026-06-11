// controllers/locationMedia.controller.ts
// ============================================================================
// LOCATION MEDIA CONTROLLER
// ============================================================================
// Endpoints compuestos: sube/elimina archivos multimedia de ubicaciones
// en una sola llamada (R2 + persistencia en LocationInfo).
// ============================================================================

import { Request, Response } from 'express';
import { locationMediaService, MediaType } from '../services/location/LocationMediaService';
import { LocationError } from '../utils/LocationErrors';
import logger from '../utils/logger';
import { UserRole } from '../models/User';

const VALID_MEDIA_TYPES: MediaType[] = ['images', 'documents', 'videos', 'maps'];

export class LocationMediaController {
  private readonly context = 'LocationMediaController';

  constructor() {
    this.uploadMedia = this.uploadMedia.bind(this);
    this.deleteMedia = this.deleteMedia.bind(this);
    this.listMedia = this.listMedia.bind(this);
  }

  /**
   * POST /api/locations/:id/media
   * Body (multipart/form-data):
   *   file       — archivo binario (requerido)
   *   mediaType  — 'images' | 'documents' | 'videos' | 'maps' (requerido)
   */
  async uploadMedia(req: Request, res: Response): Promise<void> {
    try {
      const { id: locationId } = req.params;
      const file = req.file;
      const mediaType = req.body.mediaType as MediaType;
      const userId = req.userId;
      const userRole = (req.userRole || UserRole.VIEWER) as UserRole;

      if (!file) {
        res.status(400).json({
          success: false,
          error: { code: 'FILE_REQUIRED', message: 'No se recibió ningún archivo. Envíe el archivo en el campo "file".' },
        });
        return;
      }

      if (!mediaType || !VALID_MEDIA_TYPES.includes(mediaType)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MEDIA_TYPE',
            message: `El campo "mediaType" es requerido y debe ser uno de: ${VALID_MEDIA_TYPES.join(', ')}`,
          },
        });
        return;
      }

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Usuario no autenticado' },
        });
        return;
      }

      const result = await locationMediaService.uploadMedia(
        locationId,
        mediaType,
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        userId,
        userRole
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error en uploadMedia', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
      } else {
        res.status(500).json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Error interno al subir el archivo' },
        });
      }
    }
  }

  /**
   * DELETE /api/locations/:id/media/*
   *   :id            — locationId
   *   wildcard path  — storagePath completo (puede contener "/")
   *   ?mediaType=    — (opcional) acelera la búsqueda del array
   */
  async deleteMedia(req: Request, res: Response): Promise<void> {
    try {
      const { id: locationId } = req.params;
      // Express wildcard: req.params[0] contiene todo lo que haya después del *
      const storagePath = (req.params as any)[0] as string;
      const mediaType = req.query.mediaType as MediaType | undefined;
      const userId = req.userId;

      if (!storagePath) {
        res.status(400).json({
          success: false,
          error: { code: 'STORAGE_PATH_REQUIRED', message: 'storagePath es requerido en la URL' },
        });
        return;
      }

      if (mediaType && !VALID_MEDIA_TYPES.includes(mediaType)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MEDIA_TYPE',
            message: `mediaType inválido. Permitidos: ${VALID_MEDIA_TYPES.join(', ')}`,
          },
        });
        return;
      }

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Usuario no autenticado' },
        });
        return;
      }

      const result = await locationMediaService.deleteMedia(locationId, storagePath, userId, mediaType);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error en deleteMedia', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
      } else {
        res.status(500).json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Error interno al eliminar el archivo' },
        });
      }
    }
  }

  /**
   * GET /api/locations/:id/media
   * Lista todos los archivos multimedia asociados a la ubicación.
   */
  async listMedia(req: Request, res: Response): Promise<void> {
    try {
      const { id: locationId } = req.params;
      const result = await locationMediaService.listMedia(locationId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error en listMedia', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
      } else {
        res.status(500).json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Error interno al listar archivos' },
        });
      }
    }
  }
}

export const locationMediaController = new LocationMediaController();
