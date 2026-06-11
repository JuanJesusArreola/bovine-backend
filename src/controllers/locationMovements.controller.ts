// controllers/locationMovements.controller.ts
// ============================================================================
// LOCATION MOVEMENTS CONTROLLER
// ============================================================================

import { Request, Response } from 'express';
import {
  locationMovementsService,
  MovementEventType,
  GetMovementsOptions,
} from '../services/location/LocationMovementsService';
import { MovementReason } from '../models/BovineLocationHistory';
import { LocationError } from '../utils/LocationErrors';
import logger from '../utils/logger';

export class LocationMovementsController {
  private readonly context = 'LocationMovementsController';

  constructor() {
    this.getMovements = this.getMovements.bind(this);
  }

  /**
   * GET /api/locations/:id/movements
   *   ?limit=20&offset=0
   *   ?type=ENTRY|EXIT
   *   ?reason=GRAZING|MEDICAL|...
   *   ?fromDate=ISO8601
   *   ?toDate=ISO8601
   */
  async getMovements(req: Request, res: Response): Promise<void> {
    try {
      const { id: locationId } = req.params;

      const options: GetMovementsOptions = {};

      // Paginación
      if (req.query.limit !== undefined) {
        const n = parseInt(req.query.limit as string, 10);
        if (!isNaN(n)) options.limit = n;
      }
      if (req.query.offset !== undefined) {
        const n = parseInt(req.query.offset as string, 10);
        if (!isNaN(n)) options.offset = n;
      }

      // Tipo de evento
      if (req.query.type) {
        const t = (req.query.type as string).toUpperCase();
        if (t === 'ENTRY' || t === 'EXIT') {
          options.type = t as MovementEventType;
        } else {
          res.status(400).json({
            success: false,
            error: 'type debe ser ENTRY o EXIT',
            code: 'INVALID_TYPE',
          });
          return;
        }
      }

      // Razón
      if (req.query.reason) {
        const r = (req.query.reason as string).toUpperCase();
        if (Object.values(MovementReason).includes(r as MovementReason)) {
          options.reason = r as MovementReason;
        } else {
          res.status(400).json({
            success: false,
            error: `reason inválida. Permitidas: ${Object.values(MovementReason).join(', ')}`,
            code: 'INVALID_REASON',
          });
          return;
        }
      }

      // Fechas
      if (req.query.fromDate) {
        const d = new Date(req.query.fromDate as string);
        if (!isNaN(d.getTime())) options.fromDate = d;
      }
      if (req.query.toDate) {
        const d = new Date(req.query.toDate as string);
        if (!isNaN(d.getTime())) options.toDate = d;
      }

      const result = await locationMovementsService.getLocationMovements(locationId, options);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error en getMovements', this.context, { params: req.params, query: req.query }, error as Error);
      if (error instanceof LocationError) {
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
}

export const locationMovementsController = new LocationMovementsController();
