// src/services/production/ProductionService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import Production, { ProductionAttributes, ProductionCreationAttributes, ProductionType, ProductionStatus } from '../models/Production';
import Bovine from '../models/Bovine';
import { ValidationError } from '../utils/errorUtils';
import { NotificationType, NotificationPriority } from '../models/Notification';

export class ProductionService {
  constructor(
    private productionModel: typeof Production,
    private bovineModel: typeof Bovine,
    private notificationService?: any // Opcional, si quieres enviar notificaciones
  ) { }

  // ==========================================================================
  // CRUD principal
  // ==========================================================================

  /**
   * Crea un nuevo registro de producción
   */
  async createProduction(
    data: Omit<ProductionCreationAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
    userId: string,
    transaction?: Transaction
  ): Promise<Production> {
    const t = transaction || await sequelize.transaction();
    try {
      // Verificar que el bovino existe
      const bovine = await this.bovineModel.findByPk(data.bovineId, { transaction: t });
      if (!bovine) throw new ValidationError(`Bovino con ID ${data.bovineId} no encontrado`);

      // Crear registro
      const production = await this.productionModel.create(
        { ...data, createdBy: userId },
        { transaction: t }
      );

      if (!transaction) await t.commit();

      // Opcional: enviar notificación si hay alertas (ej. baja producción)
      if (this.notificationService) {
        await this.checkProductionAlerts(production);
      }

      return production;
    } catch (error) {
      if (!transaction) await t.rollback();
      throw error;
    }
  }

  /**
   * Obtiene un registro de producción por ID
   */
  async getProductionById(id: string): Promise<Production | null> {
    return await this.productionModel.findByPk(id);
  }

  /**
   * Lista registros de producción con filtros
   */
  async getProductions(filters: {
    bovineId?: string;
    productionType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: Production[]; count: number }> {
    const where: any = {};

    if (filters.bovineId) where.bovineId = filters.bovineId;
    if (filters.productionType) where.productionType = filters.productionType;
    if (filters.startDate || filters.endDate) {
      where.productionDate = {};
      if (filters.startDate) where.productionDate[Op.gte] = filters.startDate;
      if (filters.endDate) where.productionDate[Op.lte] = filters.endDate;
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const { rows, count } = await this.productionModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [['productionDate', 'DESC']],
    });

    return { rows, count };
  }

  /**
   * Obtiene todos los registros de producción de un rancho (todos sus bovinos)
   */
  async getProductionsByRanch(
    ranchId: string,
    filters?: { productionType?: string; startDate?: Date; endDate?: Date; limit?: number; offset?: number }
  ): Promise<{ rows: Production[]; count: number }> {
    const where: any = {};

    if (filters?.productionType) where.productionType = filters.productionType;
    if (filters?.startDate || filters?.endDate) {
      where.productionDate = {};
      if (filters.startDate) where.productionDate[Op.gte] = filters.startDate;
      if (filters.endDate) where.productionDat[Op.lte] = filters.endDate;
    }

    // Configurar paginación
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    // Realizar la consulta con JOIN a Bovine
    const { rows, count } = await this.productionModel.findAndCountAll({
      include: [
        {
          model: this.bovineModel,
          as: 'bovine',          // Usa el alias correcto definido en la asociación
          where: {
            ranchId,
            isActive: true,
          },
          attributes: [],        // No necesitamos traer datos del bovino en la consulta
          required: true,        // Solo producciones de bovinos activos del rancho
        },
      ],
      where,
      limit,
      offset,
      order: [['productionDate', 'DESC']],
    });

    return { rows, count };
  }

  /**
   * Actualiza un registro de producción
   */
  async updateProduction(
    id: string,
    data: Partial<ProductionAttributes>,
    userId: string,
    transaction?: Transaction
  ): Promise<Production> {
    const t = transaction || await sequelize.transaction();
    try {
      const production = await this.productionModel.findByPk(id, { transaction: t });
      if (!production) throw new ValidationError(`Producción con ID ${id} no encontrada`);

      await production.update({ ...data, updatedBy: userId }, { transaction: t });
      if (!transaction) await t.commit();

      return production;
    } catch (error) {
      if (!transaction) await t.rollback();
      throw error;
    }
  }

