// services/VaccinationService.ts
// ============================================================================
// VACCINATION SERVICE
// ============================================================================
// CRUD de vacunas + sincronización con `BovineVaccinationStatus`.
//
// Decisión de diseño: la actualización del cache de status NO se hace por
// hook Sequelize (los hooks complican transacciones bulk), sino con llamada
// EXPLÍCITA desde este service después de cada mutación. Más predecible y
// fácil de testear.
// ============================================================================

import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';
import {
  BovineError,
  BovineNotFoundError,
  BovineValidationError,
} from '../utils/BovineErrors';

import Bovine from '../models/Bovine';
import User from '../models/User';
import Vaccination, {
  VaccineType,
  ApplicationRoute,
} from '../models/Vaccination';
import VaccineDiseaseProtection from '../models/VaccineDiseaseProtection';
import Disease from '../models/Disease';

import { bovineVaccinationStatusService } from './BovineVaccinationStatusService';
import { bovineFullService } from './BovineFullService';
import { vaccineTypeLabel, applicationRouteLabel } from '../constants/vaccination.labels';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface CreateVaccinationInput {
  bovineId: string;
  vaccineType: VaccineType;
  vaccineName?: string;
  manufacturer?: string;
  batchNumber?: string;
  doseNumber?: number;
  doseAmountMl?: number;
  applicationRoute?: ApplicationRoute;
  applicationDate: Date | string;
  nextDueDate?: Date | string;
  applicatorId: string;
  withdrawalPeriodDays?: number;
  immunityDurationDays?: number;   // override del catálogo (opcional)
  notes?: string;
  metadata?: Record<string, any>;
}

// ── Estado de protección por enfermedad (Fase 2) ─────────────────────────────

export interface DiseaseProtectionStatus {
  diseaseId: string;
  diseaseName: string;
  diseaseSlug: string;
  vaccineTypes: VaccineType[];     // tipos de vacuna aplicados que cubren la enfermedad
  dosesApplied: number;            // # de aplicaciones que cubren esta enfermedad
  dosesForImmunity: number;        // dosis recomendadas por el catálogo
  lastApplicationDate: Date;
  immunityDurationDays: number;    // duración efectiva usada para el cálculo
  protectedUntil: Date;            // última fecha de aplicación + duración
  isProtected: boolean;            // protectedUntil >= hoy
  daysUntilExpiry: number;         // negativo si ya venció
}

/**
 * Campos editables de una vacuna (V-04). Todos opcionales (patch parcial).
 * NO se permite cambiar `bovineId` (mover una vacuna a otro bovino no es válido).
 */
export interface UpdateVaccinationInput {
  vaccineType?: VaccineType;
  vaccineName?: string | null;
  manufacturer?: string | null;
  batchNumber?: string | null;
  doseNumber?: number;
  doseAmountMl?: number | null;
  applicationRoute?: ApplicationRoute | null;
  applicationDate?: Date | string;
  nextDueDate?: Date | string | null;
  applicatorId?: string;
  withdrawalPeriodDays?: number | null;
  immunityDurationDays?: number | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
}

export interface ListVaccinationsFilters {
  bovineId: string;
  vaccineType?: VaccineType;
  fromDate?: Date | string;
  toDate?: Date | string;
  applicatorId?: string;
  limit?: number;
  offset?: number;
}

export interface VaccinationListItem {
  id: string;
  bovineId: string;
  vaccineType: VaccineType;
  vaccineTypeLabel: string | null;        // V-06: etiqueta en español
  vaccineName: string | null;
  manufacturer: string | null;
  batchNumber: string | null;
  doseNumber: number;
  doseAmountMl: number | null;
  applicationRoute: ApplicationRoute | null;
  applicationRouteLabel: string | null;   // V-06: etiqueta en español
  applicationDate: Date;
  nextDueDate: Date | null;
  applicatorId: string;
  applicatorName: string | null;
  withdrawalPeriodDays: number | null;
  notes: string | null;
  createdAt: Date;
}

export interface VaccinationListResult {
  total: number;
  limit: number;
  offset: number;
  items: VaccinationListItem[];
}

// ============================================================================
// SERVICIO
// ============================================================================

export class VaccinationService {
  private readonly context = 'VaccinationService';

  // ==========================================================================
  // LECTURA
  // ==========================================================================

