// controllers/disease.controller.ts
// ============================================================================
// DISEASE CONTROLLER
// ============================================================================
// Endpoints del catálogo de enfermedades bovinas (Phase 1 — solo lectura).
//
//   GET /api/diseases                  — listado con filtros opcionales
//   GET /api/diseases/search?q=        — búsqueda en nombre y aliases
//   GET /api/diseases/with-symptoms    — catálogo completo con síntomas
//   GET /api/diseases/:slug            — detalle por slug
// ============================================================================

import { Request, Response } from 'express';
import { diseaseService } from '../services/DiseaseService';
import { DiseaseCategory, DiseaseSeverity } from '../models/Disease';
import logger from '../utils/logger';

export class DiseaseController {
  private readonly context = 'DiseaseController';

  constructor() {
    this.getAll          = this.getAll.bind(this);
    this.search          = this.search.bind(this);
    this.getWithSymptoms = this.getWithSymptoms.bind(this);
    this.getBySlug       = this.getBySlug.bind(this);
  }

  // --------------------------------------------------------------------------
  // GET /api/diseases
  // --------------------------------------------------------------------------

  /**
   * Devuelve el catálogo de enfermedades activas con paginación y búsqueda.
   *
   * Query params opcionales:
   *   search        — texto libre (filtra por nombre, busca con ILIKE)
   *   category      — BACTERIAL | VIRAL | PARASITIC | FUNGAL | METABOLIC | GENETIC | OTHER
   *   severity      — LOW | MODERATE | HIGH | CRITICAL
   *   isContagious  — true | false
   *   isZoonotic    — true | false
   *   page          — número de página (default 1)
   *   limit         — resultados por página (default 50, max 100)
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const filters: Record<string, any> = {};

      if (req.query.search)
        filters.search = (req.query.search as string).trim();

      if (req.query.category)
        filters.category = req.query.category as DiseaseCategory;

      if (req.query.severity)
        filters.severity = req.query.severity as DiseaseSeverity;

      if (req.query.isContagious !== undefined)
        filters.isContagious = req.query.isContagious === 'true';

      if (req.query.isZoonotic !== undefined)
        filters.isZoonotic = req.query.isZoonotic === 'true';

      if (req.query.page)
        filters.page = parseInt(req.query.page as string, 10);

      if (req.query.limit)
        filters.limit = parseInt(req.query.limit as string, 10);

      const result = await diseaseService.getAllDiseases(filters);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Error en getAll diseases', this.context, {}, error as Error);
      res.status(500).json({ success: false, error: 'Error obteniendo catálogo de enfermedades' });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/diseases/search?q=
  // --------------------------------------------------------------------------

  /**
   * Busca enfermedades por nombre canónico o alias.
   * Query param requerido: q (mínimo 2 caracteres).
   */
  async search(req: Request, res: Response): Promise<void> {
    try {
      const q = (req.query.q as string)?.trim() ?? '';

      if (q.length < 2) {
        res.status(400).json({
          success: false,
          error: 'El parámetro q debe tener al menos 2 caracteres',
        });
        return;
      }

      const data = await diseaseService.searchDiseases(q);
      res.json({ success: true, data, total: data.length, query: q });
    } catch (error) {
      logger.error('Error en search diseases', this.context, { q: req.query.q }, error as Error);
      res.status(500).json({ success: false, error: 'Error en búsqueda de enfermedades' });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/diseases/with-symptoms
  // --------------------------------------------------------------------------

  /**
   * Devuelve el catálogo completo con síntomas anidados por enfermedad.
   * Usado por el frontend para el formulario de apertura de casos (Fase 2).
   */
  async getWithSymptoms(req: Request, res: Response): Promise<void> {
    try {
      const data = await diseaseService.getDiseasesWithSymptoms();
      res.json({ success: true, data, total: data.length });
    } catch (error) {
      logger.error('Error en getWithSymptoms', this.context, {}, error as Error);
      res.status(500).json({ success: false, error: 'Error obteniendo enfermedades con síntomas' });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/diseases/:slug
  // --------------------------------------------------------------------------

  /**
   * Devuelve el detalle completo de una enfermedad por slug o UUID.
   * Intenta primero por slug; si no coincide, intenta por UUID.
   */
  async getBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;

      // ¿Parece un UUID?
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

      const data = isUuid
        ? await diseaseService.getDiseaseById(slug)
        : await diseaseService.getDiseaseBySlug(slug);

      if (!data) {
        res.status(404).json({ success: false, error: 'Enfermedad no encontrada' });
        return;
      }

      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getBySlug', this.context, { slug: req.params.slug }, error as Error);
      res.status(500).json({ success: false, error: 'Error obteniendo detalle de enfermedad' });
    }
  }
}

export const diseaseController = new DiseaseController();
