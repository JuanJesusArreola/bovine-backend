// controllers/bovineFilters.controller.ts
// ============================================================================
// BOVINE FILTERS CONTROLLER
// ============================================================================
// Endpoints:
//   GET /api/bovines/filters/options          — catálogos completos (cache 1h)
//   GET /api/bovines/filters/active-diseases  — solo enfermedades con casos activos
// ============================================================================

import { Request, Response } from 'express';
import { bovineFiltersService } from '../services/BovineFiltersService';
import { bovineService } from '../services/BovineService';
import logger from '../utils/logger';

export class BovineFiltersController {
  private readonly context = 'BovineFiltersController';

  constructor() {
    this.getFilterOptions  = this.getFilterOptions.bind(this);
    this.getActiveDiseases = this.getActiveDiseases.bind(this);
  }

  /**
   * GET /api/bovines/filters/options
   *
   * Response:
   * {
   *   success: true,
   *   data: {
   *     cattleTypes:  [{ value, label }, ...],
   *     genders:      [...],
   *     healthStatuses: [...],
   *     vaccinationStatuses: [...],
   *     vaccineTypes: [...],
   *     applicationRoutes: [...],
   *     breeds: ["Holstein", "Angus", ...],
   *     diseases: [{ value: slug, label: name }, ...],
   *     computedAt: ISO,
   *     ttlSeconds: 3600
   *   }
   * }
   */
  async getFilterOptions(_req: Request, res: Response): Promise<void> {
    try {
      const data = await bovineFiltersService.getFilterOptions();
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en getFilterOptions', this.context, {}, error as Error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo catálogo de filtros',
      });
    }
  }

  /**
   * GET /api/bovines/filters/active-diseases
   *
   * Devuelve solo las enfermedades que tienen al menos un caso activo
   * en los ranchos accesibles del usuario autenticado.
   *
   * Response:
   * {
   *   success: true,
   *   data: [{ value: "uuid-de-disease", label: "Mastitis" }, ...],
   *   total: 3
   * }
   */
  async getActiveDiseases(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const ranchIds = userId
        ? await bovineService.getAccessibleRanchIds(userId)
        : null;

      const data = await bovineFiltersService.getActiveDiseases(ranchIds);
      res.json({ success: true, data, total: data.length });
    } catch (error) {
      logger.error('Error en getActiveDiseases', this.context, {}, error as Error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo enfermedades activas',
      });
    }
  }
}

export const bovineFiltersController = new BovineFiltersController();
