// src/models/ranch/RanchTechnology.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Ranch from './Ranch';

// Enums
export enum AutomationLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  FULLY_AUTOMATED = 'FULLY_AUTOMATED'
}

export enum DataStorage {
  LOCAL = 'LOCAL',
  CLOUD = 'CLOUD',
  HYBRID = 'HYBRID'
}

export enum ReportingFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL'
}

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  IMPLEMENTATION = 'IMPLEMENTATION',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

// Interfaces
export interface DigitalSolution {
  type: string;
  provider: string;
  implementationDate: Date;
  status: 'ACTIVE' | 'INACTIVE' | 'TESTING';
  cost?: number;
  license?: string;
  renewalDate?: Date;
  users?: number;
}

export interface PrecisionAgriculture {
  gpsGuidedEquipment: boolean;
  soilMapping: boolean;
  variableRateApplication: boolean;
  droneSurveillance: boolean;
  satelliteMonitoring: boolean;
  yieldMapping?: boolean;
  automatedIrrigation?: boolean;
}

export interface IoTDevice {
  type: string;
  brand: string;
  quantity: number;
  purpose: string;
  lastUpdate: Date;
  model?: string;
  firmware?: string;
  connectivity?: 'WIFI' | 'CELLULAR' | 'LORA' | 'SATELLITE';
  batteryLife?: number; // días
}

export interface DataManagement {
  dataCollection: string[];
  dataStorage: DataStorage;
  analyticsTools: string[];
  reportingFrequency: ReportingFrequency;
  dataIntegration?: boolean;
  apiAccess?: boolean;
  dataVisualization?: boolean;
  machineLearning?: boolean;
}

export interface InnovationProject {
  name: string;
  description: string;
  status: ProjectStatus;
  budget: number;
  expectedBenefits: string;
  startDate?: Date;
  endDate?: Date;
  responsible?: string;
  results?: string;
}

// Atributos del modelo
export interface RanchTechnologyAttributes {
  ranchId: string;                    // PK y FK (1:1)
  
  automationLevel: AutomationLevel;
  
  digitalSolutions: DigitalSolution[];
  
  precisionAgriculture: PrecisionAgriculture;
  
  iotDevices: IoTDevice[];
  
  dataManagement: DataManagement;
  
  innovationProjects: InnovationProject[];
  
  // Infraestructura tecnológica
  hasInternet: boolean;
  internetSpeed?: number;              // Mbps
  hasCctv: boolean;
  hasAutomatedGates: boolean;
  hasAutomatedFeeders: boolean;
  hasAutomatedWaterers: boolean;
  hasWeatherStation: boolean;
  
  // Conectividad
  cellularCoverage?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NONE';
  satelliteInternet?: boolean;
  fiberOptic?: boolean;
  
  // Presupuesto tecnológico
  annualTechBudget?: number;            // Moneda local
  techInvestmentLastYear?: number;
  techInvestmentNextYear?: number;
  
  // Evaluación
  lastTechAudit?: Date;
  nextTechAudit?: Date;
  techReadinessLevel?: 1 | 2 | 3 | 4 | 5; // 1-5 (madurez tecnológica)
  
