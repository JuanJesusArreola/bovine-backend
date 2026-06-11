// services/location/LocationMonitoringService.ts
import { Op } from 'sequelize';
import logger from '../../utils/logger';
import { LocationNotFoundError, LocationError } from '../../utils/LocationErrors';
import { ensureError } from '../../utils/errorUtils';

import Location from '../../models/Location';
import LocationMonitoring, {
  MonitoringMode,
  AlertType,
  DeviceStatus,
  SignalQuality,
} from '../../models/LocationMonitoring';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface AlertThresholds {
  dwellTime?: number;
  speedLimit?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  humidityMin?: number;
  humidityMax?: number;
  batteryLow?: number;
}

export interface CreateOrUpdateMonitoringInput {
  locationId: string;
  isMonitored?: boolean;
  monitoringMode?: MonitoringMode;
  monitoringInterval?: number;
  deviceId?: string;
  deviceName?: string;
  deviceStatus?: DeviceStatus;
  alertThresholds?: AlertThresholds;
  notifyOnAlert?: boolean;
  notificationRecipients?: string[];
  updatedBy: string;
}

export interface PingDeviceInput {
  locationId: string;
  deviceBattery?: number;
  signalStrength?: number;
  signalQuality?: SignalQuality;
  deviceStatus?: DeviceStatus;
  updatedBy: string;
}

export interface RecordReadingInput {
  locationId: string;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  updatedBy: string;
}

export interface RecordAlertInput {
  locationId: string;
  alertType: AlertType;
  message: string;
  updatedBy: string;
}

export interface ResolveAlertsInput {
  locationId: string;
  count?: number; // cuántas resolver; por defecto TODAS (unresolvedAlertCount → 0)
  updatedBy: string;
}

export interface RecordMaintenanceInput {
  locationId: string;
  nextMaintenanceAt?: Date | string;
  maintenanceNotes?: string;
  updatedBy: string;
}

// ============================================================================
// SERVICIO
// ============================================================================

export class LocationMonitoringService {
  private readonly context = 'LocationMonitoringService';

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async assertLocationExists(locationId: string): Promise<void> {
    const loc = await Location.findByPk(locationId);
    if (!loc) throw new LocationNotFoundError(locationId);
  }

  private async getOrCreate(
    locationId: string,
    updatedBy: string,
    defaults: Partial<CreateOrUpdateMonitoringInput> = {}
  ): Promise<LocationMonitoring> {
    let monitoring = await LocationMonitoring.findByPk(locationId);
    if (!monitoring) {
      await this.assertLocationExists(locationId);
      monitoring = await LocationMonitoring.create({
        locationId,
        isMonitored: defaults.isMonitored ?? true,
        monitoringMode: defaults.monitoringMode ?? MonitoringMode.MANUAL,
        monitoringInterval: defaults.monitoringInterval,
        hasAlerts: false,
        alertCount: 0,
        unresolvedAlertCount: 0,
        deviceId: defaults.deviceId,
        deviceName: defaults.deviceName,
        deviceStatus: defaults.deviceStatus,
        alertThresholds: defaults.alertThresholds,
        notifyOnAlert: defaults.notifyOnAlert ?? true,
        notificationRecipients: defaults.notificationRecipients ?? [],
        lastUpdated: new Date(),
        updatedBy,
      } as any);
    }
    return monitoring;
  }

  // ==========================================================================
  // CRUD / CONFIGURACIÓN
  // ==========================================================================

  async getByLocationId(locationId: string): Promise<LocationMonitoring | null> {
    try {
      return await LocationMonitoring.findByPk(locationId);
    } catch (error) {
      logger.error('Error en getByLocationId', this.context, { locationId }, ensureError(error));
      throw new LocationError('Error al obtener monitoreo', 'MONITORING_FETCH_ERROR', 500, ensureError(error));
    }
  }

