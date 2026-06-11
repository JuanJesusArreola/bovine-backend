// src/models/ranch/RanchProduction.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Ranch from './Ranch';

export interface MilkQuality {
  fatContent: number;
  proteinContent: number;
  somaticCellCount: number;
  lactoseContent?: number;
  urea?: number;
  temperature?: number;
}

export interface RanchProductionAttributes {
  id: string;
  ranchId: string;
  year: number;
  annualMilkProduction?: number;
  averageMilkPerCow?: number;
  milkQualityAverage?: MilkQuality;
  annualMeatProduction?: number;
  averageWeightGain?: number;
  calvingRate?: number;
  calvingInterval?: number;
  mortalityRate?: number;
  cullingRate?: number;
  feedConversionRatio?: number;
  reproductiveEfficiency?: number;
  healthIncidenceRate?: number;
  vaccinationCoverage?: number;
  antibioticUsage?: number;
  organicMatterProduction?: number;
  notes?: string;

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface RanchProductionCreationAttributes
  extends Optional<RanchProductionAttributes,
    'id' | 'annualMilkProduction' | 'averageMilkPerCow' | 'milkQualityAverage' |
    'annualMeatProduction' | 'averageWeightGain' | 'calvingRate' |
    'calvingInterval' | 'mortalityRate' | 'cullingRate' |
    'feedConversionRatio' | 'reproductiveEfficiency' | 'healthIncidenceRate' |
    'vaccinationCoverage' | 'antibioticUsage' | 'organicMatterProduction' |
    'notes' | 'deletedAt'
  > {}

class RanchProduction extends Model<RanchProductionAttributes, RanchProductionCreationAttributes>
  implements RanchProductionAttributes {
  
  public id!: string;
  public ranchId!: string;
  public year!: number;
  public annualMilkProduction?: number;
  public averageMilkPerCow?: number;
  public milkQualityAverage?: MilkQuality;
  public annualMeatProduction?: number;
  public averageWeightGain?: number;
  public calvingRate?: number;
  public calvingInterval?: number;
  public mortalityRate?: number;
  public cullingRate?: number;
  public feedConversionRatio?: number;
  public reproductiveEfficiency?: number;
  public healthIncidenceRate?: number;
  public vaccinationCoverage?: number;
  public antibioticUsage?: number;
  public organicMatterProduction?: number;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

RanchProduction.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    ranchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'ranches', key: 'id' },
      comment: 'ID del rancho'
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 2000,
        max: 2100
      },
      comment: 'Año de las métricas'
    },
    annualMilkProduction: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Producción anual de leche (litros)'
    },
    averageMilkPerCow: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Promedio de leche por vaca (L/día)'
    },
    milkQualityAverage: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Calidad promedio de leche'
    },
    annualMeatProduction: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Producción anual de carne (kg)'
    },
    averageWeightGain: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Ganancia de peso promedio (kg/día)'
    },
    calvingRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: { min: 0, max: 100 },
      comment: 'Tasa de partos (%)'
    },
    calvingInterval: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
      comment: 'Intervalo entre partos (días)'
    },
    mortalityRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: { min: 0, max: 100 },
      comment: 'Tasa de mortalidad (%)'
    },
    cullingRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: { min: 0, max: 100 },
      comment: 'Tasa de descarte (%)'
    },
    feedConversionRatio: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Conversión alimenticia'
    },
    reproductiveEfficiency: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: { min: 0, max: 100 },
      comment: 'Eficiencia reproductiva (%)'
    },
    healthIncidenceRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: { min: 0, max: 100 },
      comment: 'Incidencia de enfermedades (%)'
    },
    vaccinationCoverage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: { min: 0, max: 100 },
      comment: 'Cobertura de vacunación (%)'
    },
    antibioticUsage: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Uso de antibióticos (días/animal/año)'
    },
    organicMatterProduction: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Producción de materia orgánica (ton/año)'
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
    modelName: 'RanchProduction',
    tableName: 'ranch_productions',
    timestamps: true,
    paranoid: true,
    indexes: [
      { unique: true, fields: ['ranch_id', 'year'] },
      { fields: ['year'] }
    ],
    comment: 'Métricas de producción del rancho por año'
  }
);

export default RanchProduction;