  /**
   * Elimina (soft delete) un registro de producción
   */
  async deleteProduction(id: string, userId: string, transaction?: Transaction): Promise<void> {
    const t = transaction || await sequelize.transaction();
    try {
      const production = await this.productionModel.findByPk(id, { transaction: t });
      if (!production) throw new ValidationError(`Producción con ID ${id} no encontrada`);

      await production.destroy({ transaction: t });
      if (!transaction) await t.commit();
    } catch (error) {
      if (!transaction) await t.rollback();
      throw error;
    }
  }

  // ==========================================================================
  // Métricas y análisis
  // ==========================================================================

  /**
   * Calcula métricas de producción para un bovino
   */
  async getProductionMetrics(
    bovineId: string,
    options?: { productionType?: string; startDate?: Date; endDate?: Date }
  ): Promise<{
    totalRecords: number;
    totalQuantity: number;        // ← cambiado
    averageQuantity: number;      // ← cambiado
    minQuantity: number;          // ← cambiado
    maxQuantity: number;          // ← cambiado
    unit: string;
    lastDate?: Date;
  } | null> {
    const where: any = { bovineId };
    if (options?.productionType) where.productionType = options.productionType;
    if (options?.startDate || options?.endDate) {
      where.productionDate = {};
      if (options.startDate) where.productionDate[Op.gte] = options.startDate;
      if (options.endDate) where.productionDate[Op.lte] = options.endDate;
    }

    const records = await this.productionModel.findAll({ where, order: [['productionDate', 'ASC']] });
    if (records.length === 0) return null;

    const totalQuantity = records.reduce((sum, r) => sum + r.quantity, 0);
    const quantities = records.map(r => r.quantity);
    const unit = records[0].unit;
    const lastDate = records[records.length - 1].productionDate;

    return {
      totalRecords: records.length,
      totalQuantity,
      averageQuantity: totalQuantity / records.length,
      minQuantity: Math.min(...quantities),
      maxQuantity: Math.max(...quantities),
      unit,
      lastDate,
    };
  }

