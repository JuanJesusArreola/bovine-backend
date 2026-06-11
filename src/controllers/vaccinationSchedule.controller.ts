// controllers/vaccinationSchedule.controller.ts
// ============================================================================
// VACCINATION SCHEDULE CONTROLLER (Módulo 11)
// ============================================================================
//   GET    /api/vaccination-schedules        — listar calendario
//   POST   /api/vaccination-schedules        — crear (admin)
//   PATCH  /api/vaccination-schedules/:id     — actualizar (admin)
//   DELETE /api/vaccination-schedules/:id     — eliminar (admin)
// ============================================================================

import { Request, Response } from 'express';
import { vaccinationScheduleService } from '../services/VaccinationScheduleService';
import { BovineError } from '../utils/BovineErrors';
import logger from '../utils/logger';

export class VaccinationScheduleController {
  private readonly context = 'VaccinationScheduleController';

  constructor() {
    this.list = this.list.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
  }

  private handleError(error: unknown, res: Response, action: string): void {
    logger.error(`Error en ${action}`, this.context, {}, error as Error);
    if (error instanceof BovineError) {
      res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
    } else {
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  async list(_req: Request, res: Response): Promise<void> {
    try {
      const data = await vaccinationScheduleService.list();
      res.json({ success: true, data });
    } catch (error) {
      this.handleError(error, res, 'list vaccination-schedules');
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data = await vaccinationScheduleService.create(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      this.handleError(error, res, 'create vaccination-schedule');
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const data = await vaccinationScheduleService.update(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (error) {
      this.handleError(error, res, 'update vaccination-schedule');
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      await vaccinationScheduleService.delete(req.params.id);
      res.json({ success: true, message: 'Entrada de calendario eliminada' });
    } catch (error) {
      this.handleError(error, res, 'delete vaccination-schedule');
    }
  }
}

export const vaccinationScheduleController = new VaccinationScheduleController();
