// src/models/ranch/RanchInsurance.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Ranch from './Ranch';

// Enums
export enum InsuranceType {
  PROPERTY = 'PROPERTY',                       // Seguro de propiedad
  LIABILITY = 'LIABILITY',                      // Responsabilidad civil
  LIVESTOCK = 'LIVESTOCK',                      // Seguro de ganado
  CROP = 'CROP',                                // Seguro de cultivos
  EQUIPMENT = 'EQUIPMENT',                      // Seguro de equipo
  WORKERS_COMP = 'WORKERS_COMP',                 // Compensación laboral
  BUSINESS_INTERRUPTION = 'BUSINESS_INTERRUPTION', // Interrupción de negocio
  ENVIRONMENTAL = 'ENVIRONMENTAL',               // Seguro ambiental
  TRANSPORT = 'TRANSPORT',                       // Seguro de transporte
  HEALTH = 'HEALTH',                             // Seguro de salud para empleados
  LIFE = 'LIFE',                                 // Seguro de vida
  KEY_PERSON = 'KEY_PERSON',                     // Seguro de persona clave
  PRODUCT_LIABILITY = 'PRODUCT_LIABILITY',       // Responsabilidad de producto
  FLOOD = 'FLOOD',                               // Seguro contra inundaciones
  FIRE = 'FIRE',                                 // Seguro contra incendios
  DROUGHT = 'DROUGHT',                           // Seguro contra sequía
  OTHER = 'OTHER'
}

export enum InsuranceStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  PENDING = 'PENDING',
  CLAIM = 'CLAIM'
}

export enum CoverageUnit {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED'
}

// Interfaces
export interface Beneficiary {
  name: string;
  relationship: string;
  percentage: number;
  contact?: string;
}

export interface CoverageDetail {
  item: string;
  coverageAmount: number;
  deductible?: number;
  limit?: number;
  description?: string;
}

// Atributos del modelo
export interface RanchInsuranceAttributes {
  id: string;
  ranchId: string;
  
  type: InsuranceType;
  provider: string;
  policyNumber: string;
  
  startDate: Date;
  endDate: Date;
  status: InsuranceStatus;
  
  // Cobertura
  coverageAmount: number;
  coverageUnit: CoverageUnit;
  deductible?: number;
  premium: number;
  currency: string;
  
  // Detalles de cobertura
  coverageDetails?: CoverageDetail[];
  beneficiaries?: Beneficiary[];
  
  // Ámbito
  coveredLocations?: string[];           // IDs de ubicaciones cubiertas
  coveredAssets?: string[];               // IDs de activos cubiertos
  coveredLivestock?: {
    types: string[];
    count?: number;
    value?: number;
  };
  
  // Contacto
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  
  // Documentos
  policyDocumentUrl?: string;
  claimForms?: string[];
  
  // Reclamaciones
  claimsCount?: number;
  lastClaimDate?: Date;
  totalClaimedAmount?: number;
  
  // Renovación
  autoRenewal: boolean;
  renewalDate?: Date;
  renewalPremium?: number;
  
  // Metadatos
  notes?: string;
  
