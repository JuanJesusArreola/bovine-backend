import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';

// Definición de enums para estados y tipos
export enum CattleType {
  CATTLE = 'CATTLE',
  BULL = 'BULL',
  COW = 'COW',
  CALF = 'CALF'
}

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  SICK = 'SICK',
  RECOVERING = 'RECOVERING',
  QUARANTINE = 'QUARANTINE',
  DECEASED = 'DECEASED',
  UNKNOWN = 'UNKNOWN',

}

export enum VaccinationStatus {
  UP_TO_DATE = 'UP_TO_DATE',
  PENDING = 'PENDING',
  OVERDUE = 'OVERDUE',
  NONE = 'NONE'
}

export enum GenderType {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  UNKNOWN = 'UNKNOWN'
}

/**
 * X-04: motivo por el que un bovino dejó el hato activo (isActive=false).
 * Distingue una baja legítima de un borrado por error de captura.
 */
export enum BovineExitReason {
  DECEASED = 'DECEASED',           // Muerte (hay registro en bovine_deaths)
  SOLD = 'SOLD',                   // Venta
  TRANSFERRED = 'TRANSFERRED',     // Traslado a otro hato/propietario
  CULLED = 'CULLED',               // Descarte/saca
  DELETED_ERROR = 'DELETED_ERROR', // Borrado por error de captura
}

// Interface para la ubicación geográfica
export interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  address?: string;
  municipality?: string;
  state?: string;
  country?: string;
  timestamp?: Date;
  source?: 'GPS' | 'MANUAL' | 'ESTIMATED';
}

// Interface para métricas físicas del bovino
export interface PhysicalMetrics {
  weight?: number; // Peso en kilogramos
  height?: number; // Altura en centímetros
  length?: number; // Longitud en centímetros
  bodyConditionScore?: number; // Puntuación de condición corporal (1-9)
  temperament?: 'CALM' | 'MODERATE' | 'AGGRESSIVE' | 'NERVOUS';
}

// Interface para información reproductiva
export interface ReproductiveInfo {
  isPregnant?: boolean;
  lastCalvingDate?: Date;
  expectedCalvingDate?: Date;
  breedingHistory?: Array<{
    date: Date;
    method: 'NATURAL' | 'ARTIFICIAL_INSEMINATION';
    sireId?: string;
    success: boolean;
  }>;
}

// Interface para configuración de tracking GPS
export interface TrackingConfig {
  isEnabled: boolean;
  deviceId?: string;
  batteryLevel?: number;
  signalStrength?: number;
  lastUpdate?: Date;
  updateInterval?: number; // minutos entre actualizaciones
  geofenceAlerts?: boolean;
}

// Atributos del modelo Bovine
export interface BovineAttributes {
  id: string;
  earTag: string; // Etiqueta de oreja única
  name?: string; // Nombre del animal (opcional)
  breed: string; // Raza del animal
  cattleType: CattleType; // Tipo de ganado
  gender: GenderType; // Sexo del animal
  birthDate: Date; // Fecha de nacimiento
  weight?: number; // Peso actual en kg
  healthStatus: HealthStatus; // Estado de salud actual
  vaccinationStatus: VaccinationStatus; // Estado de vacunación
  location: LocationData; // Ubicación geográfica actual
  physicalMetrics?: PhysicalMetrics; // Métricas físicas del animal
  reproductiveInfo?: ReproductiveInfo; // Información reproductiva
  trackingConfig?: TrackingConfig; // Configuración de rastreo GPS
  ownerId?: string; // ID del propietario/ganadero
  ranchId?: string; // ID de la finca/rancho
  motherId?: string; // ID de la madre (si aplica)
  fatherId?: string; // ID del padre (si aplica)
  acquisitionDate?: Date; // Fecha de adquisición
  acquisitionPrice?: number; // Precio de adquisición
  currentValue?: number; // Valor actual estimado
  notes?: string; // Notas adicionales
  images?: string[]; // URLs de imágenes del animal
  qrCode?: string; // Código QR del animal
  rfidTag?: string; // Tag RFID del animal
  isActive: boolean; // Si el animal está activo en el sistema
  lastHealthCheck?: Date; // Fecha del último chequeo de salud
  nextHealthCheck?: Date; // Fecha del próximo chequeo programado

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date; // Para soft delete
  currentLocationId?: string;
  /** X-04: motivo de salida del hato activo (null mientras está activo) */
  exitReason?: BovineExitReason | null;
}

// Atributos opcionales al crear un nuevo bovino
export interface BovineCreationAttributes
  extends Optional<BovineAttributes,
    'id' | 'name' | 'weight' | 'physicalMetrics' | 'reproductiveInfo' |
    'trackingConfig' | 'ownerId' | 'ranchId' | 'motherId' | 'fatherId' |
    'acquisitionDate' | 'acquisitionPrice' | 'currentValue' | 'notes' |
    'images' | 'qrCode' | 'rfidTag' | 'lastHealthCheck' | 'nextHealthCheck' |
    'deletedAt' | "currentLocationId" | 'exitReason'
  > { }

