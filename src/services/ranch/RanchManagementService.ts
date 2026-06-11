// services/ranch/RanchManagementService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import {
  RanchNotFoundError,
  HRNotFoundError,
  EmergencyNotFoundError,
  MediaNotFoundError,
  RanchValidationError,
} from '../../utils/RanchErrors';
import { ensureError } from '../../utils/errorUtils';
import { TURNOVER_RATE_RANGES, SAFETY_SCORE_RANGES } from '../../constants/ranch.constants';

import Ranch from '../../models/Ranch';
import RanchHR, {
  Position,
  SkillLevels,
  TrainingProgram,
  SafetyMetrics,
  LaborCosts,
  RanchHRCreationAttributes,
} from '../../models/RanchHR';
import RanchEmergency, {
  EmergencyContact,
  AssemblyPoint,
  EmergencySupply,
  EmergencyProcedure,
  RanchEmergencyCreationAttributes,
} from '../../models/RanchEmergency';
import RanchMedia, {
  MediaType,
  MediaCategory,
  MediaVisibility,
  RanchMediaCreationAttributes,
} from '../../models/RanchMedia';

// FileService ya no se usa — archivos van directo a R2 via StorageService

// ============================================================================
// DTOs para RRHH
// ============================================================================

export interface HRDTO {
  totalEmployees: number;
  permanentStaff: number;
  temporaryStaff: number;
  managementStaff: number;
  administrativeStaff?: number;
  operationalStaff?: number;
  positions: Position[];
  skillLevels: SkillLevels;
  trainingPrograms: TrainingProgram[];
  safetyMetrics: SafetyMetrics;
  laborCosts: LaborCosts;
  turnoverRate?: number;
  satisfactionScore?: number;
  absenteeismRate?: number;
  productivityScore?: number;
  lastLaborAudit?: Date;
  nextLaborAudit?: Date;
  hasUnion: boolean;
  unionName?: string;
  collectiveBargainingAgreement?: Date;
  activeRecruitment: boolean;
  openPositions: number;
  averageHiringTime?: number;
  notes?: string;
}

// ============================================================================
// DTOs para Emergencia
// ============================================================================

export interface EmergencyDTO {
  contacts: EmergencyContact[];
  assemblyPoints: AssemblyPoint[];
  emergencySupplies: EmergencySupply[];
  procedures: EmergencyProcedure[];
  evacuationPlan?: string;
  evacuationRoutes?: string[];
  musterPoints?: string[];
  emergencyKitLocation?: string;
  firstAidKits: number;
  fireExtinguishers: number;
  emergencyLights: number;
  generators?: number;
  waterTanks?: number;
  lastDrillDate?: Date;
  nextDrillDate?: Date;
  drillFrequency?: string;
  trainedPersonnel: number;
  emergencyRadio?: boolean;
  satellitePhone?: boolean;
  backupCommunication?: string;
  alertSystem?: string;
  warningSigns?: string[];
  coordinatesWithLocalAuthorities: boolean;
  mutualAidAgreements?: string[];
  lastEmergencyAssessment?: Date;
  nextEmergencyAssessment?: Date;
  assessedBy?: string;
  notes?: string;
}

// ============================================================================
// DTOs para Media
// ============================================================================

