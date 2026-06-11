import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface SupplierAttributes {
  id: string;
  supplierCode: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  alternativePhone?: string;
  address?: string;
  taxId?: string;
  paymentTerms?: string;
  leadTimeDays?: number;
  minimumOrder?: number;
  currency?: string;
  isActive: boolean;
  notes?: string;
  createdBy: string;
  updatedBy?: string;

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface SupplierCreationAttributes
  extends Optional<SupplierAttributes,
    'id' | 'contactPerson' | 'email' | 'phone' | 'alternativePhone' |
    'address' | 'taxId' | 'paymentTerms' | 'leadTimeDays' | 'minimumOrder' |
    'currency' | 'notes' | 'updatedBy' |'deletedAt'
  > {}

class Supplier extends Model<SupplierAttributes, SupplierCreationAttributes>
  implements SupplierAttributes {
  public id!: string;
  public supplierCode!: string;
  public name!: string;
  public contactPerson?: string;
  public email?: string;
  public phone?: string;
  public alternativePhone?: string;
  public address?: string;
  public taxId?: string;
  public paymentTerms?: string;
  public leadTimeDays?: number;
  public minimumOrder?: number;
  public currency?: string;
  public isActive!: boolean;
  public notes?: string;
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

Supplier.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    supplierCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    contactPerson: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: { isEmail: true },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    alternativePhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    taxId: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    paymentTerms: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    leadTimeDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
    },
    minimumOrder: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: true,
      validate: { min: 0 },
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      defaultValue: 'MXN',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Supplier',
    tableName: 'suppliers',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['supplier_code'], unique: true },
      { fields: ['name'] },
      { fields: ['is_active'] },
    ],
  }
);

export default Supplier;