// Clase del modelo Bovine
class Bovine extends Model<BovineAttributes, BovineCreationAttributes>
  implements BovineAttributes {
  public id!: string;
  public earTag!: string;
  public name?: string;
  public breed!: string;
  public cattleType!: CattleType;
  public gender!: GenderType;
  public birthDate!: Date;
  public weight?: number;
  public healthStatus!: HealthStatus;
  public vaccinationStatus!: VaccinationStatus;
  public location!: LocationData;
  public physicalMetrics?: PhysicalMetrics;
  public reproductiveInfo?: ReproductiveInfo;
  public trackingConfig?: TrackingConfig;
  public ownerId?: string;
  public ranchId?: string;
  public motherId?: string;
  public fatherId?: string;
  public acquisitionDate?: Date;
  public acquisitionPrice?: number;
  public currentValue?: number;
  public notes?: string;
  public images?: string[];
  public qrCode?: string;
  public rfidTag?: string;
  public isActive!: boolean;
  public lastHealthCheck?: Date;
  public nextHealthCheck?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
  public exitReason?: BovineExitReason | null;


}

// Definición del modelo en Sequelize
Bovine.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del bovino'
    },
    currentLocationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'locations',
        key: 'id'
      },
      comment: 'ID de la ubicación actual (FK a Location)'
    },
    earTag: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 50]
      },
      comment: 'Etiqueta de oreja única del bovino'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [2, 100]
      },
      comment: 'Nombre del animal (opcional)'
    },
    breed: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100]
      },
      comment: 'Raza del animal'
    },
    cattleType: {
      type: DataTypes.ENUM(...Object.values(CattleType)),
      allowNull: false,
    },
    gender: {
      type: DataTypes.ENUM(...Object.values(GenderType)),
      allowNull: false,
    },
    birthDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        isBefore: new Date().toISOString().split('T')[0] // No puede nacer en el futuro
      },
      comment: 'Fecha de nacimiento del animal'
    },
    weight: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      validate: {
        min: 1,
        max: 2000 // Peso máximo razonable en kg
      },
      comment: 'Peso actual del animal en kilogramos'
    },
    healthStatus: {
      type: DataTypes.ENUM(...Object.values(HealthStatus)),
      allowNull: false,
      defaultValue: HealthStatus.HEALTHY,
    },
    vaccinationStatus: {
      type: DataTypes.ENUM(...Object.values(VaccinationStatus)),
      allowNull: false,
      defaultValue: VaccinationStatus.NONE,
      // @deprecated (P-02) — columna dormante. El estado real de vacunación vive
      // en la tabla derivada `bovine_vaccination_status` (mantenida por hooks/job).
      // No usar para lecturas; se conserva solo por compatibilidad de esquema.
      //comment: 'DEPRECADO: usar bovine_vaccination_status. Columna dormante.',
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: true,
      validate: {
        isValidLocation(value: LocationData | null) {
          // Location is optional — skip validation when not provided
          if (!value) return;
          if (value.latitude != null && (value.latitude < -90 || value.latitude > 90)) {
            throw new Error('Latitud debe estar entre -90 y 90');
          }
          if (value.longitude != null && (value.longitude < -180 || value.longitude > 180)) {
            throw new Error('Longitud debe estar entre -180 y 180');
          }
        }
      },
      comment: 'Ubicación geográfica actual del animal (opcional)'
    },
    physicalMetrics: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Métricas físicas del animal (peso, altura, etc.)'
    },
    reproductiveInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información reproductiva del animal'
    },
    trackingConfig: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configuración de rastreo GPS del animal'
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del propietario del animal'
    },
    ranchId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID de la finca donde se encuentra el animal'
    },
    motherId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID de la madre del animal'
    },
    fatherId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del padre del animal'
    },
    acquisitionDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha de adquisición del animal'
    },
    acquisitionPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: {
        min: 0
      },
      comment: 'Precio de adquisición del animal'
    },
    currentValue: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: {
        min: 0
      },
      comment: 'Valor actual estimado del animal'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales sobre el animal'
    },
    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de imágenes del animal'
    },
    qrCode: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Código QR del animal'
    },
    rfidTag: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Tag RFID del animal'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el animal está activo en el sistema'
    },
    exitReason: {
      type: DataTypes.ENUM(...Object.values(BovineExitReason)),
      allowNull: true,
      //comment: 'X-04: motivo de salida del hato (DECEASED/SOLD/.../DELETED_ERROR). Null si activo.'
    },
    lastHealthCheck: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha del último chequeo de salud'
    },
    nextHealthCheck: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha del próximo chequeo programado'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de eliminación (soft delete)'
    }
  },
  {
    sequelize,
    modelName: 'Bovine',
    tableName: 'bovines',
    timestamps: true,
    paranoid: true, // Habilita soft delete
    indexes: [
      // Índices para mejorar el rendimiento de las consultas
      {

        fields: ['ear_tag']
      },
      {
        fields: ['health_status']
      },
      {
        fields: ['cattle_type']
      },
      {
        fields: ['vaccination_status']
      },
      {
        fields: ['owner_id']
      },
      {
        fields: ['ranch_id']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['birth_date']
      },
      { fields: ['current_location_id'] },
      { fields: ['health_status', 'next_health_check'] },
      {
        name: 'bovines_location_gin',
        fields: ['location'],
        using: 'gin',
        where: {
          location: {
            [Op.ne]: null
          }
        }
      },
      {
        name: 'bovines_location_geog_idx',
        using: 'gist',
        fields: [
          sequelize.literal(`
      ST_SetSRID(
        ST_MakePoint(
          (location->>'longitude')::float,
          (location->>'latitude')::float
        ),
        4326
      )
    `)
        ]
      }
    ],
    hooks: {

      // Hook para actualizar el timestamp de ubicación
      beforeUpdate: async (bovine: Bovine) => {
        if (bovine.changed('location') && bovine.location) {
          bovine.location = {
            ...bovine.location,
            timestamp: new Date()
          };
        }
      }
    },
    comment: 'Tabla para almacenar información de bovinos con geolocalización'
  }
);

export default Bovine;