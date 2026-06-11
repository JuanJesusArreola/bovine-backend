// src/controllers/finance.controller.ts
import { Request, Response } from 'express';
import { financeService } from '../container';
import { ValidationError } from '../utils/errorUtils';
import logger from '../utils/logger';

export class FinanceController {
  private readonly context = 'FinanceController';

  constructor() {
    this.createTransaction = this.createTransaction.bind(this);
    this.getTransactionById = this.getTransactionById.bind(this);
    this.listTransactions = this.listTransactions.bind(this);
    this.updateTransaction = this.updateTransaction.bind(this);
    this.deleteTransaction = this.deleteTransaction.bind(this);
    this.getFinancialSummary = this.getFinancialSummary.bind(this);
    this.getVeterinaryCosts = this.getVeterinaryCosts.bind(this);
    this.getROIAnalysis = this.getROIAnalysis.bind(this);
  }

  async createTransaction(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }

      const transaction = await financeService.createTransaction(req.body, userId);
      res.status(201).json({ success: true, data: transaction });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getTransactionById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const transaction = await financeService.getTransactionById(id);
      if (!transaction) {
        res.status(404).json({ success: false, error: 'Transacción no encontrada' });
        return;
      }
      res.json({ success: true, data: transaction });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listTransactions(req: Request, res: Response): Promise<void> {
    try {
      const {
        ranchId,
        bovineId,
        eventId,
        transactionType,
        category,
        status,
        startDate,
        endDate,
        limit,
        offset,
        orderBy,
        orderDirection,
      } = req.query;

      const result = await financeService.getTransactions({
        ranchId: ranchId as string,
        bovineId: bovineId as string,
        eventId: eventId as string,
        transactionType: transactionType as any,
        category: category as string,
        status: status as any,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        orderBy: orderBy as string,
        orderDirection: orderDirection as 'ASC' | 'DESC',
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

  async updateTransaction(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }

      const { id } = req.params;
      const transaction = await financeService.updateTransaction(id, req.body, userId);
      res.json({ success: true, data: transaction });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteTransaction(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }

      const { id } = req.params;
      await financeService.deleteTransaction(id, userId);
      res.json({ success: true, message: 'Transacción eliminada' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getFinancialSummary(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId, startDate, endDate } = req.query;
      if (!ranchId || !startDate || !endDate) {
        res.status(400).json({ success: false, error: 'ranchId, startDate y endDate son requeridos' });
        return;
      }

      const summary = await financeService.getFinancialSummary(
        ranchId as string,
        new Date(startDate as string),
        new Date(endDate as string)
      );
      res.json({ success: true, data: summary });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getVeterinaryCosts(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId, startDate, endDate } = req.query;
      if (!ranchId || !startDate || !endDate) {
        res.status(400).json({ success: false, error: 'ranchId, startDate y endDate son requeridos' });
        return;
      }

      const costs = await financeService.getVeterinaryCosts(
        ranchId as string,
        new Date(startDate as string),
        new Date(endDate as string)
      );
      res.json({ success: true, data: costs });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getROIAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId, startDate, endDate } = req.query;
      if (!ranchId || !startDate || !endDate) {
        res.status(400).json({ success: false, error: 'ranchId, startDate y endDate son requeridos' });
        return;
      }

      const roi = await financeService.getROIAnalysis(
        ranchId as string,
        new Date(startDate as string),
        new Date(endDate as string)
      );
      res.json({ success: true, data: roi });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: any, res: Response): void {
    logger.error('Error en FinanceController', this.context, { error });
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
}

export const financeController = new FinanceController();