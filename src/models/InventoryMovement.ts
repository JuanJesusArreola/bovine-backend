import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Inventory from './Inventory';
import Bovine from './Bovine';

export enum InventoryMovementType {
  PURCHASE = 'PURCHASE',        // Compra
  SALE = 'SALE',                // Venta
  USAGE = 'USAGE',              // Uso/Consumo
  ADJUSTMENT = 'ADJUSTMENT',    // Ajuste de inventario
  TRANSFER = 'TRANSFER',        // Transferencia entre ubicaciones
  RETURN = 'RETURN',            // Devolución
  DISPOSAL = 'DISPOSAL',        // Disposición/Descarte
  LOSS = 'LOSS',                // Pérdida
  FOUND = 'FOUND',              // Encontrado
  RESERVATION = 'RESERVATION',  // Reserva
  RELEASE = 'RELEASE',          // Liberación de reserva
  EXPIRATION = 'EXPIRATION',    // Vencimiento
  DAMAGE = 'DAMAGE'             // Daño
}

export interface InventoryMovementAttributes {
  id: string;
  inventoryItemId: string;
  medicationId?: string;
  medicationName: string;
  movementType: InventoryMovementType;
  quantity: number;              // Positivo = entrada, Negativo = salida
  unitCost?: number;
  totalCost?: number;
  balanceAfter: number;          // Stock después del movimiento
  date: Date;
  reason: string;
  reference?: string;            // Número de orden, ID de tratamiento, etc.
  supplierId?: string;
  supplierName?: string;
  batchNumber?: string;
  expirationDate?: Date;
  location?: {
    warehouse: string;
    zone?: string;
    aisle?: string;
    shelf?: string;
    position?: string;
    temperatureControlled: boolean;
    accessRestricted: boolean;
  };
  performedBy: string;           // ID del usuario
  approvedBy?: string;
  bovineId?: string;
  treatmentId?: string;
  notes?: string;
  attachments?: string[];

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface InventoryMovementCreationAttributes
  extends Optional<InventoryMovementAttributes,
    'id' | 'medicationId' | 'unitCost' | 'totalCost' | 'reference' |
    'supplierId' | 'supplierName' | 'batchNumber' | 'expirationDate' |
    'location' | 'approvedBy' | 'bovineId' | 'treatmentId' | 'notes' |
    'attachments' | 'deletedAt'
  > {}

class InventoryMovement extends Model<InventoryMovementAttributes, InventoryMovementCreationAttributes>
  implements InventoryMovementAttributes {
  public id!: string;
  public inventoryItemId!: string;
  public medicationId?: string;
  public medicationName!: string;
  public movementType!: InventoryMovementType;
  public quantity!: number;
  public unitCost?: number;
  public totalCost?: number;
  public balanceAfter!: number;
  public date!: Date;
  public reason!: string;
  public reference?: string;
  public supplierId?: string;
  public supplierName?: string;
  public batchNumber?: string;
  public expirationDate?: Date;
  public location?: {
    warehouse: string;
    zone?: string;
    aisle?: string;
    shelf?: string;
    position?: string;
    temperatureControlled: boolean;
    accessRestricted: boolean;
  };
  public performedBy!: string;
  public approvedBy?: string;
  public bovineId?: string;
  public treatmentId?: string;
  public notes?: string;
  public attachments?: string[];
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

InventoryMovement.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    inventoryItemId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'inventory', key: 'id' },
      onDelete: 'CASCADE',
    },
    medicationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'medications', key: 'id' },
    },
    medicationName: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    movementType: {
      type: DataTypes.ENUM(...Object.values(InventoryMovementType)),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
    unitCost: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true,
    },
    totalCost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    supplierId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    supplierName: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    batchNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    expirationDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    performedBy: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    bovineId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'bovines', key: 'id' },
    },
    treatmentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    attachments: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'InventoryMovement',
    tableName: 'inventory_movements',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['inventory_item_id'] },
      { fields: ['movement_type'] },
      { fields: ['date'] },
      { fields: ['treatment_id'] },
      { fields: ['bovine_id'] },
      { name: 'inventory_movements_item_date', fields: ['inventory_item_id', 'date'] },
    ],
  }
);

export default InventoryMovement;