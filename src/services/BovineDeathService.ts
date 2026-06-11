// services/BovineDeathService.ts
// ============================================================================
// BOVINE DEATH SERVICE (Módulo 8)
// ============================================================================
// Registra la muerte/baja de un bovino de forma ATÓMICA:
//   1. Crea el registro BovineDeath (causa, fecha, necropsia, etc.).
//   2. Si la causa es DISEASE y hay caso clínico abierto → lo cierra (DECEASED).
//   3. Marca el bovino: healthStatus=DECEASED, isActive=false, exitReason=DECEASED.
//   4. Cierra la estancia de ubicación activa y limpia currentLocationId.
//   5. Elimina (soft) el BovineHealthSnapshot (para que no aparezca en el mapa).
//   6. Emite un Event de tipo DEATH (auditoría / timeline) — best-effort.
//   7. Reporte de mortalidad (X-07).
// ============================================================================

import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';
import { BovineError, BovineNotFoundError } from '../utils/BovineErrors';

import Bovine, { HealthStatus, BovineExitReason } from '../models/Bovine';
import BovineDeath, { DeathCause } from '../models/BovineDeath';
import BovineHealthSnapshot from '../models/BovineHealthSnapshot';
import BovineLocationHistory from '../models/BovineLocationHistory';
import LocationCapacity from '../models/LocationCapacity';
import BovineDiseaseCase, { CaseStatus, CaseOutcome } from '../models/BovineDiseaseCase';
import Event, { EventType, EventStatus, EventPriority } from '../models/Event';

import { bovineDiseaseService } from './BovineDiseaseService';
import { bovineFullService } from './BovineFullService';
import { cacheService } from './CacheService';
import { deathCauseLabel } from '../constants/death.labels';

// ============================================================================
// DTOs
// ============================================================================

export interface DeceaseBovineDTO {
  cause: DeathCause;
  deathDate?: Date | string;
  /** Caso clínico a cerrar (solo si cause = DISEASE). Si no se da, se busca el activo. */
  diseaseCaseId?: string;
  locationId?: string;
  weightAtDeath?: number;
  slaughterValue?: number;
  necropsyPerformed?: boolean;
  necropsyResults?: string;
  notes?: string;
}

export interface MortalityReportFilters {
  from?: Date;
  to?: Date;
  groupBy?: 'cause' | 'month' | 'location';
}

const ACTIVE_CASE_STATUSES: CaseStatus[] = [
  CaseStatus.SUSPECTED,
  CaseStatus.CONFIRMED,
  CaseStatus.RECOVERING,
];

// ============================================================================
// SERVICIO
// ============================================================================

export class BovineDeathService {
  private readonly context = 'BovineDeathService';

