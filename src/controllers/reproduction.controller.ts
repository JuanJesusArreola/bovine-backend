// src/controllers/reproduction.controller.ts
import { Request, Response } from 'express';
import { reproductionService } from '../container';
import { ValidationError } from '../utils/errorUtils';
import logger from '../utils/logger';
import {
  ReproductionType,
  ServiceStatus,
  SireInfo,
  ServiceInfo,
  HeatInfo,
  PregnancyInfo,
  CalvingInfo,
  CalfInfo,
  WeaningInfo,
} from '../models/Reproduction';

export class ReproductionController {
  private readonly context = 'ReproductionController';

  constructor() {
    this.recordHeat = this.recordHeat.bind(this);
    this.recordInsemination = this.recordInsemination.bind(this);
    this.confirmPregnancy = this.confirmPregnancy.bind(this);
    this.recordBirth = this.recordBirth.bind(this);
    this.getEventById = this.getEventById.bind(this);
    this.listEvents = this.listEvents.bind(this);
    this.listEventsByRanch = this.listEventsByRanch.bind(this);
    this.getConceptionRate = this.getConceptionRate.bind(this);
    this.getAverageCalvingInterval = this.getAverageCalvingInterval.bind(this);
    this.updateEvent = this.updateEvent.bind(this);
    this.deleteEvent = this.deleteEvent.bind(this);
  }

  // ==========================================================================
  // Registro de eventos específicos
  // ==========================================================================

  /**
   * POST /api/reproduction/heat
   * Registrar detección de celo
   */
  async recordHeat(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }

      const { damId, heatInfo, eventDate, notes } = req.body;
      if (!damId || !heatInfo || !eventDate) {
        res.status(400).json({ success: false, error: 'Faltan campos requeridos: damId, heatInfo, eventDate' });
        return;
      }

      const event = await reproductionService.recordHeat(
        damId,
        heatInfo as HeatInfo,
        new Date(eventDate),
        userId,
        { notes }
      );

      res.status(201).json({ success: true, data: event });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * POST /api/reproduction/insemination
   * Registrar inseminación artificial o monta natural
   */
  async recordInsemination(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }

      const { damId, serviceInfo, sireInfo, eventDate, notes } = req.body;
      if (!damId || !serviceInfo || !sireInfo || !eventDate) {
        res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
        return;
      }

      const event = await reproductionService.recordInsemination(
        damId,
        serviceInfo as ServiceInfo,
        sireInfo as SireInfo,
        new Date(eventDate),
        userId,
        { notes }
      );

      res.status(201).json({ success: true, data: event });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * POST /api/reproduction/pregnancy
   * Confirmar preñez
   */
  async confirmPregnancy(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }

      const { damId, pregnancyInfo, eventDate, notes } = req.body;
      if (!damId || !pregnancyInfo || !eventDate) {
        res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
        return;
      }

      const event = await reproductionService.confirmPregnancy(
        damId,
        pregnancyInfo as PregnancyInfo,
        new Date(eventDate),
        userId,
        { notes }
      );

      res.status(201).json({ success: true, data: event });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * POST /api/reproduction/birth
   * Registrar parto
   */
  async recordBirth(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }

      const { damId, calvingInfo, calfInfo, eventDate, notes } = req.body;
      if (!damId || !calvingInfo || !calfInfo || !eventDate) {
        res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
        return;
      }

      const event = await reproductionService.recordBirth(
        damId,
        calvingInfo as CalvingInfo,
        calfInfo as CalfInfo,
        new Date(eventDate),
        userId,
        { notes }
      );

      res.status(201).json({ success: true, data: event });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ==========================================================================
  // Consultas
  // ==========================================================================

  /**
   * GET /api/reproduction/events/:id
   * Obtener un evento por ID
   */
  async getEventById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const event = await reproductionService.getEventById(id);
      if (!event) {
        res.status(404).json({ success: false, error: 'Evento no encontrado' });
        return;
      }
      res.json({ success: true, data: event });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * GET /api/reproduction/events
   * Listar eventos con filtros (bovineId, tipo, fechas)
   */
  async listEvents(req: Request, res: Response): Promise<void> {
    try {
      const { bovineId, reproductionType, startDate, endDate, limit, offset } = req.query;

      const result = await reproductionService.getEventsByBovine(
        bovineId as string,
        {
          reproductionType: reproductionType as ReproductionType,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          limit: limit ? parseInt(limit as string) : undefined,
          offset: offset ? parseInt(offset as string) : undefined,
        }
      );

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
   * GET /api/reproduction/ranch/:ranchId/events
   * Listar eventos de un rancho
   */
  async listEventsByRanch(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const { reproductionType, startDate, endDate, limit, offset } = req.query;

      const result = await reproductionService.getEventsByRanch(
        ranchId,
        {
          reproductionType: reproductionType as ReproductionType,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          limit: limit ? parseInt(limit as string) : undefined,
          offset: offset ? parseInt(offset as string) : undefined,
        }
      );

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
   * GET /api/reproduction/metrics/conception-rate
   * Calcular tasa de concepción para un rancho en un período
   */
  async getConceptionRate(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId, startDate, endDate } = req.query;
      if (!ranchId || !startDate || !endDate) {
        res.status(400).json({ success: false, error: 'ranchId, startDate y endDate son requeridos' });
        return;
      }

      const rate = await reproductionService.getConceptionRate(
        ranchId as string,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({ success: true, data: { conceptionRate: rate } });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * GET /api/reproduction/metrics/calving-interval
   * Calcular intervalo promedio entre partos para un rancho
   */
  async getAverageCalvingInterval(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const interval = await reproductionService.getAverageCalvingInterval(ranchId);
      res.json({ success: true, data: { averageCalvingInterval: interval } });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ==========================================================================
  // Actualización y eliminación
  // ==========================================================================

  /**
   * PUT /api/reproduction/events/:id
   * Actualizar un evento
   */
  async updateEvent(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }

      const { id } = req.params;
      const data = req.body;
      const event = await reproductionService.updateEvent(id, data, userId);
      res.json({ success: true, data: event });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * DELETE /api/reproduction/events/:id
   * Eliminar (soft delete) un evento
   */
  async deleteEvent(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }

      const { id } = req.params;
      await reproductionService.deleteEvent(id, userId);
      res.json({ success: true, message: 'Evento eliminado' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ==========================================================================
  // Manejo de errores
  // ==========================================================================

  private handleError(error: any, res: Response): void {
    logger.error('Error en ReproductionController', this.context, { error });
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
}

export const reproductionController = new ReproductionController();