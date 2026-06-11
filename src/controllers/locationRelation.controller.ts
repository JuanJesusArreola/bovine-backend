// controllers/locationRelation.controller.ts
import { Request, Response } from 'express';
import {
  locationRelationService,
  ListRelationsFilters,
} from '../services/location/LocationRelationService';
import { RelationType } from '../models/LocationRelation';
import { LocationError } from '../utils/LocationErrors';
import logger from '../utils/logger';

export class LocationRelationController {
  private readonly context = 'LocationRelationController';

  constructor() {
    this.getRelation = this.getRelation.bind(this);
    this.createRelation = this.createRelation.bind(this);
    this.updateRelation = this.updateRelation.bind(this);
    this.deleteRelation = this.deleteRelation.bind(this);
    this.activateRelation = this.activateRelation.bind(this);
    this.deactivateRelation = this.deactivateRelation.bind(this);
    this.listRelations = this.listRelations.bind(this);
    this.getChildren = this.getChildren.bind(this);
    this.getParents = this.getParents.bind(this);
    this.getAdjacent = this.getAdjacent.bind(this);
    this.getConnected = this.getConnected.bind(this);
    this.findBetween = this.findBetween.bind(this);
    this.recordUsage = this.recordUsage.bind(this);
    this.deactivateExpired = this.deactivateExpired.bind(this);
    this.getStats = this.getStats.bind(this);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private handleError(error: unknown, res: Response, action: string, meta: any = {}): void {
    logger.error(`Error en ${action}`, this.context, meta, error as Error);
    if (error instanceof LocationError) {
      const body: any = { success: false, error: error.message, code: error.code };
      // Si el error tiene `details` (p. ej. RelationCrossRanchError), incluirlo.
      if ((error as any).details) body.details = (error as any).details;
      res.status(error.statusCode).json(body);
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

  async getRelation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const relation = await locationRelationService.getById(id);
      if (!relation) {
        res.status(404).json({ success: false, error: 'Relación no encontrada' });
        return;
      }
      res.json({ success: true, data: relation });
    } catch (error) {
      this.handleError(error, res, 'getRelation', { params: req.params });
    }
  }

  async createRelation(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const {
        sourceLocationId,
        targetLocationId,
        relationType,
      } = req.body;

      if (!sourceLocationId || !targetLocationId || !relationType) {
        res.status(400).json({
          success: false,
          error: 'Los campos "sourceLocationId", "targetLocationId" y "relationType" son requeridos',
        });
        return;
      }

      if (!Object.values(RelationType).includes(relationType)) {
        res.status(400).json({
          success: false,
          error: `Tipo de relación inválido. Permitidos: ${Object.values(RelationType).join(', ')}`,
        });
        return;
      }

      const relation = await locationRelationService.create({
        ...req.body,
        createdBy: userId,
      });

      res.status(201).json({ success: true, data: relation, message: 'Relación creada' });
    } catch (error) {
      this.handleError(error, res, 'createRelation', { body: req.body });
    }
  }

