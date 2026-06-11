// services/BovineVaccinationStatusService.ts
// ============================================================================
// BOVINE VACCINATION STATUS SERVICE
// ============================================================================
// Calcula y mantiene actualizado el cache denormalizado
// `BovineVaccinationStatus` para cada bovino. Lo usan:
//   - El listado de bovinos para filtrar por `vaccinationStatus`.
//   - El endpoint `GET /api/bovines/:id/vaccination-status` (lectura puntual).
//
// Reglas de cálculo (basadas en VaccinationStatus de Bovine.ts):
//   - NONE        → totalApplied = 0
//   - OVERDUE     → existe alguna vacuna con nextDueDate < now
//   - PENDING     → tiene vacunas pero ninguna con nextDueDate, O hay próximas
//                    pero no ha llegado a un esquema considerado "completo".
//   - UP_TO_DATE  → todas las vacunas tienen nextDueDate > now y no hay vencidas.
//
// El "esquema completo" no está parametrizado todavía (calendario base por
// raza/edad). Por ahora aplicamos heurística simple.
// ============================================================================

import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';

import Vaccination from '../models/Vaccination';
import Bovine from '../models/Bovine';
import VaccinationSchedule from '../models/VaccinationSchedule';
import BovineVaccinationStatus, {
  VaccinationStatus,
} from '../models/BovineVaccinationStatus';
import { vaccinationStatusLabel } from '../constants/vaccination.labels';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface VaccinationStatusSnapshot {
  bovineId: string;
  status: VaccinationStatus;
  statusLabel: string;            // V-06: etiqueta en español del status
  lastVaccinationAt: Date | null;
  lastVaccineType: string | null;
  nextDueAt: Date | null;
  overdueCount: number;
  totalApplied: number;
  computedAt: Date;
}

// ============================================================================
// SERVICIO
// ============================================================================

export class BovineVaccinationStatusService {
  private readonly context = 'BovineVaccinationStatusService';

