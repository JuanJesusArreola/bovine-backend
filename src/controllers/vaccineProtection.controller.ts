// controllers/vaccineProtection.controller.ts
// ============================================================================
// VACCINE PROTECTION CONTROLLER
// ============================================================================
// REST sobre el catálogo `VaccineDiseaseProtection` (vacuna ↔ enfermedad).
//
//   GET    /api/vaccine-protections           — listar (filtros: vaccineType, diseaseId, isActive)
//   GET    /api/vaccine-protections/:id        — detalle
//   POST   /api/vaccine-protections            — crear
//   PATCH  /api/vaccine-protections/:id         — actualizar
//   DELETE /api/vaccine-protections/:id         — eliminar
// ============================================================================

import { Request, Response } from 'express';
import { vaccineProtectionService } from '../services/VaccineProtectionService';
import { VaccineType } from '../models/Vaccination';
import { BovineError } from '../utils/BovineErrors';
import logger from '../utils/logger';

export class VaccineProtectionController {
  private readonly context = 'VaccineProtectionController';

  constructor() {
    this.list   = this.list.bind(this);
    this.getById = this.getById.bind(this);
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

  async list(req: Request, res: Response): Promise<void> {
    try {
      const filters: any = {};
      if (req.query.vaccineType) filters.vaccineType = req.query.vaccineType as VaccineType;
      if (req.query.diseaseId)   filters.diseaseId   = req.query.diseaseId as string;
      if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';

      const data = await vaccineProtectionService.list(filters);
      res.json({ success: true, data });
    } catch (error) {
      this.handleError(error, res, 'list vaccine-protections');
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const data = await vaccineProtectionService.getById(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      this.handleError(error, res, 'getById vaccine-protection');
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data = await vaccineProtectionService.create(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      this.handleError(error, res, 'create vaccine-protection');
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const data = await vaccineProtectionService.update(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (error) {
      this.handleError(error, res, 'update vaccine-protection');
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      await vaccineProtectionService.delete(req.params.id);
      res.json({ success: true, message: 'Protección eliminada' });
    } catch (error) {
      this.handleError(error, res, 'delete vaccine-protection');
    }
  }
}

export const vaccineProtectionController = new VaccineProtectionController();
