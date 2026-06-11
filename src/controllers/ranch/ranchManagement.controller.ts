// controllers/ranch/ranchManagement.controller.ts
import { Request, Response } from 'express';
import multer from 'multer';
import { RanchError } from '../../utils/RanchErrors';
import logger from '../../utils/logger';
import { ranchManagementService, storageService } from '../../container';
import { FileCategory, FILE_CONFIGS } from '../../middleware/upload';
import { MediaType, MediaCategory } from '../../models/RanchMedia';
import { mapMediaCategoryToFileCategory } from '../../utils/fileCategoryMapping';

export class RanchManagementController {
  private readonly context = 'RanchManagementController';

  constructor() {
    this.getHR = this.getHR.bind(this);
    this.createOrUpdateHR = this.createOrUpdateHR.bind(this);
    this.calculateProductivity = this.calculateProductivity.bind(this);
    this.analyzeTurnover = this.analyzeTurnover.bind(this);
    this.getEmergencyPlan = this.getEmergencyPlan.bind(this);
    this.createOrUpdateEmergencyPlan = this.createOrUpdateEmergencyPlan.bind(this);
    this.assessReadiness = this.assessReadiness.bind(this);
    this.getEmergencyRecommendations = this.getEmergencyRecommendations.bind(this);
    this.uploadMedia = this.uploadMedia.bind(this);
    this.deleteMedia = this.deleteMedia.bind(this);
    this.listMedia = this.listMedia.bind(this);
    this.getMediaById = this.getMediaById.bind(this);
  }

  // ==========================================================================
  // RRHH
  // ==========================================================================

