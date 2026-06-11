// controllers/bovineDiseaseCase.controller.ts
// ============================================================================
// BOVINE DISEASE CASE CONTROLLER (Fase 2)
// ============================================================================
// REST sobre casos clínicos de enfermedades bovinas.
//
//   POST   /api/bovine-cases                    — abrir caso
//   GET    /api/bovine-cases                    — listar con filtros
//   GET    /api/bovine-cases/:id                — detalle completo
//   PATCH  /api/bovine-cases/:id                — actualizar campos
//   POST   /api/bovine-cases/:id/close          — cerrar caso
//   POST   /api/bovine-cases/:id/symptoms       — agregar síntoma
//   DELETE /api/bovine-cases/:id/symptoms/:sid  — quitar síntoma
//   POST   /api/bovine-cases/:id/treatments     — agregar tratamiento
//   POST   /api/bovine-cases/:id/lab-tests      — agregar prueba de lab
//   PATCH  /api/bovine-cases/lab-tests/:lid     — actualizar resultado de prueba
// ============================================================================

import { Request, Response } from 'express';
import { bovineDiseaseService, CaseFilters, CaseListResponse } from '../services/BovineDiseaseService';
import { CaseStatus } from '../models/BovineDiseaseCase';
import { bovineService } from '../services/BovineService';
import logger from '../utils/logger';

export class BovineDiseaseCase_Controller {
  private readonly context = 'BovineDiseaseCase_Controller';

  constructor() {
    this.openCase      = this.openCase.bind(this);
    this.getCases      = this.getCases.bind(this);
    this.getCaseById   = this.getCaseById.bind(this);
    this.updateCase    = this.updateCase.bind(this);
    this.closeCase     = this.closeCase.bind(this);
    this.addSymptom    = this.addSymptom.bind(this);
    this.removeSymptom = this.removeSymptom.bind(this);
    this.addTreatment  = this.addTreatment.bind(this);
    this.addLabTest    = this.addLabTest.bind(this);
    this.updateLabTest = this.updateLabTest.bind(this);
  }

  // --------------------------------------------------------------------------
  // POST /api/bovine-cases
  // --------------------------------------------------------------------------

  async openCase(req: Request, res: Response): Promise<void> {
    try {
      const createdBy = (req as any).user?.id;
      const data = await bovineDiseaseService.openCase({ ...req.body, createdBy });
      res.status(201).json({ success: true, data });
    } catch (error) {
      logger.error('Error en openCase', this.context, {}, error as Error);
      const msg = (error as Error).message ?? 'Error abriendo caso clínico';
      const status = msg.includes('no encontrado') ? 404 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/bovine-cases
  // --------------------------------------------------------------------------

  async getCases(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      const filters: CaseFilters = {};

      if (req.query.bovineId)  filters.bovineId  = req.query.bovineId  as string;
      if (req.query.diseaseId) filters.diseaseId = req.query.diseaseId as string;
      if (req.query.ranchId)   filters.ranchId   = req.query.ranchId   as string;

      if (req.query.status) {
        const raw = req.query.status as string;
        filters.status = raw.includes(',')
          ? (raw.split(',') as CaseStatus[])
          : (raw as CaseStatus);
      }

      if (req.query.severity) {
        const raw = req.query.severity as string;
        filters.severity = raw.includes(',')
          ? (raw.split(',') as CaseFilters['severity'])
          : (raw as CaseFilters['severity']);
      }

      if (req.query.search) filters.search = (req.query.search as string).trim();

      if (req.query.fromDate) filters.fromDate = new Date(req.query.fromDate as string);
      if (req.query.toDate)   filters.toDate   = new Date(req.query.toDate   as string);

      // Paginación
      const page  = Math.max(1, parseInt(req.query.page  as string || '1',  10));
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
      filters.limit  = limit;
      filters.offset = (page - 1) * limit;

      // Restricción de ranchos accesibles (null = sin restricción para SUPER_ADMIN/OWNER)
      if (userId) {
        filters.allowedRanchIds = await bovineService.getAccessibleRanchIds(userId);
      }

      const { rows, count } = await bovineDiseaseService.getCases(filters);

      const totalPages = Math.ceil(count / limit);
      res.json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      logger.error('Error en getCases', this.context, {}, error as Error);
      res.status(500).json({ success: false, error: 'Error obteniendo casos clínicos' });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/bovine-cases/:id
  // --------------------------------------------------------------------------

  async getCaseById(req: Request, res: Response): Promise<void> {
    try {
      const data = await bovineDiseaseService.getCaseById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, error: 'Caso clínico no encontrado' });
        return;
      }
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getCaseById', this.context, { id: req.params.id }, error as Error);
      res.status(500).json({ success: false, error: 'Error obteniendo caso clínico' });
    }
  }

