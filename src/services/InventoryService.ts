// services/inventory/InventoryService.ts
import { Op } from 'sequelize';
import sequelize from '../config/database';
import Inventory, { InventoryCategory, StockStatus, UnitOfMeasure } from '../models/Inventory';
import logger from '../utils/logger';
import InventoryMovement, { InventoryMovementType } from '../models/InventoryMovement';
import PurchaseOrder, { PurchaseOrderStatus } from '../models/PurchaseOrder';
import Supplier from '../models/Supplier';
import Medication from '../models/Medication';



// Enums internos para cálculos
enum InventoryStatus {
  IN_STOCK = 'in_stock',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
  OVERSTOCKED = 'overstocked',
  RESERVED = 'reserved',
  EXPIRED = 'expired',
  DAMAGED = 'damaged',
  QUARANTINED = 'quarantined',
  DISCONTINUED = 'discontinued'
}

enum MedicationCategory {
  ANTIBIOTIC = 'antibiotic',
  VACCINE = 'vaccine',
  ANTIPARASITIC = 'antiparasitic',
  VITAMIN = 'vitamin',
  MINERAL = 'mineral',
  HORMONE = 'hormone',
  ANALGESIC = 'analgesic',
  ANTI_INFLAMMATORY = 'anti_inflammatory',
  ANESTHETIC = 'anesthetic',
  ANTISEPTIC = 'antiseptic',
  RESPIRATORY = 'respiratory',
  DIGESTIVE = 'digestive',
  DERMATOLOGICAL = 'dermatological',
  REPRODUCTIVE = 'reproductive',
  IMMUNOMODULATOR = 'immunomodulator'
}

export interface InventoryValuation {
  totalItems: number;
  totalValue: number;
  totalCost: number;
  totalQuantity: number;
  averageCostPerItem: number;
  valuationMethod: 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE';
  calculatedAt: Date;
}

export class InventoryService {
  private readonly LOW_STOCK_THRESHOLD = 20;
  private readonly EXPIRATION_WARNING_DAYS = 30;

  constructor(
    private inventoryModel: typeof Inventory,
    private inventoryMovementModel: typeof InventoryMovement,
    private purchaseOrderModel: typeof PurchaseOrder,
    private supplierModel: typeof Supplier,
    private medicationModel: typeof Medication
  ) { }

  async getInventory(
    filters: {
      category?: InventoryCategory;
      status?: StockStatus;
      lowStock?: boolean;
      expired?: boolean;
      search?: string;
      location?: string;
      page?: number;
      limit?: number;
    } = {},
    ranchId?: string  // ← cambiado de ranchId a ranchId
  ): Promise<{ items: Inventory[]; total: number; metadata: any }> {
    try {
      const whereConditions: any = {};

      if (ranchId) {
        whereConditions.ranchId = ranchId;  // ← cambiado
      }

      if (filters.category) {
        whereConditions.category = filters.category;
      }

      if (filters.status) {
        whereConditions.status = filters.status;
      }

      if (filters.expired) {
        whereConditions.expirationDate = { [Op.lt]: new Date() };
      }

      if (filters.search) {
        whereConditions[Op.or] = [
          { itemName: { [Op.iLike]: `%${filters.search}%` } },
          { itemCode: { [Op.iLike]: `%${filters.search}%` } },
          { batchNumber: { [Op.iLike]: `%${filters.search}%` } }
        ];
      }

      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const offset = (page - 1) * limit;

      let items = await this.inventoryModel.findAll({
        where: whereConditions,
        limit,
        offset,
        order: [['updated_at', 'DESC']]
      });

      let total = items.length;
      if (filters.lowStock) {
        items = items.filter(item => item.currentStock <= item.minimumStock);
        total = items.length;
      } else {
        total = await this.inventoryModel.count({ where: whereConditions });
      }

      const metadata = {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      };

      return { items, total, metadata };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      logger.error('Error obteniendo inventario:', errorMessage);
      throw new Error(`Error obteniendo inventario: ${errorMessage}`);
    }
  }