  /**
   * Lista vacunas de un bovino con filtros y paginación.
   * Hace lookup batch del nombre del aplicador (User) en una sola query.
   */
  async listByBovine(filters: ListVaccinationsFilters): Promise<VaccinationListResult> {
    try {
      const limit = Math.min(Math.max(filters.limit ?? 20, 1), 200);
      const offset = Math.max(filters.offset ?? 0, 0);

      const where: any = { bovineId: filters.bovineId };
      if (filters.vaccineType) where.vaccineType = filters.vaccineType;
      if (filters.applicatorId) where.applicatorId = filters.applicatorId;
      if (filters.fromDate || filters.toDate) {
        where.applicationDate = {};
        if (filters.fromDate) where.applicationDate[Op.gte] = new Date(filters.fromDate);
        if (filters.toDate) where.applicationDate[Op.lte] = new Date(filters.toDate);
      }

      const { rows, count } = await Vaccination.findAndCountAll({
        where,
        order: [['applicationDate', 'DESC']],
        limit,
        offset,
      });

      // Lookup batch de nombres de aplicadores
      const applicatorIds = Array.from(new Set(rows.map((r) => r.applicatorId).filter(Boolean))) as string[];
      const applicatorNameMap = new Map<string, string>();
      if (applicatorIds.length > 0) {
        const users = await User.findAll({
          where: { id: applicatorIds },
          attributes: ['id', 'username', 'personal_info'] as any,
        });
        for (const u of users) {
          const u_any: any = u;
          const info = u_any.personalInfo ?? u_any.personal_info ?? {};
          const fullName = [info.firstName, info.lastName].filter(Boolean).join(' ').trim();
          applicatorNameMap.set(u_any.id, fullName || u_any.username || '');
        }
      }

      const items: VaccinationListItem[] = rows.map((v) => ({
        id: v.id,
        bovineId: v.bovineId,
        vaccineType: v.vaccineType,
        vaccineTypeLabel: vaccineTypeLabel(v.vaccineType),
        vaccineName: v.vaccineName ?? null,
        manufacturer: v.manufacturer ?? null,
        batchNumber: v.batchNumber ?? null,
        doseNumber: v.doseNumber,
        doseAmountMl: v.doseAmountMl ?? null,
        applicationRoute: v.applicationRoute ?? null,
        applicationRouteLabel: applicationRouteLabel(v.applicationRoute),
        applicationDate: v.applicationDate,
        nextDueDate: v.nextDueDate ?? null,
        applicatorId: v.applicatorId,
        applicatorName: applicatorNameMap.get(v.applicatorId) ?? null,
        withdrawalPeriodDays: v.withdrawalPeriodDays ?? null,
        notes: v.notes ?? null,
        createdAt: v.createdAt,
      }));

      return { total: count, limit, offset, items };
    } catch (error) {
      logger.error(
        `Error listando vacunas del bovino ${filters.bovineId}`,
        this.context,
        { filters },
        ensureError(error)
      );
      throw error;
    }
  }

  /**
   * Obtiene una vacuna por ID. 404 si no existe.
   */
  async getById(id: string): Promise<Vaccination> {
    const v = await Vaccination.findByPk(id);
    if (!v) {
      throw new BovineError('Vacuna no encontrada', 'VACCINATION_NOT_FOUND', 404);
    }
    return v;
  }

  // ==========================================================================
  // ESCRITURA
  // ==========================================================================