  async create(input: CreateOrUpdateMonitoringInput): Promise<LocationMonitoring> {
    try {
      await this.assertLocationExists(input.locationId);

      const existing = await LocationMonitoring.findByPk(input.locationId);
      if (existing) {
        throw new LocationError(
          'Ya existe configuración de monitoreo para esta ubicación. Use update.',
          'MONITORING_ALREADY_EXISTS',
          409
        );
      }

      const monitoring = await LocationMonitoring.create({
        locationId: input.locationId,
        isMonitored: input.isMonitored ?? false,
        monitoringMode: input.monitoringMode ?? MonitoringMode.MANUAL,
        monitoringInterval: input.monitoringInterval,
        hasAlerts: false,
        alertCount: 0,
        unresolvedAlertCount: 0,
        deviceId: input.deviceId,
        deviceName: input.deviceName,
        deviceStatus: input.deviceStatus,
        alertThresholds: input.alertThresholds,
        notifyOnAlert: input.notifyOnAlert ?? true,
        notificationRecipients: input.notificationRecipients ?? [],
        lastUpdated: new Date(),
        updatedBy: input.updatedBy,
      } as any);

      logger.info(`Monitoreo creado para ${input.locationId}`, this.context);
      return monitoring;
    } catch (error) {
      if (error instanceof LocationError) throw error;
      logger.error('Error en create', this.context, { input }, ensureError(error));
      throw new LocationError('Error al crear monitoreo', 'MONITORING_CREATE_ERROR', 500, ensureError(error));
    }
  }

  async update(input: CreateOrUpdateMonitoringInput): Promise<LocationMonitoring> {
    try {
      const monitoring = await LocationMonitoring.findByPk(input.locationId);
      if (!monitoring) throw new LocationNotFoundError(input.locationId);

      const updates: any = { updatedBy: input.updatedBy };
      if (input.isMonitored !== undefined) updates.isMonitored = input.isMonitored;
      if (input.monitoringMode !== undefined) updates.monitoringMode = input.monitoringMode;
      if (input.monitoringInterval !== undefined) updates.monitoringInterval = input.monitoringInterval;
      if (input.deviceId !== undefined) updates.deviceId = input.deviceId;
      if (input.deviceName !== undefined) updates.deviceName = input.deviceName;
      if (input.deviceStatus !== undefined) updates.deviceStatus = input.deviceStatus;
      if (input.alertThresholds !== undefined) updates.alertThresholds = input.alertThresholds;
      if (input.notifyOnAlert !== undefined) updates.notifyOnAlert = input.notifyOnAlert;
      if (input.notificationRecipients !== undefined) {
        updates.notificationRecipients = input.notificationRecipients;
      }

      await monitoring.update(updates);
      logger.info(`Monitoreo actualizado: ${input.locationId}`, this.context);
      return monitoring;
    } catch (error) {
      if (error instanceof LocationError) throw error;
      logger.error('Error en update', this.context, { input }, ensureError(error));
      throw new LocationError('Error al actualizar monitoreo', 'MONITORING_UPDATE_ERROR', 500, ensureError(error));
    }
  }

  async upsert(input: CreateOrUpdateMonitoringInput): Promise<LocationMonitoring> {
    const existing = await LocationMonitoring.findByPk(input.locationId);
    if (existing) return this.update(input);
    return this.create(input);
  }

  async delete(locationId: string): Promise<void> {
    const monitoring = await LocationMonitoring.findByPk(locationId);
    if (!monitoring) throw new LocationNotFoundError(locationId);
    await monitoring.destroy();
    logger.info(`Monitoreo eliminado (soft): ${locationId}`, this.context);
  }

  async enable(locationId: string, updatedBy: string): Promise<LocationMonitoring> {
    const monitoring = await this.getOrCreate(locationId, updatedBy);
    await monitoring.update({ isMonitored: true, updatedBy });
    return monitoring;
  }

  async disable(locationId: string, updatedBy: string): Promise<LocationMonitoring> {
    const monitoring = await LocationMonitoring.findByPk(locationId);
    if (!monitoring) throw new LocationNotFoundError(locationId);
    await monitoring.update({ isMonitored: false, updatedBy });
    return monitoring;
  }

  // ==========================================================================
  // DISPOSITIVO: PING Y LECTURAS
  // ==========================================================================