  // --------------------------------------------------------------------------
  // PATCH /api/bovine-cases/:id
  // --------------------------------------------------------------------------

  async updateCase(req: Request, res: Response): Promise<void> {
    try {
      const data = await bovineDiseaseService.updateCase(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en updateCase', this.context, { id: req.params.id }, error as Error);
      const msg = (error as Error).message ?? 'Error actualizando caso';
      const status = msg.includes('no encontrado') ? 404 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // POST /api/bovine-cases/:id/close
  // --------------------------------------------------------------------------

  async closeCase(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      // X-05: si outcome=DECEASED, closeCase dispara la baja por muerte;
      // recordedBy queda registrado en el evento/baja.
      const data = await bovineDiseaseService.closeCase(req.params.id, req.body, undefined, { recordedBy: userId });
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en closeCase', this.context, { id: req.params.id }, error as Error);
      const msg = (error as Error).message ?? 'Error cerrando caso';
      const status = msg.includes('no encontrado') ? 404 : msg.includes('ya está cerrado') ? 409 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // POST /api/bovine-cases/:id/symptoms
  // --------------------------------------------------------------------------

  async addSymptom(req: Request, res: Response): Promise<void> {
    try {
      const data = await bovineDiseaseService.addSymptom(req.params.id, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      logger.error('Error en addSymptom', this.context, { id: req.params.id }, error as Error);
      const msg = (error as Error).message ?? 'Error agregando síntoma';
      const status = msg.includes('no encontrado') ? 404 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // DELETE /api/bovine-cases/:id/symptoms/:symptomId
  // --------------------------------------------------------------------------

  async removeSymptom(req: Request, res: Response): Promise<void> {
    try {
      await bovineDiseaseService.removeSymptom(req.params.id, req.params.symptomId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error en removeSymptom', this.context, req.params, error as Error);
      const msg = (error as Error).message ?? 'Error eliminando síntoma';
      const status = msg.includes('no encontrado') ? 404 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // POST /api/bovine-cases/:id/treatments
  // --------------------------------------------------------------------------

  async addTreatment(req: Request, res: Response): Promise<void> {
    try {
      const data = await bovineDiseaseService.addTreatment(req.params.id, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      logger.error('Error en addTreatment', this.context, { id: req.params.id }, error as Error);
      const msg = (error as Error).message ?? 'Error agregando tratamiento';
      const status = msg.includes('no encontrado') ? 404 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // POST /api/bovine-cases/:id/lab-tests
  // --------------------------------------------------------------------------

  async addLabTest(req: Request, res: Response): Promise<void> {
    try {
      const data = await bovineDiseaseService.addLabTest(req.params.id, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      logger.error('Error en addLabTest', this.context, { id: req.params.id }, error as Error);
      const msg = (error as Error).message ?? 'Error agregando prueba de laboratorio';
      const status = msg.includes('no encontrado') ? 404 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // PATCH /api/bovine-cases/lab-tests/:labTestId
  // --------------------------------------------------------------------------

  async updateLabTest(req: Request, res: Response): Promise<void> {
    try {
      const data = await bovineDiseaseService.updateLabTest(req.params.labTestId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en updateLabTest', this.context, { id: req.params.labTestId }, error as Error);
      const msg = (error as Error).message ?? 'Error actualizando prueba de laboratorio';
      const status = msg.includes('no encontrada') ? 404 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }
}

export const bovineDiseaseCase_Controller = new BovineDiseaseCase_Controller();
