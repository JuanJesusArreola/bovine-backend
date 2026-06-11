// src/models/ranch/RanchOwnership.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Ranch from './Ranch';

export enum OwnerType {
  INDIVIDUAL = 'INDIVIDUAL',
  FAMILY = 'FAMILY',
  CORPORATION = 'CORPORATION',
  COOPERATIVE = 'COOPERATIVE',
  GOVERNMENT = 'GOVERNMENT',
  NGO = 'NGO'
}

export interface Shareholder {
  name: string;
  percentage: number;
  role: string;
  contact?: string;
}

export interface LegalRepresentative {
  name: string;
  position: string;
  contact: string;
  email?: string;
  phone?: string;
}

export interface OwnerContact {
  phone: string;
  email: string;
  address: string;
  alternativePhone?: string;
  website?: string;
}

export interface RanchOwnershipAttributes {
  ranchId: string;                    // PK y FK
  ownerType: OwnerType;
  ownerName: string;
  ownerTaxId?: string;
  ownerContact: OwnerContact;
  shareholders?: Shareholder[];
  legalRepresentative?: LegalRepresentative;
  foundationDate: Date;
  businessLicense?: string;
  taxRegistration?: string;
  registrationNumber?: string;

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface RanchOwnershipCreationAttributes
  extends Optional<RanchOwnershipAttributes,
    'shareholders' | 'legalRepresentative' | 'businessLicense' |
    'taxRegistration' | 'registrationNumber' | 'deletedAt'
  > {}

class RanchOwnership extends Model<RanchOwnershipAttributes, RanchOwnershipCreationAttributes>
  implements RanchOwnershipAttributes {
  
  public ranchId!: string;
  public ownerType!: OwnerType;
  public ownerName!: string;
  public ownerTaxId?: string;
  public ownerContact!: OwnerContact;
  public shareholders?: Shareholder[];
  public legalRepresentative?: LegalRepresentative;
  public foundationDate!: Date;
  public businessLicense?: string;
  public taxRegistration?: string;
  public registrationNumber?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

RanchOwnership.init(
  {
    ranchId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      references: { model: 'ranches', key: 'id' },
      comment: 'ID del rancho (PK y FK 1:1)'
    },
    ownerType: {
      type: DataTypes.ENUM(...Object.values(OwnerType)),
      allowNull: false,
    },
    ownerName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Nombre del propietario'
    },
    ownerTaxId: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'RFC o ID fiscal'
    },
    ownerContact: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidContact(value: OwnerContact) {
          if (!value.phone || !value.email || !value.address) {
            throw new Error('Teléfono, email y dirección son requeridos');
          }
        }
      },
      comment: 'Contacto del propietario'
    },
    shareholders: {
      type: DataTypes.JSONB,
      allowNull: true,
      validate: {
        isValidShareholders(value: Shareholder[]) {
          if (value) {
            const total = value.reduce((sum, s) => sum + s.percentage, 0);
            if (Math.abs(total - 100) > 0.01) {
              throw new Error('La suma de porcentajes debe ser 100%');
            }
          }
        }
      },
      comment: 'Accionistas (si aplica)'
    },
    legalRepresentative: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Representante legal'
    },
    foundationDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        isBefore: new Date().toISOString().split('T')[0]
      },
      comment: 'Fecha de fundación'
    },
    businessLicense: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Licencia comercial'
    },
    taxRegistration: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Registro fiscal'
    },
    registrationNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Número de registro'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'RanchOwnership',
    tableName: 'ranch_ownerships',
    timestamps: true,
    paranoid: true,
    comment: 'Información de propiedad y estructura legal del rancho'
  }
);

export default RanchOwnership;