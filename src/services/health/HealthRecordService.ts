// services/health/HealthRecordService.ts
import { Op, Transaction, literal } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import { HealthError, BovineNotFoundError, EventNotFoundError, } from '../../utils/HealthErrors';
import { ensureError } from '../../utils/errorUtils';

import Health, {
  HealthAttributes,
  HealthCreationAttributes,
  HealthRecordType,
  VitalSigns,
  PhysicalExamination,
  Symptoms,
  Diagnosis,
  Treatment,
  LaboratoryResults,
  NutritionalAssessment,
  ReproductiveAssessment,
} from '../../models/Health';
import Bovine, { HealthStatus } from '../../models/Bovine';
import Event, { EventStatus, EventType, EventPriority } from '../../models/Event';
import Disease from '../../models/Disease';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface CreateHealthRecordDTO {
  bovineId: string;
  eventId?: string; // opcional, para vincular con un evento programado
  recordType: HealthRecordType;
  recordDate: Date;
  veterinarianId?: string;
  veterinarianName?: string;
  veterinarianLicense?: string;
  technicianId?: string;
  location?: any; // LocationData
  chiefComplaint?: string;
  historyPresent?: string;
  historyPast?: string;
  vitalSigns?: VitalSigns;
  physicalExam?: PhysicalExamination;
  symptoms?: Symptoms;
  diagnosis: Diagnosis; // obligatorio
  treatment?: Treatment;
  laboratoryResults?: LaboratoryResults[];
  nutritionalAssessment?: NutritionalAssessment;
  reproductiveAssessment?: ReproductiveAssessment;
  overallHealthStatus: HealthStatus;
  recommendations?: string[];
  attachments?: string[];
  photos?: string[];
  xrays?: string[];
  videos?: string[];
  notes?: string;
  privateNotes?: string;
  cost?: number;
  currency?: string;
  followUpRequired?: boolean;
  followUpDate?: Date;
  followUpNotes?: string;
  isEmergency?: boolean;
  weatherConditions?: string;
  environmentalFactors?: string[];
  diseaseId?: string;   // FK opcional al catálogo de enfermedades
  createdBy: string;
}

// DTO para actualizar un registro existente (campos editables solamente)
export interface UpdateHealthRecordDTO {
  chiefComplaint?: string;
  historyPresent?: string;
  historyPast?: string;
  vitalSigns?: VitalSigns;
  physicalExam?: PhysicalExamination;
  symptoms?: Symptoms;
  diagnosis?: Diagnosis;
  treatment?: Treatment;
  laboratoryResults?: LaboratoryResults[];
  nutritionalAssessment?: NutritionalAssessment;
  reproductiveAssessment?: ReproductiveAssessment;
  overallHealthStatus?: HealthStatus;
  recommendations?: string[];
  followUpRequired?: boolean;
  followUpDate?: Date;
  followUpNotes?: string;
  notes?: string;
  privateNotes?: string;
  cost?: number;
  isEmergency?: boolean;
  weatherConditions?: string;
  environmentalFactors?: string[];
  diseaseId?: string | null;  // null para desvincular
  updatedBy?: string;
}

// Filtros para el listado global paginado
export interface GetHealthRecordsFilters {
  ranchId?: string;
  bovineId?: string;
  recordType?: HealthRecordType[];
  startDate?: Date;
  endDate?: Date;
  veterinarianId?: string;
  overallHealthStatus?: HealthStatus[];
  isEmergency?: boolean;
  followUpRequired?: boolean;
  diseaseId?: string;
  search?: string;          // busca en chiefComplaint y diagnosis.primaryDiagnosis
  diagnosisConfirmed?: boolean; // true = solo con confirmedAt en el JSONB diagnosis
}

