// controllers/health/diagnosis.controller.ts
import { Request, Response } from 'express';
import { diagnosisService } from '../services/health/DiagnosisService';
import { HealthError } from '../utils/HealthErrors';
import logger from '../utils/logger';

export class DiagnosisController {
  private readonly context = 'DiagnosisController';

  constructor() {
    this.recordDiagnosis = this.recordDiagnosis.bind(this);
    this.confirmDiagnosis = this.confirmDiagnosis.bind(this);
    this.getDiagnosisStats = this.getDiagnosisStats.bind(this);
  }

  /**
   * POST /api/health/diagnosis/record
   * Registra un diagnóstico en un registro de salud existente.
   */
  async recordDiagnosis(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { healthId, diagnosisData, diseaseId } = req.body;
      if (!healthId || !diagnosisData) {
        res.status(400).json({ success: false, error: 'healthId y diagnosisData son requeridos' });
        return;
      }

      // diseaseId es opcional: UUID vincula al catálogo, null desvincula, omitido no toca
      const updatedHealth = await diagnosisService.recordDiagnosis(
        healthId,
        diagnosisData,
        userId,
        diseaseId  // undefined si no viene en el body — el servicio no tocará disease_id
      );
      res.json({
        success: true,
        data: updatedHealth,
        message: 'Diagnóstico registrado exitosamente',
      });
    } catch (error) {
      logger.error('Error en recordDiagnosis', this.context, { body: req.body }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  /**
   * POST /api/health/diagnosis/confirm
   * Confirma un diagnóstico.
   */
  async confirmDiagnosis(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { healthId } = req.body;
      if (!healthId) {
        res.status(400).json({ success: false, error: 'healthId es requerido' });
        return;
      }

      const updatedHealth = await diagnosisService.confirmDiagnosis(healthId, userId);
      res.json({
        success: true,
        data: updatedHealth,
        message: 'Diagnóstico confirmado',
      });
    } catch (error) {
      logger.error('Error en confirmDiagnosis', this.context, { body: req.body }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  /**
   * GET /api/health/diagnosis/stats
   * Obtiene estadísticas de diagnósticos.
   */
  async getDiagnosisStats(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId, startDate, endDate, healthStatus } = req.query;

      const filters: any = {};
      if (ranchId) filters.ranchId = ranchId as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (healthStatus) filters.healthStatus = (healthStatus as string).split(',');

      const stats = await diagnosisService.getDiagnosisStats(filters);
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('Error en getDiagnosisStats', this.context, { query: req.query }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }
}

export const diagnosisController = new DiagnosisController();