  /**
   * Registra un "ping" del dispositivo IoT. Actualiza lastPingAt, batería y señal.
   * El hook beforeSave calculará automáticamente signalQuality y deviceStatus.
   */
  async pingDevice(input: PingDeviceInput): Promise<LocationMonitoring> {
    try {
      const monitoring = await LocationMonitoring.findByPk(input.locationId);
      if (!monitoring) throw new LocationNotFoundError(input.locationId);

      if (!monitoring.deviceId) {
        throw new LocationError(
          'La ubicación no tiene dispositivo asignado',
          'NO_DEVICE_ASSIGNED',
          400
        );
      }

      const updates: any = {
        lastPingAt: new Date(),
        deviceStatus: input.deviceStatus ?? DeviceStatus.ONLINE,
        updatedBy: input.updatedBy,
      };
      if (input.deviceBattery !== undefined) updates.deviceBattery = input.deviceBattery;
      if (input.signalStrength !== undefined) updates.signalStrength = input.signalStrength;
      if (input.signalQuality !== undefined) updates.signalQuality = input.signalQuality;

      await monitoring.update(updates);
      return monitoring;
    } catch (error) {
      if (error instanceof LocationError) throw error;
      logger.error('Error en pingDevice', this.context, { input }, ensureError(error));
      throw new LocationError('Error al registrar ping', 'PING_ERROR', 500, ensureError(error));
    }
  }

  /**
   * Registra una lectura ambiental (temperatura, humedad, presión).
   * Si cruza un umbral configurado, lanza una alerta automáticamente.
   */
  async recordReading(input: RecordReadingInput): Promise<LocationMonitoring> {
    const monitoring = await this.getOrCreate(input.locationId, input.updatedBy);

    const updates: any = {
      lastReadingAt: new Date(),
      updatedBy: input.updatedBy,
    };
    if (input.temperature !== undefined) updates.temperature = input.temperature;
    if (input.humidity !== undefined) updates.humidity = input.humidity;
    if (input.pressure !== undefined) updates.pressure = input.pressure;

    await monitoring.update(updates);

    // Verificar umbrales y lanzar alerta si corresponde
    const thresholds = monitoring.alertThresholds;
    if (thresholds) {
      const alerts: Array<{ type: AlertType; msg: string }> = [];

      if (input.temperature !== undefined) {
        if (thresholds.temperatureMax !== undefined && input.temperature > thresholds.temperatureMax) {
          alerts.push({
            type: AlertType.TEMPERATURE,
            msg: `Temperatura alta: ${input.temperature}°C (máx ${thresholds.temperatureMax}°C)`,
          });
        }
        if (thresholds.temperatureMin !== undefined && input.temperature < thresholds.temperatureMin) {
          alerts.push({
            type: AlertType.TEMPERATURE,
            msg: `Temperatura baja: ${input.temperature}°C (mín ${thresholds.temperatureMin}°C)`,
          });
        }
      }
      if (input.humidity !== undefined) {
        if (thresholds.humidityMax !== undefined && input.humidity > thresholds.humidityMax) {
          alerts.push({
            type: AlertType.HUMIDITY,
            msg: `Humedad alta: ${input.humidity}% (máx ${thresholds.humidityMax}%)`,
          });
        }
        if (thresholds.humidityMin !== undefined && input.humidity < thresholds.humidityMin) {
          alerts.push({
            type: AlertType.HUMIDITY,
            msg: `Humedad baja: ${input.humidity}% (mín ${thresholds.humidityMin}%)`,
          });
        }
      }

      for (const a of alerts) {
        await this.recordAlert({
          locationId: input.locationId,
          alertType: a.type,
          message: a.msg,
          updatedBy: input.updatedBy,
        });
      }
    }

    return (await LocationMonitoring.findByPk(input.locationId)) as LocationMonitoring;
  }

  // ==========================================================================
  // ALERTAS
  // ==========================================================================

  async recordAlert(input: RecordAlertInput): Promise<LocationMonitoring> {
    const monitoring = await this.getOrCreate(input.locationId, input.updatedBy);

    await monitoring.update({
      lastAlertDate: new Date(),
      lastAlertType: input.alertType,
      lastAlertMessage: input.message,
      alertCount: monitoring.alertCount + 1,
      unresolvedAlertCount: monitoring.unresolvedAlertCount + 1,
      updatedBy: input.updatedBy,
    } as any);

    logger.warn(
      `Alerta registrada en ${input.locationId}: [${input.alertType}] ${input.message}`,
      this.context
    );

    return monitoring;
  }

