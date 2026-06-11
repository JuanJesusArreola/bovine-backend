// src/models/ranch/RanchSustainability.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Ranch from './Ranch';

// Enums específicos
export enum ManureManagement {
  COMPOSTING = 'COMPOSTING',
  BIOGAS = 'BIOGAS',
  DIRECT_APPLICATION = 'DIRECT_APPLICATION',
  LAGOON = 'LAGOON'
}

export enum MitigationMeasure {
  ROTATIONAL_GRAZING = 'ROTATIONAL_GRAZING',
  SILVOPASTURE = 'SILVOPASTURE',
  RIPARIAN_BUFFERS = 'RIPARIAN_BUFFERS',
  COVER_CROPS = 'COVER_CROPS',
  NO_TILL = 'NO_TILL',
  INTEGRATED_PEST_MANAGEMENT = 'INTEGRATED_PEST_MANAGEMENT',
  WATER_HARVESTING = 'WATER_HARVESTING',
  SOLAR_PANELS = 'SOLAR_PANELS',
  WIND_TURBINES = 'WIND_TURBINES',
  BIOGAS_RECOVERY = 'BIOGAS_RECOVERY',
  CARBON_SEQUESTRATION = 'CARBON_SEQUESTRATION'
}

export enum AdaptationStrategy {
  DROUGHT_TOLERANT_FORAGE = 'DROUGHT_TOLERANT_FORAGE',
  EARLY_WARNING_SYSTEMS = 'EARLY_WARNING_SYSTEMS',
  WATER_STORAGE = 'WATER_STORAGE',
  SHADE_STRUCTURES = 'SHADE_STRUCTURES',
  VENTILATION_SYSTEMS = 'VENTILATION_SYSTEMS',
  CROP_DIVERSIFICATION = 'CROP_DIVERSIFICATION',
  GENETIC_SELECTION = 'GENETIC_SELECTION'
}

// Interfaces para estructuras complejas
export interface WasteManagement {
  manureManagement: ManureManagement;
  wasteReduction: number;      // Porcentaje
  recyclingRate: number;       // Porcentaje
  waterTreatment?: string;
  mortalityComposting?: boolean;
  packagingRecycling?: boolean;
}

export interface ClimateAdaptation {
  risks: string[];                     // Riesgos identificados
  mitigationMeasures: MitigationMeasure[];  // Medidas de mitigación
  adaptationStrategies: AdaptationStrategy[]; // Estrategias de adaptación
  riskAssessment?: string;              // Evaluación de riesgos
  emergencyPlan?: string;               // Plan de contingencia
}

export interface SustainabilityGoal {
  goal: string;
  targetDate: Date;
  progress: number;            // Porcentaje (0-100)
  metrics: string;
  baseline?: number;           // Valor inicial
  currentValue?: number;       // Valor actual
  targetValue?: number;        // Valor objetivo
  status: 'ON_TRACK' | 'BEHIND' | 'COMPLETED' | 'CANCELLED';
}

// Atributos del modelo
export interface RanchSustainabilityAttributes {
  ranchId: string;                    // PK y FK (1:1)
  
  // Métricas generales
  carbonFootprint?: number;            // toneladas CO2/año
  waterUsageEfficiency?: number;       // litros/animal/día o similar
  energyConsumption?: number;          // kWh/año
  renewableEnergyPercentage?: number;  // Porcentaje (0-100)
  
  // Manejo de residuos
  wasteManagement: WasteManagement;
  
  // Biodiversidad y suelo
  biodiversityIndex?: number;          // 0-10
  soilHealthScore?: number;            // 0-100
  conservationPractices: string[];     // Prácticas de conservación
  nativeVegetationArea?: number;       // Hectáreas
  wildlifeCorridors?: boolean;
  
  // Certificaciones ambientales
  environmentalCertifications: string[]; // Lista de certificaciones
  
  // Metas
  sustainabilityGoals: SustainabilityGoal[];
  
  // Adaptación climática
  climateAdaptation: ClimateAdaptation;
  
  // Monitoreo
  lastAssessmentDate?: Date;
  nextAssessmentDate?: Date;
  assessedBy?: string;
  