  /**
   * Registra la muerte de un bovino (X-03). Transacción atómica.
   */
  async deceaseBovine(bovineId: string, dto: DeceaseBovineDTO, userId: string): Promise<BovineDeath> {
    if (!dto.cause) {
      throw new BovineError('Se requiere la causa de la muerte (cause)', 'MISSING_DEATH_CAUSE', 400);
    }

    const t = await sequelize.transaction();
    try {
      const bovine = await Bovine.findByPk(bovineId, { transaction: t });
      if (!bovine) throw new BovineNotFoundError(bovineId);

      // Idempotencia: no se puede registrar dos veces
      const existingDeath = await BovineDeath.findOne({ where: { bovineId }, transaction: t });
      if (existingDeath || bovine.healthStatus === HealthStatus.DECEASED || bovine.exitReason === BovineExitReason.DECEASED) {
        throw new BovineError('El bovino ya está registrado como fallecido', 'ALREADY_DECEASED', 409);
      }

      const deathDate = dto.deathDate ? new Date(dto.deathDate) : new Date();
      if (deathDate.getTime() > Date.now() + 60 * 60 * 1000) {
        throw new BovineError('La fecha de muerte no puede ser futura', 'INVALID_DEATH_DATE', 400);
      }

      // ── 1) Si es por enfermedad, cerrar el caso clínico (mismo tx) ───────────
      let diseaseId: string | null = null;
      let diseaseCaseId: string | null = dto.diseaseCaseId ?? null;

      // Si la causa es DISEASE, determinar la enfermedad/caso "principal" para el
      // registro de muerte (el referenciado o el caso activo más reciente).
      if (dto.cause === DeathCause.DISEASE) {
        let primary: BovineDiseaseCase | null = null;
        if (dto.diseaseCaseId) {
          primary = await BovineDiseaseCase.findByPk(dto.diseaseCaseId, { transaction: t });
        } else {
          primary = await BovineDiseaseCase.findOne({
            where: { bovineId, status: { [Op.in]: ACTIVE_CASE_STATUSES } },
            order: [['diagnosedAt', 'DESC']],
            transaction: t,
          });
        }
        if (primary) {
          diseaseId = primary.diseaseId;
          diseaseCaseId = primary.id;
        }
      }

      // H-7: al morir, cerrar TODOS los casos clínicos abiertos del bovino
      // (no solo el referenciado). Un animal muerto no puede tener casos activos.
      // skipDeathHook evita recursión (ya estamos en el flujo de baja).
      const openCases = await BovineDiseaseCase.findAll({
        where: { bovineId, status: { [Op.in]: ACTIVE_CASE_STATUSES } },
        transaction: t,
      });
      for (const c of openCases) {
        await bovineDiseaseService.closeCase(
          c.id,
          { outcome: CaseOutcome.DECEASED, resolvedAt: deathDate },
          t,
          { skipDeathHook: true },
        );
      }

      // ── 2) Efectos de la baja (registro + bovino + ubicación + snapshot + evento)
      const death = await this.applyDeathSideEffects(
        bovineId,
        { ...dto, deathDate, diseaseId, diseaseCaseId },
        userId,
        t,
      );

      await t.commit();

      // Invalidar caches del bovino
      bovineFullService.invalidate(bovineId);
      await cacheService.del(`bovine:full:${bovineId}`);

      logger.info(`Bovino ${bovineId} dado de baja por muerte (${dto.cause})`, this.context, {
        bovineId, cause: dto.cause, deathId: death.id, userId,
      });

      return death;
    } catch (error) {
      await t.rollback();
      logger.error('Error registrando muerte de bovino', this.context, { bovineId, dto }, ensureError(error));
      throw error;
    }
  }