  /**
   * Resuelve alertas (decrementa unresolvedAlertCount).
   * Si `count` es undefined, resuelve todas.
   */
  async resolveAlerts(input: ResolveAlertsInput): Promise<LocationMonitoring> {
    const monitoring = await LocationMonitoring.findByPk(input.locationId);
    if (!monitoring) throw new LocationNotFoundError(input.locationId);

    const toResolve =
      input.count === undefined
        ? monitoring.unresolvedAlertCount
        : Math.min(input.count, monitoring.unresolvedAlertCount);

    const newUnresolved = Math.max(0, monitoring.unresolvedAlertCount - toResolve);

    await monitoring.update({
      unresolvedAlertCount: newUnresolved,
      updatedBy: input.updatedBy,
    } as any);

    logger.info(
      `${toResolve} alerta(s) resuelta(s) en ${input.locationId}. Restantes: ${newUnresolved}`,
      this.context
    );

    return monitoring;
  }

  // ==========================================================================
  // MANTENIMIENTO
  // ==========================================================================

  async recordMaintenance(input: RecordMaintenanceInput): Promise<LocationMonitoring> {
    const monitoring = await LocationMonitoring.findByPk(input.locationId);
    if (!monitoring) throw new LocationNotFoundError(input.locationId);

    const updates: any = {
      lastMaintenanceAt: new Date(),
      updatedBy: input.updatedBy,
    };
    if (input.nextMaintenanceAt) updates.nextMaintenanceAt = new Date(input.nextMaintenanceAt);
    if (input.maintenanceNotes !== undefined) updates.maintenanceNotes = input.maintenanceNotes;

    await monitoring.update(updates);
    logger.info(`Mantenimiento registrado en ${input.locationId}`, this.context);
    return monitoring;
  }

  // ==========================================================================
  // LISTADOS / DASHBOARDS
  // ==========================================================================

  /** Ubicaciones con alertas activas (unresolvedAlertCount > 0). */
  async listWithActiveAlerts(): Promise<LocationMonitoring[]> {
    return LocationMonitoring.findAll({
      where: { hasAlerts: true } as any,
      order: [['lastAlertDate', 'DESC']],
    });
  }

  /** Dispositivos offline (último ping hace más de N minutos, default 30). */
  async listOfflineDevices(thresholdMinutes: number = 30): Promise<LocationMonitoring[]> {
    const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);
    return LocationMonitoring.findAll({
      where: {
        deviceId: { [Op.ne]: null },
        [Op.or]: [
          { lastPingAt: null },
          { lastPingAt: { [Op.lt]: cutoff } },
          { deviceStatus: DeviceStatus.OFFLINE },
        ],
      } as any,
    });
  }

  /** Próximos mantenimientos vencidos o por vencer. */
  async listUpcomingMaintenance(withinDays: number = 7): Promise<LocationMonitoring[]> {
    const now = new Date();
    const limit = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
    return LocationMonitoring.findAll({
      where: {
        nextMaintenanceAt: { [Op.between]: [now, limit] },
      } as any,
      order: [['nextMaintenanceAt', 'ASC']],
    });
  }

  /** Dispositivos con batería por debajo del umbral (default 20%). */
  async listLowBattery(threshold: number = 20): Promise<LocationMonitoring[]> {
    return LocationMonitoring.findAll({
      where: {
        deviceBattery: { [Op.lte]: threshold, [Op.ne]: null },
      } as any,
      order: [['deviceBattery', 'ASC']],
    });
  }

  /** Resumen global de monitoreo (para dashboard principal). */
  async getGlobalStats(): Promise<{
    totalMonitored: number;
    withActiveAlerts: number;
    offlineDevices: number;
    upcomingMaintenance: number;
    lowBatteryDevices: number;
  }> {
    const [monitored, alerts, offline, maintenance, battery] = await Promise.all([
      LocationMonitoring.count({ where: { isMonitored: true } as any }),
      LocationMonitoring.count({ where: { hasAlerts: true } as any }),
      this.listOfflineDevices().then((l) => l.length),
      this.listUpcomingMaintenance().then((l) => l.length),
      this.listLowBattery().then((l) => l.length),
    ]);

    return {
      totalMonitored: monitored,
      withActiveAlerts: alerts,
      offlineDevices: offline,
      upcomingMaintenance: maintenance,
      lowBatteryDevices: battery,
    };
  }
}

export const locationMonitoringService = new LocationMonitoringService();
