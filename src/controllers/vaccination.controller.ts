// controllers/vaccination.controller.ts
// ============================================================================
// VACCINATION CONTROLLER
// ============================================================================
// Endpoints:
//   GET    /api/bovines/:id/vaccinations          → listByBovine
//   POST   /api/bovines/:id/vaccinations          → create
//   GET    /api/bovines/:id/vaccination-status    → getStatus
//   DELETE /api/vaccinations/:vaccinationId        → delete
// ============================================================================

import { Request, Response } from 'express';
import { vaccinationService } from '../services/VaccinationService';
import { bovineVaccinationStatusService } from '../services/BovineVaccinationStatusService';
import { vaccinationScheduleService } from '../services/VaccinationScheduleService';
import { VaccineType, ApplicationRoute } from '../models/Vaccination';
import { BovineError } from '../utils/BovineErrors';
import logger from '../utils/logger';

export class VaccinationController {
  private readonly context = 'VaccinationController';

  constructor() {
    this.listByBovine = this.listByBovine.bind(this);
    this.create = this.create.bind(this);
    this.getStatus = this.getStatus.bind(this);
    this.getProtection = this.getProtection.bind(this);
    this.getSuggestedSchedule = this.getSuggestedSchedule.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
  }

  // ==========================================================================
  // GET /api/bovines/:id/vaccination-schedule   (V-05)
  // ==========================================================================
  // Calendario sugerido: qué vacunas le tocan al bovino según edad/sexo/raza
  // y su estado actual (aplicada/vencida/faltante/dosis única completa).
  async getSuggestedSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { id: bovineId } = req.params;
      const data = await vaccinationScheduleService.getSuggestedForBovine(bovineId);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getSuggestedSchedule', this.context, { params: req.params }, error as Error);
      this.handleError(error, res);
    }
  }

  // ==========================================================================
  // GET /api/bovines/:id/vaccinations
  // ==========================================================================
  async listByBovine(req: Request, res: Response): Promise<void> {
    try {
      const { id: bovineId } = req.params;

      const filters: any = { bovineId };

      if (req.query.vaccineType) {
        const vt = (req.query.vaccineType as string).toUpperCase();
        if (Object.values(VaccineType).includes(vt as VaccineType)) {
          filters.vaccineType = vt;
        } else {
          res.status(400).json({
            success: false,
            error: `vaccineType inválido. Permitidos: ${Object.values(VaccineType).join(', ')}`,
            code: 'INVALID_VACCINE_TYPE',
          });
          return;
        }
      }

      if (req.query.applicatorId) {
        filters.applicatorId = req.query.applicatorId as string;
      }

      if (req.query.fromDate) {
        const d = new Date(req.query.fromDate as string);
        if (isNaN(d.getTime())) {
          res.status(400).json({ success: false, error: 'fromDate inválido', code: 'INVALID_DATE' });
          return;
        }
        filters.fromDate = d;
      }
      if (req.query.toDate) {
        const d = new Date(req.query.toDate as string);
        if (isNaN(d.getTime())) {
          res.status(400).json({ success: false, error: 'toDate inválido', code: 'INVALID_DATE' });
          return;
        }
        filters.toDate = d;
      }

      if (req.query.limit !== undefined) {
        const n = parseInt(req.query.limit as string, 10);
        if (!isNaN(n)) filters.limit = n;
      }
      if (req.query.offset !== undefined) {
        const n = parseInt(req.query.offset as string, 10);
        if (!isNaN(n)) filters.offset = n;
      }

      const result = await vaccinationService.listByBovine(filters);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error en listByBovine', this.context, { params: req.params, query: req.query }, error as Error);
      this.handleError(error, res);
    }
  }

  // ==========================================================================
  // POST /api/bovines/:id/vaccinations
  // ==========================================================================
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { id: bovineId } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado', code: 'UNAUTHORIZED' });
        return;
      }

      const body = req.body || {};
      const created = await vaccinationService.create({
        bovineId,
        vaccineType: body.vaccineType,
        vaccineName: body.vaccineName,
        manufacturer: body.manufacturer,
        batchNumber: body.batchNumber,
        doseNumber: body.doseNumber,
        doseAmountMl: body.doseAmountMl,
        applicationRoute: body.applicationRoute,
        applicationDate: body.applicationDate,
        nextDueDate: body.nextDueDate,
        // Si no se envía applicatorId, asumimos el usuario autenticado
        applicatorId: body.applicatorId || userId,
        withdrawalPeriodDays: body.withdrawalPeriodDays,
        immunityDurationDays: body.immunityDurationDays,
        notes: body.notes,
        metadata: body.metadata,
      });

      res.status(201).json({ success: true, data: created, message: 'Vacuna registrada' });
    } catch (error) {
      logger.error('Error en create vaccination', this.context, { params: req.params, body: req.body }, error as Error);
      this.handleError(error, res);
    }
  }

  // ==========================================================================
  // GET /api/bovines/:id/vaccination-status
  // ==========================================================================
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id: bovineId } = req.params;
      const data = await bovineVaccinationStatusService.get(bovineId);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getStatus', this.context, { params: req.params }, error as Error);
      this.handleError(error, res);
    }
  }

  // ==========================================================================
  // GET /api/bovines/:id/protection
  // ==========================================================================
  // Estado de protección por enfermedad, derivado de las vacunas aplicadas
  // cruzadas con el catálogo VaccineDiseaseProtection.
  async getProtection(req: Request, res: Response): Promise<void> {
    try {
      const { id: bovineId } = req.params;
      const data = await vaccinationService.getProtectionStatus(bovineId);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getProtection', this.context, { params: req.params }, error as Error);
      this.handleError(error, res);
    }
  }

  // ==========================================================================
  // PATCH /api/vaccinations/:vaccinationId
  // ==========================================================================
  // Edita una vacuna existente (V-04). Recalcula estado e invalida cache.
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { vaccinationId } = req.params;
      const updated = await vaccinationService.update(vaccinationId, req.body || {});
      res.json({ success: true, data: updated, message: 'Vacuna actualizada' });
    } catch (error) {
      logger.error('Error en update vaccination', this.context, { params: req.params, body: req.body }, error as Error);
      this.handleError(error, res);
    }
  }

  // ==========================================================================
  // DELETE /api/vaccinations/:vaccinationId
  // ==========================================================================
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { vaccinationId } = req.params;
      await vaccinationService.delete(vaccinationId);
      res.json({ success: true, message: 'Vacuna eliminada' });
    } catch (error) {
      logger.error('Error en delete vaccination', this.context, { params: req.params }, error as Error);
      this.handleError(error, res);
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  private handleError(error: unknown, res: Response): void {
    if (error instanceof BovineError) {
      const body: any = { success: false, error: error.message, code: error.code };
      if ((error as any).details) body.details = (error as any).details;
      res.status(error.statusCode).json(body);
    } else {
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
}

export const vaccinationController = new VaccinationController();