  async updateStock(
    itemId: string,
    movement: {
      movementType: InventoryMovementType;
      quantity: number;
      reason: string;
      unitCost?: number;
      reference?: string;
      bovineId?: string;
      treatmentId?: string;
      notes?: string;
    },
    userId: string
  ): Promise<Inventory> {
    const transaction = await sequelize.transaction();

    try {
      const currentItem = await this.inventoryModel.findByPk(itemId, { transaction });
      if (!currentItem) {
        throw new Error('Item de inventario no encontrado');
      }

      let newQuantity = currentItem.currentStock;
      const isInbound = this.isInboundMovement(movement.movementType);

      if (isInbound) {
        newQuantity += movement.quantity;
      } else {
        newQuantity -= movement.quantity;
      }

      if (newQuantity < 0 && movement.movementType !== InventoryMovementType.ADJUSTMENT) {
        throw new Error(`Stock insuficiente. Disponible: ${currentItem.currentStock}, Solicitado: ${movement.quantity}`);
      }

      let newAverageCost = currentItem.unitCost;
      if (movement.movementType === InventoryMovementType.PURCHASE && movement.unitCost) {
        const totalValue = (currentItem.currentStock * currentItem.unitCost) + (movement.quantity * movement.unitCost);
        newAverageCost = totalValue / newQuantity;
      }

      // No actualizamos availableStock ni totalValue manualmente
      // El hook beforeSave del modelo se encargará de actualizarlos

      await currentItem.update({
        currentStock: newQuantity,
        unitCost: newAverageCost,
        reservedStock: currentItem.reservedStock, // mantener el mismo
        lastMovementDate: new Date(),
        updatedBy: userId
      }, { transaction });

      await this.inventoryMovementModel.create({
        inventoryItemId: itemId,
        medicationId: currentItem.medicationId,
        medicationName: currentItem.itemName,
        movementType: movement.movementType,
        quantity: isInbound ? movement.quantity : -movement.quantity,
        unitCost: movement.unitCost,
        totalCost: movement.unitCost ? movement.unitCost * movement.quantity : undefined,
        balanceAfter: newQuantity,
        date: new Date(),
        reason: movement.reason,
        reference: movement.reference,
        performedBy: userId,
        bovineId: movement.bovineId,
        treatmentId: movement.treatmentId,
        notes: movement.notes
      }, { transaction });

      await transaction.commit();

      logger.info(`Stock actualizado para item ${itemId}: ${currentItem.currentStock} -> ${newQuantity}`);
      const updatedItem = await this.inventoryModel.findByPk(itemId);
      if (!updatedItem) {
        throw new Error('Item no encontrado después de actualización');
      }
      return updatedItem;
    } catch (error) {
      await transaction.rollback();
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      logger.error(`Error actualizando stock del item ${itemId}:`, errorMessage);
      throw error;
    }
  }

  async reserveStock(itemId: string, quantity: number, treatmentId: string, userId: string): Promise<Inventory> {
    const transaction = await sequelize.transaction();

    try {
      const item = await this.inventoryModel.findByPk(itemId, { transaction });
      if (!item) {
        throw new Error('Item de inventario no encontrado');
      }

      const availableStock = item.currentStock - item.reservedStock;
      if (availableStock < quantity) {
        throw new Error(`Stock insuficiente para reservar. Disponible: ${availableStock}, Solicitado: ${quantity}`);
      }

      const newReservedStock = item.reservedStock + quantity;

      await item.update({
        reservedStock: newReservedStock,
        updatedBy: userId
      }, { transaction });

      await this.inventoryMovementModel.create({
        inventoryItemId: itemId,
        medicationId: item.medicationId,
        medicationName: item.itemName,
        movementType: InventoryMovementType.RESERVATION,
        quantity: -quantity,
        balanceAfter: item.currentStock - newReservedStock,
        date: new Date(),
        reason: `Reserva para tratamiento ${treatmentId}`,
        reference: treatmentId,
        performedBy: userId,
        treatmentId,
        notes: `Reserva de stock para tratamiento programado`
      }, { transaction });

      await transaction.commit();

      logger.info(`Stock reservado para item ${itemId}: ${quantity} unidades para tratamiento ${treatmentId}`);
      const updatedItem = await this.inventoryModel.findByPk(itemId);
      if (!updatedItem) {
        throw new Error('Item no encontrado después de reserva');
      }
      return updatedItem;

    } catch (error) {
      await transaction.rollback();
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      logger.error(`Error reservando stock del item ${itemId}:`, errorMessage);
      throw error;
    }
  }