export interface MediaDTO {
  type: MediaType;
  category: MediaCategory;
  title: string;
  description?: string;
  url: string;
  filename: string;
  filesize: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
  takenDate?: Date;
  latitude?: number;
  longitude?: number;
  tags?: string[];
  visibility?: MediaVisibility;
  locationId?: string;
  bovineId?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class RanchManagementService {
  private readonly context = 'RanchManagementService';
  constructor() { }

  // ==========================================================================
  // RRHH (RanchHR)
  // ==========================================================================

  async getHR(ranchId: string): Promise<RanchHR> {
    const hr = await RanchHR.findByPk(ranchId);
    if (!hr) throw new HRNotFoundError(ranchId);
    return hr;
  }

  async createOrUpdateHR(ranchId: string, data: HRDTO, userId: string, transaction?: Transaction): Promise<RanchHR> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const ranch = await Ranch.findByPk(ranchId, { transaction: t });
      if (!ranch) throw new RanchNotFoundError(ranchId);

      // Validar consistencia de total de empleados
      const total = data.permanentStaff + data.temporaryStaff;
      if (total !== data.totalEmployees) {
        throw new RanchValidationError('La suma de personal permanente y temporal debe igualar el total de empleados');
      }

      const existing = await RanchHR.findByPk(ranchId, { transaction: t });
      const hrData: RanchHRCreationAttributes = {
        ranchId,
        totalEmployees: data.totalEmployees,
        permanentStaff: data.permanentStaff,
        temporaryStaff: data.temporaryStaff,
        managementStaff: data.managementStaff,
        administrativeStaff: data.administrativeStaff,
        operationalStaff: data.operationalStaff,
        positions: data.positions,
        skillLevels: data.skillLevels,
        trainingPrograms: data.trainingPrograms,
        safetyMetrics: data.safetyMetrics,
        laborCosts: data.laborCosts,
        turnoverRate: data.turnoverRate,
        satisfactionScore: data.satisfactionScore,
        absenteeismRate: data.absenteeismRate,
        productivityScore: data.productivityScore,
        lastLaborAudit: data.lastLaborAudit,
        nextLaborAudit: data.nextLaborAudit,
        hasUnion: data.hasUnion,
        unionName: data.unionName,
        collectiveBargainingAgreement: data.collectiveBargainingAgreement,
        activeRecruitment: data.activeRecruitment,
        openPositions: data.openPositions,
        averageHiringTime: data.averageHiringTime,
        notes: data.notes,
      };

      let hr: RanchHR;
      if (existing) {
        await existing.update(hrData, { transaction: t });
        hr = existing;
      } else {
        hr = await RanchHR.create(hrData, { transaction: t });
      }

      if (isOwnTransaction) await t.commit();

      logger.info(`Datos de RRHH ${existing ? 'actualizados' : 'creados'} para rancho ${ranchId}`, this.context, {
        ranchId,
        userId,
        durationMs: Date.now() - startTime,
      });

      return hr;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error en RRHH para rancho ${ranchId}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async calculateProductivity(ranchId: string): Promise<number> {
    const hr = await this.getHR(ranchId);
    // Fórmula simple: productividad = (productivityScore) o podemos calcular con datos de producción
    return hr.productivityScore || 0;
  }

  async analyzeTurnover(ranchId: string): Promise<{ rate: number; status: 'EXCELLENT' | 'NORMAL' | 'ALERT'; recommendations: string[] }> {
    const hr = await this.getHR(ranchId);
    const rate = hr.turnoverRate || 0;
    let status: 'EXCELLENT' | 'NORMAL' | 'ALERT';
    const recommendations: string[] = [];

    if (rate < TURNOVER_RATE_RANGES.LOW) {
      status = 'EXCELLENT';
      recommendations.push('Mantener prácticas actuales de retención.');
    } else if (rate < TURNOVER_RATE_RANGES.MEDIUM) {
      status = 'NORMAL';
      recommendations.push('Realizar encuestas de satisfacción para identificar áreas de mejora.');
    } else {
      status = 'ALERT';
      recommendations.push('Evaluar causas de rotación (salario, ambiente laboral, carga de trabajo).');
      recommendations.push('Implementar programas de retención y desarrollo profesional.');
    }

    return { rate, status, recommendations };
  }

  // ==========================================================================
  // EMERGENCIA
  // ==========================================================================

  async getEmergencyPlan(ranchId: string): Promise<RanchEmergency> {
    const emergency = await RanchEmergency.findByPk(ranchId);
    if (!emergency) throw new EmergencyNotFoundError(ranchId);
    return emergency;
  }

  async createOrUpdateEmergencyPlan(ranchId: string, data: EmergencyDTO, userId: string, transaction?: Transaction): Promise<RanchEmergency> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const ranch = await Ranch.findByPk(ranchId, { transaction: t });
      if (!ranch) throw new RanchNotFoundError(ranchId);

      const existing = await RanchEmergency.findByPk(ranchId, { transaction: t });
      const emergencyData: RanchEmergencyCreationAttributes = {
        ranchId,
        contacts: data.contacts,
        assemblyPoints: data.assemblyPoints,
        emergencySupplies: data.emergencySupplies,
        procedures: data.procedures,
        evacuationPlan: data.evacuationPlan,
        evacuationRoutes: data.evacuationRoutes,
        musterPoints: data.musterPoints,
        emergencyKitLocation: data.emergencyKitLocation,
        firstAidKits: data.firstAidKits,
        fireExtinguishers: data.fireExtinguishers,
        emergencyLights: data.emergencyLights,
        generators: data.generators,
        waterTanks: data.waterTanks,
        lastDrillDate: data.lastDrillDate,
        nextDrillDate: data.nextDrillDate,
        drillFrequency: data.drillFrequency,
        trainedPersonnel: data.trainedPersonnel,
        emergencyRadio: data.emergencyRadio,
        satellitePhone: data.satellitePhone,
        backupCommunication: data.backupCommunication,
        alertSystem: data.alertSystem,
        warningSigns: data.warningSigns,
        coordinatesWithLocalAuthorities: data.coordinatesWithLocalAuthorities,
        mutualAidAgreements: data.mutualAidAgreements,
        lastEmergencyAssessment: data.lastEmergencyAssessment,
        nextEmergencyAssessment: data.nextEmergencyAssessment,
        assessedBy: data.assessedBy,
        notes: data.notes,
        createdBy: existing ? existing.createdBy : userId,
        updatedBy: userId,
      };

      let emergency: RanchEmergency;
      if (existing) {
        await existing.update(emergencyData, { transaction: t });
        emergency = existing;
      } else {
        emergency = await RanchEmergency.create(emergencyData, { transaction: t });
      }

      if (isOwnTransaction) await t.commit();

      logger.info(`Plan de emergencia ${existing ? 'actualizado' : 'creado'} para rancho ${ranchId}`, this.context, {
        ranchId,
        userId,
        durationMs: Date.now() - startTime,
      });

      return emergency;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error en plan de emergencia para rancho ${ranchId}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async assessReadiness(ranchId: string): Promise<{ score: number; level: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'; recommendations: string[] }> {
    const emergency = await this.getEmergencyPlan(ranchId);
    let score = 0;

    // Evaluar contactos de emergencia
    if (emergency.contacts.length >= 3) score += 15;
    else if (emergency.contacts.length > 0) score += 10;
    else score += 0;

    // Evaluar puntos de reunión
    if (emergency.assemblyPoints.length >= 2) score += 10;
    else if (emergency.assemblyPoints.length > 0) score += 5;

    // Evaluar suministros
    if (emergency.emergencySupplies.length >= 5) score += 15;
    else if (emergency.emergencySupplies.length > 0) score += 8;

    // Evaluar equipo
    if (emergency.firstAidKits >= 2) score += 5;
    if (emergency.fireExtinguishers >= 2) score += 5;
    if (emergency.emergencyLights >= 2) score += 5;
    if (emergency.generators && emergency.generators > 0) score += 5;
    if (emergency.waterTanks && emergency.waterTanks > 0) score += 5;

    // Evaluar capacitación
    if (emergency.trainedPersonnel > 0) score += Math.min(15, emergency.trainedPersonnel / 2);
    if (emergency.lastDrillDate) score += 5;

    // Evaluar comunicación
    if (emergency.emergencyRadio || emergency.satellitePhone) score += 5;
    if (emergency.alertSystem) score += 5;

    // Evaluar coordinación
    if (emergency.coordinatesWithLocalAuthorities) score += 5;
    if (emergency.mutualAidAgreements?.length) score += 5;

    let level: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    const recommendations: string[] = [];

    if (score >= 80) {
      level = 'EXCELLENT';
      recommendations.push('Mantener las buenas prácticas y realizar simulacros periódicos.');
    } else if (score >= 60) {
      level = 'GOOD';
      recommendations.push('Fortalecer áreas como equipos de emergencia y capacitación.');
    } else if (score >= 40) {
      level = 'FAIR';
      recommendations.push('Revisar el plan de emergencia, aumentar suministros y realizar más simulacros.');
    } else {
      level = 'POOR';
      recommendations.push('Se requiere una revisión completa del plan de emergencia, incluyendo contactos, equipos y capacitación.');
    }

    return { score, level, recommendations };
  }

  async getEmergencyRecommendations(ranchId: string): Promise<string[]> {
    const assessment = await this.assessReadiness(ranchId);
    return assessment.recommendations;
  }

  // ==========================================================================
  // MEDIA (archivos multimedia)
  // ==========================================================================

  async uploadMedia(
    ranchId: string,
    fileData: {
      url: string;              // URL pública en R2
      storagePath: string;      // Key en R2 (para eliminar después)
      originalName: string;
      mimeType: string;
      size: number;
      thumbnailUrl?: string;
    },
    metadata: {
      type: MediaType;
      category: MediaCategory;
      title: string;
      description?: string;
      tags?: string[];
      takenDate?: Date;
      latitude?: number;
      longitude?: number;
      locationId?: string;
      bovineId?: string;
    },
    userId: string
  ): Promise<RanchMedia> {
    const t = await sequelize.transaction();

    try {
      const ranch = await Ranch.findByPk(ranchId, { transaction: t });
      if (!ranch) throw new RanchNotFoundError(ranchId);

      // Crear registro en RanchMedia con URLs de R2
      const mediaData: RanchMediaCreationAttributes = {
        ranchId,
        type: metadata.type,
        category: metadata.category,
        title: metadata.title,
        description: metadata.description,
        url: fileData.url,
        storagePath: fileData.storagePath,
        filename: fileData.originalName,
        filesize: fileData.size,
        mimeType: fileData.mimeType,
        thumbnailUrl: fileData.thumbnailUrl,
        takenDate: metadata.takenDate,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        tags: metadata.tags,
        locationId: metadata.locationId,
        bovineId: metadata.bovineId,
        uploadedBy: userId,
        visibility: MediaVisibility.PRIVATE,
        uploadDate: new Date()
      };

      const media = await RanchMedia.create(mediaData, { transaction: t });
      await t.commit();

      logger.info(`Archivo multimedia subido: ${media.id} para rancho ${ranchId}`, this.context, {
        mediaId: media.id,
        type: metadata.type,
        userId,
      });

      return media;
    } catch (error) {
      await t.rollback();
      logger.error(`Error subiendo archivo multimedia para rancho ${ranchId}`, this.context, { error });
      throw error;
    }
  }

  async deleteMedia(mediaId: string, transaction?: Transaction): Promise<void> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const media = await RanchMedia.findByPk(mediaId, { transaction: t });
      if (!media) throw new MediaNotFoundError(mediaId);

      // Eliminar archivo de R2 si tiene storagePath
      if (media.storagePath) {
        const { StorageService } = await import('../StorageService');
        const storage = new StorageService();
        await storage.delete(media.storagePath);
      }

      await media.destroy({ transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Archivo multimedia eliminado: ${mediaId}`, this.context, {
        mediaId,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error eliminando archivo multimedia ${mediaId}`, this.context, { mediaId }, ensureError(error));
      throw error;
    }
  }

  async listMedia(ranchId: string, filters?: { type?: MediaType; category?: MediaCategory; tags?: string[]; limit?: number; offset?: number }): Promise<{ rows: RanchMedia[]; count: number }> {
    try {
      const where: any = { ranchId };
      if (filters?.type) where.type = filters.type;
      if (filters?.category) where.category = filters.category;
      if (filters?.tags && filters.tags.length) {
        where.tags = { [Op.overlap]: filters.tags };
      }

      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      const { rows, count } = await RanchMedia.findAndCountAll({
        where,
        limit,
        offset,
        order: [['created_at', 'DESC']],
      });

      return { rows, count };
    } catch (error) {
      logger.error(`Error listando archivos multimedia del rancho ${ranchId}`, this.context, { filters }, ensureError(error));
      throw error;
    }
  }

  async getMediaById(mediaId: string): Promise<RanchMedia | null> {
    return await RanchMedia.findByPk(mediaId);
  }

}


export const ranchManagementService = new RanchManagementService();