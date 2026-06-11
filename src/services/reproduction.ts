// src/services/reproduction/ReproductionService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import Reproduction, {
  ReproductionAttributes,
  ReproductionCreationAttributes,
  ReproductionType,
  ServiceStatus,
  SireInfo,
  ServiceInfo,
  HeatInfo,
  PregnancyInfo,
  CalvingInfo,
  CalfInfo,
  WeaningInfo,
} from '../models/Reproduction';
import Bovine from '../models/Bovine';
import { ValidationError } from '../utils/errorUtils';
import { NotificationType, NotificationPriority } from '../models/Notification';

export class ReproductionService {
  constructor(
    private reproductionModel: typeof Reproduction,
    private bovineModel: typeof Bovine,
    private notificationService?: any
  ) { }

  // ==========================================================================
  // Métodos genéricos
  // ==========================================================================

  async createEvent(
    data: Omit<ReproductionCreationAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'createdBy'>,
    userId: string,
    transaction?: Transaction
  ): Promise<Reproduction> {
    const t = transaction || await sequelize.transaction();
    try {
      const bovine = await this.bovineModel.findByPk(data.damId, { transaction: t });
      if (!bovine) throw new ValidationError(`Bovino con ID ${data.damId} no encontrado`);

      const event = await this.reproductionModel.create(
        { ...data, createdBy: userId },
        { transaction: t }
      );

      if (!transaction) await t.commit();

      if (this.notificationService) {
        await this.checkReproductionAlerts(event);
      }

      return event;
    } catch (error) {
      if (!transaction) await t.rollback();
      throw error;
    }
  }

  async getEventById(id: string): Promise<Reproduction | null> {
    return await this.reproductionModel.findByPk(id);
  }

  async getEventsByBovine(
    damId: string,
    filters?: { reproductionType?: ReproductionType; startDate?: Date; endDate?: Date; limit?: number; offset?: number }
  ): Promise<{ rows: Reproduction[]; count: number }> {
    const where: any = { damId };
    if (filters?.reproductionType) where.reproductionType = filters.reproductionType;
    // Construir condiciones de fecha usando serviceInfo->>'serviceDate'
    if (filters?.startDate || filters?.endDate) {
      const dateConditions = [];
      if (filters.startDate) {
        dateConditions.push(
          sequelize.literal(`("serviceInfo"->>'serviceDate')::timestamp >= '${filters.startDate.toISOString()}'`)
        );
      }
      if (filters.endDate) {
        dateConditions.push(
          sequelize.literal(`("serviceInfo"->>'serviceDate')::timestamp <= '${filters.endDate.toISOString()}'`)
        );
      }
      where[Op.and] = dateConditions;
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const { rows, count } = await this.reproductionModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [[sequelize.literal(`("serviceInfo"->>'serviceDate')::timestamp`), 'DESC']],
    });

