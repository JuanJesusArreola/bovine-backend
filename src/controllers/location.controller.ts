// controllers/location/location.controller.ts
import { Request, Response } from 'express';
import { locationService } from '../services/location/LocationService';
import { LocationError, LocationNotFoundError, LocationValidationError } from '../utils/LocationErrors';
import logger from '../utils/logger';

export class LocationController {
  private readonly context = 'LocationController';

  constructor() {
    this.createLocation = this.createLocation.bind(this);
    this.updateLocation = this.updateLocation.bind(this);
    this.deleteLocation = this.deleteLocation.bind(this);
    this.getLocationById = this.getLocationById.bind(this);
    this.listLocations = this.listLocations.bind(this);
    this.calculateDistance = this.calculateDistance.bind(this);
    this.getNearbyLocations = this.getNearbyLocations.bind(this);
    this.getLocationTypeLabel = this.getLocationTypeLabel.bind(this);
    this.getStatusLabel = this.getStatusLabel.bind(this);
    this.getLocationSummary = this.getLocationSummary.bind(this);
  }

  // ==============================================================
  // CRUD
  // ==============================================================

  async createLocation(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const location = await locationService.createLocation({
        ...req.body,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        data: location,
        message: 'Ubicación creada exitosamente',
      });
    } catch (error) {
      logger.error('Error en createLocation', this.context, { body: req.body }, error as Error);
      if (error instanceof LocationError) {
        const body: any = { success: false, error: error.message, code: error.code };
        // Si el error tiene `details` (p. ej. LocationOutsideRanchError), incluirlo.
        if ((error as any).details) body.details = (error as any).details;
        res.status(error.statusCode).json(body);
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async updateLocation(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { id } = req.params;
      const location = await locationService.updateLocation({
        id,
        ...req.body,
        updatedBy: userId,
      });

      res.json({
        success: true,
        data: location,
        message: 'Ubicación actualizada',
      });
    } catch (error) {
      logger.error('Error en updateLocation', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof LocationError) {
        const body: any = { success: false, error: error.message, code: error.code };
        // Si el error tiene `details` (p. ej. LocationOutsideRanchError), incluirlo.
        if ((error as any).details) body.details = (error as any).details;
        res.status(error.statusCode).json(body);
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async deleteLocation(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { id } = req.params;
      await locationService.deleteLocation(id, userId);

      res.json({ success: true, message: 'Ubicación eliminada' });
    } catch (error) {
      logger.error('Error en deleteLocation', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        const body: any = { success: false, error: error.message, code: error.code };
        // Si el error tiene `details` (p. ej. LocationOutsideRanchError), incluirlo.
        if ((error as any).details) body.details = (error as any).details;
        res.status(error.statusCode).json(body);
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getLocationById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const location = await locationService.getLocationById(id);
      if (!location) {
        res.status(404).json({ success: false, error: 'Ubicación no encontrada' });
        return;
      }
      res.json({ success: true, data: location });
    } catch (error) {
      logger.error('Error en getLocationById', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        const body: any = { success: false, error: error.message, code: error.code };
        // Si el error tiene `details` (p. ej. LocationOutsideRanchError), incluirlo.
        if ((error as any).details) body.details = (error as any).details;
        res.status(error.statusCode).json(body);
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async listLocations(req: Request, res: Response): Promise<void> {
    try {
      const {
        ranchId,
        type,
        status,
        isActive,
        parentLocationId,
        searchTerm,
        limit,
        offset,
      } = req.query;

      const filters: any = {};
      if (ranchId) filters.ranchId = ranchId as string;
      if (type) filters.type = (type as string).split(',') as any;
      if (status) filters.status = (status as string).split(',') as any;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      if (parentLocationId !== undefined) {
        filters.parentLocationId = parentLocationId === 'null' ? null : parentLocationId as string;
      }
      if (searchTerm) filters.searchTerm = searchTerm as string;
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);

      const result = await locationService.listLocations(filters);
      res.json({
        success: true,
        data: result.rows,
        pagination: {
          total: result.count,
          limit: filters.limit || 50,
          offset: filters.offset || 0,
        },
      });
    } catch (error) {
      logger.error('Error en listLocations', this.context, { query: req.query }, error as Error);
      if (error instanceof LocationError) {
        const body: any = { success: false, error: error.message, code: error.code };
        // Si el error tiene `details` (p. ej. LocationOutsideRanchError), incluirlo.
        if ((error as any).details) body.details = (error as any).details;
        res.status(error.statusCode).json(body);
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  // ==============================================================
  // GEOESPACIALES
  // ==============================================================

  async calculateDistance(req: Request, res: Response): Promise<void> {
    try {
      const { id1, id2 } = req.params;
      const distance = await locationService.calculateDistance(id1, id2);
      res.json({ success: true, data: { from: id1, to: id2, distance } });
    } catch (error) {
      logger.error('Error en calculateDistance', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        const body: any = { success: false, error: error.message, code: error.code };
        // Si el error tiene `details` (p. ej. LocationOutsideRanchError), incluirlo.
        if ((error as any).details) body.details = (error as any).details;
        res.status(error.statusCode).json(body);
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getNearbyLocations(req: Request, res: Response): Promise<void> {
    try {
      const { latitude, longitude, radius } = req.query;
      if (!latitude || !longitude || !radius) {
        res.status(400).json({ success: false, error: 'Se requieren latitude, longitude y radius' });
        return;
      }

      const lat = parseFloat(latitude as string);
      const lon = parseFloat(longitude as string);
      const rad = parseFloat(radius as string);

      const { ranchId, type, status, isActive } = req.query;
      const filters: any = {};
      if (ranchId) filters.ranchId = ranchId as string;
      if (type) filters.type = (type as string).split(',') as any;
      if (status) filters.status = (status as string).split(',') as any;
      if (isActive !== undefined) filters.isActive = isActive === 'true';

      const locations = await locationService.getNearbyLocations(lat, lon, rad, filters);
      res.json({ success: true, data: locations });
    } catch (error) {
      logger.error('Error en getNearbyLocations', this.context, { query: req.query }, error as Error);
      if (error instanceof LocationError) {
        const body: any = { success: false, error: error.message, code: error.code };
        // Si el error tiene `details` (p. ej. LocationOutsideRanchError), incluirlo.
        if ((error as any).details) body.details = (error as any).details;
        res.status(error.statusCode).json(body);
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  // ==============================================================
  // UTILIDADES
  // ==============================================================

  async getLocationTypeLabel(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.params;
      const label = locationService.getLocationTypeLabel(type as any);
      res.json({ success: true, data: { type, label } });
    } catch (error) {
      logger.error('Error en getLocationTypeLabel', this.context, { params: req.params }, error as Error);
      res.status(500).json({ success: false, error: 'Error interno' });
    }
  }

  async getStatusLabel(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.params;
      const label = locationService.getStatusLabel(status as any);
      res.json({ success: true, data: { status, label } });
    } catch (error) {
      logger.error('Error en getStatusLabel', this.context, { params: req.params }, error as Error);
      res.status(500).json({ success: false, error: 'Error interno' });
    }
  }

  async getLocationSummary(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const location = await locationService.getLocationById(id);
      if (!location) {
        res.status(404).json({ success: false, error: 'Ubicación no encontrada' });
        return;
      }
      const summary = locationService.getLocationSummary(location);
      res.json({ success: true, data: summary });
    } catch (error) {
      logger.error('Error en getLocationSummary', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno' });
      }
    }
  }
}

export const locationController = new LocationController();