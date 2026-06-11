// controllers/health/treatment.controller.ts
import { Request, Response } from 'express';
import { treatmentService } from '../services/health/TreatmentService';
import { HealthError } from '../utils/HealthErrors';
import logger from '../utils/logger';

export class TreatmentController {
  private readonly context = 'TreatmentController';

  constructor() {
    this.startTreatment = this.startTreatment.bind(this);
    this.recordMedicationAdministration = this.recordMedicationAdministration.bind(this);
    this.completeTreatment = this.completeTreatment.bind(this);
    this.checkWithdrawalPeriods = this.checkWithdrawalPeriods.bind(this);
  }

  /**
   * POST /api/health/treatment/start
   * Inicia un tratamiento en un registro de salud.
   */
  async startTreatment(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { healthId, ...rest } = req.body;
      if (!healthId) {
        res.status(400).json({ success: false, error: 'healthId es requerido' });
        return;
      }

      const data = {
        healthId,
        ...rest,
        createdBy: userId,
      };

      const updatedHealth = await treatmentService.startTreatment(data);
      res.json({
        success: true,
        data: updatedHealth,
        message: 'Tratamiento iniciado exitosamente',
      });
    } catch (error) {
      logger.error('Error en startTreatment', this.context, { body: req.body }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  /**
   * POST /api/health/treatment/medication/record
   * Registra administración de medicamento.
   */
  async recordMedicationAdministration(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { healthId, medicationIndex, administeredAt, notes } = req.body;
      if (!healthId || medicationIndex === undefined || !administeredAt) {
        res.status(400).json({ success: false, error: 'healthId, medicationIndex y administeredAt son requeridos' });
        return;
      }

      const data = {
        healthId,
        medicationIndex,
        administeredAt: new Date(administeredAt),
        administeredBy: userId,
        notes,
      };

      const updatedHealth = await treatmentService.recordMedicationAdministration(data);
      res.json({
        success: true,
        data: updatedHealth,
        message: 'Administración registrada',
      });
    } catch (error) {
      logger.error('Error en recordMedicationAdministration', this.context, { body: req.body }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  /**
   * POST /api/health/treatment/complete
   * Completa un tratamiento.
   */
  async completeTreatment(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { healthId, outcome, endDate } = req.body;
      if (!healthId) {
        res.status(400).json({ success: false, error: 'healthId es requerido' });
        return;
      }

      const updatedHealth = await treatmentService.completeTreatment(
        healthId,
        outcome,
        endDate ? new Date(endDate) : undefined,
        userId
      );
      res.json({
        success: true,
        data: updatedHealth,
        message: 'Tratamiento completado',
      });
    } catch (error) {
      logger.error('Error en completeTreatment', this.context, { body: req.body }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  /**
   * GET /api/health/treatment/withdrawal/:healthId
   * Verifica períodos de retiro de un tratamiento.
   */
  async checkWithdrawalPeriods(req: Request, res: Response): Promise<void> {
    try {
      const { healthId } = req.params;
      const results = await treatmentService.checkWithdrawalPeriods(healthId);
      res.json({ success: true, data: results });
    } catch (error) {
      logger.error('Error en checkWithdrawalPeriods', this.context, { params: req.params }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  
}

export const treatmentController = new TreatmentController();