import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Location from './Location';

// Enums específicos para LocationMonitoring
export enum MonitoringMode {
  MANUAL = 'MANUAL',           // Monitoreo manual (inspecciones humanas)
  AUTOMATED = 'AUTOMATED',     // Monitoreo automatizado (sensores)
  HYBRID = 'HYBRID'            // Combinación de ambos
}

export enum AlertType {
  ENTRY = 'ENTRY',             // Entrada a zona
  EXIT = 'EXIT',               // Salida de zona
  DWELL_TIME = 'DWELL_TIME',   // Tiempo de permanencia excedido
  SPEED_LIMIT = 'SPEED_LIMIT', // Exceso de velocidad
  UNAUTHORIZED = 'UNAUTHORIZED', // Acceso no autorizado
  EMERGENCY = 'EMERGENCY',     // Emergencia
  MAINTENANCE = 'MAINTENANCE', // Mantenimiento requerido
  BATTERY_LOW = 'BATTERY_LOW', // Batería baja del dispositivo
  OFFLINE = 'OFFLINE',         // Dispositivo sin conexión
  TEMPERATURE = 'TEMPERATURE', // Alerta de temperatura
  HUMIDITY = 'HUMIDITY',       // Alerta de humedad
  OTHER = 'OTHER'              // Otro tipo
}

export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  MAINTENANCE = 'MAINTENANCE',
  ERROR = 'ERROR'
}

export enum SignalQuality {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
  NO_SIGNAL = 'NO_SIGNAL'
}

// Atributos del modelo LocationMonitoring
export interface LocationMonitoringAttributes {
  
  locationId: string;           // FK a Location (OBLIGATORIO - relación 1:1)
  
  // Configuración de monitoreo
  isMonitored: boolean;          // Si está siendo monitoreada
  monitoringMode: MonitoringMode; // Modo de monitoreo
  monitoringInterval?: number;    // Intervalo en minutos (para automático)
  
  // Alertas
  hasAlerts: boolean;            // Si tiene alertas activas
  lastAlertDate?: Date;          // Fecha de última alerta
  lastAlertType?: AlertType;      // Tipo de última alerta
  lastAlertMessage?: string;      // Mensaje de última alerta
  alertCount: number;            // Contador total de alertas
  unresolvedAlertCount: number;   // Alertas sin resolver
  
  // Datos del dispositivo
  deviceId?: string;              // ID del dispositivo/sensor
  deviceName?: string;            // Nombre del dispositivo
  deviceStatus?: DeviceStatus;    // Estado del dispositivo
  deviceBattery?: number;         // Nivel de batería (0-100)
  lastPingAt?: Date;              // Último ping recibido
  signalStrength?: number;        // Potencia de señal (dBm)
  signalQuality?: SignalQuality;  // Calidad de señal
  
  // Métricas ambientales (opcional)
  temperature?: number;           // Temperatura actual
  humidity?: number;              // Humedad actual
  pressure?: number;              // Presión atmosférica
  lastReadingAt?: Date;           // Fecha de última lectura
  
  // Datos de mantenimiento
  lastMaintenanceAt?: Date;       // Último mantenimiento
  nextMaintenanceAt?: Date;       // Próximo mantenimiento
  maintenanceNotes?: string;      // Notas de mantenimiento
  
  // Configuración adicional
  alertThresholds?: {              // Umbrales para alertas
    dwellTime?: number;            // Minutos para alerta de permanencia
    speedLimit?: number;           // Km/h para alerta de velocidad
    temperatureMin?: number;       // Temperatura mínima
    temperatureMax?: number;       // Temperatura máxima
    humidityMin?: number;          // Humedad mínima
    humidityMax?: number;          // Humedad máxima
    batteryLow?: number;           // Nivel de batería para alerta
  };
  
  // Notificaciones
  notifyOnAlert: boolean;          // Notificar cuando hay alertas
  notificationRecipients?: string[]; // IDs de usuarios a notificar
  
  // Auditoría
  lastUpdated: Date;
  updatedBy: string;
  
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;                // Soft delete
}

// Atributos opcionales al crear
export interface LocationMonitoringCreationAttributes
  extends Optional<LocationMonitoringAttributes,
    'monitoringInterval' | 'lastAlertDate' | 'lastAlertType' | 
    'lastAlertMessage' | 'alertCount' | 'unresolvedAlertCount' | 'deviceId' |
    'deviceName' | 'deviceStatus' | 'deviceBattery' | 'lastPingAt' |
    'signalStrength' | 'signalQuality' | 'temperature' | 'humidity' |
    'pressure' | 'lastReadingAt' | 'lastMaintenanceAt' | 'nextMaintenanceAt' |
    'maintenanceNotes' | 'alertThresholds' | 'notificationRecipients' |
    'deletedAt'
  > {}