  /**
   * Registra una nueva vacuna y recalcula el cache de status del bovino.
   * Todo en una transacción. Detecta duplicados (mismo tipo + misma fecha).
   */
  async create(input: CreateVaccinationInput): Promise<Vaccination> {
    const t = await sequelize.transaction();
    try {
      // Verificar bovino existe
      const bovine = await Bovine.findByPk(input.bovineId, { transaction: t });
      if (!bovine) {
        throw new BovineNotFoundError(input.bovineId);
      }

      // Verificar applicator (User) existe
      const applicator = await User.findByPk(input.applicatorId, { transaction: t });
      if (!applicator) {
        throw new BovineValidationError(
          `Aplicador con ID ${input.applicatorId} no encontrado`
        );
      }

      const applicationDate = new Date(input.applicationDate);
      const nextDueDate = input.nextDueDate ? new Date(input.nextDueDate) : undefined;

      // Detectar duplicado: mismo bovino + mismo tipo + misma fecha
      const existing = await Vaccination.findOne({
        where: {
          bovineId: input.bovineId,
          vaccineType: input.vaccineType,
          applicationDate,
        },
        transaction: t,
      });
      if (existing) {
        throw new BovineError(
          'Ya existe una vacuna de este tipo registrada en la misma fecha para este bovino.',
          'VACCINATION_DUPLICATE',
          409
        );
      }

      const created = await Vaccination.create(
        {
          bovineId: input.bovineId,
          vaccineType: input.vaccineType,
          vaccineName: input.vaccineName,
          manufacturer: input.manufacturer,
          batchNumber: input.batchNumber,
          doseNumber: input.doseNumber ?? 1,
          doseAmountMl: input.doseAmountMl,
          applicationRoute: input.applicationRoute,
          applicationDate,
          nextDueDate,
          applicatorId: input.applicatorId,
          withdrawalPeriodDays: input.withdrawalPeriodDays,
          immunityDurationDays: input.immunityDurationDays,
          notes: input.notes,
          metadata: input.metadata,
        } as any,
        { transaction: t }
      );

      // Recalcular cache de estado de vacunación (dentro de la misma tx)
      await bovineVaccinationStatusService.recompute(input.bovineId, t);

      await t.commit();

      // Invalidar cache compuesto del bovino
      bovineFullService.invalidate(input.bovineId);

      logger.info(
        `Vacuna registrada: ${created.id} (${input.vaccineType}) para bovino ${input.bovineId}`,
        this.context,
        { vaccinationId: created.id, bovineId: input.bovineId }
      );

      return created;
    } catch (error) {
      await t.rollback();
      logger.error(
        `Error registrando vacuna para bovino ${input.bovineId}`,
        this.context,
        { input },
        ensureError(error)
      );
      throw error;
    }
  }

  /**
   * Edita una vacuna existente y recalcula el cache de status (V-04).
   * Patch parcial: solo se aplican los campos provistos.
   * Si cambia vaccineType o applicationDate, revalida duplicado (excluyendo la propia).
   */
  async update(id: string, input: UpdateVaccinationInput): Promise<Vaccination> {
    const t = await sequelize.transaction();
    try {
      const vaccination = await Vaccination.findByPk(id, { transaction: t });
      if (!vaccination) {
        throw new BovineError('Vacuna no encontrada', 'VACCINATION_NOT_FOUND', 404);
      }

      // Si se cambia el aplicador, verificar que existe
      if (input.applicatorId && input.applicatorId !== vaccination.applicatorId) {
        const applicator = await User.findByPk(input.applicatorId, { transaction: t });
        if (!applicator) {
          throw new BovineValidationError(`Aplicador con ID ${input.applicatorId} no encontrado`);
        }
      }

      // Resolver valores efectivos para validaciones
      const newType = input.vaccineType ?? vaccination.vaccineType;
      const newAppDate = input.applicationDate !== undefined
        ? new Date(input.applicationDate)
        : vaccination.applicationDate;

      // applicationDate no puede ser futura
      if (input.applicationDate !== undefined && newAppDate > new Date()) {
        throw new BovineValidationError('applicationDate no puede ser futura');
      }

      // nextDueDate (si se provee y no es null) debe ser posterior a applicationDate
      const newNextDue = input.nextDueDate !== undefined && input.nextDueDate !== null
        ? new Date(input.nextDueDate)
        : (input.nextDueDate === null ? null : vaccination.nextDueDate);
      if (newNextDue && newNextDue <= newAppDate) {
        throw new BovineValidationError('nextDueDate debe ser posterior a applicationDate');
      }

      // Revalidar duplicado solo si cambió tipo o fecha (mismo bovino+tipo+fecha)
      if (input.vaccineType !== undefined || input.applicationDate !== undefined) {
        const duplicate = await Vaccination.findOne({
          where: {
            bovineId: vaccination.bovineId,
            vaccineType: newType,
            applicationDate: newAppDate,
            id: { [Op.ne]: id },
          },
          transaction: t,
        });
        if (duplicate) {
          throw new BovineError(
            'Ya existe una vacuna de este tipo registrada en la misma fecha para este bovino.',
            'VACCINATION_DUPLICATE',
            409
          );
        }
      }

      // Construir payload solo con los campos provistos
      const payload: any = {};
      if (input.vaccineType !== undefined)          payload.vaccineType = input.vaccineType;
      if (input.vaccineName !== undefined)          payload.vaccineName = input.vaccineName;
      if (input.manufacturer !== undefined)         payload.manufacturer = input.manufacturer;
      if (input.batchNumber !== undefined)          payload.batchNumber = input.batchNumber;
      if (input.doseNumber !== undefined)           payload.doseNumber = input.doseNumber;
      if (input.doseAmountMl !== undefined)         payload.doseAmountMl = input.doseAmountMl;
      if (input.applicationRoute !== undefined)     payload.applicationRoute = input.applicationRoute;
      if (input.applicationDate !== undefined)      payload.applicationDate = newAppDate;
      if (input.nextDueDate !== undefined)          payload.nextDueDate = newNextDue;
      if (input.applicatorId !== undefined)         payload.applicatorId = input.applicatorId;
      if (input.withdrawalPeriodDays !== undefined) payload.withdrawalPeriodDays = input.withdrawalPeriodDays;
      if (input.immunityDurationDays !== undefined) payload.immunityDurationDays = input.immunityDurationDays;
      if (input.notes !== undefined)                payload.notes = input.notes;
      if (input.metadata !== undefined)             payload.metadata = input.metadata;

      await vaccination.update(payload, { transaction: t });

      // Recalcular estado (la fecha/tipo pueden alterar OVERDUE/UP_TO_DATE)
      await bovineVaccinationStatusService.recompute(vaccination.bovineId, t);

      await t.commit();
      bovineFullService.invalidate(vaccination.bovineId);

      logger.info(`Vacuna actualizada: ${id}`, this.context, { vaccinationId: id });
      return vaccination;
    } catch (error) {
      await t.rollback();
      logger.error(`Error actualizando vacuna ${id}`, this.context, { id, input }, ensureError(error));
      throw error;
    }
  }

