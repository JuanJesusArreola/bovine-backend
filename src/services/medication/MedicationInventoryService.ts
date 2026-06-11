// services/inventory/MedicationInventoryService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import { HealthError } from '../../utils/HealthErrors';
import { ensureError } from '../../utils/errorUtils';

import Inventory, {
  InventoryCategory,
  StockStatus,
  UnitOfMeasure,
  StorageCondition,
} from '../../models/Inventory';
import Medication from '../../models/Medication';
import Health from '../../models/Health';
import { medicationService } from '../medication/MedicationService';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface ConsumptionRecordDTO {
  medicationCode: string;       // código del medicamento (itemCode en Inventory)
  quantity: number;             // cantidad consumida (positiva)
  batchNumber?: string;         // opcional, para descontar de un lote específico
  healthRecordId?: string;      // opcional, para asociar a un registro de salud
  consumedBy: string;           // usuario que realiza el consumo
  notes?: string;
}

export interface PurchaseRecordDTO {
  medicationCode: string;       // código del medicamento (itemCode en Inventory)
  quantity: number;
  batchNumber: string;
  expirationDate?: Date;
  purchaseDate: Date;
  unitCost?: number;
  totalCost?: number;
  supplier?: string;            // nombre del proveedor
  recordedBy: string;
  notes?: string;
  // Opcionales con valores por defecto
  storageLocation?: string;     // ej. 'FARMACIA'
  storageCondition?: StorageCondition;
  unitOfMeasure?: UnitOfMeasure;
  minimumStock?: number;        // si no se proporciona, se usará 0 o el valor por defecto
}

export interface StockLevelInfo {
  medicationCode: string;
  medicationName: string;
  currentStock: number;
  minimumStock: number;
  status: 'OK' | 'LOW' | 'CRITICAL';
}

