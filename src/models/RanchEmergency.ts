// src/models/ranch/RanchEmergency.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Ranch from './Ranch';

// Enums
export enum EmergencyType {
  FIRE = 'FIRE',
  FLOOD = 'FLOOD',
  DROUGHT = 'DROUGHT',
  HURRICANE = 'HURRICANE',
  TORNADO = 'TORNADO',
  EARTHQUAKE = 'EARTHQUAKE',
  VOLCANIC_ERUPTION = 'VOLCANIC_ERUPTION',
  DISEASE_OUTBREAK = 'DISEASE_OUTBREAK',
  CHEMICAL_SPILL = 'CHEMICAL_SPILL',
  POWER_OUTAGE = 'POWER_OUTAGE',
  WATER_SHORTAGE = 'WATER_SHORTAGE',
  FEED_SHORTAGE = 'FEED_SHORTAGE',
  WILDFIRE = 'WILDFIRE',
  BLIZZARD = 'BLIZZARD',
  HAILSTORM = 'HAILSTORM',
  OTHER = 'OTHER'
}

export enum ContactType {
  EMERGENCY = 'EMERGENCY',
  VETERINARY = 'VETERINARY',
  FIRE = 'FIRE',
  POLICE = 'POLICE',
  MEDICAL = 'MEDICAL',
  UTILITIES = 'UTILITIES',
  GOVERNMENT = 'GOVERNMENT',
  SUPPLIER = 'SUPPLIER',
  NEIGHBOR = 'NEIGHBOR',
  OTHER = 'OTHER'
}

export enum AssemblyPointType {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  TERTIARY = 'TERTIARY',
  EVACUATION = 'EVACUATION',
  SHELTER = 'SHELTER'
}

// Interfaces
export interface EmergencyContact {
  type: ContactType;
  name: string;
  role: string;
  phone: string;
  alternativePhone?: string;
  email?: string;
  organization?: string;
  priority: number;  // 1 = principal, 2 = secundario, etc.
  available24h: boolean;
  notes?: string;
}

export interface AssemblyPoint {
  type: AssemblyPointType;
  name: string;
  latitude: number;
  longitude: number;
  capacity?: number;           // Número de personas/animales
  facilities?: string[];        // Instalaciones disponibles
  supplies?: string[];          // Suministros almacenados
  coordinates: { lat: number; lng: number };
}

export interface EmergencySupply {
  name: string;
  quantity: number;
  unit: string;
  location: string;            // Dónde se almacena
  expiryDate?: Date;
  responsiblePerson?: string;
  lastChecked?: Date;
}

export interface EmergencyProcedure {
  emergencyType: EmergencyType;
  title: string;
  description: string;
  steps: string[];
  responsibleRole: string;
  estimatedTime?: number;      // Minutos
  priority: number;
  lastUpdated: Date;
}

// Atributos del modelo
export interface RanchEmergencyAttributes {
  ranchId: string;                    // PK y FK (1:1)
  
  // Contactos de emergencia
  contacts: EmergencyContact[];
  
  // Puntos de reunión
  assemblyPoints: AssemblyPoint[];
  
  // Suministros de emergencia
  emergencySupplies: EmergencySupply[];
  
  // Procedimientos
  procedures: EmergencyProcedure[];
  
  // Plan de evacuación
  evacuationPlan?: string;             // URL o descripción
  evacuationRoutes?: string[];          // Descripción de rutas
  musterPoints?: string[];              // Puntos de reunión (nombres)
  
  // Equipo de emergencia
  emergencyKitLocation?: string;
  firstAidKits: number;
  fireExtinguishers: number;
  emergencyLights: number;
  generators?: number;
  waterTanks?: number;
  
  // Capacitación
  lastDrillDate?: Date;
  nextDrillDate?: Date;
  drillFrequency?: string;              // ej: "QUARTERLY", "ANNUAL"
  trainedPersonnel: number;
  
  // Comunicaciones
  emergencyRadio?: boolean;
  satellitePhone?: boolean;
  backupCommunication?: string;
  
  // Alertas
  alertSystem?: string;                  // Descripción del sistema de alertas
  warningSigns?: string[];                // Señales de advertencia
  
  // Coordinación
  coordinatesWithLocalAuthorities: boolean;
  mutualAidAgreements?: string[];         // Acuerdos con vecinos
  
  // Evaluación
  lastEmergencyAssessment?: Date;
  nextEmergencyAssessment?: Date;
  assessedBy?: string;
  
  // Metadatos
  notes?: string;
  
