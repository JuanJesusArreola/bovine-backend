// controllers/ranch/ranchOperations.controller.ts
import { Request, Response } from 'express';
import { ranchOperationsService } from '../../services/ranch/RanchOperationsService';
import { RanchError } from '../../utils/RanchErrors';
import logger from '../../utils/logger';

export class RanchOperationsController {
  private readonly context = 'RanchOperationsController';

  constructor() {
    this.getProduction = this.getProduction.bind(this);
    this.createProduction = this.createProduction.bind(this);
    this.updateProduction = this.updateProduction.bind(this);
    this.getProductionTrends = this.getProductionTrends.bind(this);
    this.compareWithIndustry = this.compareWithIndustry.bind(this);
    this.getSustainability = this.getSustainability.bind(this);
    this.createOrUpdateSustainability = this.createOrUpdateSustainability.bind(this);
    this.updateGoalProgress = this.updateGoalProgress.bind(this);
    this.getTechnology = this.getTechnology.bind(this);
    this.createOrUpdateTechnology = this.createOrUpdateTechnology.bind(this);
    this.getTechReadiness = this.getTechReadiness.bind(this);
    this.recommendTechInvestments = this.recommendTechInvestments.bind(this);
    this.getFinancial = this.getFinancial.bind(this);
    this.createFinancial = this.createFinancial.bind(this);
    this.updateFinancial = this.updateFinancial.bind(this);
    this.calculateProfitability = this.calculateProfitability.bind(this);
    this.analyzeRevenueStreams = this.analyzeRevenueStreams.bind(this);
    this.compareWithPreviousYears = this.compareWithPreviousYears.bind(this);
  }

  // ==========================================================================
  // Producción
  // ==========================================================================

