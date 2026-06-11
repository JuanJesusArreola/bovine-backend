// controllers/health/laboratory.controller.ts
import { Request, Response } from 'express';
import { laboratoryService } from '../services/health/LaboratoryService';
import { HealthError } from '../utils/HealthErrors';
import logger from '../utils/logger';

export class LaboratoryController {
  private readonly context = 'LaboratoryController';

  constructor() {
    this.addLaboratoryResults = this.addLaboratoryResults.bind(this);
    this.getAbnormalResults = this.getAbnormalResults.bind(this);
    this.getAbnormalResultsByBovine = this.getAbnormalResultsByBovine.bind(this);
    this.getAbnormalResultsByRanch = this.getAbnormalResultsByRanch.bind(this);
  }

  /**
   * POST /api/health/laboratory/results
   * Agrega resultados de laboratorio a un registro de salud.
   */
  async addLaboratoryResults(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { healthId, results } = req.body;
      if (!healthId || !results || !Array.isArray(results)) {
        res.status(400).json({ success: false, error: 'healthId y results (array) son requeridos' });
        return;
      }

      const data = {
        healthId,
        results,
        updatedBy: userId,
      };

      const updatedHealth = await laboratoryService.addLaboratoryResults(data);
      res.json({
        success: true,
        data: updatedHealth,
        message: 'Resultados de laboratorio agregados',
      });
    } catch (error) {
      logger.error('Error en addLaboratoryResults', this.context, { body: req.body }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  /**
   * GET /api/health/laboratory/abnormal/:healthId
   * Obtiene resultados anormales de un registro de salud específico.
   */
  async getAbnormalResults(req: Request, res: Response): Promise<void> {
    try {
      const { healthId } = req.params;
      const abnormal = await laboratoryService.getAbnormalResults(healthId);
      res.json({ success: true, data: abnormal });
    } catch (error) {
      logger.error('Error en getAbnormalResults', this.context, { params: req.params }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  /**
   * GET /api/health/laboratory/bovine/:bovineId/abnormal
   * Obtiene los últimos resultados anormales de un bovino.
   */
  async getAbnormalResultsByBovine(req: Request, res: Response): Promise<void> {
    try {
      const { bovineId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const abnormal = await laboratoryService.getAbnormalResultsByBovine(bovineId, limit);
      res.json({ success: true, data: abnormal });
    } catch (error) {
      logger.error('Error en getAbnormalResultsByBovine', this.context, { params: req.params, query: req.query }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  /**
   * GET /api/health/laboratory/ranch/:ranchId/abnormal
   * Obtiene estadísticas de resultados anormales en un rancho.
   */
  async getAbnormalResultsByRanch(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const stats = await laboratoryService.getAbnormalResultsByRanch(ranchId, days);
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('Error en getAbnormalResultsByRanch', this.context, { params: req.params, query: req.query }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }
}

export const laboratoryController = new LaboratoryController();