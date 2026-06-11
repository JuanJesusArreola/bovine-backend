// controllers/epidemiological.controller.ts
// ============================================================================
// EPIDEMIOLOGICAL CONTROLLER (Fase 4)
// ============================================================================
//   GET  /api/epidemiology/snapshots                 — listar snapshots
//   GET  /api/epidemiology/snapshots/latest          — último snapshot
//   GET  /api/epidemiology/top-diseases/:ranchId     — top enfermedades
//   GET  /api/epidemiology/trend/:ranchId            — serie temporal
//   POST /api/epidemiology/compute                   — job manual (admin)
// ============================================================================

import { Request, Response } from 'express';
import { epidemiologicalService, SnapshotFilters } from '../services/EpidemiologicalService';
import logger from '../utils/logger';

export class EpidemiologicalController {
  private readonly context = 'EpidemiologicalController';

  constructor() {
    this.getSnapshots            = this.getSnapshots.bind(this);
    this.getLatest               = this.getLatest.bind(this);
    this.getTopDiseases          = this.getTopDiseases.bind(this);
    this.getTrend                = this.getTrend.bind(this);
    this.compute                 = this.compute.bind(this);
    this.getOutbreakTimeline     = this.getOutbreakTimeline.bind(this);
    this.detectPotentialContacts = this.detectPotentialContacts.bind(this);
    this.getCaseContacts         = this.getCaseContacts.bind(this);
    this.createManualContact     = this.createManualContact.bind(this);
    this.getHerdHealthIndex      = this.getHerdHealthIndex.bind(this);
    this.getBovineRiskScore      = this.getBovineRiskScore.bind(this);
    this.getHeatmap              = this.getHeatmap.bind(this);
    this.getAlerts               = this.getAlerts.bind(this);
    this.updateAlert             = this.updateAlert.bind(this);
  }

