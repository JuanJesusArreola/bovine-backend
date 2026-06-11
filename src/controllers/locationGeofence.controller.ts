// controllers/location/locationGeofence.controller.ts
import { Request, Response } from 'express';
import { locationGeofenceService } from '../services/location/LocationGeofenceService';
import { LocationError } from '../utils/LocationErrors';
import logger from '../utils/logger';

export class LocationGeofenceController {
  private readonly context = 'LocationGeofenceController';

  constructor() {
    this.isPointInsideGeofence = this.isPointInsideGeofence.bind(this);
    this.isPointInCircle = this.isPointInCircle.bind(this);
    this.isPointInRectangle = this.isPointInRectangle.bind(this);
    this.isPointInPolygon = this.isPointInPolygon.bind(this);
    this.isPointInCorridor = this.isPointInCorridor.bind(this);
    this.distanceToSegment = this.distanceToSegment.bind(this);
    this.getGeofenceCenter = this.getGeofenceCenter.bind(this);
  }

  async isPointInsideGeofence(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const { latitude, longitude } = req.body;
      if (!latitude || !longitude) {
        res.status(400).json({ success: false, error: 'Se requieren latitude y longitude' });
        return;
      }

      const inside = await locationGeofenceService.isPointInsideGeofence(locationId, { latitude, longitude });
      res.json({ success: true, data: { inside } });
    } catch (error) {
      logger.error('Error en isPointInsideGeofence', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async isPointInCircle(req: Request, res: Response): Promise<void> {
    try {
      const { centerLat, centerLon, radius, pointLat, pointLon } = req.body;
      if (centerLat === undefined || centerLon === undefined || radius === undefined || pointLat === undefined || pointLon === undefined) {
        res.status(400).json({ success: false, error: 'Se requieren centerLat, centerLon, radius, pointLat, pointLon' });
        return;
      }

      const inside = locationGeofenceService.isPointInCircle(
        { latitude: centerLat, longitude: centerLon },
        radius,
        { latitude: pointLat, longitude: pointLon }
      );
      res.json({ success: true, data: { inside } });
    } catch (error) {
      logger.error('Error en isPointInCircle', this.context, { body: req.body }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async isPointInRectangle(req: Request, res: Response): Promise<void> {
    try {
      const { north, south, east, west, pointLat, pointLon } = req.body;
      if (north === undefined || south === undefined || east === undefined || west === undefined || pointLat === undefined || pointLon === undefined) {
        res.status(400).json({ success: false, error: 'Se requieren north, south, east, west, pointLat, pointLon' });
        return;
      }

      const inside = locationGeofenceService.isPointInRectangle(
        { north, south, east, west },
        { latitude: pointLat, longitude: pointLon }
      );
      res.json({ success: true, data: { inside } });
    } catch (error) {
      logger.error('Error en isPointInRectangle', this.context, { body: req.body }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async isPointInPolygon(req: Request, res: Response): Promise<void> {
    try {
      const { polygon, pointLat, pointLon } = req.body;
      if (!polygon || !Array.isArray(polygon) || polygon.length < 3 || pointLat === undefined || pointLon === undefined) {
        res.status(400).json({ success: false, error: 'Se requieren polygon (array de {lat,lon}) y pointLat, pointLon' });
        return;
      }

      const inside = locationGeofenceService.isPointInPolygon(
        polygon.map((p: any) => ({ latitude: p.lat, longitude: p.lon })),
        { latitude: pointLat, longitude: pointLon }
      );
      res.json({ success: true, data: { inside } });
    } catch (error) {
      logger.error('Error en isPointInPolygon', this.context, { body: req.body }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async isPointInCorridor(req: Request, res: Response): Promise<void> {
    try {
      const { line, width, pointLat, pointLon } = req.body;
      if (!line || !Array.isArray(line) || line.length < 2 || width === undefined || pointLat === undefined || pointLon === undefined) {
        res.status(400).json({ success: false, error: 'Se requieren line (array de {lat,lon}), width, pointLat, pointLon' });
        return;
      }

      const inside = await locationGeofenceService.isPointInCorridor(
        line.map((p: any) => ({ latitude: p.lat, longitude: p.lon })),
        width,
        { latitude: pointLat, longitude: pointLon }
      );
      res.json({ success: true, data: { inside } });
    } catch (error) {
      logger.error('Error en isPointInCorridor', this.context, { body: req.body }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async distanceToSegment(req: Request, res: Response): Promise<void> {
    try {
      const { startLat, startLon, endLat, endLon, pointLat, pointLon } = req.body;
      if (startLat === undefined || startLon === undefined || endLat === undefined || endLon === undefined || pointLat === undefined || pointLon === undefined) {
        res.status(400).json({ success: false, error: 'Se requieren startLat, startLon, endLat, endLon, pointLat, pointLon' });
        return;
      }

      const distance = locationGeofenceService.distanceToSegment(
        { latitude: startLat, longitude: startLon },
        { latitude: endLat, longitude: endLon },
        { latitude: pointLat, longitude: pointLon }
      );
      res.json({ success: true, data: { distance } });
    } catch (error) {
      logger.error('Error en distanceToSegment', this.context, { body: req.body }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getGeofenceCenter(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const center = await locationGeofenceService.getGeofenceCenter(locationId);
      res.json({ success: true, data: { center } });
    } catch (error) {
      logger.error('Error en getGeofenceCenter', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }
}

export const locationGeofenceController = new LocationGeofenceController();