  /**
   * Elimina (soft) una vacuna y recalcula el cache de status.
   */
  async delete(id: string): Promise<void> {
    const t = await sequelize.transaction();
    try {
      const v = await Vaccination.findByPk(id, { transaction: t });
      if (!v) {
        throw new BovineError('Vacuna no encontrada', 'VACCINATION_NOT_FOUND', 404);
      }
      const bovineId = v.bovineId;
      await v.destroy({ transaction: t });
      await bovineVaccinationStatusService.recompute(bovineId, t);
      await t.commit();
      // Invalidar cache compuesto del bovino
      bovineFullService.invalidate(bovineId);
      logger.info(`Vacuna eliminada: ${id}`, this.context, { vaccinationId: id });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  // ==========================================================================
  // PROTECCIÓN POR ENFERMEDAD (Fase 2)
  // ==========================================================================

  /**
   * Deriva el estado de protección de un bovino contra cada enfermedad,
   * cruzando sus vacunas aplicadas con el catálogo VaccineDiseaseProtection.
   *
   * Para cada enfermedad cubierta:
   *   - protectedUntil = max(applicationDate + immunityDays) entre sus vacunas
   *   - immunityDays    = vaccination.immunityDurationDays (override) ?? catálogo
   *   - isProtected     = protectedUntil >= hoy
   */
  async getProtectionStatus(bovineId: string): Promise<DiseaseProtectionStatus[]> {
    try {
      // 1. Vacunas del bovino
      const vaccinations = await Vaccination.findAll({
        where: { bovineId },
        attributes: ['id', 'vaccineType', 'applicationDate', 'immunityDurationDays'],
        order: [['applicationDate', 'ASC']],
      });
      if (vaccinations.length === 0) return [];

      // 2. Catálogo de protección (solo activo) para los tipos aplicados
      const appliedTypes = Array.from(new Set(vaccinations.map((v) => v.vaccineType)));
      const catalog = await VaccineDiseaseProtection.findAll({
        where: { vaccineType: appliedTypes, isActive: true },
        include: [{ model: Disease, as: 'disease', attributes: ['id', 'name', 'slug'] }],
      });
      if (catalog.length === 0) return [];

      // Mapa: vaccineType → entradas de catálogo
      const byType = new Map<VaccineType, VaccineDiseaseProtection[]>();
      for (const c of catalog) {
        const list = byType.get(c.vaccineType) ?? [];
        list.push(c);
        byType.set(c.vaccineType, list);
      }

      // 3. Acumular por enfermedad
      interface Acc {
        diseaseId: string;
        diseaseName: string;
        diseaseSlug: string;
        vaccineTypes: Set<VaccineType>;
        dosesApplied: number;
        dosesForImmunity: number;
        lastApplicationDate: Date;
        immunityDurationDays: number;
        protectedUntil: Date;
      }
      const accByDisease = new Map<string, Acc>();

      for (const v of vaccinations) {
        const entries = byType.get(v.vaccineType);
        if (!entries) continue;

        for (const entry of entries) {
          const disease = (entry as any).disease;
          if (!disease) continue;

          const immunityDays = v.immunityDurationDays ?? entry.immunityDurationDays;
          const protectedUntil = new Date(v.applicationDate);
          protectedUntil.setDate(protectedUntil.getDate() + immunityDays);

          const existing = accByDisease.get(entry.diseaseId);
          if (!existing) {
            accByDisease.set(entry.diseaseId, {
              diseaseId: entry.diseaseId,
              diseaseName: disease.name,
              diseaseSlug: disease.slug,
              vaccineTypes: new Set([v.vaccineType]),
              dosesApplied: 1,
              dosesForImmunity: entry.dosesForImmunity,
              lastApplicationDate: v.applicationDate,
              immunityDurationDays: immunityDays,
              protectedUntil,
            });
          } else {
            existing.vaccineTypes.add(v.vaccineType);
            existing.dosesApplied += 1;
            existing.dosesForImmunity = Math.max(existing.dosesForImmunity, entry.dosesForImmunity);
            // Conservar la aplicación que produce la protección más larga
            if (protectedUntil > existing.protectedUntil) {
              existing.protectedUntil = protectedUntil;
              existing.lastApplicationDate = v.applicationDate;
              existing.immunityDurationDays = immunityDays;
            } else if (v.applicationDate > existing.lastApplicationDate) {
              existing.lastApplicationDate = v.applicationDate;
            }
          }
        }
      }

      // 4. Construir respuesta
      const now = new Date();
      const MS_PER_DAY = 1000 * 60 * 60 * 24;
      const result: DiseaseProtectionStatus[] = Array.from(accByDisease.values()).map((a) => ({
        diseaseId: a.diseaseId,
        diseaseName: a.diseaseName,
        diseaseSlug: a.diseaseSlug,
        vaccineTypes: Array.from(a.vaccineTypes),
        dosesApplied: a.dosesApplied,
        dosesForImmunity: a.dosesForImmunity,
        lastApplicationDate: a.lastApplicationDate,
        immunityDurationDays: a.immunityDurationDays,
        protectedUntil: a.protectedUntil,
        isProtected: a.protectedUntil >= now,
        daysUntilExpiry: Math.round((a.protectedUntil.getTime() - now.getTime()) / MS_PER_DAY),
      }));

      // Ordenar: protegidas primero, luego por expiración más próxima
      result.sort((x, y) => x.daysUntilExpiry - y.daysUntilExpiry);
      return result;
    } catch (error) {
      logger.error(
        `Error calculando protección del bovino ${bovineId}`,
        this.context,
        { bovineId },
        ensureError(error)
      );
      throw error;
    }
  }

  /**
   * Indica si un bovino estaba protegido contra una enfermedad en una fecha dada
   * (por defecto, hoy). Reutilizable por el motor epidemiológico.
   */
  async isProtectedAgainst(
    bovineId: string,
    diseaseId: string,
    atDate: Date = new Date()
  ): Promise<boolean> {
    try {
      // Tipos de vacuna que cubren esta enfermedad
      const protections = await VaccineDiseaseProtection.findAll({
        where: { diseaseId, isActive: true },
        attributes: ['vaccineType', 'immunityDurationDays'],
      });
      if (protections.length === 0) return false;

      const immunityByType = new Map<VaccineType, number>();
      for (const p of protections) immunityByType.set(p.vaccineType, p.immunityDurationDays);

      // Vacunas del bovino de esos tipos, aplicadas en o antes de atDate
      const vaccinations = await Vaccination.findAll({
        where: {
          bovineId,
          vaccineType: Array.from(immunityByType.keys()),
          applicationDate: { [Op.lte]: atDate },
        },
        attributes: ['vaccineType', 'applicationDate', 'immunityDurationDays'],
      });

      for (const v of vaccinations) {
        const immunityDays = v.immunityDurationDays ?? immunityByType.get(v.vaccineType) ?? 0;
        const protectedUntil = new Date(v.applicationDate);
        protectedUntil.setDate(protectedUntil.getDate() + immunityDays);
        if (protectedUntil >= atDate) return true;
      }
      return false;
    } catch (error) {
      logger.error(
        `Error verificando protección del bovino ${bovineId} contra ${diseaseId}`,
        this.context,
        { bovineId, diseaseId },
        ensureError(error)
      );
      throw error;
    }
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const vaccinationService = new VaccinationService();