    return { rows, count };
  }

  async getEventsByRanch(
    ranchId: string,
    filters?: { reproductionType?: ReproductionType; startDate?: Date; endDate?: Date; limit?: number; offset?: number }
  ): Promise<{ rows: Reproduction[]; count: number }> {
    const where: any = {};
    if (filters?.reproductionType) where.reproductionType = filters.reproductionType;
    // Condiciones de fecha
    if (filters?.startDate || filters?.endDate) {
      const dateConditions = [];
      if (filters.startDate) {
        dateConditions.push(
          sequelize.literal(`("serviceInfo"->>'serviceDate')::timestamp >= '${filters.startDate.toISOString()}'`)
        );
      }
      if (filters.endDate) {
        dateConditions.push(
          sequelize.literal(`("serviceInfo"->>'serviceDate')::timestamp <= '${filters.endDate.toISOString()}'`)
        );
      }
      where[Op.and] = dateConditions;
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const { rows, count } = await this.reproductionModel.findAndCountAll({
      include: [
        {
          model: this.bovineModel,
          as: 'dam',
          where: {
            ranchId,
            isActive: true,
          },
          attributes: [],
          required: true,
        },
      ],
      where,
      limit,
      offset,
      subQuery: false,
      order: [[sequelize.literal(`("serviceInfo"->>'serviceDate')::timestamp`), 'DESC']],
    });

    return { rows, count };
  }

  async updateEvent(
    id: string,
    data: Partial<ReproductionAttributes>,
    userId: string,
    transaction?: Transaction
  ): Promise<Reproduction> {
    const t = transaction || await sequelize.transaction();
    try {
      const event = await this.reproductionModel.findByPk(id, { transaction: t });
      if (!event) throw new ValidationError(`Evento con ID ${id} no encontrado`);

      await event.update({ ...data, updatedBy: userId }, { transaction: t });
      if (!transaction) await t.commit();

      return event;
    } catch (error) {
      if (!transaction) await t.rollback();
      throw error;
    }
  }

  async deleteEvent(id: string, userId: string, transaction?: Transaction): Promise<void> {
    const t = transaction || await sequelize.transaction();
    try {
      const event = await this.reproductionModel.findByPk(id, { transaction: t });
      if (!event) throw new ValidationError(`Evento con ID ${id} no encontrado`);

      await event.destroy({ transaction: t });
      if (!transaction) await t.commit();
    } catch (error) {
      if (!transaction) await t.rollback();
      throw error;
    }
  }

  // ==========================================================================
  // Métodos específicos por tipo de evento
  // ==========================================================================

  private generateReproductionCode(): string {
    return `REP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  async recordHeat(
    damId: string,
    heatInfo: HeatInfo,
    eventDate: Date,
    userId: string,
    metadata?: any
  ): Promise<Reproduction> {
    const eventData: Omit<ReproductionCreationAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> = {
      reproductionCode: this.generateReproductionCode(),
      damId,
      reproductionType: ReproductionType.NATURAL_SERVICE,
      status: ServiceStatus.IN_HEAT,
      sireInfo: { sireName: '', sireBreed: '' },
      serviceInfo: {
        serviceDate: eventDate,
        serviceTime: '',
        serviceNumber: 0,
        serviceMethod: ReproductionType.NATURAL_SERVICE,
        serviceLocation: { latitude: 0, longitude: 0 },
      },
      heatInfo,
      isCompleted: false,
      isSuccessful: false,
      notes: metadata?.notes,
      createdBy: userId,
    };
    return this.createEvent(eventData, userId);
  }

  async recordInsemination(
    damId: string,
    serviceInfo: ServiceInfo,
    sireInfo: SireInfo,
    eventDate: Date,
    userId: string,
    metadata?: any
  ): Promise<Reproduction> {
    const eventData: Omit<ReproductionCreationAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> = {
      reproductionCode: this.generateReproductionCode(),
      damId,
      reproductionType: serviceInfo.serviceMethod,
      status: ServiceStatus.SERVICED,
      sireInfo,
      serviceInfo,
      isCompleted: false,
      isSuccessful: false,
      notes: metadata?.notes,
      createdBy: userId,
    };
    return this.createEvent(eventData, userId);
  }

  async confirmPregnancy(
    damId: string,
    pregnancyInfo: PregnancyInfo,
    eventDate: Date,
    userId: string,
    metadata?: any
  ): Promise<Reproduction> {
    const eventData: Omit<ReproductionCreationAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> = {
      reproductionCode: this.generateReproductionCode(),
      damId,
      reproductionType: ReproductionType.SYNCHRONIZED_BREEDING,
      status: ServiceStatus.CONFIRMED_PREGNANT,
      sireInfo: { sireName: '', sireBreed: '' },
      serviceInfo: {
        serviceDate: eventDate,
        serviceTime: '',
        serviceNumber: 0,
        serviceMethod: ReproductionType.SYNCHRONIZED_BREEDING,
        serviceLocation: { latitude: 0, longitude: 0 },
      },
      pregnancyInfo,
      isCompleted: false,
      isSuccessful: false,
      notes: metadata?.notes,
      createdBy: userId,
    };
    return this.createEvent(eventData, userId);
  }

  async recordBirth(
    damId: string,
    calvingInfo: CalvingInfo,
    calfInfo: CalfInfo,
    eventDate: Date,
    userId: string,
    metadata?: any
  ): Promise<Reproduction> {
    const eventData: Omit<ReproductionCreationAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> = {
      reproductionCode: this.generateReproductionCode(),
      damId,
      reproductionType: ReproductionType.SYNCHRONIZED_BREEDING,
      status: ServiceStatus.CALVED,
      sireInfo: { sireName: '', sireBreed: '' },
      serviceInfo: {
        serviceDate: eventDate,
        serviceTime: '',
        serviceNumber: 0,
        serviceMethod: ReproductionType.SYNCHRONIZED_BREEDING,
        serviceLocation: { latitude: 0, longitude: 0 },
      },
      calvingInfo,
      calfInfo,
      isCompleted: false,
      isSuccessful: false,
      notes: metadata?.notes,
      createdBy: userId,
    };
    return this.createEvent(eventData, userId);
  }

  // ==========================================================================
  // Métricas
  // ==========================================================================

  async getConceptionRate(
    ranchId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const events = await this.getEventsByRanch(ranchId, {
      reproductionType: ReproductionType.ARTIFICIAL_INSEMINATION,
      startDate,
      endDate,
      limit: 1000000,
    });
    const inseminations = events.rows;

    const pregnancies = await this.getEventsByRanch(ranchId, {
      reproductionType: ReproductionType.SYNCHRONIZED_BREEDING,
      startDate,
      endDate,
      limit: 1000000,
    });
    const confirmed = pregnancies.rows.filter(p => p.status === ServiceStatus.CONFIRMED_PREGNANT);

    if (inseminations.length === 0) return 0;
    return (confirmed.length / inseminations.length) * 100;
  }

  async getAverageCalvingInterval(ranchId: string): Promise<number> {
    const births = await this.getEventsByRanch(ranchId, {
      reproductionType: ReproductionType.SYNCHRONIZED_BREEDING,
      limit: 1000000,
    });
    const birthRecords = births.rows.filter(b => b.status === ServiceStatus.CALVED);
    if (birthRecords.length < 2) return 0;

    // Ordenar por fecha de parto usando serviceInfo.serviceDate
    const sorted = birthRecords.sort((a, b) => {
      const dateA = new Date(a.serviceInfo.serviceDate);
      const dateB = new Date(b.serviceInfo.serviceDate);
      return dateA.getTime() - dateB.getTime();
    });
    let totalDays = 0;
    for (let i = 1; i < sorted.length; i++) {
      const diff = sorted[i].serviceInfo.serviceDate.getTime() - sorted[i - 1].serviceInfo.serviceDate.getTime();
      totalDays += diff / (1000 * 60 * 60 * 24);
    }
    return totalDays / (sorted.length - 1);
  }

  // ==========================================================================
  // Alertas
  // ==========================================================================

  private async checkReproductionAlerts(event: Reproduction): Promise<void> {
    if (!this.notificationService) return;
    // Ejemplo básico: alerta si una inseminación no se confirma después de 30 días
    if (event.reproductionType === ReproductionType.ARTIFICIAL_INSEMINATION && event.status !== ServiceStatus.CONFIRMED_PREGNANT) {
      const daysSinceService = (Date.now() - event.serviceInfo.serviceDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceService > 30) {
        await this.notificationService.sendNotification({
          userId: event.createdBy,
          type: NotificationType.REPRODUCTION_ALERT,
          priority: NotificationPriority.HIGH,
          title: '📅 Chequeo de preñez pendiente',
          content: `El bovino ${event.damId} necesita chequeo de preñez. Han pasado ${Math.floor(daysSinceService)} días desde la inseminación.`,
          data: {
            damId: event.damId,
            serviceDate: event.serviceInfo.serviceDate,
            daysSinceService,
          },
          metadata: {
            bovineId: event.damId,
            reproductionEventId: event.id,
          },
        });
      }
    }
  }
}