export interface ExpiringMedicationInfo {
  inventoryId: string;
  medicationCode: string;
  medicationName: string;
  batchNumber: string;
  currentStock: number;
  expirationDate: Date;
  daysToExpire: number;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class MedicationInventoryService {
  private readonly context = 'MedicationInventoryService';

  /**
   * Obtiene el stock disponible total para un medicamento (suma de todos los lotes activos no expirados/dañados).
   */
  async getAvailableStock(medicationCode: string): Promise<number> {
    try {
      const result = await Inventory.sum('currentStock', {
        where: {
          itemCode: medicationCode,
          isActive: true,
          status: { [Op.notIn]: [StockStatus.EXPIRED, StockStatus.DAMAGED] },
        },
      });
      return result || 0;
    } catch (error) {
      logger.error(`Error obteniendo stock disponible para ${medicationCode}`, this.context, { medicationCode }, ensureError(error));
      throw new HealthError('Error al consultar stock disponible', 'INVENTORY_ERROR', 500, ensureError(error));
    }
  }

  /**
   * Verifica niveles de stock para todos los medicamentos o uno específico.
   * Agrupa por itemCode y devuelve el stock total y el mínimo (del primer lote).
   */
  async checkStockLevels(medicationCode?: string): Promise<StockLevelInfo[]> {
    try {
      const whereClause: any = { isActive: true };
      if (medicationCode) {
        whereClause.itemCode = medicationCode;
      }

      // Obtener todos los lotes activos (no expirados/dañados) que cumplan la condición
      const batches = await Inventory.findAll({
        where: {
          ...whereClause,
          status: { [Op.notIn]: [StockStatus.EXPIRED, StockStatus.DAMAGED] },
        },
        order: [['itemCode', 'ASC']],
      });

      // Agrupar manualmente por itemCode
      const grouped = new Map<string, { totalStock: number; minStock: number; firstBatch: Inventory }>();

      for (const batch of batches) {
        const code = batch.itemCode;
        if (!grouped.has(code)) {
          grouped.set(code, {
            totalStock: 0,
            minStock: batch.minimumStock, // usamos el mínimo del primer lote como representativo
            firstBatch: batch,
          });
        }
        const group = grouped.get(code)!;
        group.totalStock += batch.currentStock;
        // Si hay lotes con mínimo diferente, podríamos tomar el mínimo más bajo (por seguridad)
        group.minStock = Math.min(group.minStock, batch.minimumStock);
      }

      const result: StockLevelInfo[] = [];

      for (const [code, group] of grouped.entries()) {
        const batch = group.firstBatch;
        const totalStock = group.totalStock;
        const minStock = group.minStock;

        // Obtener nombre del medicamento desde el catálogo (mejor que usar itemName del lote)
        let medicationName = code;
        try {
          const medication = await medicationService.getMedicationById(code);
          if (medication) medicationName = medication.genericName;
        } catch {
          medicationName = batch.itemName; // fallback al nombre del lote
        }

        let status: 'OK' | 'LOW' | 'CRITICAL';
        if (totalStock <= 0) {
          status = 'CRITICAL';
        } else if (totalStock < minStock * 0.5) {
          status = 'CRITICAL';
        } else if (totalStock < minStock) {
          status = 'LOW';
        } else {
          status = 'OK';
        }

        result.push({
          medicationCode: code,
          medicationName,
          currentStock: totalStock,
          minimumStock: minStock,
          status,
        });
      }

      return result;
    } catch (error) {
      logger.error('Error verificando niveles de stock', this.context, { medicationCode }, ensureError(error));
      throw new HealthError('Error al verificar niveles de stock', 'INVENTORY_ERROR', 500, ensureError(error));
    }
  }

  /**
   * Obtiene los medicamentos que vencen en los próximos `days` días.
   * Utiliza el método de instancia `isNearExpiration` si existe, pero aquí lo calculamos directamente.
   */
  async getExpiringMedications(days: number = 30): Promise<ExpiringMedicationInfo[]> {
    try {
      const today = new Date();
      const limitDate = new Date();
      limitDate.setDate(today.getDate() + days);

      const expiringItems = await Inventory.findAll({
        where: {
          expirationDate: { [Op.between]: [today, limitDate] },
          currentStock: { [Op.gt]: 0 },
          isActive: true,
        },
        order: [['expirationDate', 'ASC']],
      });

      const result: ExpiringMedicationInfo[] = [];

      for (const item of expiringItems) {
        const medication = await medicationService.getMedicationById(item.itemCode).catch(() => null);
        const daysToExpire = item.getDaysToExpiration() ?? 0; // usamos el método del modelo

        result.push({
          inventoryId: item.id,
          medicationCode: item.itemCode,
          medicationName: medication?.genericName || item.itemName,
          batchNumber: item.batchNumber || 'N/A',
          currentStock: item.currentStock,
          expirationDate: item.expirationDate!,
          daysToExpire,
        });
      }

      return result;
    } catch (error) {
      logger.error('Error obteniendo medicamentos próximos a vencer', this.context, { days }, ensureError(error));
      throw new HealthError('Error al consultar medicamentos próximos a vencer', 'INVENTORY_ERROR', 500, ensureError(error));
    }
  }

  /**
   * Registra el consumo de un medicamento, descontando del inventario (FIFO por fecha de vencimiento).
   */
  async recordConsumption(data: ConsumptionRecordDTO, transaction?: Transaction): Promise<void> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      // Validar que el medicamento exista en el catálogo
      const medication = await medicationService.getMedicationById(data.medicationCode);
      if (!medication) {
        throw new HealthError(`Medicamento con código ${data.medicationCode} no encontrado`, 'MEDICATION_NOT_FOUND', 404);
      }

      // Si se proporciona healthRecordId, verificar que exista
      if (data.healthRecordId) {
        const healthRecord = await Health.findByPk(data.healthRecordId, { transaction: t });
        if (!healthRecord) {
          throw new HealthError(`Registro de salud con ID ${data.healthRecordId} no encontrado`, 'HEALTH_NOT_FOUND', 404);
        }
      }

      // Buscar lotes disponibles con FIFO (más próximos a vencer primero)
      const availableBatches = await Inventory.findAll({
        where: {
          itemCode: data.medicationCode,
          currentStock: { [Op.gt]: 0 },
          isActive: true,
          status: { [Op.notIn]: [StockStatus.EXPIRED, StockStatus.DAMAGED] },
        },
        order: [
          ['expirationDate', 'ASC'], // primero los que vencen antes (FIFO)
          ['createdAt', 'ASC'],
        ],
        transaction: t,
      });

      if (availableBatches.length === 0) {
        throw new HealthError(`No hay stock disponible para ${medication.genericName}`, 'INSUFFICIENT_STOCK', 400);
      }

      let remainingQuantity = data.quantity;

      for (const batch of availableBatches) {
        if (remainingQuantity <= 0) break;

        const available = batch.currentStock;
        const toTake = Math.min(available, remainingQuantity);

        // Actualizar stock del lote
        await batch.update(
          {
            currentStock: available - toTake,
            lastMovementDate: new Date(),
          },
          { transaction: t }
        );

        remainingQuantity -= toTake;

        // Si el lote se queda sin stock, cambiar estado a OUT_OF_STOCK
        if (batch.currentStock === 0) {
          await batch.update({ status: StockStatus.OUT_OF_STOCK }, { transaction: t });
        }
      }

      if (remainingQuantity > 0) {
        throw new HealthError(`Stock insuficiente, faltaron ${remainingQuantity} unidades`, 'INSUFFICIENT_STOCK', 400);
      }

      if (isOwnTransaction) await t.commit();

      logger.info(`Consumo registrado: ${data.quantity} de ${data.medicationCode}`, this.context, {
        medicationCode: data.medicationCode,
        quantity: data.quantity,
        healthRecordId: data.healthRecordId,
        consumedBy: data.consumedBy,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error registrando consumo de ${data.medicationCode}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  /**
   * Registra una compra (nuevo lote) de medicamento.
   * Crea un nuevo registro en Inventory con los datos proporcionados.
   */
  async recordPurchase(data: PurchaseRecordDTO, transaction?: Transaction): Promise<Inventory> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      // Validar que el medicamento exista en el catálogo
      const medication = await medicationService.getMedicationById(data.medicationCode);
      if (!medication) {
        throw new HealthError(`Medicamento con código ${data.medicationCode} no encontrado`, 'MEDICATION_NOT_FOUND', 404);
      }

      // Valores por defecto para campos opcionales
      const storageLocation = data.storageLocation || 'FARMACIA';
      const storageCondition = data.storageCondition || StorageCondition.AMBIENT;
      const unitOfMeasure = data.unitOfMeasure || UnitOfMeasure.UNIT;
      const minimumStock = data.minimumStock ?? 0; // si no se provee, 0
      const unitCost = data.unitCost || 0;
      const totalValue = data.totalCost || (unitCost * data.quantity);

      // Construir objeto de inventario
      const inventoryItem = await Inventory.create(
        {
          itemCode: data.medicationCode,
          itemName: medication.genericName, // copia del nombre en el momento de compra
          category: InventoryCategory.MEDICATION,
          currentStock: data.quantity,
          reservedStock: 0,
          availableStock: data.quantity, // se actualizará en el hook beforeSave
          minimumStock,
          unitOfMeasure,
          unitCost,
          totalValue,
          currency: 'MXN', // o podrías obtenerlo del catálogo
          status: StockStatus.IN_STOCK,
          storageLocation,
          storageCondition,
          expirationDate: data.expirationDate,
          manufacturingDate: data.purchaseDate, // aproximación, podrías enviarlo aparte
          batchNumber: data.batchNumber,
          supplierInfo: data.supplier ? { supplierName: data.supplier } : undefined,
          purchaseDate: data.purchaseDate,
          trackExpiration: !!data.expirationDate,
          trackBatch: true,
          isActive: true,
          createdBy: data.recordedBy,
          notes: data.notes,
        } as any, // el tipado de Sequelize puede necesitar un cast
        { transaction: t }
      );

      if (isOwnTransaction) await t.commit();

      logger.info(`Compra registrada: ${data.quantity} de ${data.medicationCode}`, this.context, {
        medicationCode: data.medicationCode,
        quantity: data.quantity,
        batchNumber: data.batchNumber,
        recordedBy: data.recordedBy,
        durationMs: Date.now() - startTime,
      });

      return inventoryItem;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error registrando compra de ${data.medicationCode}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const medicationInventoryService = new MedicationInventoryService();