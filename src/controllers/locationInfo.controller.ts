// controllers/locationInfo.controller.ts
import { Request, Response } from 'express';
import { locationInfoService, MediaKind } from '../services/location/LocationInfoService';
import { LocationError } from '../utils/LocationErrors';
import logger from '../utils/logger';

const VALID_MEDIA_KINDS: MediaKind[] = ['images', 'documents', 'videos', 'maps'];

export class LocationInfoController {
  private readonly context = 'LocationInfoController';

  constructor() {
    // Binding de métodos para Express callbacks
    this.getInfo = this.getInfo.bind(this);
    this.createInfo = this.createInfo.bind(this);
    this.updateInfo = this.updateInfo.bind(this);
    this.upsertInfo = this.upsertInfo.bind(this);
    this.deleteInfo = this.deleteInfo.bind(this);
    this.getSummary = this.getSummary.bind(this);
    this.addMedia = this.addMedia.bind(this);
    this.removeMedia = this.removeMedia.bind(this);
    this.recordInspection = this.recordInspection.bind(this);
    this.recordReview = this.recordReview.bind(this);
    this.listNeedingInspection = this.listNeedingInspection.bind(this);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private handleError(error: unknown, res: Response, action: string, meta: any = {}): void {
    logger.error(`Error en ${action}`, this.context, meta, error as Error);
    if (error instanceof LocationError) {
      res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
    } else {
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  private requireUserId(req: Request, res: Response): string | null {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Usuario no autenticado' });
      return null;
    }
    return userId;
  }

  // ==========================================================================
  // CRUD
  // ==========================================================================

  async getInfo(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const info = await locationInfoService.getByLocationId(locationId);
      if (!info) {
        res.status(404).json({ success: false, error: 'Información no encontrada para esta ubicación' });
        return;
      }
      res.json({ success: true, data: info });
    } catch (error) {
      this.handleError(error, res, 'getInfo', { params: req.params });
    }
  }

  async createInfo(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId } = req.params;
      const info = await locationInfoService.create({
        ...req.body,
        locationId,
        updatedBy: userId,
      });

      res.status(201).json({ success: true, data: info, message: 'Información creada' });
    } catch (error) {
      this.handleError(error, res, 'createInfo', { params: req.params, body: req.body });
    }
  }

  async updateInfo(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId } = req.params;
      const info = await locationInfoService.update({
        ...req.body,
        locationId,
        updatedBy: userId,
      });

      res.json({ success: true, data: info, message: 'Información actualizada' });
    } catch (error) {
      this.handleError(error, res, 'updateInfo', { params: req.params, body: req.body });
    }
  }

  /**
   * PUT idempotente: crea si no existe, actualiza si existe.
   */
  async upsertInfo(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId } = req.params;
      const info = await locationInfoService.upsert({
        ...req.body,
        locationId,
        updatedBy: userId,
      });

      res.json({ success: true, data: info, message: 'Información guardada' });
    } catch (error) {
      this.handleError(error, res, 'upsertInfo', { params: req.params, body: req.body });
    }
  }

  async deleteInfo(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      await locationInfoService.delete(locationId);
      res.json({ success: true, message: 'Información eliminada' });
    } catch (error) {
      this.handleError(error, res, 'deleteInfo', { params: req.params });
    }
  }

  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const summary = await locationInfoService.getSummary(locationId);
      res.json({ success: true, data: summary });
    } catch (error) {
      this.handleError(error, res, 'getSummary', { params: req.params });
    }
  }

  // ==========================================================================
  // MEDIA
  // ==========================================================================

  /**
   * POST /:locationId/info/:kind
   * Body: { url: string }
   * kind ∈ images|documents|videos|maps
   */
  async addMedia(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId, kind } = req.params as { locationId: string; kind: MediaKind };
      const { url } = req.body;

      if (!VALID_MEDIA_KINDS.includes(kind)) {
        res.status(400).json({
          success: false,
          error: `Tipo de media inválido. Permitidos: ${VALID_MEDIA_KINDS.join(', ')}`,
        });
        return;
      }

      if (!url || typeof url !== 'string') {
        res.status(400).json({ success: false, error: 'El campo "url" es requerido (string)' });
        return;
      }

      const info = await locationInfoService.addMedia({
        locationId,
        kind,
        url,
        updatedBy: userId,
      });

      res.status(201).json({ success: true, data: info, message: `Media añadida a ${kind}` });
    } catch (error) {
      this.handleError(error, res, 'addMedia', { params: req.params, body: req.body });
    }
  }

  /**
   * DELETE /:locationId/info/:kind
   * Body: { url: string }
   */
  async removeMedia(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId, kind } = req.params as { locationId: string; kind: MediaKind };
      const url = (req.body?.url || req.query?.url) as string;

      if (!VALID_MEDIA_KINDS.includes(kind)) {
        res.status(400).json({
          success: false,
          error: `Tipo de media inválido. Permitidos: ${VALID_MEDIA_KINDS.join(', ')}`,
        });
        return;
      }

      if (!url || typeof url !== 'string') {
        res.status(400).json({ success: false, error: 'El campo "url" es requerido (body o query)' });
        return;
      }

      const info = await locationInfoService.removeMedia({
        locationId,
        kind,
        url,
        updatedBy: userId,
      });

      res.json({ success: true, data: info, message: `Media removida de ${kind}` });
    } catch (error) {
      this.handleError(error, res, 'removeMedia', { params: req.params, body: req.body });
    }
  }

  // ==========================================================================
  // INSPECCIÓN / REVISIÓN
  // ==========================================================================

  async recordInspection(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId } = req.params;
      const info = await locationInfoService.recordInspection({
        ...req.body,
        locationId,
        inspectedBy: userId,
      });

      res.status(201).json({ success: true, data: info, message: 'Inspección registrada' });
    } catch (error) {
      this.handleError(error, res, 'recordInspection', { params: req.params, body: req.body });
    }
  }

  async recordReview(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId } = req.params;
      const info = await locationInfoService.recordReview({
        locationId,
        reviewedBy: userId,
      });

      res.json({ success: true, data: info, message: 'Revisión registrada' });
    } catch (error) {
      this.handleError(error, res, 'recordReview', { params: req.params });
    }
  }

  async listNeedingInspection(req: Request, res: Response): Promise<void> {
    try {
      const list = await locationInfoService.listNeedingInspection();
      res.json({ success: true, data: list, pagination: { total: list.length } });
    } catch (error) {
      this.handleError(error, res, 'listNeedingInspection');
    }
  }
}

export const locationInfoController = new LocationInfoController();
