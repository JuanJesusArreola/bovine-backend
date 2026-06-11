// src/models/ranch/RanchCertification.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Ranch from './Ranch';

// Enums
export enum CertificationType {
  ORGANIC = 'ORGANIC',
  FAIR_TRADE = 'FAIR_TRADE',
  ANIMAL_WELFARE = 'ANIMAL_WELFARE',
  ENVIRONMENTAL = 'ENVIRONMENTAL',
  QUALITY_ASSURANCE = 'QUALITY_ASSURANCE',
  HALAL = 'HALAL',
  KOSHER = 'KOSHER',
  NON_GMO = 'NON_GMO',
  SUSTAINABLE = 'SUSTAINABLE',
  CARBON_NEUTRAL = 'CARBON_NEUTRAL',
  GRASS_FED = 'GRASS_FED',
  ANTIBIOTIC_FREE = 'ANTIBIOTIC_FREE',
  HORMONE_FREE = 'HORMONE_FREE',
  GLOBAL_GAP = 'GLOBAL_GAP',
  RAINFOREST_ALLIANCE = 'RAINFOREST_ALLIANCE',
  UTZ = 'UTZ',
  BRCGS = 'BRCGS',
  IFS = 'IFS',
  SQF = 'SQF',
  PRIMUS_GFS = 'PRIMUS_GFS'
}

export enum CertificationStatus {
  VALID = 'VALID',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
  REVOKED = 'REVOKED',
  APPLICATION = 'APPLICATION'
}

// Atributos del modelo
export interface RanchCertificationAttributes {
  id: string;
  ranchId: string;
  
  type: CertificationType;
  certifyingBody: string;
  certificateNumber: string;
  
  issueDate: Date;
  expirationDate: Date;
  status: CertificationStatus;
  
  // Alcance de la certificación
  scope?: string;                    // Qué cubre la certificación
  products?: string[];                // Productos certificados
  locations?: string[];               // Ubicaciones específicas (IDs)
  
  // Documentos
  certificateUrl?: string;
  auditReportUrl?: string;
  documents?: string[];                // Otros documentos
  
  // Auditoría
  lastAuditDate?: Date;
  nextAuditDate?: Date;
  auditor?: string;
  auditScore?: number;                 // Puntaje de auditoría (si aplica)
  
  // Costos
  cost?: number;                        // Costo de la certificación
  currency?: string;                    // Moneda
  
  // Responsable
  responsiblePerson?: string;            // Persona responsable
  contactEmail?: string;
  contactPhone?: string;
  
  // Metadatos
  notes?: string;
  
  createdBy: string;
  updatedBy?: string;

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface RanchCertificationCreationAttributes
  extends Optional<RanchCertificationAttributes,
    'id' | 'scope' | 'products' | 'locations' | 'certificateUrl' |
    'auditReportUrl' | 'documents' | 'lastAuditDate' | 'nextAuditDate' |
    'auditor' | 'auditScore' | 'cost' | 'currency' | 'responsiblePerson' |
    'contactEmail' | 'contactPhone' | 'notes' | 'updatedBy' |
    'deletedAt'
  > {}

class RanchCertification extends Model<RanchCertificationAttributes, RanchCertificationCreationAttributes>
  implements RanchCertificationAttributes {
  
  public id!: string;
  public ranchId!: string;
  
  public type!: CertificationType;
  public certifyingBody!: string;
  public certificateNumber!: string;
  
  public issueDate!: Date;
  public expirationDate!: Date;
  public status!: CertificationStatus;
  
  public scope?: string;
  public products?: string[];
  public locations?: string[];
  
  public certificateUrl?: string;
  public auditReportUrl?: string;
  public documents?: string[];
  
  public lastAuditDate?: Date;
  public nextAuditDate?: Date;
  public auditor?: string;
  public auditScore?: number;
  
  public cost?: number;
  public currency?: string;
  
  public responsiblePerson?: string;
  public contactEmail?: string;
  public contactPhone?: string;
  
  public notes?: string;
  
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

RanchCertification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único de la certificación'
    },
    ranchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'ranches', key: 'id' },
      comment: 'ID del rancho'
    },
    type: {
      type: DataTypes.ENUM(...Object.values(CertificationType)),
      allowNull: false,
    },
    certifyingBody: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Entidad certificadora'
    },
    certificateNumber: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Número de certificado'
    },
    issueDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        isBefore: new Date().toISOString().split('T')[0]
      },
      comment: 'Fecha de emisión'
    },
    expirationDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isAfterIssue(value: string) {
          if (new Date(value as string) <= new Date(this.issueDate as string)) {
            throw new Error('La fecha de expiración debe ser posterior a la emisión');
          }
        }
      },
      comment: 'Fecha de expiración'
    },
    status: {
      type: DataTypes.ENUM(...Object.values(CertificationStatus)),
      allowNull: false,
      defaultValue: CertificationStatus.VALID,
    },
    scope: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Alcance de la certificación'
    },
    products: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: 'Productos certificados'
    },
    locations: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: true,
      comment: 'IDs de ubicaciones específicas certificadas'
    },
    certificateUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: { isUrl: true },
      comment: 'URL del certificado'
    },
    auditReportUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: { isUrl: true },
      comment: 'URL del reporte de auditoría'
    },
    documents: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: 'URLs de otros documentos'
    },
    lastAuditDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha de última auditoría'
    },
    nextAuditDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha de próxima auditoría'
    },
    auditor: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Auditor responsable'
    },
    auditScore: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0, max: 100 },
      comment: 'Puntaje de auditoría (0-100)'
    },
    cost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Costo de la certificación'
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      comment: 'Moneda'
    },
    responsiblePerson: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Persona responsable'
    },
    contactEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: { isEmail: true },
      comment: 'Email de contacto'
    },
    contactPhone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Teléfono de contacto'
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
    modelName: 'RanchCertification',
    tableName: 'ranch_certifications',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['ranch_id', 'type'], unique: true },
      { fields: ['ranch_id'] },
      { fields: ['type'] },
      { fields: ['status'] },
      { fields: ['expiration_date'] },
      { fields: ['certifying_body'] },
      { name: 'certifications_expiring', fields: ['expiration_date', 'status'] }
    ],
    hooks: {
      beforeSave: async (cert: RanchCertification) => {
        // Validar fechas de auditoría
        if (cert.lastAuditDate && cert.nextAuditDate) {
          if (cert.nextAuditDate <= cert.lastAuditDate) {
            throw new Error('La próxima auditoría debe ser posterior a la última');
          }
        }
        
        // Actualizar estado basado en fecha de expiración
        if (cert.expirationDate < new Date() && cert.status === CertificationStatus.VALID) {
          cert.status = CertificationStatus.EXPIRED;
        }
      }
    },
    comment: 'Certificaciones del rancho'
  }
);

export default RanchCertification;