// Clase del modelo LocationMonitoring
class LocationMonitoring extends Model<LocationMonitoringAttributes, LocationMonitoringCreationAttributes>
  implements LocationMonitoringAttributes {
  
  
  public locationId!: string;
  
  public isMonitored!: boolean;
  public monitoringMode!: MonitoringMode;
  public monitoringInterval?: number;
  
  public hasAlerts!: boolean;
  public lastAlertDate?: Date;
  public lastAlertType?: AlertType;
  public lastAlertMessage?: string;
  public alertCount!: number;
  public unresolvedAlertCount!: number;
  
  public deviceId?: string;
  public deviceName?: string;
  public deviceStatus?: DeviceStatus;
  public deviceBattery?: number;
  public lastPingAt?: Date;
  public signalStrength?: number;
  public signalQuality?: SignalQuality;
  
  public temperature?: number;
  public humidity?: number;
  public pressure?: number;
  public lastReadingAt?: Date;
  
  public lastMaintenanceAt?: Date;
  public nextMaintenanceAt?: Date;
  public maintenanceNotes?: string;
  
  public alertThresholds?: {
    dwellTime?: number;
    speedLimit?: number;
    temperatureMin?: number;
    temperatureMax?: number;
    humidityMin?: number;
    humidityMax?: number;
    batteryLow?: number;
  };
  
  public notifyOnAlert!: boolean;
  public notificationRecipients?: string[];
  
  public lastUpdated!: Date;
  public updatedBy!: string;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;

  // ❌ LOS MÉTODOS DE NEGOCIO IRÁN EN SERVICIOS
  // (mencionados abajo, no implementados aquí)
}