  async getHR(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const hr = await ranchManagementService.getHR(ranchId);
      res.json({ success: true, data: hr });
    } catch (error) {
      this.handleError(error, res, 'getHR');
    }
  }

  async createOrUpdateHR(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) return this.unauthorized(res);

      const { ranchId } = req.params;
      const hr = await ranchManagementService.createOrUpdateHR(ranchId, req.body, userId);
      res.json({ success: true, data: hr, message: 'RRHH guardado' });
    } catch (error) {
      this.handleError(error, res, 'createOrUpdateHR');
    }
  }

  async calculateProductivity(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const productivity = await ranchManagementService.calculateProductivity(ranchId);
      res.json({ success: true, data: { productivity } });
    } catch (error) {
      this.handleError(error, res, 'calculateProductivity');
    }
  }

  async analyzeTurnover(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const analysis = await ranchManagementService.analyzeTurnover(ranchId);
      res.json({ success: true, data: analysis });
    } catch (error) {
      this.handleError(error, res, 'analyzeTurnover');
    }
  }

  // ==========================================================================
  // EMERGENCIA
  // ==========================================================================

  async getEmergencyPlan(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const plan = await ranchManagementService.getEmergencyPlan(ranchId);
      res.json({ success: true, data: plan });
    } catch (error) {
      this.handleError(error, res, 'getEmergencyPlan');
    }
  }

  async createOrUpdateEmergencyPlan(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) return this.unauthorized(res);

      const { ranchId } = req.params;
      const plan = await ranchManagementService.createOrUpdateEmergencyPlan(ranchId, req.body, userId);
      res.json({ success: true, data: plan, message: 'Plan de emergencia guardado' });
    } catch (error) {
      this.handleError(error, res, 'createOrUpdateEmergencyPlan');
    }
  }

  async assessReadiness(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const readiness = await ranchManagementService.assessReadiness(ranchId);
      res.json({ success: true, data: readiness });
    } catch (error) {
      this.handleError(error, res, 'assessReadiness');
    }
  }

  async getEmergencyRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const recommendations = await ranchManagementService.getEmergencyRecommendations(ranchId);
      res.json({ success: true, data: recommendations });
    } catch (error) {
      this.handleError(error, res, 'getEmergencyRecommendations');
    }
  }

  // ==========================================================================
  // MEDIA
  // ==========================================================================

  async uploadMedia(req: Request, res: Response): Promise<void> {
    const { category } = req.body;
    const fileCategory = mapMediaCategoryToFileCategory(category as MediaCategory);
    const config = FILE_CONFIGS[fileCategory];

    // multer memoryStorage — archivo queda como Buffer, nunca toca disco
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: config.maxSize, files: 1 },
    }).single('file');

    upload(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        res.status(400).json({ success: false, error: `Error de upload: ${err.message}` });
        return;
      }
      if (err) {
        res.status(400).json({ success: false, error: err.message });
        return;
      }

      try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, error: 'No autenticado' });

        const { ranchId } = req.params;
        const { title, type, category, description, tags, takenDate, latitude, longitude, locationId, bovineId } = req.body;

        const file = req.file;
        if (!file) return res.status(400).json({ success: false, error: 'Archivo no recibido' });

        // Validar MIME type contra config de la categoría
        if (!config.allowedTypes.includes(file.mimetype)) {
          res.status(400).json({
            success: false,
            error: `Tipo de archivo no permitido: ${file.mimetype}. Permitidos: ${config.allowedTypes.join(', ')}`,
          });
          return;
        }

        // Determinar thumbnail según config
        const thumbnailConfig = config.thumbnailSizes?.[0];
        const thumbnail = thumbnailConfig
          ? { width: thumbnailConfig.width, height: thumbnailConfig.height, suffix: thumbnailConfig.name }
          : undefined;

        // Subir a Cloudflare R2
        const uploadResult = await storageService.upload(
          {
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          },
          fileCategory, // carpeta en R2
          thumbnail
        );

        const fileData = {
          url: uploadResult.url,
          storagePath: uploadResult.storagePath,
          originalName: uploadResult.originalName,
          mimeType: uploadResult.mimeType,
          size: uploadResult.size,
          thumbnailUrl: uploadResult.thumbnailUrl,
        };

        const metadata = {
          type: type as MediaType,
          category: category as MediaCategory,
          title,
          description,
          tags: tags ? (typeof tags === 'string' ? tags.split(',') : tags) : undefined,
          takenDate: takenDate ? new Date(takenDate) : undefined,
          latitude: latitude ? parseFloat(latitude) : undefined,
          longitude: longitude ? parseFloat(longitude) : undefined,
          locationId,
          bovineId,
        };

        const media = await ranchManagementService.uploadMedia(ranchId, fileData, metadata, userId);
        res.status(201).json({ success: true, data: media });
      } catch (error) {
        logger.error('Error en uploadMedia', this.context, { error });
        if (error instanceof RanchError) {
          res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
        } else {
          res.status(500).json({ success: false, error: 'Error interno del servidor' });
        }
      }
    });
  }

  async deleteMedia(req: Request, res: Response): Promise<void> {
    try {
      const { mediaId } = req.params;
      await ranchManagementService.deleteMedia(mediaId);
      res.json({ success: true, message: 'Archivo eliminado' });
    } catch (error) {
      this.handleError(error, res, 'deleteMedia');
    }
  }

  async listMedia(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const { type, category, tags, limit, offset } = req.query;
      const filters: any = {};
      if (type) filters.type = type as string;
      if (category) filters.category = category as string;
      if (tags) filters.tags = (tags as string).split(',');
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);

      const result = await ranchManagementService.listMedia(ranchId, filters);
      res.json({
        success: true,
        data: result.rows,
        pagination: { total: result.count, limit: filters.limit || 50, offset: filters.offset || 0 },
      });
    } catch (error) {
      this.handleError(error, res, 'listMedia');
    }
  }

  async getMediaById(req: Request, res: Response): Promise<void> {
    try {
      const { mediaId } = req.params;
      const media = await ranchManagementService.getMediaById(mediaId);
      if (!media) {
        res.status(404).json({ success: false, error: 'Archivo no encontrado' });
        return;
      }
      res.json({ success: true, data: media });
    } catch (error) {
      this.handleError(error, res, 'getMediaById');
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private unauthorized(res: Response): void {
    res.status(401).json({ success: false, error: 'Usuario no autenticado' });
  }

  private handleError(error: any, res: Response, method: string): void {
    logger.error(`Error en ${method}`, this.context, { error: error.message }, error);
    if (error instanceof RanchError) {
      res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
    } else {
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
}

export const ranchManagementController = new RanchManagementController();