  createdBy: string;
  updatedBy?: string;

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface RanchEmergencyCreationAttributes
  extends Optional<RanchEmergencyAttributes,
    'evacuationPlan' | 'evacuationRoutes' | 'musterPoints' |
    'emergencyKitLocation' | 'generators' | 'waterTanks' |
    'lastDrillDate' | 'nextDrillDate' | 'drillFrequency' |
    'emergencyRadio' | 'satellitePhone' | 'backupCommunication' |
    'alertSystem' | 'warningSigns' | 'mutualAidAgreements' |
    'lastEmergencyAssessment' | 'nextEmergencyAssessment' | 'assessedBy' |
    'notes' | 'updatedBy' | 'deletedAt'
  > {}

class RanchEmergency extends Model<RanchEmergencyAttributes, RanchEmergencyCreationAttributes>
  implements RanchEmergencyAttributes {
  
  public ranchId!: string;
  
  public contacts!: EmergencyContact[];
  public assemblyPoints!: AssemblyPoint[];
  public emergencySupplies!: EmergencySupply[];
  public procedures!: EmergencyProcedure[];
  
  public evacuationPlan?: string;
  public evacuationRoutes?: string[];
  public musterPoints?: string[];
  
  public emergencyKitLocation?: string;
  public firstAidKits!: number;
  public fireExtinguishers!: number;
  public emergencyLights!: number;
  public generators?: number;
  public waterTanks?: number;
  
  public lastDrillDate?: Date;
  public nextDrillDate?: Date;
  public drillFrequency?: string;
  public trainedPersonnel!: number;
  
  public emergencyRadio?: boolean;
  public satellitePhone?: boolean;
  public backupCommunication?: string;
  
  public alertSystem?: string;
  public warningSigns?: string[];
  
  public coordinatesWithLocalAuthorities!: boolean;
  public mutualAidAgreements?: string[];
  
  public lastEmergencyAssessment?: Date;
  public nextEmergencyAssessment?: Date;
  public assessedBy?: string;
  
  public notes?: string;
  
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

RanchEmergency.init(
  {
    ranchId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      references: { model: 'ranches', key: 'id' },
      comment: 'ID del rancho (PK y FK 1:1)'
    },
    contacts: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidContacts(value: EmergencyContact[]) {
          if (value.length === 0) {
            throw new Error('Debe tener al menos un contacto de emergencia');
          }
          value.forEach((contact, index) => {
            if (!contact.name || !contact.phone || !contact.role) {
              throw new Error(`Contacto ${index} incompleto`);
            }
          });
        }
      },
      comment: 'Contactos de emergencia'
    },
    assemblyPoints: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidPoints(value: AssemblyPoint[]) {
          if (value.length === 0) {
            throw new Error('Debe tener al menos un punto de reunión');
          }
          value.forEach((point, index) => {
            if (!point.name || !point.coordinates) {
              throw new Error(`Punto de reunión ${index} incompleto`);
            }
          });
        }
      },
      comment: 'Puntos de reunión'
    },
    emergencySupplies: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Suministros de emergencia'
    },
    procedures: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Procedimientos de emergencia'
    },
    evacuationPlan: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Plan de evacuación'
    },
    evacuationRoutes: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: true,
      comment: 'Rutas de evacuación'
    },
    musterPoints: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: 'Puntos de reunión'
    },
    emergencyKitLocation: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Ubicación del kit de emergencia'
    },
    firstAidKits: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
      comment: 'Número de botiquines'
    },
    fireExtinguishers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
      comment: 'Número de extinguidores'
    },
    emergencyLights: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
      comment: 'Número de luces de emergencia'
    },
    generators: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
      comment: 'Número de generadores'
    },
    waterTanks: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
      comment: 'Número de tanques de agua'
    },
    lastDrillDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha del último simulacro'
    },
    nextDrillDate: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        isAfterLast(value: Date) {
          if (value && this.lastDrillDate && value <= this.lastDrillDate) {
            throw new Error('La próxima fecha de simulacro debe ser posterior a la última');
          }
        }
      },
      comment: 'Fecha del próximo simulacro'
    },
    drillFrequency: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Frecuencia de simulacros'
    },
    trainedPersonnel: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
      comment: 'Personal capacitado'
    },
    emergencyRadio: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: '¿Tiene radio de emergencia?'
    },
    satellitePhone: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: '¿Tiene teléfono satelital?'
    },
    backupCommunication: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Método de comunicación de respaldo'
    },
    alertSystem: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Sistema de alertas'
    },
    warningSigns: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: 'Señales de advertencia'
    },
    coordinatesWithLocalAuthorities: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: '¿Coordina con autoridades locales?'
    },
    mutualAidAgreements: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: 'Acuerdos de ayuda mutua'
    },
    lastEmergencyAssessment: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Última evaluación de emergencia'
    },
    nextEmergencyAssessment: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Próxima evaluación de emergencia'
    },
    assessedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del evaluador'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que creó'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que actualizó'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'RanchEmergency',
    tableName: 'ranch_emergency',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['last_drill_date', 'next_drill_date'] },
      { fields: ['last_emergency_assessment'] },
      { fields: ['trained_personnel'] }
    ],
    hooks: {
      beforeSave: async (emergency: RanchEmergency) => {
        // Validar fechas de simulacro
        if (emergency.lastDrillDate && emergency.nextDrillDate) {
          if (emergency.nextDrillDate <= emergency.lastDrillDate) {
            throw new Error('La próxima fecha de simulacro debe ser posterior a la última');
          }
        }
        
        // Validar fechas de evaluación
        if (emergency.lastEmergencyAssessment && emergency.nextEmergencyAssessment) {
          if (emergency.nextEmergencyAssessment <= emergency.lastEmergencyAssessment) {
            throw new Error('La próxima evaluación debe ser posterior a la última');
          }
        }
      }
    },
    comment: 'Plan de emergencias del rancho'
  }
);

export default RanchEmergency;