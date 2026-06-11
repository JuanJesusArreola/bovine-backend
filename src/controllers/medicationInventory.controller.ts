// controllers/inventory/medicationInventory.controller.ts
import { Request, Response } from 'express';
import { medicationInventoryService } from '../services/medication/MedicationInventoryService';
import { HealthError } from '../utils/HealthErrors';
import logger from '../utils/logger';

export class MedicationInventoryController {
  private readonly context = 'MedicationInventoryController';

  constructor() {
    this.getAvailableStock = this.getAvailableStock.bind(this);
    this.checkStockLevels = this.checkStockLevels.bind(this);
    this.getExpiringMedications = this.getExpiringMedications.bind(this);
    this.recordConsumption = this.recordConsumption.bind(this);
    this.recordPurchase = this.recordPurchase.bind(this);
  }

  async getAvailableStock(req: Request, res: Response): Promise<void> {
    try {
      const { medicationCode } = req.params;
      const stock = await medicationInventoryService.getAvailableStock(medicationCode);
      res.json({ success: true, data: { medicationCode, availableStock: stock } });
    } catch (error) {
      logger.error('Error en getAvailableStock', this.context, { params: req.params }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async checkStockLevels(req: Request, res: Response): Promise<void> {
    try {
      const { medicationCode } = req.query;
      const levels = await medicationInventoryService.checkStockLevels(medicationCode as string);
      res.json({ success: true, data: levels });
    } catch (error) {
      logger.error('Error en checkStockLevels', this.context, { query: req.query }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getExpiringMedications(req: Request, res: Response): Promise<void> {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const expiring = await medicationInventoryService.getExpiringMedications(days);
      res.json({ success: true, data: expiring });
    } catch (error) {
      logger.error('Error en getExpiringMedications', this.context, { query: req.query }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async recordConsumption(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { medicationCode, quantity, batchNumber, healthRecordId, notes } = req.body;
      if (!medicationCode || !quantity || quantity <= 0) {
        res.status(400).json({ success: false, error: 'medicationCode y quantity (positivo) son requeridos' });
        return;
      }

      await medicationInventoryService.recordConsumption({
        medicationCode,
        quantity,
        batchNumber,
        healthRecordId,
        consumedBy: userId,
        notes,
      });

      res.json({ success: true, message: 'Consumo registrado exitosamente' });
    } catch (error) {
      logger.error('Error en recordConsumption', this.context, { body: req.body }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async recordPurchase(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { medicationCode, quantity, batchNumber, expirationDate, purchaseDate, unitCost, totalCost, supplier, notes } = req.body;
      if (!medicationCode || !quantity || !batchNumber || !purchaseDate) {
        res.status(400).json({ success: false, error: 'medicationCode, quantity, batchNumber y purchaseDate son requeridos' });
        return;
      }

      const newItem = await medicationInventoryService.recordPurchase({
        medicationCode,
        quantity,
        batchNumber,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        purchaseDate: new Date(purchaseDate),
        unitCost,
        totalCost,
        supplier,
        recordedBy: userId,
        notes,
      });

      res.status(201).json({
        success: true,
        data: newItem,
        message: 'Compra registrada exitosamente',
      });
    } catch (error) {
      logger.error('Error en recordPurchase', this.context, { body: req.body }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }
}

export const medicationInventoryController = new MedicationInventoryController();