  async releaseStock(itemId: string, quantity: number, treatmentId: string, userId: string): Promise<Inventory> {
    const transaction = await sequelize.transaction();

    try {
      const item = await this.inventoryModel.findByPk(itemId, { transaction });
      if (!item) {
        throw new Error('Item de inventario no encontrado');
      }

      if (item.reservedStock < quantity) {
        throw new Error(`No hay suficiente stock reservado para liberar. Reservado: ${item.reservedStock}, Solicitado: ${quantity}`);
      }

      const newReservedStock = item.reservedStock - quantity;

      await item.update({
        reservedStock: newReservedStock,
        updatedBy: userId
      }, { transaction });

      await this.inventoryMovementModel.create({
        inventoryItemId: itemId,
        medicationId: item.medicationId,
        medicationName: item.itemName,
        movementType: InventoryMovementType.RELEASE,
        quantity: quantity,
        balanceAfter: item.currentStock - newReservedStock,
        date: new Date(),
        reason: `Liberación de reserva del tratamiento ${treatmentId}`,
        reference: treatmentId,
        performedBy: userId,
        treatmentId,
        notes: `Liberación de stock reservado`
      }, { transaction });

      await transaction.commit();

      logger.info(`Stock liberado para item ${itemId}: ${quantity} unidades del tratamiento ${treatmentId}`);
      const updatedItem = await this.inventoryModel.findByPk(itemId);
      if (!updatedItem) {
        throw new Error('Item no encontrado después de liberación');
      }
      return updatedItem;
    } catch (error) {
      await transaction.rollback();
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      logger.error(`Error liberando stock del item ${itemId}:`, errorMessage);
      throw error;
    }
  }

  async getInventoryItemByMedicationId(medicationId: string): Promise<Inventory | null> {
    try {
      const item = await this.inventoryModel.findOne({
        where: { medicationId }
      });
      return item;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      logger.error(`Error obteniendo inventario por medicationId ${medicationId}:`, errorMessage);
      return null;
    }
  }

  async calculateInventoryValuation(
    ranchId: string,  // ← cambiado de ranchId a ranchId  
    method: 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE' = 'WEIGHTED_AVERAGE'
  ): Promise<InventoryValuation> {
    try {
      const items = await this.inventoryModel.findAll({
        where: { ranchId }  // ← cambiado
      });

      let totalValue = 0;
      let totalQuantity = 0;

      for (const item of items) {
        const itemValue = this.calculateItemValue(item, method);
        totalValue += itemValue;
        totalQuantity += item.currentStock;
      }

      return {
        totalItems: items.length,
        totalValue,
        totalCost: items.reduce((sum, item) => sum + (item.unitCost * item.currentStock), 0),
        totalQuantity,
        averageCostPerItem: items.length > 0 ? totalValue / items.length : 0,
        valuationMethod: method,
        calculatedAt: new Date()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      logger.error(`Error calculando valuación de inventario para rancho ${ranchId}:`, errorMessage);
      throw new Error(`Error calculando valuación: ${errorMessage}`);
    }
  }

  // ==========================================================================
  // MÉTODOS PRIVADOS
  // ==========================================================================

  private isInboundMovement(movementType: InventoryMovementType): boolean {
    return [
      InventoryMovementType.PURCHASE,
      InventoryMovementType.RETURN,
      InventoryMovementType.FOUND,
      InventoryMovementType.RELEASE
    ].includes(movementType);
  }

  private calculateItemValue(item: Inventory, method: 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE'): number {
    switch (method) {
      case 'WEIGHTED_AVERAGE':
        return item.currentStock * item.unitCost;
      default:
        return item.currentStock * item.unitCost;
    }
  }

  async getInventoryItemById(itemId: string): Promise<Inventory | null> {
    try {
        const item = await this.inventoryModel.findByPk(itemId);
        return item;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        logger.error(`Error obteniendo item ${itemId}:`, errorMessage);
        return null;
    }
}
}

export const inventoryService = new InventoryService(
  Inventory,
  InventoryMovement,
  PurchaseOrder,
  Supplier,
  Medication
);