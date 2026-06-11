import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Inventory from './Inventory';

export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  ORDERED = 'ORDERED',
  PARTIAL = 'PARTIAL',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface PurchaseOrderItem {
  inventoryItemId: string;
  medicationId?: string;
  medicationName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
  batchNumber?: string;
  expirationDate?: Date;
  notes?: string;
}

export interface PurchaseOrderAttributes {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  ranchId: string;
  status: PurchaseOrderStatus;
  orderDate: Date;
  expectedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  items: PurchaseOrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  paymentTerms?: string;
  deliveryInstructions?: string;
  createdBy: string;
  approvedBy?: string;
  receivedBy?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface PurchaseOrderCreationAttributes
  extends Optional<PurchaseOrderAttributes,
    'id' | 'expectedDeliveryDate' | 'actualDeliveryDate' | 'paymentTerms' |
    'deliveryInstructions' | 'approvedBy' | 'receivedBy' | 'notes' |
    'deletedAt'
  > {}

class PurchaseOrder extends Model<PurchaseOrderAttributes, PurchaseOrderCreationAttributes>
  implements PurchaseOrderAttributes {
  public id!: string;
  public orderNumber!: string;
  public supplierId!: string;
  public supplierName!: string;
  public ranchId!: string;
  public status!: PurchaseOrderStatus;
  public orderDate!: Date;
  public expectedDeliveryDate?: Date;
  public actualDeliveryDate?: Date;
  public items!: PurchaseOrderItem[];
  public subtotal!: number;
  public tax!: number;
  public shipping!: number;
  public discount!: number;
  public total!: number;
  public currency!: string;
  public paymentTerms?: string;
  public deliveryInstructions?: string;
  public createdBy!: string;
  public approvedBy?: string;
  public receivedBy?: string;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

PurchaseOrder.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    orderNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    supplierId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    supplierName: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    ranchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'ranches', key: 'id' },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PurchaseOrderStatus)),
      allowNull: false,
      defaultValue: PurchaseOrderStatus.DRAFT,
    },
    orderDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    expectedDeliveryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    actualDeliveryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    items: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    tax: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    shipping: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    discount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'MXN',
    },
    paymentTerms: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    deliveryInstructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    receivedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'PurchaseOrder',
    tableName: 'purchase_orders',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['order_number'], unique: true },
      { fields: ['supplier_id'] },
      { fields: ['ranch_id'] },
      { fields: ['status'] },
      { fields: ['order_date'] },
    ],
  }
);

export default PurchaseOrder;