  async updateRelation(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { id } = req.params;
      const relation = await locationRelationService.update({
        ...req.body,
        id,
        updatedBy: userId,
      });

      res.json({ success: true, data: relation, message: 'Relación actualizada' });
    } catch (error) {
      this.handleError(error, res, 'updateRelation', { params: req.params, body: req.body });
    }
  }

  async deleteRelation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await locationRelationService.delete(id);
      res.json({ success: true, message: 'Relación eliminada' });
    } catch (error) {
      this.handleError(error, res, 'deleteRelation', { params: req.params });
    }
  }

  async activateRelation(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;
      const { id } = req.params;
      const relation = await locationRelationService.activate(id, userId);
      res.json({ success: true, data: relation, message: 'Relación activada' });
    } catch (error) {
      this.handleError(error, res, 'activateRelation', { params: req.params });
    }
  }

  async deactivateRelation(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;
      const { id } = req.params;
      const relation = await locationRelationService.deactivate(id, userId);
      res.json({ success: true, data: relation, message: 'Relación desactivada' });
    } catch (error) {
      this.handleError(error, res, 'deactivateRelation', { params: req.params });
    }
  }

  // ==========================================================================
  // LISTADOS / CONSULTAS
  // ==========================================================================

  async listRelations(req: Request, res: Response): Promise<void> {
    try {
      const q = req.query;
      const filters: ListRelationsFilters = {
        locationId: q.locationId as string | undefined,
        sourceLocationId: q.sourceLocationId as string | undefined,
        targetLocationId: q.targetLocationId as string | undefined,
        relationType: q.relationType as RelationType | undefined,
        isActive: q.isActive !== undefined ? q.isActive === 'true' : undefined,
        isPrimary: q.isPrimary !== undefined ? q.isPrimary === 'true' : undefined,
        bidirectional: q.bidirectional !== undefined ? q.bidirectional === 'true' : undefined,
      };

      const list = await locationRelationService.list(filters);
      res.json({ success: true, data: list, pagination: { total: list.length } });
    } catch (error) {
      this.handleError(error, res, 'listRelations', { query: req.query });
    }
  }

  async getChildren(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const list = await locationRelationService.getChildren(locationId);
      res.json({ success: true, data: list, pagination: { total: list.length } });
    } catch (error) {
      this.handleError(error, res, 'getChildren', { params: req.params });
    }
  }

  async getParents(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const list = await locationRelationService.getParents(locationId);
      res.json({ success: true, data: list, pagination: { total: list.length } });
    } catch (error) {
      this.handleError(error, res, 'getParents', { params: req.params });
    }
  }

  async getAdjacent(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const list = await locationRelationService.getAdjacent(locationId);
      res.json({ success: true, data: list, pagination: { total: list.length } });
    } catch (error) {
      this.handleError(error, res, 'getAdjacent', { params: req.params });
    }
  }

  async getConnected(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const list = await locationRelationService.getConnected(locationId);
      res.json({ success: true, data: list, pagination: { total: list.length } });
    } catch (error) {
      this.handleError(error, res, 'getConnected', { params: req.params });
    }
  }

  async findBetween(req: Request, res: Response): Promise<void> {
    try {
      const { locationA, locationB } = req.params;
      const relationType = req.query.relationType as RelationType | undefined;

      if (relationType && !Object.values(RelationType).includes(relationType)) {
        res.status(400).json({
          success: false,
          error: `Tipo de relación inválido. Permitidos: ${Object.values(RelationType).join(', ')}`,
        });
        return;
      }

      const list = await locationRelationService.findBetween(locationA, locationB, relationType);
      res.json({ success: true, data: list, pagination: { total: list.length } });
    } catch (error) {
      this.handleError(error, res, 'findBetween', { params: req.params, query: req.query });
    }
  }

  // ==========================================================================
  // USO / MÉTRICAS
  // ==========================================================================

  async recordUsage(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;
      const { id } = req.params;
      const relation = await locationRelationService.recordUsage({ id, updatedBy: userId });
      res.json({ success: true, data: relation, message: 'Uso registrado' });
    } catch (error) {
      this.handleError(error, res, 'recordUsage', { params: req.params });
    }
  }

  async deactivateExpired(_req: Request, res: Response): Promise<void> {
    try {
      const affected = await locationRelationService.deactivateExpired();
      res.json({
        success: true,
        data: { affected },
        message: `${affected} relaciones expiradas desactivadas`,
      });
    } catch (error) {
      this.handleError(error, res, 'deactivateExpired');
    }
  }

  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const locationId = req.query.locationId as string | undefined;
      const stats = await locationRelationService.getStats(locationId);
      res.json({ success: true, data: stats });
    } catch (error) {
      this.handleError(error, res, 'getStats', { query: req.query });
    }
  }
}

export const locationRelationController = new LocationRelationController();