  createdBy: string;
  updatedBy?: string;

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface RanchInsuranceCreationAttributes
  extends Optional<RanchInsuranceAttributes,
    'id' | 'deductible' | 'coverageDetails' | 'beneficiaries' |
    'coveredLocations' | 'coveredAssets' | 'coveredLivestock' |
    'agentName' | 'agentPhone' | 'agentEmail' | 'policyDocumentUrl' |
    'claimForms' | 'claimsCount' | 'lastClaimDate' | 'totalClaimedAmount' |
    'renewalDate' | 'renewalPremium' | 'notes' | 'updatedBy' |
    'deletedAt'
  > {}

class RanchInsurance extends Model<RanchInsuranceAttributes, RanchInsuranceCreationAttributes>
  implements RanchInsuranceAttributes {
  
  public id!: string;
  public ranchId!: string;
  
  public type!: InsuranceType;
  public provider!: string;
  public policyNumber!: string;
  
  public startDate!: Date;
  public endDate!: Date;
  public status!: InsuranceStatus;
  
  public coverageAmount!: number;
  public coverageUnit!: CoverageUnit;
  public deductible?: number;
  public premium!: number;
  public currency!: string;
  
  public coverageDetails?: CoverageDetail[];
  public beneficiaries?: Beneficiary[];
  
  public coveredLocations?: string[];
  public coveredAssets?: string[];
  public coveredLivestock?: {
    types: string[];
    count?: number;
    value?: number;
  };
  
  public agentName?: string;
  public agentPhone?: string;
  public agentEmail?: string;
  
  public policyDocumentUrl?: string;
  public claimForms?: string[];
  
  public claimsCount?: number;
  public lastClaimDate?: Date;
  public totalClaimedAmount?: number;
  
  public autoRenewal!: boolean;
  public renewalDate?: Date;
  public renewalPremium?: number;
  
  public notes?: string;
  
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

RanchInsurance.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del seguro'
    },
    ranchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'ranches', key: 'id' },
      comment: 'ID del rancho'
    },
    type: {
      type: DataTypes.ENUM(...Object.values(InsuranceType)),
      allowNull: false,
    },
    provider: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Proveedor/Aseguradora'
    },
    policyNumber: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Número de póliza'
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        isBefore: new Date().toISOString().split('T')[0]
      },
      comment: 'Fecha de inicio'
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isAfterStart(value: string) {
          if (new Date(value as string) <= new Date(this.startDate as string)) {
            throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
          }
        }
      },
      comment: 'Fecha de fin'
    },
    status: {
      type: DataTypes.ENUM(...Object.values(InsuranceStatus)),
      allowNull: false,
      defaultValue: InsuranceStatus.ACTIVE,
    },
    coverageAmount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      validate: { min: 0 },
      comment: 'Monto de cobertura'
    },
    coverageUnit: {
      type: DataTypes.ENUM(...Object.values(CoverageUnit)),
      allowNull: false,
      defaultValue: CoverageUnit.FIXED,
    },
    deductible: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Deducible'
    },
    premium: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: { min: 0 },
      comment: 'Prima'
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'MXN',
      comment: 'Moneda'
    },
    coverageDetails: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Detalles de cobertura'
    },
    beneficiaries: {
      type: DataTypes.JSONB,
      allowNull: true,
      validate: {
        isValidBeneficiaries(value: Beneficiary[]) {
          if (value) {
            const total = value.reduce((sum, b) => sum + b.percentage, 0);
            if (Math.abs(total - 100) > 0.01) {
              throw new Error('La suma de porcentajes de beneficiarios debe ser 100%');
            }
          }
        }
      },
      comment: 'Beneficiarios'
    },
    coveredLocations: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: true,
      comment: 'IDs de ubicaciones cubiertas'
    },
    coveredAssets: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: true,
      comment: 'IDs de activos cubiertos'
    },
    coveredLivestock: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Ganado cubierto'
    },
    agentName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Nombre del agente'
    },
    agentPhone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Teléfono del agente'
    },
    agentEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: { isEmail: true },
      comment: 'Email del agente'
    },
    policyDocumentUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: { isUrl: true },
      comment: 'URL de la póliza'
    },
    claimForms: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: 'URLs de formularios de reclamación'
    },
    claimsCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      validate: { min: 0 },
      comment: 'Número de reclamaciones'
    },
    lastClaimDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de última reclamación'
    },
    totalClaimedAmount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Monto total reclamado'
    },
    autoRenewal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: '¿Renovación automática?'
    },
    renewalDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha de renovación'
    },
    renewalPremium: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Prima de renovación'
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
    modelName: 'RanchInsurance',
    tableName: 'ranch_insurances',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['ranch_id', 'type'], unique: true },
      { fields: ['ranch_id'] },
      { fields: ['type'] },
      { fields: ['status'] },
      { fields: ['end_date'] },
      { fields: ['provider'] },
      { name: 'insurances_expiring', fields: ['end_date', 'status'] }
    ],
    hooks: {
      beforeSave: async (insurance: RanchInsurance) => {
        // Actualizar estado basado en fecha de fin
        if (insurance.endDate < new Date() && insurance.status === InsuranceStatus.ACTIVE) {
          insurance.status = InsuranceStatus.EXPIRED;
        }
        
        // Validar que renewalDate sea posterior a endDate
        if (insurance.renewalDate && insurance.renewalDate <= insurance.endDate) {
          throw new Error('La fecha de renovación debe ser posterior a la fecha de fin');
        }
      }
    },
    comment: 'Seguros del rancho'
  }
);

export default RanchInsurance;