  /**
   * Obtiene tendencias de producción (agrupadas por período)
   */
  async getProductionTrends(
    bovineId: string,
    productionType: string,
    period: 'day' | 'week' | 'month' = 'day'
  ): Promise<{ date: Date; total: number; average: number; count: number }[]> {
    const records = await this.productionModel.findAll({
      where: { bovineId, productionType },
      order: [['productionDate', 'ASC']],
    });

    if (records.length === 0) return [];

    // Agrupar según el período
    const groups = new Map<string, { total: number; count: number; date: Date }>();

    records.forEach(record => {
      let key: string;
      const date = new Date(record.productionDate);
      switch (period) {
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${date.getMonth() + 1}`;
          break;
        default: // day
          key = date.toISOString().split('T')[0];
      }

      if (!groups.has(key)) {
        groups.set(key, { total: 0, count: 0, date });
      }
      const group = groups.get(key)!;
      group.total += record.quantity;
      group.count++;
    });

    return Array.from(groups.entries()).map(([key, group]) => ({
      date: group.date,
      total: group.total,
      average: group.total / group.count,
      count: group.count,
    }));
  }

  // ==========================================================================
  // Métodos específicos para tipos de producción (ej. leche, peso)
  // ==========================================================================
  private generateProductionCode(): string {
    return `PROD-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
  /**
   * Registra producción de leche (conveniencia)
   */
  async recordMilkProduction(
    bovineId: string,
    liters: number,
    productionDate: Date,
    userId: string,
  ): Promise<Production> {
    return this.createProduction(
      {
        bovineId,
        productionType: ProductionType.MILK,
        quantity: liters,
        unit: 'L',
        productionDate,
        productionCode: this.generateProductionCode(),
        status: ProductionStatus.PLANNED,
        createdBy: userId,
        isCompleted: false,
        isApproved: false,
        isActive: true,
      },
      userId
    );
  }

  /**
   * Registra peso del bovino
   */
  async recordWeight(
    bovineId: string,
    weightKg: number,
    productionDate: Date,
    userId: string,
  ): Promise<Production> {
    return this.createProduction(
      {
        bovineId,
        productionType: ProductionType.MEAT,
        quantity: weightKg,
        unit: 'KG',
        productionDate,
        productionCode: this.generateProductionCode(),
        status: ProductionStatus.PLANNED,
        createdBy: userId,
        isCompleted: false,
        isApproved: false,
        isActive: true,
      },
      userId
    );
  }

  // ==========================================================================
  // Alertas (opcional, si se inyecta notificationService)
  // ==========================================================================

  private async checkProductionAlerts(production: Production): Promise<void> {
    if (!this.notificationService) return;

    // Alerta de baja producción de leche
    if (production.productionType === ProductionType.MILK && production.quantity < 5) {

      let ranchId: string | undefined;
      const bovine = await this.bovineModel.findByPk(production.bovineId);
      if (bovine) {
        ranchId = bovine.ranchId;
      }
      await this.notificationService.sendNotification({
        userId: production.createdBy,
        type: NotificationType.PRODUCTION_ALERT, // agregar al enum enun futuro este tipo de notificaciones
        priority: NotificationPriority.HIGH,
        title: 'Baja producción de leche',
        content: `Producción de leche por debajo del promedio: ${production.quantity}L para el bovino ${production.bovineId}`,
        data: {
          bovineId: production.bovineId,
          quantity: production.quantity,
          unit: production.unit,
          productionDate: production.productionDate,
        },
        metadata: {
          bovineId: production.bovineId,
          ranchId: ranchId, // Si no tienes ranchId en production, obténlo del bovino
        },
      });
    }

    // Aquí puedes añadir más alertas según necesidades
  }


  /**
 * Obtiene los bovinos con mayor producción total en un rancho durante un período.
 * @param ranchId ID del rancho
 * @param startDate Fecha de inicio
 * @param endDate Fecha de fin
 * @param limit Número máximo de resultados (por defecto 10)
 * @returns Lista de bovinos con su producción total, unidad y arete
 */
  async getTopProducersByRanch(
    ranchId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<Array<{ bovineId: string; earTag: string; total: number; unit: string }>> {
    // 1. Obtener todos los bovinos activos del rancho
    const bovines = await this.bovineModel.findAll({
      where: { ranchId, isActive: true },
      attributes: ['id', 'earTag'],
    });

    const bovineIds = bovines.map(b => b.id);
    if (bovineIds.length === 0) return [];

    // 2. Obtener todos los registros de producción de esos bovinos en el período
    const records = await this.productionModel.findAll({
      where: {
        bovineId: { [Op.in]: bovineIds },
        productionDate: { [Op.between]: [startDate, endDate] },
      },
      attributes: ['bovineId', 'quantity', 'unit'],
    });

    // 3. Agrupar por bovineId y sumar cantidades
    const grouped = records.reduce((acc, record) => {
      const id = record.bovineId;
      if (!acc[id]) {
        acc[id] = { total: 0, unit: record.unit, earTag: '' };
      }
      acc[id].total += record.quantity;
      // La unidad se asume consistente para el mismo tipo de producción
      // Si hay mezcla de unidades (raro), se tomaría la primera; pero en la práctica suele ser igual.
      return acc;
    }, {} as Record<string, { total: number; unit: string; earTag: string }>);

    // 4. Agregar el earTag desde la lista de bovinos
    for (const bovine of bovines) {
      if (grouped[bovine.id]) {
        grouped[bovine.id].earTag = bovine.earTag;
      }
    }

    // 5. Convertir a array, ordenar y limitar
    const producers = Object.entries(grouped).map(([bovineId, data]) => ({
      bovineId,
      earTag: data.earTag,
      total: data.total,
      unit: data.unit,
    }));

    producers.sort((a, b) => b.total - a.total);
    return producers.slice(0, limit);
  }
}