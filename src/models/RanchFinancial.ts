// src/models/ranch/RanchFinancial.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Ranch from './Ranch';

export interface OperatingCosts {
  feed: number;
  labor: number;
  veterinary: number;
  utilities: number;
  maintenance: number;
  insurance: number;
  taxes: number;
  other: number;
  currency: string;
}

export interface RevenueStream {
  source: string;
  percentage: number;
  amount: number;
  description?: string;
}

export interface RanchFinancialAttributes {
  id: string;
  ranchId: string;
  fiscalYear: number;
  annualRevenue?: number;
  annualExpenses?: number;
  netProfit?: number;
  profitMargin?: number;
  roi?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  equity?: number;
  cashFlow?: number;
  debtToEquityRatio?: number;
  operatingCosts: OperatingCosts;
  revenueStreams: RevenueStream[];
  budgetYear: number;
  lastFinancialAudit?: Date;
  auditor?: string;
  notes?: string;

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface RanchFinancialCreationAttributes
  extends Optional<RanchFinancialAttributes,
    'id' | 'annualRevenue' | 'annualExpenses' | 'netProfit' | 'profitMargin' |
    'roi' | 'totalAssets' | 'totalLiabilities' | 'equity' | 'cashFlow' |
    'debtToEquityRatio' | 'lastFinancialAudit' | 'auditor' | 'notes' |
    'deletedAt'
  > {}

class RanchFinancial extends Model<RanchFinancialAttributes, RanchFinancialCreationAttributes>
  implements RanchFinancialAttributes {
  
  public id!: string;
  public ranchId!: string;
  public fiscalYear!: number;
  public annualRevenue?: number;
  public annualExpenses?: number;
  public netProfit?: number;
  public profitMargin?: number;
  public roi?: number;
  public totalAssets?: number;
  public totalLiabilities?: number;
  public equity?: number;
  public cashFlow?: number;
  public debtToEquityRatio?: number;
  public operatingCosts!: OperatingCosts;
  public revenueStreams!: RevenueStream[];
  public budgetYear!: number;
  public lastFinancialAudit?: Date;
  public auditor?: string;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

RanchFinancial.init(
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
    fiscalYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 2000, max: 2100 },
      comment: 'Año fiscal'
    },
    annualRevenue: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Ingresos anuales'
    },
    annualExpenses: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Gastos anuales'
    },
    netProfit: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
      comment: 'Ganancia neta'
    },
    profitMargin: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: { min: -100, max: 100 },
      comment: 'Margen de ganancia (%)'
    },
    roi: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: { min: -100, max: 1000 },
      comment: 'Retorno de inversión (%)'
    },
    totalAssets: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Activos totales'
    },
    totalLiabilities: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Pasivos totales'
    },
    equity: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Patrimonio'
    },
    cashFlow: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
      comment: 'Flujo de caja'
    },
    debtToEquityRatio: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Relación deuda/patrimonio'
    },
    operatingCosts: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidCosts(value: OperatingCosts) {
          if (!value.feed || !value.labor || !value.currency) {
            throw new Error('Costos de alimentación, laborales y moneda son requeridos');
          }
        }
      },
      comment: 'Costos operativos'
    },
    revenueStreams: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidStreams(value: RevenueStream[]) {
          if (!value || value.length === 0) {
            throw new Error('Al menos una fuente de ingresos es requerida');
          }
          const total = value.reduce((sum, s) => sum + s.percentage, 0);
          if (Math.abs(total - 100) > 0.01) {
            throw new Error('La suma de porcentajes debe ser 100%');
          }
        }
      },
      comment: 'Fuentes de ingresos'
    },
    budgetYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 2000, max: 2100 },
      comment: 'Año del presupuesto'
    },
    lastFinancialAudit: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Última auditoría financiera'
    },
    auditor: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Auditor'
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
    modelName: 'RanchFinancial',
    tableName: 'ranch_financials',
    timestamps: true,
    paranoid: true,
    indexes: [
      { unique: true, fields: ['ranch_id', 'fiscal_year'] },
      { fields: ['fiscal_year'] }
    ],
    hooks: {
      beforeSave: async (financial: RanchFinancial) => {
        // Calcular netProfit si no está definido pero sí ingresos y gastos
        if (financial.annualRevenue && financial.annualExpenses && !financial.netProfit) {
          financial.netProfit = financial.annualRevenue - financial.annualExpenses;
        }
        
        // Calcular profitMargin si es posible
        if (financial.netProfit && financial.annualRevenue && financial.annualRevenue > 0 && !financial.profitMargin) {
          financial.profitMargin = (financial.netProfit / financial.annualRevenue) * 100;
        }
      }
    },
    comment: 'Información financiera del rancho por año fiscal'
  }
);

export default RanchFinancial;