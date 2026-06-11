// services/VaccineProtectionService.ts
// ============================================================================
// VACCINE PROTECTION SERVICE
// ============================================================================
// CRUD del catálogo `VaccineDiseaseProtection` (vacuna ↔ enfermedad) + helper
// `getProtectedDiseases(vaccineType)` usado por VaccinationService y por el
// motor epidemiológico para derivar la protección real de cada bovino.
// ============================================================================

import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';
import { BovineError } from '../utils/BovineErrors';

import VaccineDiseaseProtection from '../models/VaccineDiseaseProtection';
import Disease from '../models/Disease';
import { VaccineType } from '../models/Vaccination';

// ============================================================================
// INTERFACES
// ============================================================================

export interface CreateProtectionInput {
  vaccineType: VaccineType;
  diseaseId: string;
  immunityDurationDays: number;
  dosesForImmunity?: number;
  isActive?: boolean;
  notes?: string | null;
}

export interface UpdateProtectionInput {
  immunityDurationDays?: number;
  dosesForImmunity?: number;
  isActive?: boolean;
  notes?: string | null;
}

export interface ListProtectionFilters {
  vaccineType?: VaccineType;
  diseaseId?: string;
  isActive?: boolean;
}

// ============================================================================
// SERVICIO
// ============================================================================

export class VaccineProtectionService {
  private readonly context = 'VaccineProtectionService';

  /**
   * Devuelve las entradas de protección (activas) para un tipo de vacuna,
   * con los metadatos básicos de la enfermedad asociada.
   */
  async getProtectedDiseases(vaccineType: VaccineType): Promise<VaccineDiseaseProtection[]> {
    return VaccineDiseaseProtection.findAll({
      where: { vaccineType, isActive: true },
      include: [
        { model: Disease, as: 'disease', attributes: ['id', 'name', 'slug', 'severity', 'isContagious'] },
      ],
    });
  }

  /**
   * Lista el catálogo con filtros opcionales.
   */
  async list(filters: ListProtectionFilters = {}): Promise<VaccineDiseaseProtection[]> {
    try {
      const where: any = {};
      if (filters.vaccineType) where.vaccineType = filters.vaccineType;
      if (filters.diseaseId)   where.diseaseId   = filters.diseaseId;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;

      return await VaccineDiseaseProtection.findAll({
        where,
        include: [
          { model: Disease, as: 'disease', attributes: ['id', 'name', 'slug', 'category', 'severity'] },
        ],
        order: [['vaccineType', 'ASC']],
      });
    } catch (error) {
      logger.error('Error listando catálogo de protección', this.context, filters as any, ensureError(error));
      throw error;
    }
  }

  async getById(id: string): Promise<VaccineDiseaseProtection> {
    const row = await VaccineDiseaseProtection.findByPk(id, {
      include: [{ model: Disease, as: 'disease', attributes: ['id', 'name', 'slug', 'category', 'severity'] }],
    });
    if (!row) throw new BovineError('Entrada de protección no encontrada', 'PROTECTION_NOT_FOUND', 404);
    return row;
  }

  async create(input: CreateProtectionInput): Promise<VaccineDiseaseProtection> {
    try {
      // Verificar que la enfermedad existe
      const disease = await Disease.findByPk(input.diseaseId);
      if (!disease) {
        throw new BovineError(`Enfermedad no encontrada: ${input.diseaseId}`, 'DISEASE_NOT_FOUND', 404);
      }

      // Evitar duplicado (vaccineType, diseaseId)
      const existing = await VaccineDiseaseProtection.findOne({
        where: { vaccineType: input.vaccineType, diseaseId: input.diseaseId },
      });
      if (existing) {
        throw new BovineError(
          'Ya existe una protección para ese par (tipo de vacuna, enfermedad).',
          'PROTECTION_DUPLICATE',
          409
        );
      }

      const created = await VaccineDiseaseProtection.create({
        vaccineType: input.vaccineType,
        diseaseId: input.diseaseId,
        immunityDurationDays: input.immunityDurationDays,
        dosesForImmunity: input.dosesForImmunity ?? 1,
        isActive: input.isActive ?? true,
        notes: input.notes ?? null,
      });

      logger.info(`Protección creada: ${input.vaccineType} → enfermedad ${input.diseaseId}`, this.context);
      return created;
    } catch (error) {
      logger.error('Error creando protección', this.context, { input }, ensureError(error));
      throw error;
    }
  }

  async update(id: string, input: UpdateProtectionInput): Promise<VaccineDiseaseProtection> {
    try {
      const row = await VaccineDiseaseProtection.findByPk(id);
      if (!row) throw new BovineError('Entrada de protección no encontrada', 'PROTECTION_NOT_FOUND', 404);

      await row.update({
        ...(input.immunityDurationDays !== undefined ? { immunityDurationDays: input.immunityDurationDays } : {}),
        ...(input.dosesForImmunity !== undefined ? { dosesForImmunity: input.dosesForImmunity } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      });

      return row;
    } catch (error) {
      logger.error('Error actualizando protección', this.context, { id, input }, ensureError(error));
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const row = await VaccineDiseaseProtection.findByPk(id);
    if (!row) throw new BovineError('Entrada de protección no encontrada', 'PROTECTION_NOT_FOUND', 404);
    await row.destroy();
    logger.info(`Protección eliminada: ${id}`, this.context);
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const vaccineProtectionService = new VaccineProtectionService();