export interface GetHealthRecordsOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface HealthRecordsPage {
  data: Health[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface HealthRecordFilters {
  bovineId?: string;
  recordType?: HealthRecordType[];
  startDate?: Date;
  endDate?: Date;
  veterinarianId?: string;
  overallHealthStatus?: HealthStatus[];
  isEmergency?: boolean;
  followUpRequired?: boolean;
  limit?: number;
  offset?: number;
}

export interface HealthSummary {
  bovineId: string;
  bovineName?: string;
  earTag?: string;
  lastRecordDate?: Date;
  totalRecords: number;
  healthStatus: HealthStatus;
  pendingFollowUps: number;
  lastDiagnosis?: string;
  lastTreatment?: string;
  totalCost: number;
  currency: string;
  daysSinceLastRecord: number | null;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class HealthRecordService {
  private readonly context = 'HealthRecordService';

  // ==========================================================================
  // CREACIÓN
  // ==========================================================================

  async createHealthRecord(data: CreateHealthRecordDTO, transaction?: Transaction): Promise<Health> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      // 1. Validar que el bovino existe
      const bovine = await Bovine.findByPk(data.bovineId, { transaction: t });
      if (!bovine) {
        throw new HealthError(`Bovino con ID ${data.bovineId} no encontrado`, 'BOVINE_NOT_FOUND', 404);
      }

      // 2. Si se proporciona eventId, verificar que existe y no está completado
      if (data.eventId) {
        const event = await Event.findByPk(data.eventId, { transaction: t });
        if (!event) {
          throw new HealthError(`Evento con ID ${data.eventId} no encontrado`, 'EVENT_NOT_FOUND', 404);
        }
        // Opcional: marcar el evento como completado o vincularlo? Por ahora solo validamos existencia.
        // Podríamos actualizar el evento para apuntar al healthRecord, pero eso lo hace EventService.
      }

      // 3. Construir el registro de salud
      const healthRecord = await Health.create(
        {
          bovineId: data.bovineId,
          eventId: data.eventId,
          diseaseId: data.diseaseId,
          recordType: data.recordType,
          recordDate: data.recordDate,
          veterinarianId: data.veterinarianId,
          veterinarianName: data.veterinarianName,
          veterinarianLicense: data.veterinarianLicense,
          technicianId: data.technicianId,
          location: data.location,
          chiefComplaint: data.chiefComplaint,
          historyPresent: data.historyPresent,
          historyPast: data.historyPast,
          vitalSigns: data.vitalSigns,
          physicalExam: data.physicalExam,
          symptoms: data.symptoms,
          diagnosis: data.diagnosis,
          treatment: data.treatment,
          laboratoryResults: data.laboratoryResults,
          nutritionalAssessment: data.nutritionalAssessment,
          reproductiveAssessment: data.reproductiveAssessment,
          overallHealthStatus: data.overallHealthStatus,
          recommendations: data.recommendations,
          attachments: data.attachments,
          photos: data.photos,
          xrays: data.xrays,
          videos: data.videos,
          notes: data.notes,
          privateNotes: data.privateNotes,
          cost: data.cost,
          currency: data.currency,
          followUpRequired: data.followUpRequired || false,
          followUpDate: data.followUpDate,
          followUpNotes: data.followUpNotes,
          isEmergency: data.isEmergency || false,
          weatherConditions: data.weatherConditions,
          environmentalFactors: data.environmentalFactors,
          createdBy: data.createdBy,
        } as HealthCreationAttributes,
        { transaction: t }
      );

      // 4. Actualizar el bovino con la última fecha de chequeo y estado de salud
      await bovine.update(
        {
          lastHealthCheck: data.recordDate,
          healthStatus: data.overallHealthStatus,
          nextHealthCheck: data.followUpDate, // opcional
        },
        { transaction: t }
      );

      // 5. Crear evento de seguimiento si se requiere
      if (data.followUpRequired && data.followUpDate) {
        await Event.create(
          {
            bovineId:      data.bovineId,
            eventType:     EventType.HEALTH_CHECK,
            title:         `Seguimiento: ${data.chiefComplaint ?? healthRecord.id}`,
            description:   data.followUpNotes ?? 'Seguimiento de consulta médica',
            scheduledDate: data.followUpDate,
            status:        EventStatus.SCHEDULED,
            priority:      EventPriority.HIGH,
            healthRecordId: healthRecord.id,
            requiresVeterinarian: true,
            isActive:      true,
            createdBy:     data.createdBy,
          } as any,
          { transaction: t }
        );
      }

      // 6. Opcional: actualizar el evento si existe para marcarlo como completado y vincularlo
      if (data.eventId) {
        await Event.update(
          {
            status: EventStatus.COMPLETED,
            healthRecordId: healthRecord.id,
            endDate: new Date(),
          },
          { where: { id: data.eventId }, transaction: t }
        );
      }

      if (isOwnTransaction) await t.commit();

      logger.info(`Registro de salud creado: ${healthRecord.id}`, this.context, {
        bovineId: data.bovineId,
        recordType: data.recordType,
        durationMs: Date.now() - startTime,
      });

      return healthRecord;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error('Error creando registro de salud', this.context, { data }, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // CONSULTAS
  // ==========================================================================

  async getBovineHealthHistory(
    bovineId: string,
    filters: Omit<HealthRecordFilters, 'bovineId'> = {}
  ): Promise<{ rows: Health[]; count: number }> {
    try {
      const where: any = { bovineId };
      if (filters.recordType?.length) where.recordType = { [Op.in]: filters.recordType };
      if (filters.startDate) where.recordDate = { [Op.gte]: filters.startDate };
      if (filters.endDate) where.recordDate = { ...where.recordDate, [Op.lte]: filters.endDate };
      if (filters.veterinarianId) where.veterinarianId = filters.veterinarianId;
      if (filters.overallHealthStatus?.length) where.overallHealthStatus = { [Op.in]: filters.overallHealthStatus };
      if (filters.isEmergency !== undefined) where.isEmergency = filters.isEmergency;
      if (filters.followUpRequired !== undefined) where.followUpRequired = filters.followUpRequired;

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const { rows, count } = await Health.findAndCountAll({
        where,
        limit,
        offset,
        order: [['recordDate', 'DESC']],
      });

      logger.debug(`Historial de salud obtenido para bovino ${bovineId}`, this.context, {
        count,
        filters,
      });

      return { rows, count };
    } catch (error) {
      logger.error(`Error obteniendo historial de salud del bovino ${bovineId}`, this.context, { bovineId, filters }, ensureError(error));
      throw error;
    }
  }

  async getHealthRecordById(id: string): Promise<Health | null> {
    try {
      return await Health.findByPk(id);
    } catch (error) {
      logger.error(`Error obteniendo registro de salud ${id}`, this.context, { id }, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // UTILIDADES CLÍNICAS
  // ==========================================================================

  getDaysSinceRecord(record: Health): number {
    const now = new Date();
    const recordDate = new Date(record.recordDate);
    const diffTime = now.getTime() - recordDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  hasAbnormalVitalSigns(vitalSigns?: VitalSigns): boolean {
    if (!vitalSigns) return false;

    // Valores de referencia típicos para bovinos (ajustar según especie/edad)
    const normalRanges = {
      temperature: { min: 38.0, max: 39.3 }, // °C
      heartRate: { min: 48, max: 84 }, // latidos/min
      respiratoryRate: { min: 10, max: 30 }, // resp/min
      capillaryRefillTime: { min: 1, max: 2 }, // segundos
    };

    if (vitalSigns.temperature && (vitalSigns.temperature < normalRanges.temperature.min || vitalSigns.temperature > normalRanges.temperature.max))
      return true;
    if (vitalSigns.heartRate && (vitalSigns.heartRate < normalRanges.heartRate.min || vitalSigns.heartRate > normalRanges.heartRate.max))
      return true;
    if (vitalSigns.respiratoryRate && (vitalSigns.respiratoryRate < normalRanges.respiratoryRate.min || vitalSigns.respiratoryRate > normalRanges.respiratoryRate.max))
      return true;
    if (vitalSigns.capillaryRefillTime && (vitalSigns.capillaryRefillTime < normalRanges.capillaryRefillTime.min || vitalSigns.capillaryRefillTime > normalRanges.capillaryRefillTime.max))
      return true;

    return false;
  }

  getTotalCost(record: Health): number {
    let total = 0;
    if (record.cost) total += record.cost;
    if (record.treatment?.medications) {
      for (const med of record.treatment.medications) {
        if (med.cost) total += med.cost;
      }
    }
    if (record.laboratoryResults) {
      for (const lab of record.laboratoryResults) {
        if (lab.cost) total += lab.cost;
      }
    }
    return total;
  }

  // ==========================================================================
  // ACTUALIZACIÓN
  // ==========================================================================

  async updateHealthRecord(
    id: string,
    data: UpdateHealthRecordDTO,
    updatedBy: string
  ): Promise<Health> {
    try {
      const record = await Health.findByPk(id);
      if (!record) {
        throw new HealthError(`Registro de salud ${id} no encontrado`, 'HEALTH_RECORD_NOT_FOUND', 404);
      }

      const updateData: Partial<HealthAttributes> = { updatedBy };

      if (data.chiefComplaint        !== undefined) updateData.chiefComplaint        = data.chiefComplaint;
      if (data.historyPresent        !== undefined) updateData.historyPresent        = data.historyPresent;
      if (data.historyPast           !== undefined) updateData.historyPast           = data.historyPast;
      if (data.vitalSigns            !== undefined) updateData.vitalSigns            = data.vitalSigns;
      if (data.physicalExam          !== undefined) updateData.physicalExam          = data.physicalExam;
      if (data.symptoms              !== undefined) updateData.symptoms              = data.symptoms;
      if (data.diagnosis             !== undefined) updateData.diagnosis             = data.diagnosis;
      if (data.treatment             !== undefined) updateData.treatment             = data.treatment;
      if (data.laboratoryResults     !== undefined) updateData.laboratoryResults     = data.laboratoryResults;
      if (data.nutritionalAssessment !== undefined) updateData.nutritionalAssessment = data.nutritionalAssessment;
      if (data.reproductiveAssessment !== undefined) updateData.reproductiveAssessment = data.reproductiveAssessment;
      if (data.overallHealthStatus   !== undefined) updateData.overallHealthStatus   = data.overallHealthStatus;
      if (data.recommendations       !== undefined) updateData.recommendations       = data.recommendations;
      if (data.followUpRequired      !== undefined) updateData.followUpRequired      = data.followUpRequired;
      if (data.followUpDate          !== undefined) updateData.followUpDate          = data.followUpDate;
      if (data.followUpNotes         !== undefined) updateData.followUpNotes         = data.followUpNotes;
      if (data.notes                 !== undefined) updateData.notes                 = data.notes;
      if (data.privateNotes          !== undefined) updateData.privateNotes          = data.privateNotes;
      if (data.cost                  !== undefined) updateData.cost                  = data.cost;
      if (data.isEmergency           !== undefined) updateData.isEmergency           = data.isEmergency;
      if (data.weatherConditions     !== undefined) updateData.weatherConditions     = data.weatherConditions;
      if (data.environmentalFactors  !== undefined) updateData.environmentalFactors  = data.environmentalFactors;
      if (data.diseaseId             !== undefined) updateData.diseaseId             = data.diseaseId ?? undefined;

      await record.update(updateData);

      logger.info(`Registro de salud actualizado: ${id}`, this.context, { id, updatedBy });
      return record;
    } catch (error) {
      logger.error(`Error actualizando registro de salud ${id}`, this.context, { id }, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // ELIMINACIÓN (soft delete)
  // ==========================================================================

  async deleteHealthRecord(id: string): Promise<void> {
    try {
      const record = await Health.findByPk(id);
      if (!record) {
        throw new HealthError(`Registro de salud ${id} no encontrado`, 'HEALTH_RECORD_NOT_FOUND', 404);
      }
      await record.destroy(); // paranoid: true → setea deletedAt
      logger.info(`Registro de salud eliminado (soft): ${id}`, this.context, { id });
    } catch (error) {
      logger.error(`Error eliminando registro de salud ${id}`, this.context, { id }, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // LISTADO GLOBAL PAGINADO
  // ==========================================================================

  async getHealthRecords(
    filters: GetHealthRecordsFilters = {},
    options: GetHealthRecordsOptions = {}
  ): Promise<HealthRecordsPage> {
    try {
      const page      = Math.max(1, options.page  ?? 1);
      const limit     = Math.min(100, Math.max(1, options.limit ?? 50));
      const offset    = (page - 1) * limit;
      const sortBy    = options.sortBy    ?? 'recordDate';
      const sortOrder = options.sortOrder ?? 'DESC';

      // ── WHERE conditions ──────────────────────────────────────────────────
      const where: any = {};

      if (filters.bovineId)         where.bovineId            = filters.bovineId;
      if (filters.veterinarianId)   where.veterinarianId      = filters.veterinarianId;
      if (filters.isEmergency       !== undefined) where.isEmergency       = filters.isEmergency;
      if (filters.followUpRequired  !== undefined) where.followUpRequired  = filters.followUpRequired;
      if (filters.diseaseId)        where.diseaseId            = filters.diseaseId;

      if (filters.recordType?.length)
        where.recordType = { [Op.in]: filters.recordType };

      if (filters.overallHealthStatus?.length)
        where.overallHealthStatus = { [Op.in]: filters.overallHealthStatus };

      if (filters.startDate || filters.endDate) {
        where.recordDate = {};
        if (filters.startDate) where.recordDate[Op.gte] = filters.startDate;
        if (filters.endDate)   where.recordDate[Op.lte] = filters.endDate;
      }

      if (filters.search) {
        const q = `%${filters.search}%`;
        where[Op.or] = [
          { chiefComplaint: { [Op.iLike]: q } },
        ];
      }

      // Filtro por diagnóstico confirmado: comprueba que diagnosis->>'confirmedAt' no sea null
      if (filters.diagnosisConfirmed !== undefined) {
        const diagCondition = filters.diagnosisConfirmed
          ? literal(`"Health"."diagnosis"->>'confirmedAt' IS NOT NULL`)
          : literal(`("Health"."diagnosis"->>'confirmedAt' IS NULL OR "Health"."diagnosis" IS NULL)`);
        where[Op.and] = [...(Array.isArray(where[Op.and]) ? where[Op.and] : []), diagCondition];
      }

      // ── INCLUDE: bovino (siempre) + disease (solo si hay asociación) ──────
      const include: any[] = [
        {
          model: Bovine,
          as: 'bovine',
          attributes: ['id', 'earTag', 'name', 'ranchId'],
          required: filters.ranchId ? true : false,
          ...(filters.ranchId ? { where: { ranchId: filters.ranchId } } : {}),
        },
        {
          model: Disease,
          as: 'disease',
          attributes: ['id', 'name', 'slug', 'severity'],
          required: false,
        },
      ];

      const { rows, count } = await Health.findAndCountAll({
        where,
        include,
        order:    [[sortBy, sortOrder]],
        limit,
        offset,
        distinct: true,
      });

      const totalPages = Math.ceil(count / limit);

      return {
        data: rows,
        pagination: {
          page,
          limit,
          total: count,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Error obteniendo listado global de registros de salud', this.context, { filters, options }, ensureError(error));
      throw error;
    }
  }

  async getHealthSummary(bovineId: string): Promise<HealthSummary | null> {
    try {
      const bovine = await Bovine.findByPk(bovineId, {
        attributes: ['id', 'name', 'earTag', 'healthStatus', 'lastHealthCheck', 'nextHealthCheck'],
      });
      if (!bovine) return null;

      const totalRecords = await Health.count({ where: { bovineId } });

      const pendingFollowUps = await Health.count({
        where: {
          bovineId,
          followUpRequired: true,
          followUpDate: { [Op.gte]: new Date() }, // futuros
        },
      });

      const lastRecord = await Health.findOne({
        where: { bovineId },
        order: [['recordDate', 'DESC']],
        attributes: ['recordDate', 'diagnosis', 'treatment', 'cost', 'currency'],
      });

      const daysSinceLastRecord = lastRecord ? this.getDaysSinceRecord(lastRecord) : null;

      const totalCost = lastRecord ? this.getTotalCost(lastRecord) : 0;
      const currency = lastRecord?.currency || 'MXN';

      const summary: HealthSummary = {
        bovineId,
        bovineName: bovine.name,
        earTag: bovine.earTag,
        lastRecordDate: lastRecord?.recordDate,
        totalRecords,
        healthStatus: bovine.healthStatus,
        pendingFollowUps,
        lastDiagnosis: lastRecord?.diagnosis?.primaryDiagnosis,
        lastTreatment: lastRecord?.treatment?.treatmentPlan,
        totalCost,
        currency,
        daysSinceLastRecord,
      };

      return summary;
    } catch (error) {
      logger.error(`Error generando resumen de salud para bovino ${bovineId}`, this.context, { bovineId }, ensureError(error));
      throw error;
    }
  }

  /**
   * Obtiene las enfermedades recientes de un rancho.
   * @param ranchId ID del rancho
   * @param limit Número máximo de registros a devolver (por defecto 10)
   * @returns Lista de registros de salud con información de bovino y diagnóstico
   */
  async getRecentIllnessesByRanch(ranchId: string, limit: number = 10): Promise<any[]> {
    try {
      // Obtener todos los IDs de bovinos del rancho
      const bovines = await Bovine.findAll({
        where: { ranchId, isActive: true },
        attributes: ['id'],
      });
      const bovineIds = bovines.map(b => b.id);

      if (bovineIds.length === 0) {
        return [];
      }

      // Consultar registros de salud con diagnóstico
      const records = await Health.findAll({
        where: {
          bovineId: { [Op.in]: bovineIds },
          diagnosis: { [Op.ne]: null as any}, // solo registros con diagnóstico
        },
        order: [['recordDate', 'DESC']],
        limit,
        include: [
          {
            model: Bovine,
            as: 'bovine', // Asegúrate de que el alias coincida con la asociación definida
            attributes: ['earTag', 'name'],
          },
        ],
      });

      // Formatear los resultados para el reporte
      return records.map(record => ({
        id: record.id,
        bovineId: record.bovineId,
        earTag: (record as any).bovine?.earTag,
        bovineName: (record as any).bovine?.name,
        disease: record.diagnosis?.primaryDiagnosis || 'Sin diagnóstico',
        severity: record.diagnosis?.prognosis || 'No especificada',
        diagnosisDate: record.recordDate,
        status: record.overallHealthStatus,
        location: record.location,
      }));
    } catch (error) {
      logger.error(`Error obteniendo enfermedades recientes del rancho ${ranchId}`, this.context, { ranchId, limit }, ensureError(error));
      throw error;
    }
  }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const healthRecordService = new HealthRecordService();