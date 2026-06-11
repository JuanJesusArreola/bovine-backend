// services/VaccinationScheduleService.ts
// ============================================================================
// VACCINATION SCHEDULE SERVICE (Módulo 11)
// ============================================================================
// CRUD del calendario base + "calendario sugerido" para un bovino concreto
// (qué vacunas le tocan según edad/sexo/raza y su estado actual).
// ============================================================================

import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';
import { BovineError, BovineNotFoundError } from '../utils/BovineErrors';

import VaccinationSchedule from '../models/VaccinationSchedule';
import Bovine, { GenderType } from '../models/Bovine';
import Vaccination, { VaccineType } from '../models/Vaccination';
import { vaccineTypeLabel } from '../constants/vaccination.labels';

export interface CreateScheduleInput {
  vaccineType: VaccineType;
  fromAgeMonths: number;
  toAgeMonths?: number | null;
  frequencyMonths?: number | null;
  isRequired?: boolean;
  genderFilter?: GenderType | null;
  breedFilter?: string | null;
  notes?: string | null;
}

export type SuggestedItemStatus = 'APPLIED_CURRENT' | 'OVERDUE' | 'MISSING' | 'ONE_TIME_DONE';

export interface SuggestedScheduleItem {
  scheduleId: string;
  vaccineType: VaccineType;
  vaccineTypeLabel: string | null;
  isRequired: boolean;
  frequencyMonths: number | null;
  status: SuggestedItemStatus;
  lastApplicationDate: Date | null;
  nextDueDate: Date | null;
  notes: string | null;
}

export class VaccinationScheduleService {
  private readonly context = 'VaccinationScheduleService';

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async list(): Promise<VaccinationSchedule[]> {
    return VaccinationSchedule.findAll({ order: [['vaccineType', 'ASC']] });
  }

  async create(input: CreateScheduleInput): Promise<VaccinationSchedule> {
    return VaccinationSchedule.create({
      vaccineType: input.vaccineType,
      fromAgeMonths: input.fromAgeMonths,
      toAgeMonths: input.toAgeMonths ?? null,
      frequencyMonths: input.frequencyMonths ?? null,
      isRequired: input.isRequired ?? true,
      genderFilter: input.genderFilter ?? null,
      breedFilter: input.breedFilter ?? null,
      isActive: true,
      notes: input.notes ?? null,
    });
  }

  async update(id: string, input: Partial<CreateScheduleInput> & { isActive?: boolean }): Promise<VaccinationSchedule> {
    const row = await VaccinationSchedule.findByPk(id);
    if (!row) throw new BovineError('Entrada de calendario no encontrada', 'SCHEDULE_NOT_FOUND', 404);
    const payload: any = {};
    for (const k of ['vaccineType', 'fromAgeMonths', 'toAgeMonths', 'frequencyMonths', 'isRequired', 'genderFilter', 'breedFilter', 'isActive', 'notes'] as const) {
      if ((input as any)[k] !== undefined) payload[k] = (input as any)[k];
    }
    await row.update(payload);
    return row;
  }

  async delete(id: string): Promise<void> {
    const row = await VaccinationSchedule.findByPk(id);
    if (!row) throw new BovineError('Entrada de calendario no encontrada', 'SCHEDULE_NOT_FOUND', 404);
    await row.destroy();
  }

  // ── Calendario sugerido por bovino (V-05) ──────────────────────────────────

  async getSuggestedForBovine(bovineId: string): Promise<SuggestedScheduleItem[]> {
    try {
      const bovine = await Bovine.findByPk(bovineId, { attributes: ['id', 'birthDate', 'gender', 'breed'] });
      if (!bovine) throw new BovineNotFoundError(bovineId);

      const now = new Date();
      const ageMonths = bovine.birthDate
        ? Math.floor((now.getTime() - new Date(bovine.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
        : 0;

      const schedules = await VaccinationSchedule.findAll({ where: { isActive: true } as any });
      const applicable = schedules.filter((s) =>
        ageMonths >= s.fromAgeMonths &&
        (s.toAgeMonths == null || ageMonths <= s.toAgeMonths) &&
        (s.genderFilter == null || s.genderFilter === bovine.gender) &&
        (s.breedFilter == null || s.breedFilter === bovine.breed)
      );

      // Vacunas aplicadas (más reciente por tipo)
      const vaccinations = await Vaccination.findAll({
        where: { bovineId },
        attributes: ['vaccineType', 'applicationDate', 'nextDueDate'],
        order: [['applicationDate', 'DESC']],
      });
      const latestPerType = new Map<string, { applicationDate: Date; nextDueDate: Date | null }>();
      for (const v of vaccinations) {
        if (!latestPerType.has(v.vaccineType)) {
          latestPerType.set(v.vaccineType, { applicationDate: v.applicationDate, nextDueDate: v.nextDueDate ?? null });
        }
      }

      return applicable.map((s) => {
        const applied = latestPerType.get(s.vaccineType);
        const freq = s.frequencyMonths ?? 0;
        let status: SuggestedItemStatus;
        let nextDueDate: Date | null = null;

        if (!applied) {
          status = 'MISSING';
        } else if (freq <= 0) {
          status = 'ONE_TIME_DONE';
        } else {
          let due = applied.nextDueDate;
          if (!due) {
            due = new Date(applied.applicationDate);
            due.setMonth(due.getMonth() + freq);
          }
          nextDueDate = due;
          status = due < now ? 'OVERDUE' : 'APPLIED_CURRENT';
        }

        return {
          scheduleId: s.id,
          vaccineType: s.vaccineType,
          vaccineTypeLabel: vaccineTypeLabel(s.vaccineType),
          isRequired: s.isRequired,
          frequencyMonths: s.frequencyMonths ?? null,
          status,
          lastApplicationDate: applied?.applicationDate ?? null,
          nextDueDate,
          notes: s.notes ?? null,
        };
      });
    } catch (error) {
      logger.error('Error obteniendo calendario sugerido', this.context, { bovineId }, ensureError(error));
      throw error;
    }
  }
}

export const vaccinationScheduleService = new VaccinationScheduleService();