  notes?: string;
  
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface RanchTechnologyCreationAttributes
  extends Optional<RanchTechnologyAttributes,
    'internetSpeed' | 'cellularCoverage' | 'satelliteInternet' | 'fiberOptic' |
    'annualTechBudget' | 'techInvestmentLastYear' | 'techInvestmentNextYear' |
    'lastTechAudit' | 'nextTechAudit' | 'techReadinessLevel' | 'notes' |
    'deletedAt'
  > {}

class RanchTechnology extends Model<RanchTechnologyAttributes, RanchTechnologyCreationAttributes>
  implements RanchTechnologyAttributes {
  
  public ranchId!: string;
  
  public automationLevel!: AutomationLevel;
  public digitalSolutions!: DigitalSolution[];
  public precisionAgriculture!: PrecisionAgriculture;
  public iotDevices!: IoTDevice[];
  public dataManagement!: DataManagement;
  public innovationProjects!: InnovationProject[];
  
  public hasInternet!: boolean;
  public internetSpeed?: number;
  public hasCctv!: boolean;
  public hasAutomatedGates!: boolean;
  public hasAutomatedFeeders!: boolean;
  public hasAutomatedWaterers!: boolean;
  public hasWeatherStation!: boolean;
  
  public cellularCoverage?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NONE';
  public satelliteInternet?: boolean;
  public fiberOptic?: boolean;
  
  public annualTechBudget?: number;
  public techInvestmentLastYear?: number;
  public techInvestmentNextYear?: number;
  
  public lastTechAudit?: Date;
  public nextTechAudit?: Date;
  public techReadinessLevel?: 1 | 2 | 3 | 4 | 5;
  
  public notes?: string;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

RanchTechnology.init(
  {
    ranchId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      references: { model: 'ranches', key: 'id' },
      comment: 'ID del rancho (PK y FK 1:1)'
    },
    automationLevel: {
      type: DataTypes.ENUM(...Object.values(AutomationLevel)),
      allowNull: false,
      defaultValue: AutomationLevel.LOW,
    },
    digitalSolutions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidSolutions(value: DigitalSolution[]) {
          value.forEach((sol, index) => {
            if (!sol.type || !sol.provider || !sol.implementationDate) {
              throw new Error(`Solución digital ${index} incompleta`);
            }
          });
        }
      },
      comment: 'Soluciones digitales implementadas'
    },
    precisionAgriculture: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidPrecision(value: PrecisionAgriculture) {
          // No hay validación específica, solo estructura
        }
      },
      comment: 'Agricultura de precisión'
    },
    iotDevices: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Dispositivos IoT'
    },
    dataManagement: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidDataManagement(value: DataManagement) {
          if (!value.dataStorage) {
            throw new Error('Tipo de almacenamiento de datos requerido');
          }
          if (!value.reportingFrequency) {
            throw new Error('Frecuencia de reportes requerida');
          }
        }
      },
      comment: 'Manejo de datos'
    },
    innovationProjects: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Proyectos de innovación'
    },
    hasInternet: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Tiene acceso a internet'
    },
    internetSpeed: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
      comment: 'Velocidad de internet en Mbps'
    },
    hasCctv: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Tiene sistema de cámaras'
    },
    hasAutomatedGates: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Tiene puertas automáticas'
    },
    hasAutomatedFeeders: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Tiene comederos automáticos'
    },
    hasAutomatedWaterers: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Tiene bebederos automáticos'
    },
    hasWeatherStation: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Tiene estación meteorológica'
    },
    cellularCoverage: {
      type: DataTypes.ENUM('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'NONE'),
      allowNull: true,
    },
    satelliteInternet: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: 'Tiene internet satelital'
    },
    fiberOptic: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: 'Tiene fibra óptica'
    },
    annualTechBudget: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Presupuesto anual de tecnología'
    },
    techInvestmentLastYear: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Inversión en tecnología año anterior'
    },
    techInvestmentNextYear: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Inversión planeada en tecnología próximo año'
    },
    lastTechAudit: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Última auditoría tecnológica'
    },
    nextTechAudit: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Próxima auditoría tecnológica'
    },
    techReadinessLevel: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 },
      comment: 'Nivel de madurez tecnológica (1-5)'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'RanchTechnology',
    tableName: 'ranch_technologies',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['automation_level'] },
      { fields: ['has_internet'] },
      { fields: ['tech_readiness_level'] },
      { fields: ['last_tech_audit', 'next_tech_audit'] }
    ],
    hooks: {
      beforeSave: async (tech: RanchTechnology) => {
        // Validar consistencia de fechas de auditoría
        if (tech.lastTechAudit && tech.nextTechAudit) {
          if (tech.nextTechAudit <= tech.lastTechAudit) {
            throw new Error('La próxima auditoría debe ser posterior a la última');
          }
        }
        
        // Si tiene internet, sugerir velocidad mínima (solo validación)
        if (tech.hasInternet && tech.internetSpeed && tech.internetSpeed < 1) {
          console.warn('Velocidad de internet muy baja (< 1 Mbps)');
        }
      }
    },
    comment: 'Información de tecnología e innovación del rancho'
  }
);

export default RanchTechnology;