  // Metadatos
  notes?: string;
  
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

// Atributos opcionales al crear
export interface RanchSustainabilityCreationAttributes
  extends Optional<RanchSustainabilityAttributes,
    'carbonFootprint' | 'waterUsageEfficiency' | 'energyConsumption' |
    'renewableEnergyPercentage' | 'biodiversityIndex' | 'soilHealthScore' |
    'nativeVegetationArea' | 'wildlifeCorridors' | 'lastAssessmentDate' |
    'nextAssessmentDate' | 'assessedBy' | 'notes' | 'deletedAt'
  > {}

// Clase del modelo
class RanchSustainability extends Model<RanchSustainabilityAttributes, RanchSustainabilityCreationAttributes>
  implements RanchSustainabilityAttributes {
  
  public ranchId!: string;
  
  public carbonFootprint?: number;
  public waterUsageEfficiency?: number;
  public energyConsumption?: number;
  public renewableEnergyPercentage?: number;
  
  public wasteManagement!: WasteManagement;
  
  public biodiversityIndex?: number;
  public soilHealthScore?: number;
  public conservationPractices!: string[];
  public nativeVegetationArea?: number;
  public wildlifeCorridors?: boolean;
  
  public environmentalCertifications!: string[];
  
  public sustainabilityGoals!: SustainabilityGoal[];
  
  public climateAdaptation!: ClimateAdaptation;
  
  public lastAssessmentDate?: Date;
  public nextAssessmentDate?: Date;
  public assessedBy?: string;
  
  public notes?: string;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

// Inicialización
RanchSustainability.init(
  {
    ranchId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      references: { model: 'ranches', key: 'id' },
      comment: 'ID del rancho (PK y FK 1:1)'
    },
    carbonFootprint: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Huella de carbono (toneladas CO2/año)'
    },
    waterUsageEfficiency: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Eficiencia del uso de agua (L/animal/día)'
    },
    energyConsumption: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Consumo de energía (kWh/año)'
    },
    renewableEnergyPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: { min: 0, max: 100 },
      comment: 'Porcentaje de energía renovable'
    },
    wasteManagement: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidWasteManagement(value: WasteManagement) {
          if (!value.manureManagement) {
            throw new Error('Tipo de manejo de estiércol es requerido');
          }
          if (value.wasteReduction < 0 || value.wasteReduction > 100) {
            throw new Error('La reducción de residuos debe estar entre 0 y 100');
          }
          if (value.recyclingRate < 0 || value.recyclingRate > 100) {
            throw new Error('La tasa de reciclaje debe estar entre 0 y 100');
          }
        }
      },
      comment: 'Manejo de residuos'
    },
    biodiversityIndex: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: true,
      validate: { min: 0, max: 10 },
      comment: 'Índice de biodiversidad (0-10)'
    },
    soilHealthScore: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0, max: 100 },
      comment: 'Puntuación de salud del suelo (0-100)'
    },
    conservationPractices: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
      comment: 'Prácticas de conservación'
    },
    nativeVegetationArea: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Área de vegetación nativa (hectáreas)'
    },
    wildlifeCorridors: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: 'Posee corredores de vida silvestre'
    },
    environmentalCertifications: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
      comment: 'Certificaciones ambientales'
    },
    sustainabilityGoals: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidGoals(value: SustainabilityGoal[]) {
          if (value) {
            value.forEach((goal, index) => {
              if (!goal.goal || !goal.targetDate || goal.progress === undefined) {
                throw new Error(`Meta ${index} incompleta`);
              }
              if (goal.progress < 0 || goal.progress > 100) {
                throw new Error(`Progreso de meta ${index} debe estar entre 0 y 100`);
              }
            });
          }
        }
      },
      comment: 'Metas de sostenibilidad'
    },
    climateAdaptation: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidClimateAdaptation(value: ClimateAdaptation) {
          if (!value.risks || !value.mitigationMeasures || !value.adaptationStrategies) {
            throw new Error('Riesgos, medidas y estrategias son requeridos');
          }
        }
      },
      comment: 'Adaptación al cambio climático'
    },
    lastAssessmentDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de última evaluación'
    },
    nextAssessmentDate: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        isAfterLast(value: Date) {
          if (value && this.lastAssessmentDate && value <= this.lastAssessmentDate) {
            throw new Error('La próxima evaluación debe ser posterior a la última');
          }
        }
      },
      comment: 'Fecha de próxima evaluación'
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
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'RanchSustainability',
    tableName: 'ranch_sustainability',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['last_assessment_date'] },
      { fields: ['next_assessment_date'] },
      { fields: ['carbon_footprint'] },
      { name: 'ranch_sustainability_energy', fields: ['energy_consumption', 'renewable_energy_percentage'] }
    ],
    hooks: {
      beforeSave: async (sustainability: RanchSustainability) => {
        // Actualizar progreso de metas automáticamente si tienen valores actuales
        if (sustainability.sustainabilityGoals) {
          sustainability.sustainabilityGoals = sustainability.sustainabilityGoals.map(goal => {
            if (goal.currentValue !== undefined && goal.targetValue !== undefined && goal.targetValue > 0) {
              const progress = (goal.currentValue / goal.targetValue) * 100;
              goal.progress = Math.min(100, Math.max(0, progress));
              
              // Actualizar estado basado en progreso
              if (goal.progress >= 100) {
                goal.status = 'COMPLETED';
              } else if (goal.targetDate < new Date()) {
                goal.status = 'BEHIND';
              } else {
                goal.status = 'ON_TRACK';
              }
            }
            return goal;
          });
        }
      }
    },
    comment: 'Información de sostenibilidad y medio ambiente del rancho'
  }
);

export default RanchSustainability;