  /**
   * Efectos colaterales de la baja por muerte (X-03 / X-05), SIN cerrar casos.
   * Reutilizable: lo llama deceaseBovine() y también closeCase() cuando el
   * outcome es DECEASED (módulo Salud). Idempotente: si ya hay BovineDeath,
   * no duplica. NO hace commit (usa la transacción del caller).
   */
  async applyDeathSideEffects(
    bovineId: string,
    dto: {
      cause: DeathCause;
      deathDate: Date;
      diseaseId?: string | null;
      diseaseCaseId?: string | null;
      locationId?: string | null;
      weightAtDeath?: number | null;
      slaughterValue?: number | null;
      necropsyPerformed?: boolean;
      necropsyResults?: string | null;
      notes?: string | null;
    },
    userId: string | null | undefined,
    t: Transaction,
  ): Promise<BovineDeath> {
    // Idempotencia: si ya existe el registro de muerte, no duplicar
    const existing = await BovineDeath.findOne({ where: { bovineId }, transaction: t });
    if (existing) return existing;

    const deathDate = dto.deathDate;

    // Cerrar la estancia de ubicación activa + re-sincronizar ocupación
    const activeStay = await BovineLocationHistory.findOne({
      where: { bovineId, exitedAt: { [Op.is]: null } as any },
      transaction: t,
    });
    const deathLocationId = dto.locationId ?? activeStay?.locationId ?? null;
    if (activeStay) {
      await activeStay.update({ exitedAt: deathDate }, { transaction: t });
      const capacity = await LocationCapacity.findOne({ where: { locationId: activeStay.locationId }, transaction: t });
      if (capacity) {
        const current = await BovineLocationHistory.count({
          where: { locationId: activeStay.locationId, exitedAt: { [Op.is]: null } as any },
          transaction: t,
        });
        await capacity.update({ currentAnimals: current }, { transaction: t });
      }
    }

    // Crear el registro de muerte
    const death = await BovineDeath.create(
      {
        bovineId,
        deathDate,
        cause: dto.cause,
        diseaseCaseId: dto.diseaseCaseId ?? null,
        diseaseId: dto.diseaseId ?? null,
        locationId: deathLocationId,
        weightAtDeath: dto.weightAtDeath ?? null,
        slaughterValue: dto.cause === DeathCause.SLAUGHTER ? (dto.slaughterValue ?? null) : null,
        necropsyPerformed: dto.necropsyPerformed ?? false,
        necropsyResults: dto.necropsyResults ?? null,
        notes: dto.notes ?? null,
        recordedBy: userId ?? null,
      },
      { transaction: t }
    );

    // Marcar el bovino como fallecido / fuera del hato activo
    await Bovine.update(
      {
        healthStatus: HealthStatus.DECEASED,
        isActive: false,
        exitReason: BovineExitReason.DECEASED,
        currentLocationId: null as any,
      },
      { where: { id: bovineId }, transaction: t }
    );

    // Eliminar (soft) el snapshot del mapa
    await BovineHealthSnapshot.destroy({ where: { bovineId }, transaction: t });

    // Emitir Event de auditoría (best-effort)
    try {
      await Event.create(
        {
          bovineId,
          eventType: EventType.DEATH,
          title: `Baja por fallecimiento: ${deathCauseLabel(dto.cause)}`,
          description: dto.notes ?? undefined,
          status: EventStatus.COMPLETED,
          priority: EventPriority.HIGH,
          scheduledDate: deathDate,
          createdBy: userId ?? bovineId,
        } as any,
        { transaction: t }
      );
    } catch (evErr) {
      logger.error('No se pudo emitir Event de muerte (no bloquea la baja)', this.context, { bovineId }, ensureError(evErr));
    }

    return death;
  }

  /**
   * Reporte de mortalidad de un rancho (X-07).
   * Agrupa por causa | mes | ubicación.
   */
  async getMortalityReport(ranchId: string, filters: MortalityReportFilters = {}) {
    const groupBy = filters.groupBy ?? 'cause';

    const whereDeath: any = {};
    if (filters.from || filters.to) {
      whereDeath.deathDate = {};
      if (filters.from) whereDeath.deathDate[Op.gte] = filters.from;
      if (filters.to)   whereDeath.deathDate[Op.lte] = filters.to;
    }

    // Traer muertes de bovinos del rancho (join con Bovine por ranchId)
    const deaths = await BovineDeath.findAll({
      where: whereDeath,
      include: [
        { model: Bovine, as: 'bovine', attributes: ['id', 'ranchId', 'earTag'], where: { ranchId }, required: true },
      ],
      order: [['deathDate', 'DESC']],
    });

    const total = deaths.length;

    // Agregación
    const buckets = new Map<string, number>();
    for (const d of deaths) {
      let key: string;
      if (groupBy === 'month') {
        const dt = new Date(d.deathDate);
        key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      } else if (groupBy === 'location') {
        key = d.locationId ?? 'sin-ubicacion';
      } else {
        key = d.cause;
      }
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    const groups = Array.from(buckets.entries())
      .map(([key, count]) => ({
        key,
        label: groupBy === 'cause' ? deathCauseLabel(key) : key,
        count,
        percentage: total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return { ranchId, groupBy, total, groups };
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const bovineDeathService = new BovineDeathService();