  async getProduction(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId, year } = req.params;
      const production = await ranchOperationsService.getProduction(ranchId, parseInt(year));
      res.json({ success: true, data: production });
    } catch (error) {
      this.handleError(error, res, 'getProduction');
    }
  }

  async createProduction(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) return this.unauthorized(res);

      const { ranchId } = req.params;
      const production = await ranchOperationsService.createProduction(ranchId, req.body, userId);
      res.status(201).json({ success: true, data: production, message: 'Producción creada' });
    } catch (error) {
      this.handleError(error, res, 'createProduction');
    }
  }

  async updateProduction(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) return this.unauthorized(res);

      const { ranchId, year } = req.params;
      const production = await ranchOperationsService.updateProduction(ranchId, parseInt(year), req.body, userId);
      res.json({ success: true, data: production, message: 'Producción actualizada' });
    } catch (error) {
      this.handleError(error, res, 'updateProduction');
    }
  }

  async getProductionTrends(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const years = req.query.years ? parseInt(req.query.years as string) : 5;
      const trends = await ranchOperationsService.getProductionTrends(ranchId, years);
      res.json({ success: true, data: trends });
    } catch (error) {
      this.handleError(error, res, 'getProductionTrends');
    }
  }

  async compareWithIndustry(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId, year } = req.params;
      const comparison = await ranchOperationsService.compareWithIndustry(ranchId, parseInt(year));
      res.json({ success: true, data: comparison });
    } catch (error) {
      this.handleError(error, res, 'compareWithIndustry');
    }
  }

  // ==========================================================================
  // Sostenibilidad
  // ==========================================================================

  async getSustainability(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const sustainability = await ranchOperationsService.getSustainability(ranchId);
      res.json({ success: true, data: sustainability });
    } catch (error) {
      this.handleError(error, res, 'getSustainability');
    }
  }

  async createOrUpdateSustainability(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) return this.unauthorized(res);

      const { ranchId } = req.params;
      const sustainability = await ranchOperationsService.createOrUpdateSustainability(ranchId, req.body, userId);
      res.json({ success: true, data: sustainability, message: 'Sostenibilidad guardada' });
    } catch (error) {
      this.handleError(error, res, 'createOrUpdateSustainability');
    }
  }

  async updateGoalProgress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) return this.unauthorized(res);

      const { ranchId, goalIndex } = req.params;
      const { progress } = req.body;
      const sustainability = await ranchOperationsService.updateGoalProgress(ranchId, parseInt(goalIndex), progress, userId);
      res.json({ success: true, data: sustainability, message: 'Progreso actualizado' });
    } catch (error) {
      this.handleError(error, res, 'updateGoalProgress');
    }
  }

  // ==========================================================================
  // Tecnología
  // ==========================================================================

  async getTechnology(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const technology = await ranchOperationsService.getTechnology(ranchId);
      res.json({ success: true, data: technology });
    } catch (error) {
      this.handleError(error, res, 'getTechnology');
    }
  }

  async createOrUpdateTechnology(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) return this.unauthorized(res);

      const { ranchId } = req.params;
      const technology = await ranchOperationsService.createOrUpdateTechnology(ranchId, req.body, userId);
      res.json({ success: true, data: technology, message: 'Tecnología guardada' });
    } catch (error) {
      this.handleError(error, res, 'createOrUpdateTechnology');
    }
  }

  async getTechReadiness(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const tech = await ranchOperationsService.getTechnology(ranchId);
      const level = ranchOperationsService.calculateTechReadinessLevel(tech);
      res.json({ success: true, data: { techReadinessLevel: level } });
    } catch (error) {
      this.handleError(error, res, 'getTechReadiness');
    }
  }

  async recommendTechInvestments(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const recommendations = await ranchOperationsService.recommendInvestments(ranchId);
      res.json({ success: true, data: recommendations });
    } catch (error) {
      this.handleError(error, res, 'recommendTechInvestments');
    }
  }

  // ==========================================================================
  // Finanzas
  // ==========================================================================

  async getFinancial(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId, year } = req.params;
      const financial = await ranchOperationsService.getFinancial(ranchId, parseInt(year));
      res.json({ success: true, data: financial });
    } catch (error) {
      this.handleError(error, res, 'getFinancial');
    }
  }

  async createFinancial(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) return this.unauthorized(res);

      const { ranchId } = req.params;
      const financial = await ranchOperationsService.createFinancial(ranchId, req.body, userId);
      res.status(201).json({ success: true, data: financial, message: 'Finanzas creadas' });
    } catch (error) {
      this.handleError(error, res, 'createFinancial');
    }
  }

  async updateFinancial(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) return this.unauthorized(res);

      const { ranchId, year } = req.params;
      const financial = await ranchOperationsService.updateFinancial(ranchId, parseInt(year), req.body, userId);
      res.json({ success: true, data: financial, message: 'Finanzas actualizadas' });
    } catch (error) {
      this.handleError(error, res, 'updateFinancial');
    }
  }

  async calculateProfitability(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId, year } = req.params;
      const profitability = await ranchOperationsService.calculateProfitability(ranchId, parseInt(year));
      res.json({ success: true, data: profitability });
    } catch (error) {
      this.handleError(error, res, 'calculateProfitability');
    }
  }

  async analyzeRevenueStreams(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId, year } = req.params;
      const analysis = await ranchOperationsService.analyzeRevenueStreams(ranchId, parseInt(year));
      res.json({ success: true, data: analysis });
    } catch (error) {
      this.handleError(error, res, 'analyzeRevenueStreams');
    }
  }

  async compareWithPreviousYears(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId, year } = req.params;
      const comparison = await ranchOperationsService.compareWithPreviousYears(ranchId, parseInt(year));
      res.json({ success: true, data: comparison });
    } catch (error) {
      this.handleError(error, res, 'compareWithPreviousYears');
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private unauthorized(res: Response): void {
    res.status(401).json({ success: false, error: 'Usuario no autenticado' });
  }

  private handleError(error: any, res: Response, method: string): void {
    logger.error(`Error en ${method}`, this.context, { error: error.message }, error);
    if (error instanceof RanchError) {
      res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
    } else {
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
}

export const ranchOperationsController = new RanchOperationsController();