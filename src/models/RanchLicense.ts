// src/models/ranch/RanchLicense.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Ranch from './Ranch';

// Enums
export enum LicenseType {
  OPERATING_LICENSE = 'OPERATING_LICENSE',           // Licencia de funcionamiento
  ENVIRONMENTAL_PERMIT = 'ENVIRONMENTAL_PERMIT',     // Permiso ambiental
  SANITARY_LICENSE = 'SANITARY_LICENSE',             // Licencia sanitaria
  WATER_RIGHTS = 'WATER_RIGHTS',                     // Derechos de agua
  LAND_USE_PERMIT = 'LAND_USE_PERMIT',                // Permiso de uso de suelo
  CONSTRUCTION_PERMIT = 'CONSTRUCTION_PERMIT',        // Permiso de construcción
  TRANSPORT_PERMIT = 'TRANSPORT_PERMIT',              // Permiso de transporte
  EXPORT_LICENSE = 'EXPORT_LICENSE',                  // Licencia de exportación
  IMPORT_LICENSE = 'IMPORT_LICENSE',                   // Licencia de importación
  SLAUGHTERHOUSE_LICENSE = 'SLAUGHTERHOUSE_LICENSE',   // Licencia de rastro
  DAIRY_LICENSE = 'DAIRY_LICENSE',                     // Licencia lechera
  FEEDLOT_LICENSE = 'FEEDLOT_LICENSE',                 // Licencia de engorda
  BREEDING_LICENSE = 'BREEDING_LICENSE',               // Licencia de cría
  VETERINARY_LICENSE = 'VETERINARY_LICENSE',           // Licencia veterinaria
  OTHER = 'OTHER'
}

export enum LicenseStatus {
  VALID = 'VALID',
  EXPIRED = 'EXPIRED',
  PENDING = 'PENDING',
  REVOKED = 'REVOKED',
  SUSPENDED = 'SUSPENDED',
  APPLICATION = 'APPLICATION'
}

export enum LicenseAuthority {
  MUNICIPAL = 'MUNICIPAL',
  STATE = 'STATE',
  FEDERAL = 'FEDERAL',
  INTERNATIONAL = 'INTERNATIONAL',
  OTHER = 'OTHER'
}

// Atributos del modelo
export interface RanchLicenseAttributes {
  id: string;
  ranchId: string;
  
  type: LicenseType;
  licenseNumber: string;
  authority: LicenseAuthority;
  issuingBody: string;                    // Nombre de la entidad que emite
  
  issueDate: Date;
  expirationDate: Date;
  status: LicenseStatus;
  
  // Alcance
  scope?: string;                          // Descripción del alcance
  locations?: string[];                     // IDs de ubicaciones específicas (opcional)
  activities?: string[];                     // Actividades permitidas
  
  // Documentos
  documentUrl?: string;
  supportingDocuments?: string[];
  
  // Costos
  cost?: number;
  currency?: string;
  renewalCost?: number;
  
  // Responsable
  responsiblePerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  
  // Renovación
  renewalReminderSent?: boolean;
  renewalDate?: Date;
  autoRenewal?: boolean;
  
  // Metadatos
  notes?: string;
  
  createdBy: string;
  updatedBy?: string;

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface RanchLicenseCreationAttributes
  extends Optional<RanchLicenseAttributes,
    'id' | 'scope' | 'locations' | 'activities' | 'documentUrl' |
    'supportingDocuments' | 'cost' | 'currency' | 'renewalCost' |
    'responsiblePerson' | 'contactEmail' | 'contactPhone' |
    'renewalReminderSent' | 'renewalDate' | 'autoRenewal' | 'notes' |
    'updatedBy' | 'deletedAt'
  > {}

class RanchLicense extends Model<RanchLicenseAttributes, RanchLicenseCreationAttributes>
  implements RanchLicenseAttributes {
  
  public id!: string;
  public ranchId!: string;
  
  public type!: LicenseType;
  public licenseNumber!: string;
  public authority!: LicenseAuthority;
  public issuingBody!: string;
  
  public issueDate!: Date;
  public expirationDate!: Date;
  public status!: LicenseStatus;
  
  public scope?: string;
  public locations?: string[];
  public activities?: string[];
  
  public documentUrl?: string;
  public supportingDocuments?: string[];
  
  public cost?: number;
  public currency?: string;
  public renewalCost?: number;
  
  public responsiblePerson?: string;
  public contactEmail?: string;
  public contactPhone?: string;
  
  public renewalReminderSent?: boolean;
  public renewalDate?: Date;
  public autoRenewal?: boolean;
  
  public notes?: string;
  
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

RanchLicense.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único de la licencia'
    },
    ranchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'ranches', key: 'id' },
      comment: 'ID del rancho'
    },
    type: {
      type: DataTypes.ENUM(...Object.values(LicenseType)),
      allowNull: false,
    },
    licenseNumber: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Número de licencia'
    },
    authority: {
      type: DataTypes.ENUM(...Object.values(LicenseAuthority)),
      allowNull: false,
    },
    issuingBody: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Nombre de la entidad que emite'
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
      type: DataTypes.ENUM(...Object.values(LicenseStatus)),
      allowNull: false,
      defaultValue: LicenseStatus.VALID,
    },
    scope: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Alcance de la licencia'
    },
    locations: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: true,
      comment: 'IDs de ubicaciones específicas'
    },
    activities: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: 'Actividades permitidas'
    },
    documentUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: { isUrl: true },
      comment: 'URL del documento de licencia'
    },
    supportingDocuments: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: 'URLs de documentos de soporte'
    },
    cost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Costo de la licencia'
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      comment: 'Moneda'
    },
    renewalCost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Costo de renovación'
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
    renewalReminderSent: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: '¿Recordatorio de renovación enviado?'
    },
    renewalDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha programada para renovación'
    },
    autoRenewal: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: '¿Renovación automática?'
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
    modelName: 'RanchLicense',
    tableName: 'ranch_licenses',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['ranch_id', 'type'], unique: true },
      { fields: ['ranch_id'] },
      { fields: ['type'] },
      { fields: ['status'] },
      { fields: ['expiration_date'] },
      { fields: ['authority'] },
      { name: 'licenses_expiring', fields: ['expiration_date', 'status'] }
    ],
    hooks: {
      beforeSave: async (license: RanchLicense) => {
        // Validar que renewalDate sea posterior a issueDate si existe
        if (license.renewalDate && license.renewalDate <= license.issueDate) {
          throw new Error('La fecha de renovación debe ser posterior a la emisión');
        }
        
        // Actualizar estado basado en fecha de expiración
        if (license.expirationDate < new Date() && license.status === LicenseStatus.VALID) {
          license.status = LicenseStatus.EXPIRED;
        }
      }
    },
    comment: 'Licencias y permisos del rancho'
  }
);

export default RanchLicense;