  /**
   * Recalcula el estado de vacunación de un bovino y persiste el snapshot.
   * Idempotente. Llamar después de crear/actualizar/borrar una vacuna.
   *
   * @param bovineId   ID del bovino
   * @param transaction transacción opcional (si forma parte de una mayor)
   */
  async recompute(bovineId: string, transaction?: Transaction): Promise<VaccinationStatusSnapshot> {
    try {
      const now = new Date();

      // Traer todas las vacunas activas del bovino
      const vaccinations = await Vaccination.findAll({
        where: { bovineId },
        attributes: ['vaccineType', 'applicationDate', 'nextDueDate'],
        order: [['applicationDate', 'DESC']],
        transaction,
      });

      const totalApplied = vaccinations.length;

      // Caso simple: nunca vacunado
      if (totalApplied === 0) {
        const snapshot: VaccinationStatusSnapshot = {
          bovineId,
          status: VaccinationStatus.NONE,
          statusLabel: vaccinationStatusLabel(VaccinationStatus.NONE)!,
          lastVaccinationAt: null,
          lastVaccineType: null,
          nextDueAt: null,
          overdueCount: 0,
          totalApplied: 0,
          computedAt: now,
        };
        await this.upsert(snapshot, transaction);
        return snapshot;
      }

      // Última vacuna aplicada (cualquier tipo)
      const last = vaccinations[0];
      const lastVaccinationAt = (last as any).applicationDate as Date;
      const lastVaccineType = (last as any).vaccineType as string;

      // Para cada tipo distinto, considerar la vacuna MÁS RECIENTE
      // y evaluar su nextDueDate contra `now`.
      const latestPerType = new Map<string, { applicationDate: Date; nextDueDate: Date | null }>();
      for (const v of vaccinations) {
        const type = (v as any).vaccineType as string;
        const appDate = (v as any).applicationDate as Date;
        const due = ((v as any).nextDueDate as Date | null) ?? null;
        const existing = latestPerType.get(type);
        if (!existing || appDate > existing.applicationDate) {
          latestPerType.set(type, { applicationDate: appDate, nextDueDate: due });
        }
      }

      let overdueCount = 0;
      let nextDueAt: Date | null = null;
      let status: VaccinationStatus;

      // ── V-04: lógica CALENDARIO-DRIVEN con FALLBACK ─────────────────────────
      // Cargar el calendario aplicable al bovino (edad + sexo + raza). Si el
      // calendario está vacío, se cae a la heurística previa (sin sorpresas).
      const bovine = await Bovine.findByPk(bovineId, {
        attributes: ['birthDate', 'gender', 'breed'],
        transaction,
      });

      const schedules = await VaccinationSchedule.findAll({
        where: { isActive: true } as any,
        transaction,
      });

      let ageMonths = 0;
      if (bovine?.birthDate) {
        ageMonths = Math.floor(
          (now.getTime() - new Date(bovine.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
        );
      }

      const applicable = schedules.filter((s) =>
        ageMonths >= s.fromAgeMonths &&
        (s.toAgeMonths == null || ageMonths <= s.toAgeMonths) &&
        (s.genderFilter == null || s.genderFilter === bovine?.gender) &&
        (s.breedFilter == null || s.breedFilter === bovine?.breed)
      );

      if (applicable.length === 0) {
        // FALLBACK (heurística previa): basada solo en nextDueDate de las vacunas.
        let hasFutureSchedule = false;
        for (const { nextDueDate } of latestPerType.values()) {
          if (!nextDueDate) continue;
          if (nextDueDate < now) overdueCount += 1;
          else {
            hasFutureSchedule = true;
            if (!nextDueAt || nextDueDate < nextDueAt) nextDueAt = nextDueDate;
          }
        }
        status = overdueCount > 0
          ? VaccinationStatus.OVERDUE
          : hasFutureSchedule
            ? VaccinationStatus.UP_TO_DATE
            : VaccinationStatus.PENDING;
      } else {
        // CALENDARIO-DRIVEN: por cada vacuna que le toca al bovino según su edad.
        let missingRequired = false;
        for (const s of applicable) {
          const appliedOfType = latestPerType.get(s.vaccineType);

          if (!appliedOfType) {
            // No la tiene aplicada → si es obligatoria, está PENDIENTE
            if (s.isRequired) missingRequired = true;
            continue;
          }

          const freq = s.frequencyMonths ?? 0;
          if (freq <= 0) {
            // Dosis única ya aplicada → COMPLETA (esto elimina el "PENDING eterno")
            continue;
          }

          // Próximo vencimiento: nextDueDate explícito o última aplicación + frecuencia
          let due = appliedOfType.nextDueDate;
          if (!due) {
            due = new Date(appliedOfType.applicationDate);
            due.setMonth(due.getMonth() + freq);
          }
          if (due < now) overdueCount += 1;
          else if (!nextDueAt || due < nextDueAt) nextDueAt = due;
        }

        status = overdueCount > 0
          ? VaccinationStatus.OVERDUE
          : missingRequired
            ? VaccinationStatus.PENDING
            : VaccinationStatus.UP_TO_DATE;
      }

      const snapshot: VaccinationStatusSnapshot = {
        bovineId,
        status,
        statusLabel: vaccinationStatusLabel(status)!,
        lastVaccinationAt,
        lastVaccineType,
        nextDueAt,
        overdueCount,
        totalApplied,
        computedAt: now,
      };

      await this.upsert(snapshot, transaction);
      return snapshot;
    } catch (error) {
      logger.error(
        `Error recalculando estado de vacunación para bovino ${bovineId}`,
        this.context,
        { bovineId },
        ensureError(error)
      );
      throw error;
    }
  }

  /**
   * Devuelve el snapshot actual del bovino. Si no existe, lo calcula y crea.
   */
  async get(bovineId: string): Promise<VaccinationStatusSnapshot> {
    const existing = await BovineVaccinationStatus.findByPk(bovineId);
    if (existing) {
      return this.toSnapshot(existing);
    }
    // No existe: calcular y crear
    return this.recompute(bovineId);
  }

  /**
   * Crea el registro con `status = NONE` para un bovino recién creado.
   * Llamar desde `BovineService.createBovine` (afterCreate hook o explicit).
   */
  async initializeForNewBovine(bovineId: string, transaction?: Transaction): Promise<void> {
    await BovineVaccinationStatus.upsert(
      {
        bovineId,
        status: VaccinationStatus.NONE,
        lastVaccinationAt: null,
        lastVaccineType: null,
        nextDueAt: null,
        overdueCount: 0,
        totalApplied: 0,
        computedAt: new Date(),
      } as any,
      { transaction }
    );
  }

  /**
   * Recalcula el estado de vacunación de TODOS los bovinos activos.
   * Usado por:
   *   - El backfill puntual (V-01) → crea filas faltantes para bovinos antiguos.
   *   - El job diario (V-02) → refresca OVERDUE por el paso del tiempo.
   *
   * @param options.onlyMissing  Si true, solo procesa bovinos SIN fila de estado
   *                              (modo backfill). Si false (default), reprocesa todos.
   */
  async recomputeAll(
    options: { onlyMissing?: boolean } = {}
  ): Promise<{ processed: number; errors: number; skipped: number }> {
    const startTime = Date.now();
    let processed = 0;
    let errors = 0;

    const bovines = (await Bovine.findAll({
      attributes: ['id'],
      where: { isActive: true } as any,
      raw: true,
    })) as any[];

    let targetIds: string[] = bovines.map((b) => b.id);
    const totalActive = targetIds.length;

    if (options.onlyMissing) {
      const existing = (await BovineVaccinationStatus.findAll({
        attributes: ['bovineId'],
        raw: true,
      })) as any[];
      const existingSet = new Set(existing.map((e) => e.bovineId));
      targetIds = targetIds.filter((id) => !existingSet.has(id));
    }

    for (const id of targetIds) {
      try {
        await this.recompute(id);
        processed++;
      } catch (error) {
        errors++;
        logger.error(
          `recomputeAll: error en bovino ${id}`,
          this.context,
          { bovineId: id },
          ensureError(error)
        );
      }
    }

    const skipped = totalActive - targetIds.length;
    logger.info(
      `recomputeAll finalizado — procesados: ${processed}, errores: ${errors}, omitidos: ${skipped}`,
      this.context,
      { processed, errors, skipped, onlyMissing: !!options.onlyMissing, durationMs: Date.now() - startTime }
    );

    return { processed, errors, skipped };
  }

  // ==========================================================================
  // INTERNOS
  // ==========================================================================

  private async upsert(snapshot: VaccinationStatusSnapshot, transaction?: Transaction): Promise<void> {
    await BovineVaccinationStatus.upsert(
      {
        bovineId: snapshot.bovineId,
        status: snapshot.status,
        lastVaccinationAt: snapshot.lastVaccinationAt,
        lastVaccineType: snapshot.lastVaccineType,
        nextDueAt: snapshot.nextDueAt,
        overdueCount: snapshot.overdueCount,
        totalApplied: snapshot.totalApplied,
        computedAt: snapshot.computedAt,
      } as any,
      { transaction }
    );
  }

  private toSnapshot(row: BovineVaccinationStatus): VaccinationStatusSnapshot {
    return {
      bovineId: row.bovineId,
      status: row.status,
      statusLabel: vaccinationStatusLabel(row.status)!,
      lastVaccinationAt: row.lastVaccinationAt ?? null,
      lastVaccineType: row.lastVaccineType ?? null,
      nextDueAt: row.nextDueAt ?? null,
      overdueCount: row.overdueCount,
      totalApplied: row.totalApplied,
      computedAt: row.computedAt,
    };
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const bovineVaccinationStatusService = new BovineVaccinationStatusService();
