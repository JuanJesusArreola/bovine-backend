// controllers/bovineFull.controller.ts
// ============================================================================
// BOVINE FULL CONTROLLER
// ============================================================================
// GET /api/bovines/:id/full
// Endpoint compuesto para la pantalla de detalle del bovino.
// ============================================================================

import { Request, Response } from 'express';
import { bovineFullService } from '../services/BovineFullService';
import { BovineError } from '../utils/BovineErrors';
import logger from '../utils/logger';

export class BovineFullController {
  private readonly context = 'BovineFullController';

  constructor() {
    this.getFullDetail = this.getFullDetail.bind(this);
  }

  /**
   * GET /api/bovines/:id/full
   * Devuelve bovino + ranch + healthSnapshot + media + current-location +
   * vaccinationStatus + últimas vacunas/health/movimientos.
   */
  async getFullDetail(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = await bovineFullService.getFullDetail(id);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getFullDetail', this.context, { params: req.params }, error as Error);
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
}

export const bovineFullController = new BovineFullController();