// Definición del modelo en Sequelize
LocationMonitoring.init(
  {
    locationId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'locations',
        key: 'id'
      },
       // Relación 1:1 con Location
      comment: 'ID de la ubicación (relación 1:1)'
    },
    isMonitored: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si la ubicación está siendo monitoreada'
    },
    monitoringMode: {
      type: DataTypes.ENUM(...Object.values(MonitoringMode)),
      allowNull: false,
      defaultValue: MonitoringMode.MANUAL,
    },
    monitoringInterval: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 1440 // 24 horas en minutos
      },
      comment: 'Intervalo de monitoreo en minutos (para modo automático)'
    },
    hasAlerts: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si hay alertas activas'
    },
    lastAlertDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de la última alerta'
    },
    lastAlertType: {
      type: DataTypes.ENUM(...Object.values(AlertType)),
      allowNull: true,
    },
    lastAlertMessage: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Mensaje de la última alerta'
    },
    alertCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'Contador total de alertas'
    },
    unresolvedAlertCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'Número de alertas sin resolver'
    },
    deviceId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'ID del dispositivo o sensor'
    },
    deviceName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Nombre del dispositivo'
    },
    deviceStatus: {
      type: DataTypes.ENUM(...Object.values(DeviceStatus)),
      allowNull: true,
    },
    deviceBattery: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
        max: 100
      },
      comment: 'Nivel de batería del dispositivo (0-100)'
    },
    lastPingAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Último ping recibido del dispositivo'
    },
    signalStrength: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Potencia de señal en dBm'
    },
    signalQuality: {
      type: DataTypes.ENUM(...Object.values(SignalQuality)),
      allowNull: true,
    },
    temperature: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Temperatura actual en °C'
    },
    humidity: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 100
      },
      comment: 'Humedad actual en %'
    },
    pressure: {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: true,
      comment: 'Presión atmosférica en hPa'
    },
    lastReadingAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de la última lectura ambiental'
    },
    lastMaintenanceAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha del último mantenimiento'
    },
    nextMaintenanceAt: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        isAfterLastMaintenance(value: Date) {
          if (value && this.lastMaintenanceAt && value <= this.lastMaintenanceAt) {
            throw new Error('La fecha de próximo mantenimiento debe ser posterior al último');
          }
        }
      },
      comment: 'Fecha del próximo mantenimiento'
    },
    maintenanceNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas de mantenimiento'
    },
    alertThresholds: {
      type: DataTypes.JSONB,
      allowNull: true,
      validate: {
        isValidThresholds(value: any) {
          if (value) {
            // Validar estructura y rangos
            if (value.dwellTime !== undefined && value.dwellTime < 0) {
              throw new Error('El tiempo de permanencia no puede ser negativo');
            }
            if (value.speedLimit !== undefined && value.speedLimit < 0) {
              throw new Error('El límite de velocidad no puede ser negativo');
            }
            if (value.temperatureMin !== undefined && value.temperatureMax !== undefined &&
                value.temperatureMin >= value.temperatureMax) {
              throw new Error('La temperatura mínima debe ser menor a la máxima');
            }
            if (value.batteryLow !== undefined && (value.batteryLow < 0 || value.batteryLow > 100)) {
              throw new Error('El nivel de batería bajo debe estar entre 0 y 100');
            }
          }
        }
      },
      comment: 'Umbrales para generación de alertas'
    },
    notifyOnAlert: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Indica si se deben enviar notificaciones de alertas'
    },
    notificationRecipients: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: true,
      defaultValue: [],
      comment: 'Lista de IDs de usuarios a notificar'
    },
    lastUpdated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de última actualización del monitoreo'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que actualizó'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de eliminación (soft delete)'
    }
  },
  {
    sequelize,
    modelName: 'LocationMonitoring',
    tableName: 'location_monitoring',
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ['location_id']
      },
      {
        fields: ['is_monitored']
      },
      {
        fields: ['has_alerts']
      },
      {
        fields: ['device_id']
      },
      {
        fields: ['device_status']
      },
      {
        fields: ['last_ping_at']
      },
      {
        name: 'location_monitoring_alerts',
        fields: ['has_alerts', 'unresolved_alert_count']
      },
      {
        name: 'location_monitoring_device',
        fields: ['device_id', 'device_status', 'last_ping_at']
      },
      {
        name: 'location_monitoring_maintenance',
        fields: ['next_maintenance_at', 'is_monitored']
      }
    ],
    hooks: {
      beforeSave: async (monitoring: LocationMonitoring) => {
        // Actualizar lastUpdated automáticamente
        monitoring.lastUpdated = new Date();
        
        // Actualizar hasAlerts basado en unresolvedAlertCount
        monitoring.hasAlerts = monitoring.unresolvedAlertCount > 0;
        
        // Calcular calidad de señal basada en intensidad
        if (monitoring.signalStrength !== undefined && !monitoring.signalQuality) {
          if (monitoring.signalStrength >= -50) {
            monitoring.signalQuality = SignalQuality.EXCELLENT;
          } else if (monitoring.signalStrength >= -70) {
            monitoring.signalQuality = SignalQuality.GOOD;
          } else if (monitoring.signalStrength >= -85) {
            monitoring.signalQuality = SignalQuality.FAIR;
          } else if (monitoring.signalStrength >= -100) {
            monitoring.signalQuality = SignalQuality.POOR;
          } else {
            monitoring.signalQuality = SignalQuality.NO_SIGNAL;
          }
        }
        
        // Determinar estado del dispositivo basado en último ping
        if (monitoring.lastPingAt && monitoring.deviceId) {
          const minutesSincePing = (new Date().getTime() - monitoring.lastPingAt.getTime()) / (1000 * 60);
          
          if (minutesSincePing > 30 && monitoring.deviceStatus === DeviceStatus.ONLINE) {
            monitoring.deviceStatus = DeviceStatus.OFFLINE;
          }
        }
        
        // Validar consistencia de modos
        if (monitoring.monitoringMode === MonitoringMode.AUTOMATED && !monitoring.deviceId) {
          throw new Error('El modo automatizado requiere un dispositivo asignado');
        }
        
        if (monitoring.monitoringMode === MonitoringMode.MANUAL && monitoring.monitoringInterval) {
          monitoring.monitoringInterval = undefined; // No aplica en modo manual
        }
      },
      
      beforeCreate: async (monitoring: LocationMonitoring) => {
        // Inicializar contadores si no se proporcionaron
        if (monitoring.alertCount === undefined) monitoring.alertCount = 0;
        if (monitoring.unresolvedAlertCount === undefined) monitoring.unresolvedAlertCount = 0;
        monitoring.hasAlerts = monitoring.unresolvedAlertCount > 0;
      },
      
      afterFind: (monitorings: LocationMonitoring | LocationMonitoring[]) => {
        const process = (m: LocationMonitoring) => {
          // Actualizar estado en memoria basado en último ping
          if (m.lastPingAt && m.deviceId) {
            const minutesSincePing = (new Date().getTime() - m.lastPingAt.getTime()) / (1000 * 60);
            
            if (minutesSincePing > 30 && m.deviceStatus === DeviceStatus.ONLINE) {
              m.deviceStatus = DeviceStatus.OFFLINE;
            }
          }
        };
        
        if (Array.isArray(monitorings)) {
          monitorings.forEach(process);
        } else if (monitorings) {
          process(monitorings);
        }
      }
    },
    comment: 'Tabla para monitoreo de ubicaciones (alertas, dispositivos, métricas)'
  }
);

export default LocationMonitoring;