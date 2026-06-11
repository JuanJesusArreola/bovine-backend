// src/controllers/production.controller.ts
import { Request, Response } from 'express';
import { productionService } from '../container';
import { ValidationError } from '../utils/errorUtils';
import logger from '../utils/logger';
import { ProductionType } from '../models/Production';

export class ProductionController {
  private readonly context = 'ProductionController';

  constructor() {
    this.createProduction = this.createProduction.bind(this);
    this.getProductionById = this.getProductionById.bind(this);
    this.listProductions = this.listProductions.bind(this);
    this.getProductionMetrics = this.getProductionMetrics.bind(this);
    this.getProductionTrends = this.getProductionTrends.bind(this);
    this.updateProduction = this.updateProduction.bind(this);
    this.deleteProduction = this.deleteProduction.bind(this);
  }

  /**
   * Crear un nuevo registro de producción (leche, peso, etc.)
   */
  async createProduction(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }

      const { bovineId, productionType, quantity, unit, productionDate, metadata } = req.body;

      // Validaciones básicas
      if (!bovineId || !productionType || !quantity || !unit || !productionDate) {
        res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
        return;
      }

      const date = new Date(productionDate);

      let production;

      // Usar el método de conveniencia según el tipo
      switch (productionType) {
        case ProductionType.MILK:
          production = await productionService.recordMilkProduction(
            bovineId,
            quantity,
            date,
            userId
          );
          break;
        case ProductionType.MEAT: // Si WEIGHT se maneja como MEAT (ajustable)
          production = await productionService.recordWeight(
            bovineId,
            quantity,
            date,
            userId
          );
          break;
        default:
          // Pero por ahora, rechazar tipos no soportados
          res.status(400).json({ success: false, error: `Tipo de producción no soportado: ${productionType}` });
          return;
      }

      res.status(201).json({ success: true, data: production });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Obtener producción por ID
   */
  async getProductionById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const production = await productionService.getProductionById(id);
      if (!production) {
        res.status(404).json({ success: false, error: 'Registro no encontrado' });
        return;
      }
      res.json({ success: true, data: production });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Listar producciones con filtros
   */
  async listProductions(req: Request, res: Response): Promise<void> {
    try {
      const { bovineId, productionType, startDate, endDate, limit, offset } = req.query;

      const result = await productionService.getProductions({
        bovineId: bovineId as string,
        productionType: productionType as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          total: result.count,
          limit: limit ? parseInt(limit as string) : 50,
          offset: offset ? parseInt(offset as string) : 0,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Obtener métricas de producción de un bovino
   */
  async getProductionMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { bovineId } = req.params;
      const { productionType, startDate, endDate } = req.query;

      const metrics = await productionService.getProductionMetrics(bovineId, {
        productionType: productionType as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      if (!metrics) {
        res.status(404).json({ success: false, error: 'No hay datos para este bovino' });
        return;
      }

      res.json({ success: true, data: metrics });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Obtener tendencias de producción
   */
  async getProductionTrends(req: Request, res: Response): Promise<void> {
    try {
      const { bovineId } = req.params;
      const { productionType, period } = req.query;

      if (!productionType) {
        res.status(400).json({ success: false, error: 'productionType es requerido' });
        return;
      }

      const trends = await productionService.getProductionTrends(
        bovineId,
        productionType as string,
        (period as 'day' | 'week' | 'month') || 'day'
      );

      res.json({ success: true, data: trends });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Actualizar un registro de producción
   */
  async updateProduction(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }

      const { id } = req.params;
      const { quantity, unit, productionDate, metadata } = req.body;

      const production = await productionService.updateProduction(
        id,
        { quantity, unit, productionDate: productionDate ? new Date(productionDate) : undefined },
        userId
      );

      res.json({ success: true, data: production });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Eliminar un registro de producción
   */
  async deleteProduction(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }

      const { id } = req.params;
      await productionService.deleteProduction(id, userId);
      res.json({ success: true, message: 'Registro eliminado' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: any, res: Response): void {
    logger.error('Error en ProductionController', this.context, { error });
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
}

export const productionController = new ProductionController();