// controllers/locationMonitoring.controller.ts
import { Request, Response } from 'express';
import { locationMonitoringService } from '../services/location/LocationMonitoringService';
import { LocationError } from '../utils/LocationErrors';
import logger from '../utils/logger';

export class LocationMonitoringController {
  private readonly context = 'LocationMonitoringController';

  constructor() {
    this.getMonitoring = this.getMonitoring.bind(this);
    this.createMonitoring = this.createMonitoring.bind(this);
    this.updateMonitoring = this.updateMonitoring.bind(this);
    this.upsertMonitoring = this.upsertMonitoring.bind(this);
    this.deleteMonitoring = this.deleteMonitoring.bind(this);
    this.enableMonitoring = this.enableMonitoring.bind(this);
    this.disableMonitoring = this.disableMonitoring.bind(this);
    this.pingDevice = this.pingDevice.bind(this);
    this.recordReading = this.recordReading.bind(this);
    this.recordAlert = this.recordAlert.bind(this);
    this.resolveAlerts = this.resolveAlerts.bind(this);
    this.recordMaintenance = this.recordMaintenance.bind(this);
    this.listWithActiveAlerts = this.listWithActiveAlerts.bind(this);
    this.listOfflineDevices = this.listOfflineDevices.bind(this);
    this.listUpcomingMaintenance = this.listUpcomingMaintenance.bind(this);
    this.listLowBattery = this.listLowBattery.bind(this);
    this.getGlobalStats = this.getGlobalStats.bind(this);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private handleError(error: unknown, res: Response, action: string, meta: any = {}): void {
    logger.error(`Error en ${action}`, this.context, meta, error as Error);
    if (error instanceof LocationError) {
      res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
    } else {
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  private requireUserId(req: Request, res: Response): string | null {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Usuario no autenticado' });
      return null;
    }
    return userId;
  }

  // ==========================================================================
  // CRUD / CONFIGURACIÓN
  // ==========================================================================

  async getMonitoring(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const monitoring = await locationMonitoringService.getByLocationId(locationId);
      if (!monitoring) {
        res.status(404).json({ success: false, error: 'Monitoreo no configurado para esta ubicación' });
        return;
      }
      res.json({ success: true, data: monitoring });
    } catch (error) {
      this.handleError(error, res, 'getMonitoring', { params: req.params });
    }
  }

  async createMonitoring(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId } = req.params;
      const monitoring = await locationMonitoringService.create({
        ...req.body,
        locationId,
        updatedBy: userId,
      });

      res.status(201).json({ success: true, data: monitoring, message: 'Monitoreo creado' });
    } catch (error) {
      this.handleError(error, res, 'createMonitoring', { params: req.params, body: req.body });
    }
  }

  async updateMonitoring(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId } = req.params;
      const monitoring = await locationMonitoringService.update({
        ...req.body,
        locationId,
        updatedBy: userId,
      });

      res.json({ success: true, data: monitoring, message: 'Monitoreo actualizado' });
    } catch (error) {
      this.handleError(error, res, 'updateMonitoring', { params: req.params, body: req.body });
    }
  }

  async upsertMonitoring(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId } = req.params;
      const monitoring = await locationMonitoringService.upsert({
        ...req.body,
        locationId,
        updatedBy: userId,
      });

      res.json({ success: true, data: monitoring, message: 'Monitoreo guardado' });
    } catch (error) {
      this.handleError(error, res, 'upsertMonitoring', { params: req.params, body: req.body });
    }
  }

  async deleteMonitoring(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      await locationMonitoringService.delete(locationId);
      res.json({ success: true, message: 'Monitoreo eliminado' });
    } catch (error) {
      this.handleError(error, res, 'deleteMonitoring', { params: req.params });
    }
  }

  async enableMonitoring(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId } = req.params;
      const monitoring = await locationMonitoringService.enable(locationId, userId);
      res.json({ success: true, data: monitoring, message: 'Monitoreo activado' });
    } catch (error) {
      this.handleError(error, res, 'enableMonitoring', { params: req.params });
    }
  }

  async disableMonitoring(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId } = req.params;
      const monitoring = await locationMonitoringService.disable(locationId, userId);
      res.json({ success: true, data: monitoring, message: 'Monitoreo desactivado' });
    } catch (error) {
      this.handleError(error, res, 'disableMonitoring', { params: req.params });
    }
  }

  // ==========================================================================
  // DISPOSITIVO: PING Y LECTURAS
  // ==========================================================================

  async pingDevice(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId } = req.params;
      const monitoring = await locationMonitoringService.pingDevice({
        ...req.body,
        locationId,
        updatedBy: userId,
      });

      res.json({ success: true, data: monitoring, message: 'Ping registrado' });
    } catch (error) {
      this.handleError(error, res, 'pingDevice', { params: req.params, body: req.body });
    }
  }

  async recordReading(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId } = req.params;
      const monitoring = await locationMonitoringService.recordReading({
        ...req.body,
        locationId,
        updatedBy: userId,
      });

      res.status(201).json({ success: true, data: monitoring, message: 'Lectura registrada' });
    } catch (error) {
      this.handleError(error, res, 'recordReading', { params: req.params, body: req.body });
    }
  }

  // ==========================================================================
  // ALERTAS
  // ==========================================================================

  async recordAlert(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId } = req.params;
      const { alertType, message } = req.body;

      if (!alertType || !message) {
        res.status(400).json({
          success: false,
          error: 'Los campos "alertType" y "message" son requeridos',
        });
        return;
      }

      const monitoring = await locationMonitoringService.recordAlert({
        locationId,
        alertType,
        message,
        updatedBy: userId,
      });

      res.status(201).json({ success: true, data: monitoring, message: 'Alerta registrada' });
    } catch (error) {
      this.handleError(error, res, 'recordAlert', { params: req.params, body: req.body });
    }
  }

  async resolveAlerts(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId } = req.params;
      const { count } = req.body;

      const monitoring = await locationMonitoringService.resolveAlerts({
        locationId,
        count: typeof count === 'number' ? count : undefined,
        updatedBy: userId,
      });

      res.json({ success: true, data: monitoring, message: 'Alertas resueltas' });
    } catch (error) {
      this.handleError(error, res, 'resolveAlerts', { params: req.params, body: req.body });
    }
  }

  // ==========================================================================
  // MANTENIMIENTO
  // ==========================================================================

  async recordMaintenance(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { locationId } = req.params;
      const monitoring = await locationMonitoringService.recordMaintenance({
        ...req.body,
        locationId,
        updatedBy: userId,
      });

      res.status(201).json({ success: true, data: monitoring, message: 'Mantenimiento registrado' });
    } catch (error) {
      this.handleError(error, res, 'recordMaintenance', { params: req.params, body: req.body });
    }
  }

  // ==========================================================================
  // LISTADOS / DASHBOARDS
  // ==========================================================================

  async listWithActiveAlerts(_req: Request, res: Response): Promise<void> {
    try {
      const list = await locationMonitoringService.listWithActiveAlerts();
      res.json({ success: true, data: list, pagination: { total: list.length } });
    } catch (error) {
      this.handleError(error, res, 'listWithActiveAlerts');
    }
  }

  async listOfflineDevices(req: Request, res: Response): Promise<void> {
    try {
      const thresholdMinutes = req.query.thresholdMinutes
        ? parseInt(req.query.thresholdMinutes as string, 10)
        : 30;
      const list = await locationMonitoringService.listOfflineDevices(thresholdMinutes);
      res.json({ success: true, data: list, pagination: { total: list.length } });
    } catch (error) {
      this.handleError(error, res, 'listOfflineDevices', { query: req.query });
    }
  }

  async listUpcomingMaintenance(req: Request, res: Response): Promise<void> {
    try {
      const withinDays = req.query.withinDays
        ? parseInt(req.query.withinDays as string, 10)
        : 7;
      const list = await locationMonitoringService.listUpcomingMaintenance(withinDays);
      res.json({ success: true, data: list, pagination: { total: list.length } });
    } catch (error) {
      this.handleError(error, res, 'listUpcomingMaintenance', { query: req.query });
    }
  }

  async listLowBattery(req: Request, res: Response): Promise<void> {
    try {
      const threshold = req.query.threshold
        ? parseInt(req.query.threshold as string, 10)
        : 20;
      const list = await locationMonitoringService.listLowBattery(threshold);
      res.json({ success: true, data: list, pagination: { total: list.length } });
    } catch (error) {
      this.handleError(error, res, 'listLowBattery', { query: req.query });
    }
  }

  async getGlobalStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await locationMonitoringService.getGlobalStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      this.handleError(error, res, 'getGlobalStats');
    }
  }
}

export const locationMonitoringController = new LocationMonitoringController();
