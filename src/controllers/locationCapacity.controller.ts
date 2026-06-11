// controllers/location/locationCapacity.controller.ts
import { Request, Response } from 'express';
import { locationCapacityService } from '../services/location/LocationCapacityService';
import { LocationError } from '../utils/LocationErrors';
import logger from '../utils/logger';

export class LocationCapacityController {
  private readonly context = 'LocationCapacityController';

  constructor() {
    this.getCapacity = this.getCapacity.bind(this);
    this.getOccupancyPercentage = this.getOccupancyPercentage.bind(this);
    this.isAtCapacity = this.isAtCapacity.bind(this);
    this.getAvailableCapacity = this.getAvailableCapacity.bind(this);
    this.incrementAnimals = this.incrementAnimals.bind(this);
    this.decrementAnimals = this.decrementAnimals.bind(this);
    this.meetsRequirements = this.meetsRequirements.bind(this);
    this.getCapacityStats = this.getCapacityStats.bind(this);
    this.recommendCapacityAdjustment = this.recommendCapacityAdjustment.bind(this);
    this.createCapacity = this.createCapacity.bind(this);
    this.updateCapacity = this.updateCapacity.bind(this);
    this.upsertCapacity = this.upsertCapacity.bind(this);
    this.getCurrentOccupancy = this.getCurrentOccupancy.bind(this);
    this.getRanchOccupancy = this.getRanchOccupancy.bind(this);
  }

  /**
   * GET /api/locations/:locationId/current-occupancy
   * Devuelve la ocupación actual de la ubicación (currentAnimals, maxAnimals, available, %).
   */
  async getCurrentOccupancy(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const data = await locationCapacityService.getCurrentOccupancy(locationId);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getCurrentOccupancy', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  /**
   * GET /api/ranches/:ranchId/occupancy
   * Suma las ocupaciones actuales de todas las ubicaciones del rancho.
   */
  async getRanchOccupancy(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const data = await locationCapacityService.getRanchOccupancy(ranchId);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getRanchOccupancy', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  /**
   * POST /api/locations/:locationId/capacity
   * Crea el registro de capacidad. Falla si ya existe.
   */
  async createCapacity(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado', code: 'UNAUTHORIZED' });
        return;
      }
      const capacity = await locationCapacityService.createCapacity(locationId, req.body, userId);
      res.status(201).json({ success: true, data: capacity });
    } catch (error) {
      logger.error('Error en createCapacity', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  /**
   * PUT /api/locations/:locationId/capacity
   * Actualiza el registro. Falla si no existe.
   */
  async updateCapacity(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado', code: 'UNAUTHORIZED' });
        return;
      }
      const capacity = await locationCapacityService.updateCapacity(locationId, req.body, userId);
      res.json({ success: true, data: capacity });
    } catch (error) {
      logger.error('Error en updateCapacity', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  /**
   * PATCH /api/locations/:locationId/capacity
   * Upsert: crea si no existe, actualiza si existe.
   * Devuelve 201 si creó, 200 si actualizó.
   */
  async upsertCapacity(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado', code: 'UNAUTHORIZED' });
        return;
      }
      const { capacity, created } = await locationCapacityService.upsertCapacity(
        locationId,
        req.body,
        userId
      );
      res.status(created ? 201 : 200).json({ success: true, data: capacity, created });
    } catch (error) {
      logger.error('Error en upsertCapacity', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getCapacity(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const capacity = await locationCapacityService.getCapacity(locationId);
      res.json({ success: true, data: capacity });
    } catch (error) {
      logger.error('Error en getCapacity', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getOccupancyPercentage(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const percentage = await locationCapacityService.getOccupancyPercentage(locationId);
      res.json({ success: true, data: { percentage } });
    } catch (error) {
      logger.error('Error en getOccupancyPercentage', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async isAtCapacity(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const atCapacity = await locationCapacityService.isAtCapacity(locationId);
      res.json({ success: true, data: { atCapacity } });
    } catch (error) {
      logger.error('Error en isAtCapacity', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getAvailableCapacity(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const available = await locationCapacityService.getAvailableCapacity(locationId);
      res.json({ success: true, data: { available } });
    } catch (error) {
      logger.error('Error en getAvailableCapacity', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  /**
   * @deprecated 410 Gone — currentAnimals se calcula on-the-fly desde
   * BovineLocationHistory. La fuente de verdad para entradas/salidas es
   * el flujo de registerEntry/registerExit en el servicio de bovinos.
   */
  async incrementAnimals(_req: Request, res: Response): Promise<void> {
    res.status(410).json({
      success: false,
      error:
        'Endpoint deprecado. currentAnimals se calcula automáticamente desde BovineLocationHistory. ' +
        'Para registrar entrada de un bovino usa POST /api/bovines/:id/register-entry.',
      code: 'GONE_USE_BOVINE_LOCATION_HISTORY',
    });
  }

  /**
   * @deprecated 410 Gone — currentAnimals se calcula on-the-fly desde
   * BovineLocationHistory. La fuente de verdad para entradas/salidas es
   * el flujo de registerEntry/registerExit en el servicio de bovinos.
   */
  async decrementAnimals(_req: Request, res: Response): Promise<void> {
    res.status(410).json({
      success: false,
      error:
        'Endpoint deprecado. currentAnimals se calcula automáticamente desde BovineLocationHistory. ' +
        'Para registrar salida de un bovino usa POST /api/bovines/:id/register-exit.',
      code: 'GONE_USE_BOVINE_LOCATION_HISTORY',
    });
  }

  async meetsRequirements(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const requirements = req.body;
      const result = await locationCapacityService.meetsRequirements(locationId, requirements);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error en meetsRequirements', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getCapacityStats(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const stats = await locationCapacityService.getCapacityStats(locationId);
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('Error en getCapacityStats', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async recommendCapacityAdjustment(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const recommendation = await locationCapacityService.recommendCapacityAdjustment(locationId);
      res.json({ success: true, data: { recommendation } });
    } catch (error) {
      logger.error('Error en recommendCapacityAdjustment', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }
}

export const locationCapacityController = new LocationCapacityController();