  // --------------------------------------------------------------------------
  // GET /api/bovines/:id/risk-score   (E-05)
  // --------------------------------------------------------------------------
  async getBovineRiskScore(req: Request, res: Response): Promise<void> {
    try {
      const data = await epidemiologicalService.getBovineRiskScore(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getBovineRiskScore', this.context, { params: req.params }, error as Error);
      const msg = (error as Error).message ?? 'Error calculando riesgo';
      res.status(msg.includes('no encontrado') ? 404 : 500).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/epidemiology/heatmap   (E-06)
  // --------------------------------------------------------------------------
  async getHeatmap(req: Request, res: Response): Promise<void> {
    try {
      const ranchId = req.query.ranchId as string;
      const diseaseId = req.query.diseaseId as string | undefined;
      const cellSize = req.query.cellSize ? parseFloat(req.query.cellSize as string) : undefined;
      const data = await epidemiologicalService.getHeatmap(ranchId, diseaseId, cellSize);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getHeatmap', this.context, { query: req.query }, error as Error);
      res.status(500).json({ success: false, error: 'Error generando heatmap' });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/epidemiology/alerts   (E-03)
  // --------------------------------------------------------------------------
  async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const data = await epidemiologicalService.listAlerts({
        ranchId: req.query.ranchId as string | undefined,
        status: req.query.status as any,
      });
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getAlerts', this.context, { query: req.query }, error as Error);
      res.status(500).json({ success: false, error: 'Error obteniendo alertas' });
    }
  }

  // --------------------------------------------------------------------------
  // PATCH /api/epidemiology/alerts/:id   (E-03)
  // --------------------------------------------------------------------------
  async updateAlert(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const data = await epidemiologicalService.updateAlertStatus(req.params.id, req.body.status, userId);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en updateAlert', this.context, { params: req.params }, error as Error);
      const msg = (error as Error).message ?? 'Error actualizando alerta';
      res.status(msg.includes('no encontrada') ? 404 : 500).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/epidemiology/snapshots
  // --------------------------------------------------------------------------

  async getSnapshots(req: Request, res: Response): Promise<void> {
    try {
      const filters: SnapshotFilters = {};

      if (req.query.ranchId)   filters.ranchId  = req.query.ranchId  as string;
      if (req.query.diseaseId) filters.diseaseId = req.query.diseaseId as string;
      // diseaseId=null (string "null") → filtro de globales
      if (req.query.diseaseId === 'null') filters.diseaseId = null;

      if (req.query.fromDate)  filters.fromDate = new Date(req.query.fromDate as string);
      if (req.query.toDate)    filters.toDate   = new Date(req.query.toDate   as string);

      filters.limit  = req.query.limit  ? parseInt(req.query.limit  as string, 10) : 100;
      filters.offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const data = await epidemiologicalService.getSnapshots(filters);
      res.json({ success: true, data, total: data.length });
    } catch (error) {
      logger.error('Error en getSnapshots', this.context, { query: req.query }, error as Error);
      res.status(500).json({ success: false, error: 'Error obteniendo snapshots epidemiológicos' });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/epidemiology/snapshots/latest
  // --------------------------------------------------------------------------

  async getLatest(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId, diseaseId } = req.query;

      if (!ranchId) {
        res.status(400).json({ success: false, error: 'ranchId es requerido' });
        return;
      }

      // diseaseId=null → global; diseaseId=<uuid> → específico; omitido → más reciente sin filtro
      const diseaseIdParam =
        diseaseId === 'null'    ? null :
        diseaseId !== undefined ? (diseaseId as string) :
        undefined;

      const data = await epidemiologicalService.getLatest(ranchId as string, diseaseIdParam);

      if (!data) {
        res.status(404).json({ success: false, error: 'No se encontró snapshot para los filtros indicados' });
        return;
      }
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getLatest', this.context, { query: req.query }, error as Error);
      res.status(500).json({ success: false, error: 'Error obteniendo último snapshot' });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/epidemiology/top-diseases/:ranchId
  // --------------------------------------------------------------------------

  async getTopDiseases(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const data = await epidemiologicalService.getTopDiseases(ranchId, limit);
      res.json({ success: true, data, total: data.length });
    } catch (error) {
      logger.error('Error en getTopDiseases', this.context, { params: req.params }, error as Error);
      res.status(500).json({ success: false, error: 'Error obteniendo top enfermedades' });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/epidemiology/trend/:ranchId
  // --------------------------------------------------------------------------

  async getTrend(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const diseaseId   = req.query.diseaseId === 'null'    ? null
                        : req.query.diseaseId !== undefined  ? req.query.diseaseId as string
                        : null;
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

      const data = await epidemiologicalService.getTrend(ranchId, diseaseId, days);
      res.json({ success: true, data, total: data.length });
    } catch (error) {
      logger.error('Error en getTrend', this.context, { params: req.params, query: req.query }, error as Error);
      res.status(500).json({ success: false, error: 'Error obteniendo tendencia epidemiológica' });
    }
  }

  // --------------------------------------------------------------------------
  // POST /api/epidemiology/compute   (solo SUPER_ADMIN)
  // --------------------------------------------------------------------------

  async compute(req: Request, res: Response): Promise<void> {
    try {
      const date = req.body.date ? new Date(req.body.date) : undefined;
      const result = await epidemiologicalService.computeSnapshots(date);
      res.json({
        success: true,
        message: `Snapshots calculados: ${result.computed}, errores: ${result.errors}`,
        data: result,
      });
    } catch (error) {
      logger.error('Error en compute', this.context, { body: req.body }, error as Error);
      res.status(500).json({ success: false, error: 'Error ejecutando cómputo epidemiológico' });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/epidemiology/outbreak/:ranchId/:diseaseId   (Fase 5.1)
  // --------------------------------------------------------------------------

  /**
   * Línea de tiempo clínica completa de todos los casos de una enfermedad
   * en un rancho, ordenados por diagnosedAt.
   */
  async getOutbreakTimeline(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId, diseaseId } = req.params;
      const data = await epidemiologicalService.getOutbreakTimeline(ranchId, diseaseId);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getOutbreakTimeline', this.context, { params: req.params }, error as Error);
      const msg = (error as Error).message ?? 'Error obteniendo línea de tiempo del brote';
      const status = msg.includes('no encontrado') ? 404 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // POST /api/epidemiology/cases/:caseId/detect-contacts   (Fase 5.3)
  // --------------------------------------------------------------------------

  /**
   * Ejecuta el análisis espaciotemporal para un caso dado y crea los enlaces
   * CaseContact automáticamente.
   * Devuelve la lista de contactos detectados (nuevos + ya existentes).
   */
  async detectPotentialContacts(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.params;
      const contacts = await epidemiologicalService.detectPotentialContacts(caseId);
      const newCount = contacts.filter((c) => c.isNew).length;
      res.json({
        success: true,
        message: `${contacts.length} contactos potenciales (${newCount} nuevos)`,
        data: contacts,
        total: contacts.length,
        newLinks: newCount,
      });
    } catch (error) {
      logger.error('Error en detectPotentialContacts', this.context, { params: req.params }, error as Error);
      const msg = (error as Error).message ?? 'Error detectando contactos potenciales';
      const status = msg.includes('no encontrado') ? 404 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/epidemiology/cases/:caseId/contacts   (Fase 5.3 — lectura)
  // --------------------------------------------------------------------------

  /**
   * Devuelve todos los enlaces de contagio asociados a un caso,
   * tanto como fuente (source) como destino (target).
   */
  async getCaseContacts(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.params;
      const data = await epidemiologicalService.getCaseContacts(caseId);
      res.json({
        success: true,
        data,
        totalAsSource: data.asSource.length,
        totalAsTarget: data.asTarget.length,
      });
    } catch (error) {
      logger.error('Error en getCaseContacts', this.context, { params: req.params }, error as Error);
      res.status(500).json({ success: false, error: 'Error obteniendo contactos del caso' });
    }
  }

  // --------------------------------------------------------------------------
  // POST /api/epidemiology/contacts   (E-07 — captura manual)
  // --------------------------------------------------------------------------

  async createManualContact(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const data = await epidemiologicalService.createManualContact(req.body, userId);
      res.status(201).json({ success: true, data });
    } catch (error) {
      logger.error('Error en createManualContact', this.context, { body: req.body }, error as Error);
      const msg = (error as Error).message ?? 'Error creando contacto manual';
      const status = msg.includes('no encontrado') ? 404 : msg.includes('requ') ? 400 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/epidemiology/herd-health/:ranchId   (E-02 — índice de salud)
  // --------------------------------------------------------------------------

  async getHerdHealthIndex(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const data = await epidemiologicalService.getHerdHealthIndex(ranchId);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getHerdHealthIndex', this.context, { params: req.params }, error as Error);
      res.status(500).json({ success: false, error: 'Error obteniendo índice de salud del hato' });
    }
  }
}

export const epidemiologicalController = new EpidemiologicalController();
