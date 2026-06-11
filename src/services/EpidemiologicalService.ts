// services/EpidemiologicalService.ts
// ============================================================================
// EPIDEMIOLOGICAL SERVICE (Fase 4)
// ============================================================================
// Responsabilidades:
//   1. computeSnapshots(date?) — job diario: calcula y persiste los resúmenes
//      epidemiológicos por rancho × enfermedad para la fecha indicada.
//   2. getSnapshots(filters)   — consulta snapshots históricos con filtros.
//   3. getLatest(ranchId, diseaseId?) — último snapshot por rancho/enfermedad.
//   4. getTopDiseases(ranchId) — enfermedades ordenadas por activeCases desc.
//   5. getTrend(ranchId, diseaseId, days) — serie temporal de los últimos N días.
//
// Lógica de cómputo:
//   - activeCases:      BovineDiseaseCase WHERE status IN(SUSPECTED,CONFIRMED,RECOVERING) AND ranchId
//   - newCases7d/30d:   diagnosedAt BETWEEN (snapshotDate - N días) AND snapshotDate
//   - closedCases30d:   resolvedAt BETWEEN (snapshotDate - 30d) AND snapshotDate
//   - recovered/deceased: outer de closedCases30d filtrado por outcome
//   - incidenceRate:    affectedBovines / totalBovinesInRanch × 100
//   - mortalityRate:    deceasedCount / closedCases30d × 100
//   - avgResolutionDays: AVG(resolvedAt - diagnosedAt) de casos cerrados en 30d
//
// Upsert:
//   Usa EpidemiologicalSnapshot.upsert() con conflictFields
//   [ranch_id, disease_id, snapshot_date] para ser idempotente.
// ============================================================================

import { Op, fn, col, literal } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';

import EpidemiologicalSnapshot, {
  EpidemiologicalSnapshot_Attributes,
} from '../models/EpidemiologicalSnapshot';
import BovineDiseaseCase, { CaseStatus, CaseOutcome } from '../models/BovineDiseaseCase';
import CaseContact, { ContactType, ContactDetectedBy } from '../models/CaseContact';
import Bovine from '../models/Bovine';
import Disease from '../models/Disease';
import Ranch from '../models/Ranch';
import BovineLocationHistory from '../models/BovineLocationHistory';
import Vaccination from '../models/Vaccination';
import VaccineDiseaseProtection from '../models/VaccineDiseaseProtection';
import BovineDeath, { DeathCause } from '../models/BovineDeath';
import EpidemiologyAlert, { AlertType, AlertSeverity, AlertStatus } from '../models/EpidemiologyAlert';
import { vaccinationService } from './VaccinationService';

// ============================================================================
// DTOs / Filtros
// ============================================================================

export interface SnapshotFilters {
  ranchId?: string;
  diseaseId?: string | null;  // null = solo globales; undefined = todos
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface TrendPoint {
  snapshotDate: string;
  activeCases: number;
  newCases7d: number;
  newCases30d: number;
  incidenceRate: number | null;
  mortalityRate: number | null;
  vaccinationCoverage: number | null;
}

export interface TopDiseaseItem {
  diseaseId: string;
  diseaseName: string;
  diseaseSlug: string;
  activeCases: number;
  affectedBovines: number;
  newCases7d: number;
  incidenceRate: number | null;
  vaccinatedBovines: number;
  vaccinationCoverage: number | null;
}

// ============================================================================
// DTOs — Fase 5
// ============================================================================

/** Un caso individual dentro de la línea de tiempo de un brote */
export interface OutbreakCaseItem {
  caseId: string;
  bovineId: string;
  bovineEarTag: string;
  bovineName: string | null;
  breed: string | null;
  status: CaseStatus;
  severity: string;
  diagnosedAt: Date;
  resolvedAt: Date | null;
  outcome: string | null;
  diagnosedBy: string | null;
  durationDays: number | null;  // null si aún activo
  notes: string | null;
}

/** Respuesta completa de la línea de tiempo de un brote */
export interface OutbreakTimelineResponse {
  ranchId: string;
  ranchName: string;
  disease: {
    id: string;
    name: string;
    slug: string;
    category: string;
    severity: string;
    isContagious: boolean;
    isZoonotic: boolean;
    incubationDaysMin: number | null;
    incubationDaysMax: number | null;
  };
  summary: {
    totalCases: number;
    activeCases: number;
    recoveredCases: number;
    deceasedCases: number;
    firstCaseAt: Date | null;
    lastCaseAt: Date | null;
    durationDays: number | null;  // días desde primer caso hasta hoy (o último cierre)
  };
  timeline: OutbreakCaseItem[];
}

/** Un contacto potencial detectado por el sistema */
export interface DetectedContact {
  sourceCaseId: string;
  /** Caso del bovino contagiado. null si es solo EXPOSICIÓN asintomática (E-04). */
  targetCaseId: string | null;
  /** Bovino destino (siempre presente: tenga o no caso). */
  targetBovineId: string;
  targetBovineEarTag: string;
  targetBovineName: string | null;
  contactType: ContactType;
  contactDate: Date | null;
  locationId: string | null;
  confidence: number;
  /** El bovino destino tenía protección vacunal activa contra la enfermedad en la ventana de exposición */
  wasProtected: boolean;
  /** E-04: true si es exposición sin caso (targetCaseId null). */
  isExposureOnly: boolean;
  isNew: boolean;  // true = creado ahora, false = ya existía
}

// Statuses que se consideran "caso activo"
const ACTIVE_STATUSES: CaseStatus[] = [
  CaseStatus.SUSPECTED,
  CaseStatus.CONFIRMED,
  CaseStatus.RECOVERING,
];

// ============================================================================
// SERVICIO
// ============================================================================

export class EpidemiologicalService {
  private readonly context = 'EpidemiologicalService';

  // --------------------------------------------------------------------------
  // computeSnapshots
  // --------------------------------------------------------------------------

  /**
   * Calcula y persiste los snapshots epidemiológicos para una fecha dada
   * (por defecto hoy). Es idempotente: llamarlo varias veces en el mismo día
   * actualiza los datos en lugar de duplicarlos.
   *
   * Itera sobre todos los ranchos que tienen al menos un bovino activo.
   * Por cada rancho computa:
   *   - 1 snapshot GLOBAL (diseaseId = NULL)
   *   - 1 snapshot POR ENFERMEDAD para cada Disease con ≥1 caso en 30d
   */
  async computeSnapshots(date?: Date): Promise<{ computed: number; errors: number }> {
    const snapshotDate = this.toDateOnly(date ?? new Date());
    const dateObj = new Date(snapshotDate);

    const window7d  = new Date(dateObj); window7d.setDate(window7d.getDate() - 7);
    const window30d = new Date(dateObj); window30d.setDate(window30d.getDate() - 30);

    let computed = 0;
    let errors   = 0;

    logger.info(`Iniciando cómputo de snapshots epidemiológicos para ${snapshotDate}`, this.context);

    try {
      // ── Obtener todos los ranchos con bovinos activos ─────────────────────
      const ranchRows = await Bovine.findAll({
        attributes: [[fn('DISTINCT', col('ranch_id')), 'ranchId']],
        where: { isActive: true },
        raw: true,
      }) as any[];

      const ranchIds: string[] = ranchRows.map((r: any) => r.ranchId).filter(Boolean);

      for (const ranchId of ranchIds) {
        try {
          // Snapshot GLOBAL del rancho
          await this.computeOneSnapshot(ranchId, null, snapshotDate, dateObj, window7d, window30d);
          computed++;

          // Enfermedades con actividad en 30d para este rancho
          const diseaseRows = await BovineDiseaseCase.findAll({
            attributes: [[fn('DISTINCT', col('disease_id')), 'diseaseId']],
            where: {
              ranchId,
              [Op.or]: [
                // Caso activo ahora
                { status: { [Op.in]: ACTIVE_STATUSES } },
                // O cerrado en los últimos 30d
                { resolvedAt: { [Op.gte]: window30d } },
                // O abierto en los últimos 30d
                { diagnosedAt: { [Op.gte]: window30d } },
              ],
            },
            raw: true,
          }) as any[];

          for (const { diseaseId } of diseaseRows) {
            if (!diseaseId) continue;
            try {
              await this.computeOneSnapshot(ranchId, diseaseId, snapshotDate, dateObj, window7d, window30d);
              computed++;
            } catch (inner) {
              logger.error('Error cómputo snapshot de enfermedad', this.context, { ranchId, diseaseId }, ensureError(inner));
              errors++;
            }
          }
        } catch (ranchErr) {
          logger.error('Error cómputo snapshot de rancho', this.context, { ranchId }, ensureError(ranchErr));
          errors++;
        }
      }
    } catch (globalErr) {
      logger.error('Error global en computeSnapshots', this.context, { snapshotDate }, ensureError(globalErr));
      throw globalErr;
    }

    logger.info(
      `Cómputo de snapshots finalizado — computed: ${computed}, errors: ${errors}`,
      this.context,
      { snapshotDate, computed, errors }
    );

    return { computed, errors };
  }

  // --------------------------------------------------------------------------
  // Lógica interna de cómputo para un rancho × enfermedad
  // --------------------------------------------------------------------------

  private async computeOneSnapshot(
    ranchId: string,
    diseaseId: string | null,
    snapshotDate: string,
    dateObj: Date,
    window7d: Date,
    window30d: Date
  ): Promise<void> {
    const diseaseFilter = diseaseId ? { diseaseId } : {};

    // Total bovinos activos en el rancho
    const totalBovinesInRanch = await Bovine.count({
      where: { ranchId, isActive: true },
    });

    // Casos activos (any active status)
    const activeCases = await BovineDiseaseCase.count({
      where: {
        ranchId,
        ...diseaseFilter,
        status: { [Op.in]: ACTIVE_STATUSES },
      },
    });

    // Bovinos únicos con caso activo
    const affectedBovinesResult = await BovineDiseaseCase.findAll({
      attributes: [[fn('COUNT', fn('DISTINCT', col('bovine_id'))), 'cnt']],
      where: {
        ranchId,
        ...diseaseFilter,
        status: { [Op.in]: ACTIVE_STATUSES },
      },
      raw: true,
    }) as any[];
    const affectedBovines = parseInt(affectedBovinesResult[0]?.cnt ?? '0', 10);

    // Nuevos en 7d
    const newCases7d = await BovineDiseaseCase.count({
      where: {
        ranchId,
        ...diseaseFilter,
        diagnosedAt: { [Op.between]: [window7d, dateObj] },
      },
    });

    // Nuevos en 30d
    const newCases30d = await BovineDiseaseCase.count({
      where: {
        ranchId,
        ...diseaseFilter,
        diagnosedAt: { [Op.between]: [window30d, dateObj] },
      },
    });

    // Casos cerrados en 30d (tienen resolvedAt)
    const closedRows = await BovineDiseaseCase.findAll({
      attributes: ['outcome', 'diagnosedAt', 'resolvedAt'],
      where: {
        ranchId,
        ...diseaseFilter,
        resolvedAt: { [Op.between]: [window30d, dateObj] },
      },
      raw: true,
    }) as any[];

    const closedCases30d  = closedRows.length;
    const recoveredCount  = closedRows.filter((r: any) => r.outcome === CaseOutcome.RECOVERED).length;
    let   deceasedCount   = closedRows.filter((r: any) => r.outcome === CaseOutcome.DECEASED).length;

    // X-06: en el snapshot GLOBAL (diseaseId null) sumar las muertes EXTERNAS
    // (no por enfermedad), que no quedan reflejadas en casos clínicos cerrados.
    // Las muertes por enfermedad ya se cuentan vía los casos cerrados DECEASED.
    if (!diseaseId) {
      const externalDeaths = await BovineDeath.count({
        where: {
          deathDate: { [Op.between]: [window30d, dateObj] },
          cause: { [Op.ne]: DeathCause.DISEASE },
        },
        include: [
          { model: Bovine, as: 'bovine', attributes: [], where: { ranchId }, required: true },
        ],
      });
      deceasedCount += externalDeaths;
    }

    // avgResolutionDays — sólo casos con ambas fechas
    const withBothDates = closedRows.filter(
      (r: any) => r.diagnosedAt && r.resolvedAt
    );
    let avgResolutionDays: number | null = null;
    if (withBothDates.length > 0) {
      const totalDays = withBothDates.reduce((sum: number, r: any) => {
        const diff = new Date(r.resolvedAt).getTime() - new Date(r.diagnosedAt).getTime();
        return sum + diff / (1000 * 60 * 60 * 24);
      }, 0);
      avgResolutionDays = parseFloat((totalDays / withBothDates.length).toFixed(1));
    }

    // Métricas derivadas
    const incidenceRate = totalBovinesInRanch > 0
      ? parseFloat(((affectedBovines / totalBovinesInRanch) * 100).toFixed(2))
      : null;

    const mortalityRate = closedCases30d > 0
      ? parseFloat(((deceasedCount / closedCases30d) * 100).toFixed(2))
      : null;

    // Cobertura de vacunación — solo aplica a snapshots por enfermedad
    const { vaccinatedBovines, susceptibleBovines, vaccinationCoverage } = diseaseId
      ? await this.computeVaccinationMetrics(ranchId, diseaseId, dateObj, totalBovinesInRanch)
      : { vaccinatedBovines: 0, susceptibleBovines: 0, vaccinationCoverage: null };

    // Upsert seguro: findOne + update | create
    // (evita dependencia de conflictFields que varía entre versiones de Sequelize)
    const snapshotData = {
      ranchId,
      diseaseId,
      snapshotDate,
      activeCases,
      affectedBovines,
      newCases7d,
      newCases30d,
      closedCases30d,
      recoveredCount,
      deceasedCount,
      totalBovinesInRanch,
      incidenceRate,
      mortalityRate,
      avgResolutionDays,
      vaccinatedBovines,
      susceptibleBovines,
      vaccinationCoverage,
      computedAt: new Date(),
      metadata: null,
    };

    const existing = await EpidemiologicalSnapshot.findOne({
      where: {
        ranchId,
        snapshotDate,
        // Sequelize traduce null → IS NULL automáticamente
        diseaseId: diseaseId as any,
      },
    });

    if (existing) {
      await existing.update(snapshotData);
    } else {
      await EpidemiologicalSnapshot.create(snapshotData);
    }
  }

  // --------------------------------------------------------------------------
  // computeVaccinationMetrics — cobertura vacunal por rancho × enfermedad
  // --------------------------------------------------------------------------

  /**
   * Cuenta cuántos bovinos del rancho tenían protección vacunal ACTIVA contra
   * la enfermedad en la fecha del snapshot, cruzando las vacunas aplicadas
   * con el catálogo VaccineDiseaseProtection.
   *
   * Un bovino está protegido si tiene ≥1 vacuna de un tipo que cubre la
   * enfermedad, con applicationDate + immunityDays ≥ atDate.
   * immunityDays = vaccination.immunityDurationDays (override) ?? catálogo.
   */
  private async computeVaccinationMetrics(
    ranchId: string,
    diseaseId: string,
    atDate: Date,
    totalBovinesInRanch: number
  ): Promise<{ vaccinatedBovines: number; susceptibleBovines: number; vaccinationCoverage: number | null }> {
    // Tipos de vacuna que protegen contra esta enfermedad + su inmunidad de catálogo
    const protections = await VaccineDiseaseProtection.findAll({
      where: { diseaseId, isActive: true },
      attributes: ['vaccineType', 'immunityDurationDays'],
      raw: true,
    }) as any[];

    if (protections.length === 0) {
      // No hay vacuna catalogada para esta enfermedad → cobertura 0
      return {
        vaccinatedBovines: 0,
        susceptibleBovines: totalBovinesInRanch,
        vaccinationCoverage: totalBovinesInRanch > 0 ? 0 : null,
      };
    }

    const immunityByType = new Map<string, number>();
    for (const p of protections) immunityByType.set(p.vaccineType, p.immunityDurationDays);

    // Vacunas de esos tipos, en bovinos activos del rancho, aplicadas ≤ atDate
    const vaccinations = await Vaccination.findAll({
      attributes: ['bovineId', 'vaccineType', 'applicationDate', 'immunityDurationDays'],
      where: {
        vaccineType: { [Op.in]: Array.from(immunityByType.keys()) },
        applicationDate: { [Op.lte]: atDate },
      },
      include: [
        { model: Bovine, as: 'bovine', attributes: [], where: { ranchId, isActive: true }, required: true },
      ],
      raw: true,
    }) as any[];

    const protectedBovines = new Set<string>();
    for (const v of vaccinations) {
      const immunityDays = v.immunityDurationDays ?? immunityByType.get(v.vaccineType) ?? 0;
      const protectedUntil = new Date(v.applicationDate);
      protectedUntil.setDate(protectedUntil.getDate() + immunityDays);
      if (protectedUntil >= atDate) protectedBovines.add(v.bovineId);
    }

    const vaccinatedBovines = protectedBovines.size;
    const susceptibleBovines = Math.max(0, totalBovinesInRanch - vaccinatedBovines);
    const vaccinationCoverage = totalBovinesInRanch > 0
      ? parseFloat(((vaccinatedBovines / totalBovinesInRanch) * 100).toFixed(2))
      : null;

    return { vaccinatedBovines, susceptibleBovines, vaccinationCoverage };
  }

  // --------------------------------------------------------------------------
  // getSnapshots
  // --------------------------------------------------------------------------

  async getSnapshots(filters: SnapshotFilters = {}): Promise<EpidemiologicalSnapshot[]> {
    try {
      const where: any = {};

      if (filters.ranchId)             where.ranchId   = filters.ranchId;
      if (filters.diseaseId !== undefined) where.diseaseId = filters.diseaseId;
      if (filters.fromDate || filters.toDate) {
        where.snapshotDate = {};
        if (filters.fromDate) where.snapshotDate[Op.gte] = this.toDateOnly(filters.fromDate);
        if (filters.toDate)   where.snapshotDate[Op.lte] = this.toDateOnly(filters.toDate);
      }

      return await EpidemiologicalSnapshot.findAll({
        where,
        include: [
          { model: Disease, as: 'disease', attributes: ['id', 'name', 'slug', 'category', 'severity'] },
          { model: Ranch,   as: 'ranch',   attributes: ['id', 'name'] },
        ],
        order: [['snapshotDate', 'DESC']],
        limit:  filters.limit  ?? 100,
        offset: filters.offset ?? 0,
      });
    } catch (error) {
      logger.error('Error obteniendo snapshots', this.context, filters as any, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // getLatest
  // --------------------------------------------------------------------------

  /**
   * Devuelve el snapshot más reciente para un rancho.
   * Si diseaseId se proporciona, filtra por esa enfermedad; si es null devuelve
   * el global; si no se proporciona (undefined), devuelve el más reciente sin
   * importar la enfermedad.
   */
  async getLatest(ranchId: string, diseaseId?: string | null): Promise<EpidemiologicalSnapshot | null> {
    try {
      const where: any = { ranchId };
      if (diseaseId !== undefined) where.diseaseId = diseaseId;

      return await EpidemiologicalSnapshot.findOne({
        where,
        include: [
          { model: Disease, as: 'disease', attributes: ['id', 'name', 'slug', 'category', 'severity'] },
        ],
        order: [['snapshotDate', 'DESC']],
      });
    } catch (error) {
      logger.error('Error obteniendo snapshot más reciente', this.context, { ranchId, diseaseId }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // getTopDiseases
  // --------------------------------------------------------------------------

  /**
   * Devuelve las enfermedades con más casos activos en el último snapshot
   * disponible del rancho, ordenadas por activeCases descendente.
   */
  async getTopDiseases(ranchId: string, limit = 10): Promise<TopDiseaseItem[]> {
    try {
      // Obtener la fecha del snapshot más reciente para este rancho
      const latest = await EpidemiologicalSnapshot.findOne({
        attributes: ['snapshotDate'],
        where: { ranchId, diseaseId: { [Op.not]: null } },
        order: [['snapshotDate', 'DESC']],
        raw: true,
      }) as any;

      if (!latest) return [];

      const rows = await EpidemiologicalSnapshot.findAll({
        where: {
          ranchId,
          snapshotDate: latest.snapshotDate,
          diseaseId: { [Op.not]: null },
        },
        include: [
          { model: Disease, as: 'disease', attributes: ['id', 'name', 'slug'] },
        ],
        order: [['activeCases', 'DESC']],
        limit,
      });

      return rows.map((r) => {
        const disease = (r as any).disease;
        return {
          diseaseId:      r.diseaseId!,
          diseaseName:    disease?.name    ?? 'Desconocida',
          diseaseSlug:    disease?.slug    ?? '',
          activeCases:    r.activeCases,
          affectedBovines: r.affectedBovines,
          newCases7d:     r.newCases7d,
          incidenceRate:  r.incidenceRate,
          vaccinatedBovines:   r.vaccinatedBovines,
          vaccinationCoverage: r.vaccinationCoverage,
        };
      });
    } catch (error) {
      logger.error('Error obteniendo top enfermedades', this.context, { ranchId, limit }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // getTrend
  // --------------------------------------------------------------------------

  /**
   * Devuelve la serie temporal (últimos `days` días) de un rancho × enfermedad.
   * Ideal para graficar la evolución epidemiológica en el frontend.
   */
  async getTrend(ranchId: string, diseaseId: string | null, days = 30): Promise<TrendPoint[]> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const rows = await EpidemiologicalSnapshot.findAll({
        where: {
          ranchId,
          diseaseId: diseaseId ?? null,
          snapshotDate: { [Op.gte]: this.toDateOnly(cutoff) },
        },
        attributes: [
          'snapshotDate',
          'activeCases',
          'newCases7d',
          'newCases30d',
          'incidenceRate',
          'mortalityRate',
          'vaccinationCoverage',
        ],
        order: [['snapshotDate', 'ASC']],
        raw: true,
      }) as any[];

      return rows.map((r: any) => ({
        snapshotDate:  r.snapshotDate,
        activeCases:   r.activeCases,
        newCases7d:    r.newCases7d,
        newCases30d:   r.newCases30d,
        incidenceRate: r.incidenceRate !== null ? parseFloat(r.incidenceRate) : null,
        mortalityRate: r.mortalityRate !== null ? parseFloat(r.mortalityRate) : null,
        vaccinationCoverage: r.vaccinationCoverage !== null && r.vaccinationCoverage !== undefined
          ? parseFloat(r.vaccinationCoverage)
          : null,
      }));
    } catch (error) {
      logger.error('Error obteniendo tendencia epidemiológica', this.context, { ranchId, diseaseId, days }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // getOutbreakTimeline  (Fase 5.1)
  // --------------------------------------------------------------------------

  /**
   * Devuelve la línea de tiempo clínica completa de todos los casos de una
   * enfermedad en un rancho, ordenados por `diagnosedAt`.
   *
   * Incluye:
   *  - Datos de la enfermedad (metadatos epidemiológicos)
   *  - Resumen del brote (totales, fechas, duración)
   *  - Lista ordenada de casos con datos del bovino afectado
   */
  async getOutbreakTimeline(
    ranchId: string,
    diseaseId: string
  ): Promise<OutbreakTimelineResponse> {
    try {
      // Ranch + Disease en paralelo
      const [ranch, disease] = await Promise.all([
        Ranch.findByPk(ranchId, { attributes: ['id', 'name'] }),
        Disease.findByPk(diseaseId, {
          attributes: [
            'id', 'name', 'slug', 'category', 'severity',
            'isContagious', 'isZoonotic', 'incubationDaysMin', 'incubationDaysMax',
          ],
        }),
      ]);

      if (!ranch)   throw new Error(`Rancho no encontrado: ${ranchId}`);
      if (!disease) throw new Error(`Enfermedad no encontrada: ${diseaseId}`);

      // Todos los casos de esta enfermedad en este rancho (incluye cerrados)
      const cases = await BovineDiseaseCase.findAll({
        where: { ranchId, diseaseId },
        include: [
          {
            model: Bovine,
            as: 'bovine',
            attributes: ['id', 'earTag', 'name', 'breed'],
          },
        ],
        order: [['diagnosedAt', 'ASC']],
      });

      // Construir timeline
      const now = new Date();
      const timeline: OutbreakCaseItem[] = cases.map((c) => {
        const bovine = (c as any).bovine;
        const durationDays = c.resolvedAt
          ? Math.round(
              (new Date(c.resolvedAt).getTime() - new Date(c.diagnosedAt).getTime()) /
              (1000 * 60 * 60 * 24)
            )
          : null;

        return {
          caseId:         c.id,
          bovineId:       c.bovineId,
          bovineEarTag:   bovine?.earTag  ?? '',
          bovineName:     bovine?.name    ?? null,
          breed:          bovine?.breed   ?? null,
          status:         c.status,
          severity:       c.severity,
          diagnosedAt:    c.diagnosedAt,
          resolvedAt:     c.resolvedAt   ?? null,
          outcome:        c.outcome      ?? null,
          diagnosedBy:    c.diagnosedBy  ?? null,
          durationDays,
          notes:          c.notes        ?? null,
        };
      });

      // Resumen
      const closed    = cases.filter((c) => !c.isOpen);
      const active    = cases.filter((c) =>  c.isOpen);
      const recovered = closed.filter((c) => c.outcome === CaseOutcome.RECOVERED);
      const deceased  = closed.filter((c) => c.outcome === CaseOutcome.DECEASED);

      const firstCaseAt = cases.length > 0 ? cases[0].diagnosedAt : null;
      const lastCaseAt  = cases.length > 0 ? cases[cases.length - 1].diagnosedAt : null;

      const durationDays = firstCaseAt
        ? Math.round((now.getTime() - new Date(firstCaseAt).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ranchId,
        ranchName: (ranch as any).name,
        disease: {
          id:                (disease as any).id,
          name:              (disease as any).name,
          slug:              (disease as any).slug,
          category:          (disease as any).category,
          severity:          (disease as any).severity,
          isContagious:      (disease as any).isContagious,
          isZoonotic:        (disease as any).isZoonotic,
          incubationDaysMin: (disease as any).incubationDaysMin  ?? null,
          incubationDaysMax: (disease as any).incubationDaysMax  ?? null,
        },
        summary: {
          totalCases:     cases.length,
          activeCases:    active.length,
          recoveredCases: recovered.length,
          deceasedCases:  deceased.length,
          firstCaseAt,
          lastCaseAt,
          durationDays,
        },
        timeline,
      };
    } catch (error) {
      logger.error('Error en getOutbreakTimeline', this.context, { ranchId, diseaseId }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // detectPotentialContacts  (Fase 5.3)
  // --------------------------------------------------------------------------

  /**
   * Analiza co-localización espaciotemporal para un caso dado y crea enlaces
   * de contagio potencial (`CaseContact`) con los casos activos de otros
   * bovinos que estuvieron en el mismo potrero/corral durante el período de
   * incubación de la enfermedad.
   *
   * Algoritmo:
   *  1. Carga el caso índice (bovineId, diseaseId, diagnosedAt).
   *  2. Obtiene la ventana de exposición = [diagnosedAt - incubationDaysMax, diagnosedAt].
   *     Default incubationDaysMax = 21 si la enfermedad no tiene dato.
   *  3. Consulta BovineLocationHistory para obtener los potrero-IDs del bovino
   *     índice durante esa ventana.
   *  4. Encuentra todos los demás bovinos que estuvieron en los mismos potreros
   *     y con intervalos solapados.
   *  5. Para cada bovino co-localizado, busca si tiene un caso activo de la
   *     misma enfermedad (o caso reciente en ±incubationDaysMax).
   *  6. Crea CaseContact si no existe ya el par (sourceCaseId, targetCaseId).
   *  7. Devuelve la lista de contactos detectados/confirmados.
   *
   * `createdBy` = null → registro automático del sistema.
   */
  async detectPotentialContacts(caseId: string): Promise<DetectedContact[]> {
    try {
      // ── 1. Cargar caso índice ────────────────────────────────────────────
      const indexCase = await BovineDiseaseCase.findByPk(caseId, {
        include: [
          {
            model: Disease,
            as: 'disease',
            attributes: ['id', 'incubationDaysMin', 'incubationDaysMax'],
          },
        ],
      });

      if (!indexCase) throw new Error(`Caso clínico no encontrado: ${caseId}`);

      const { bovineId, diseaseId, ranchId, diagnosedAt } = indexCase;
      const disease = (indexCase as any).disease;

      // ── 2. Ventana de exposición ─────────────────────────────────────────
      const incubationMax: number = disease?.incubationDaysMax ?? 21;
      const exposureStart = new Date(diagnosedAt);
      exposureStart.setDate(exposureStart.getDate() - incubationMax);
      const exposureEnd = new Date(diagnosedAt);

      // ── 3. Potreros del bovino índice durante la exposición ──────────────
      const indexStays = await BovineLocationHistory.findAll({
        attributes: ['locationId', 'enteredAt', 'exitedAt'],
        where: {
          bovineId,
          enteredAt: { [Op.lte]: exposureEnd },
          [Op.or]: [
            { exitedAt: { [Op.gte]: exposureStart } },
            { exitedAt: null as any },  // aún en la ubicación → IS NULL
          ],
        } as any,
        raw: true,
      }) as any[];

      if (indexStays.length === 0) {
        logger.debug(
          `detectPotentialContacts: sin historial de ubicación para bovino ${bovineId} en ventana de exposición`,
          this.context
        );
        return [];
      }

      const locationIds: string[] = [...new Set(indexStays.map((s: any) => s.locationId))];

      // ── 4. Bovinos co-localizados ────────────────────────────────────────
      // Mismos potreros, mismo rango de tiempo, diferente bovino
      const coLocalRows = await BovineLocationHistory.findAll({
        attributes: [[fn('DISTINCT', col('bovine_id')), 'bovineId']],
        where: {
          locationId: { [Op.in]: locationIds },
          bovineId: { [Op.ne]: bovineId },
          enteredAt: { [Op.lte]: exposureEnd },
          [Op.or]: [
            { exitedAt: { [Op.gte]: exposureStart } },
            { exitedAt: null as any },
          ],
        } as any,
        raw: true,
      }) as any[];

      const contactBovineIds: string[] = coLocalRows.map((r: any) => r.bovineId).filter(Boolean);

      if (contactBovineIds.length === 0) return [];

      // ── 5. Casos de esos bovinos para la misma enfermedad ────────────────
      // Ventana ampliada: ±incubationMax a partir del diagnosedAt del índice
      const searchFrom = new Date(diagnosedAt);
      searchFrom.setDate(searchFrom.getDate() - incubationMax);
      const searchTo = new Date(diagnosedAt);
      searchTo.setDate(searchTo.getDate() + incubationMax);

      const contactCases = await BovineDiseaseCase.findAll({
        attributes: ['id', 'bovineId', 'diagnosedAt', 'status'],
        include: [
          { model: Bovine, as: 'bovine', attributes: ['id', 'earTag', 'name'] },
        ],
        where: {
          bovineId: { [Op.in]: contactBovineIds },
          diseaseId,
          ranchId,
          diagnosedAt: { [Op.between]: [searchFrom, searchTo] },
        },
      });

      // E-04: NO retornamos aunque no haya casos — los bovinos co-localizados
      // sin caso se registran como exposiciones asintomáticas más abajo.

      // ── 6. Crear CaseContact para cada par ───────────────────────────────
      const results: DetectedContact[] = [];

      for (const targetCase of contactCases) {
        // Calcular fecha de contacto: punto medio solapado
        // Buscar la estancia más cercana entre index y target bovino
        const targetStays = await BovineLocationHistory.findAll({
          attributes: ['locationId', 'enteredAt', 'exitedAt'],
          where: {
            bovineId: targetCase.bovineId,
            locationId: { [Op.in]: locationIds },
            enteredAt: { [Op.lte]: exposureEnd },
            [Op.or]: [
              { exitedAt: { [Op.gte]: exposureStart } },
              { exitedAt: null as any },
            ],
          } as any,
          raw: true,
        }) as any[];

        // Potrero del primer solapamiento
        const firstOverlap = targetStays[0];
        const overlapLocationId: string | null = firstOverlap?.locationId ?? null;

        // Fecha estimada de contacto = punto medio de la ventana de solapamiento
        let contactDate: Date | null = null;
        if (firstOverlap) {
          const overlapStart = new Date(
            Math.max(exposureStart.getTime(), new Date(firstOverlap.enteredAt).getTime())
          );
          const overlapEndRaw = firstOverlap.exitedAt
            ? new Date(firstOverlap.exitedAt)
            : exposureEnd;
          const overlapEnd = new Date(Math.min(exposureEnd.getTime(), overlapEndRaw.getTime()));
          contactDate = new Date((overlapStart.getTime() + overlapEnd.getTime()) / 2);
        }

        // Confianza basada en el número de estancias solapadas
        let confidence = Math.min(0.95, 0.5 + targetStays.length * 0.15);

        // ── Ajuste por protección vacunal ────────────────────────────────────
        // Si el bovino destino estaba protegido contra la enfermedad en la
        // fecha de contacto, es menos probable que sea un contagio real → se
        // reduce la confianza a la mitad (mínimo 0.1) y se marca wasProtected.
        const protectionDate = contactDate ?? exposureEnd;
        const wasProtected = await vaccinationService.isProtectedAgainst(
          targetCase.bovineId,
          diseaseId,
          protectionDate
        );
        if (wasProtected) {
          confidence = Math.max(0.1, parseFloat((confidence * 0.5).toFixed(2)));
        }

        // Crear o verificar existencia del enlace
        let isNew = false;
        const existing = await CaseContact.findOne({
          where: { sourceCaseId: caseId, targetCaseId: targetCase.id },
        });

        if (!existing) {
          await CaseContact.create({
            sourceCaseId:  caseId,
            targetCaseId:  targetCase.id,
            contactType:   ContactType.SAME_LOCATION,
            contactDate:   contactDate ?? undefined,
            detectedBy:    ContactDetectedBy.AUTO,
            confidence,
            locationId:    overlapLocationId ?? undefined,
          });
          isNew = true;
        }

        const targetBovine = (targetCase as any).bovine;
        results.push({
          sourceCaseId:        caseId,
          targetCaseId:        targetCase.id,
          targetBovineId:      targetCase.bovineId,
          targetBovineEarTag:  targetBovine?.earTag ?? '',
          targetBovineName:    targetBovine?.name   ?? null,
          contactType:         ContactType.SAME_LOCATION,
          contactDate,
          locationId:          overlapLocationId,
          confidence,
          wasProtected,
          isExposureOnly:      false,
          isNew,
        });
      }

      // ── 6b. (E-04) Exposiciones asintomáticas: bovinos co-localizados SIN caso ─
      const bovinesWithCase = new Set(contactCases.map((c) => c.bovineId));
      const exposedBovineIds = contactBovineIds.filter((id) => !bovinesWithCase.has(id));

      if (exposedBovineIds.length > 0) {
        const exposedBovines = await Bovine.findAll({
          where: { id: { [Op.in]: exposedBovineIds } },
          attributes: ['id', 'earTag', 'name'],
        });
        const bovineMap = new Map(exposedBovines.map((b) => [b.id, b]));

        for (const exposedId of exposedBovineIds) {
          // Confianza de exposición: baja por definición (< 0.5)
          let confidence = 0.3;
          const wasProtected = await vaccinationService.isProtectedAgainst(exposedId, diseaseId, exposureEnd);
          if (wasProtected) confidence = Math.max(0.1, parseFloat((confidence * 0.5).toFixed(2)));

          // Dedupe por (sourceCaseId, targetBovineId) — el índice único no cubre nulls
          let isNew = false;
          const existing = await CaseContact.findOne({
            where: { sourceCaseId: caseId, targetBovineId: exposedId, targetCaseId: null as any },
          });
          if (!existing) {
            await CaseContact.create({
              sourceCaseId:   caseId,
              targetCaseId:   null,
              targetBovineId: exposedId,
              contactType:    ContactType.SAME_LOCATION,
              detectedBy:     ContactDetectedBy.AUTO,
              confidence,
            });
            isNew = true;
          }

          const b = bovineMap.get(exposedId) as any;
          results.push({
            sourceCaseId:       caseId,
            targetCaseId:       null,
            targetBovineId:     exposedId,
            targetBovineEarTag: b?.earTag ?? '',
            targetBovineName:   b?.name   ?? null,
            contactType:        ContactType.SAME_LOCATION,
            contactDate:        null,
            locationId:         null,
            confidence,
            wasProtected,
            isExposureOnly:     true,
            isNew,
          });
        }
      }

      logger.info(
        `detectPotentialContacts: ${results.length} contactos (${results.filter(r => r.isNew).length} nuevos, ${results.filter(r => r.isExposureOnly).length} exposiciones)`,
        this.context,
        { caseId, diseaseId, ranchId }
      );

      return results;
    } catch (error) {
      logger.error('Error en detectPotentialContacts', this.context, { caseId }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // createManualContact  (E-07)
  // --------------------------------------------------------------------------

  /**
   * Registra manualmente un enlace de contacto (E-07). Permite tipos no
   * co-localizados: DIRECT_CONTACT, SHARED_WATER, SHARED_PASTURE, etc.
   * Requiere sourceCaseId y (targetCaseId | targetBovineId).
   */
  async createManualContact(
    dto: {
      sourceCaseId: string;
      targetCaseId?: string | null;
      targetBovineId?: string | null;
      contactType: ContactType;
      contactDate?: Date;
      confidence?: number;
      distanceMeters?: number;
      locationId?: string;
      notes?: string;
    },
    userId?: string
  ): Promise<CaseContact> {
    try {
      if (!dto.sourceCaseId) throw new Error('sourceCaseId es requerido');
      if (!dto.targetCaseId && !dto.targetBovineId) {
        throw new Error('Se requiere targetCaseId o targetBovineId');
      }

      const source = await BovineDiseaseCase.findByPk(dto.sourceCaseId, { attributes: ['id'] });
      if (!source) throw new Error(`Caso fuente no encontrado: ${dto.sourceCaseId}`);

      if (dto.targetCaseId) {
        const target = await BovineDiseaseCase.findByPk(dto.targetCaseId, { attributes: ['id'] });
        if (!target) throw new Error(`Caso destino no encontrado: ${dto.targetCaseId}`);
      }

      // Dedupe
      const dedupeWhere: any = { sourceCaseId: dto.sourceCaseId };
      if (dto.targetCaseId) dedupeWhere.targetCaseId = dto.targetCaseId;
      else dedupeWhere.targetBovineId = dto.targetBovineId;
      const existing = await CaseContact.findOne({ where: dedupeWhere });
      if (existing) return existing;

      const created = await CaseContact.create({
        sourceCaseId:   dto.sourceCaseId,
        targetCaseId:   dto.targetCaseId ?? null,
        targetBovineId: dto.targetBovineId ?? null,
        contactType:    dto.contactType,
        contactDate:    dto.contactDate,
        detectedBy:     ContactDetectedBy.MANUAL,
        confidence:     dto.confidence ?? 0.7,  // manual: confianza por defecto media-alta
        distanceMeters: dto.distanceMeters,
        locationId:     dto.locationId,
        notes:          dto.notes,
        createdBy:      userId,
      });

      logger.info(`Contacto manual creado: ${created.id}`, this.context, { sourceCaseId: dto.sourceCaseId });
      return created;
    } catch (error) {
      logger.error('Error creando contacto manual', this.context, { dto }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // getHerdHealthIndex  (E-02)
  // --------------------------------------------------------------------------

  /**
   * Índice de salud del hato (E-02): desglose de porcentajes por estado de salud
   * + cobertura vacunal + un score 0-100 ponderado.
   *
   * Score: HEALTHY=100, RECOVERING=70, QUARANTINE=40, SICK=20, UNKNOWN=50,
   * promedio ponderado por # de bovinos. Solo considera bovinos ACTIVOS.
   */
  async getHerdHealthIndex(ranchId: string): Promise<{
    ranchId: string;
    totalActive: number;
    byStatus: Record<string, { count: number; percentage: number }>;
    vaccinationCoveragePct: number | null;
    healthScore: number | null;
    computedAt: Date;
  }> {
    const STATUSES = ['HEALTHY', 'SICK', 'RECOVERING', 'QUARANTINE', 'UNKNOWN'];
    const SCORE_WEIGHT: Record<string, number> = {
      HEALTHY: 100, RECOVERING: 70, UNKNOWN: 50, QUARANTINE: 40, SICK: 20,
    };

    // Conteo por estado (bovinos activos)
    const rows = await Bovine.findAll({
      attributes: ['healthStatus', [fn('COUNT', col('id')), 'count']],
      where: { ranchId, isActive: true } as any,
      group: ['health_status'],
      raw: true,
    }) as any[];

    const counts: Record<string, number> = {};
    let totalActive = 0;
    for (const r of rows) {
      const c = parseInt(r.count, 10);
      counts[r.healthStatus] = c;
      totalActive += c;
    }

    const byStatus: Record<string, { count: number; percentage: number }> = {};
    for (const s of STATUSES) {
      const c = counts[s] ?? 0;
      byStatus[s] = { count: c, percentage: totalActive > 0 ? parseFloat(((c / totalActive) * 100).toFixed(1)) : 0 };
    }

    // Score ponderado
    let healthScore: number | null = null;
    if (totalActive > 0) {
      let acc = 0;
      for (const s of STATUSES) acc += (counts[s] ?? 0) * (SCORE_WEIGHT[s] ?? 50);
      healthScore = parseFloat((acc / totalActive).toFixed(1));
    }

    // Cobertura vacunal: bovinos con estado UP_TO_DATE / total activos
    let vaccinationCoveragePct: number | null = null;
    if (totalActive > 0) {
      const BovineVaccinationStatus = (await import('../models/BovineVaccinationStatus')).default;
      const upToDate = await BovineVaccinationStatus.count({
        where: { status: 'UP_TO_DATE' },
        include: [{ model: Bovine, as: 'bovine', attributes: [], where: { ranchId, isActive: true }, required: true }],
      });
      vaccinationCoveragePct = parseFloat(((upToDate / totalActive) * 100).toFixed(1));
    }

    return {
      ranchId,
      totalActive,
      byStatus,
      vaccinationCoveragePct,
      healthScore,
      computedAt: new Date(),
    };
  }

  // --------------------------------------------------------------------------
  // evaluateAlerts  (E-03)
  // --------------------------------------------------------------------------

  /**
   * Evalúa los snapshots más recientes y genera alertas epidemiológicas cuando
   * se disparan triggers. Idempotente: no duplica una alerta OPEN del mismo
   * (ranchId, diseaseId, type). Se ejecuta tras computeSnapshots (cron).
   *
   * Triggers:
   *   - OUTBREAK_EMERGING: newCases7d ≥ 3
   *   - LOW_COVERAGE:      activeCases > 0 y vaccinationCoverage < 50%
   *   - HIGH_LETHALITY:    mortalityRate > 30%
   *   - ZOONOTIC_CASE:     caso activo de enfermedad zoonótica
   */
  async evaluateAlerts(): Promise<{ created: number }> {
    let created = 0;

    const ensureAlert = async (
      ranchId: string,
      diseaseId: string | null,
      type: AlertType,
      severity: AlertSeverity,
      title: string,
      message: string,
      metadata?: Record<string, unknown>
    ) => {
      const existing = await EpidemiologyAlert.findOne({
        where: { ranchId, diseaseId: diseaseId as any, type, status: AlertStatus.OPEN },
      });
      if (existing) return;
      await EpidemiologyAlert.create({ ranchId, diseaseId, type, severity, title, message, metadata: metadata ?? null });
      created++;
    };

    try {
      // Snapshots por enfermedad del día más reciente de cada rancho
      const latestByRanch = await EpidemiologicalSnapshot.findAll({
        where: { diseaseId: { [Op.not]: null } },
        include: [{ model: Disease, as: 'disease', attributes: ['name', 'isZoonotic'] }],
        order: [['snapshotDate', 'DESC']],
        limit: 500,
      });

      // Quedarse con el snapshot más reciente por (ranch, disease)
      const seen = new Set<string>();
      for (const s of latestByRanch) {
        const key = `${s.ranchId}|${s.diseaseId}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const dName = (s as any).disease?.name ?? 'enfermedad';

        if (s.newCases7d >= 3) {
          await ensureAlert(s.ranchId, s.diseaseId, AlertType.OUTBREAK_EMERGING, AlertSeverity.HIGH,
            `Brote emergente: ${dName}`,
            `${s.newCases7d} casos nuevos de ${dName} en los últimos 7 días.`,
            { newCases7d: s.newCases7d, activeCases: s.activeCases });
        }

        if (s.activeCases > 0 && s.vaccinationCoverage != null && Number(s.vaccinationCoverage) < 50) {
          await ensureAlert(s.ranchId, s.diseaseId, AlertType.LOW_COVERAGE, AlertSeverity.MEDIUM,
            `Cobertura vacunal baja: ${dName}`,
            `Cobertura ${s.vaccinationCoverage}% con ${s.activeCases} casos activos de ${dName}.`,
            { vaccinationCoverage: s.vaccinationCoverage, activeCases: s.activeCases });
        }

        if (s.mortalityRate != null && Number(s.mortalityRate) > 30) {
          await ensureAlert(s.ranchId, s.diseaseId, AlertType.HIGH_LETHALITY, AlertSeverity.CRITICAL,
            `Letalidad anormal: ${dName}`,
            `Tasa de mortalidad ${s.mortalityRate}% en ${dName} (últimos 30 días).`,
            { mortalityRate: s.mortalityRate });
        }

        if ((s as any).disease?.isZoonotic && s.activeCases > 0) {
          await ensureAlert(s.ranchId, s.diseaseId, AlertType.ZOONOTIC_CASE, AlertSeverity.HIGH,
            `Caso zoonótico activo: ${dName}`,
            `Hay ${s.activeCases} caso(s) activo(s) de ${dName} (zoonótica) — riesgo para humanos.`,
            { activeCases: s.activeCases });
        }
      }

      if (created > 0) logger.info(`evaluateAlerts: ${created} alertas creadas`, this.context);
      return { created };
    } catch (error) {
      logger.error('Error evaluando alertas epidemiológicas', this.context, {}, ensureError(error));
      throw error;
    }
  }

  async listAlerts(filters: { ranchId?: string; status?: AlertStatus } = {}): Promise<EpidemiologyAlert[]> {
    const where: any = {};
    if (filters.ranchId) where.ranchId = filters.ranchId;
    if (filters.status) where.status = filters.status;
    return EpidemiologyAlert.findAll({
      where,
      include: [{ model: Disease, as: 'disease', attributes: ['id', 'name', 'slug'] }],
      order: [['created_at', 'DESC']],
      limit: 200,
    });
  }

  async updateAlertStatus(id: string, status: AlertStatus, userId?: string): Promise<EpidemiologyAlert> {
    const alert = await EpidemiologyAlert.findByPk(id);
    if (!alert) throw new Error(`Alerta no encontrada: ${id}`);
    const payload: any = { status };
    if (status === AlertStatus.ACKNOWLEDGED) { payload.acknowledgedBy = userId ?? null; payload.acknowledgedAt = new Date(); }
    if (status === AlertStatus.RESOLVED) { payload.resolvedAt = new Date(); }
    await alert.update(payload);
    return alert;
  }

  // --------------------------------------------------------------------------
  // getBovineRiskScore  (E-05)
  // --------------------------------------------------------------------------

  /**
   * Score de riesgo epidemiológico de un bovino (0–100) con factores ponderados.
   * Heurística documentada (a calibrar clínicamente):
   *   - Caso activo: severidad (LOW15/MOD30/HIGH50/CRIT70) + contagiosa10 + zoonótica10
   *   - healthStatus: SICK20 / QUARANTINE15 / RECOVERING10
   *   - Exposiciones recientes (contacto como destino): min(20, n×5)
   *   - Vacunación NO al día: +10
   * Nivel: <25 LOW, <50 MEDIUM, <75 HIGH, ≥75 CRITICAL.
   */
  async getBovineRiskScore(bovineId: string): Promise<{
    bovineId: string;
    riskScore: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    factors: Array<{ factor: string; points: number }>;
  }> {
    const SEVERITY_PTS: Record<string, number> = { LOW: 15, MODERATE: 30, HIGH: 50, CRITICAL: 70 };
    const factors: Array<{ factor: string; points: number }> = [];
    let score = 0;
    const add = (factor: string, points: number) => { if (points > 0) { factors.push({ factor, points }); score += points; } };

    const bovine = await Bovine.findByPk(bovineId, { attributes: ['id', 'healthStatus'] });
    if (!bovine) throw new Error(`Bovino no encontrado: ${bovineId}`);

    // Caso activo + enfermedad
    const activeCase = await BovineDiseaseCase.findOne({
      where: { bovineId, status: { [Op.in]: ACTIVE_STATUSES } },
      include: [{ model: Disease, as: 'disease', attributes: ['severity', 'isContagious', 'isZoonotic', 'name'] }],
      order: [['diagnosedAt', 'DESC']],
    });
    if (activeCase) {
      add(`Caso activo (severidad ${activeCase.severity})`, SEVERITY_PTS[activeCase.severity] ?? 20);
      const d = (activeCase as any).disease;
      if (d?.isContagious) add('Enfermedad contagiosa', 10);
      if (d?.isZoonotic) add('Enfermedad zoonótica', 10);
    }

    // healthStatus
    if (bovine.healthStatus === 'SICK') add('Estado SICK', 20);
    else if (bovine.healthStatus === 'QUARANTINE') add('Estado QUARANTINE', 15);
    else if (bovine.healthStatus === 'RECOVERING') add('Estado RECOVERING', 10);

    // Exposiciones recientes (como destino)
    const exposures = await CaseContact.count({ where: { targetBovineId: bovineId } });
    if (exposures > 0) add(`Exposiciones detectadas (${exposures})`, Math.min(20, exposures * 5));

    // Vacunación no al día
    const BVS = (await import('../models/BovineVaccinationStatus')).default;
    const vacc = await BVS.findByPk(bovineId, { attributes: ['status'] });
    if (!vacc || vacc.status === 'OVERDUE' || vacc.status === 'NONE') add('Vacunación no al día', 10);

    score = Math.min(100, score);
    const level = score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW';
    return { bovineId, riskScore: score, level, factors };
  }

  // --------------------------------------------------------------------------
  // getHeatmap  (E-06)
  // --------------------------------------------------------------------------

  /**
   * Heatmap epidemiológico: agrupa bovinos con caso activo en celdas de grid
   * (lat/lng redondeados) y asigna un score 0–100 ponderado por estado de salud.
   * Pesos: SICK 1.0, QUARANTINE 0.8, RECOVERING 0.5.
   */
  async getHeatmap(ranchId: string, diseaseId?: string, cellSizeDeg = 0.005): Promise<{
    ranchId: string;
    diseaseId: string | null;
    cellSizeDeg: number;
    cells: Array<{ lat: number; lng: number; count: number; score: number; level: string }>;
  }> {
    const STATUS_W: Record<string, number> = { SICK: 1.0, QUARANTINE: 0.8, RECOVERING: 0.5 };
    const BovineHealthSnapshot = (await import('../models/BovineHealthSnapshot')).default;

    const where: any = {
      ranchId,
      healthStatus: { [Op.in]: ['SICK', 'RECOVERING', 'QUARANTINE'] },
    };
    if (diseaseId) where.activeDiseaseId = diseaseId;

    const snapshots = await BovineHealthSnapshot.findAll({
      where,
      attributes: ['location', 'healthStatus'],
      raw: true,
    }) as any[];

    // Agrupar por celda
    const cells = new Map<string, { lat: number; lng: number; count: number; weighted: number }>();
    for (const s of snapshots) {
      const loc = s.location;
      if (!loc || loc.latitude == null || loc.longitude == null) continue;
      const lat = Math.round(loc.latitude / cellSizeDeg) * cellSizeDeg;
      const lng = Math.round(loc.longitude / cellSizeDeg) * cellSizeDeg;
      const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
      const cur = cells.get(key) ?? { lat, lng, count: 0, weighted: 0 };
      cur.count += 1;
      cur.weighted += STATUS_W[s.healthStatus] ?? 0.5;
      cells.set(key, cur);
    }

    // Normalizar score 0–100 respecto a la celda más caliente
    const maxWeighted = Math.max(1, ...Array.from(cells.values()).map((c) => c.weighted));
    const out = Array.from(cells.values()).map((c) => {
      const score = Math.round((c.weighted / maxWeighted) * 100);
      const level = score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW';
      return { lat: c.lat, lng: c.lng, count: c.count, score, level };
    }).sort((a, b) => b.score - a.score);

    return { ranchId, diseaseId: diseaseId ?? null, cellSizeDeg, cells: out };
  }

  // --------------------------------------------------------------------------
  // getCaseContacts  (Fase 5 — lectura)
  // --------------------------------------------------------------------------

  /**
   * Devuelve todos los contactos de contagio registrados para un caso,
   * tanto como fuente como como destino.
   */
  async getCaseContacts(caseId: string): Promise<{
    asSource: CaseContact[];
    asTarget: CaseContact[];
  }> {
    try {
      const [asSource, asTarget] = await Promise.all([
        CaseContact.findAll({
          where: { sourceCaseId: caseId },
          include: [
            {
              model: BovineDiseaseCase,
              as: 'targetCase',
              attributes: ['id', 'status', 'severity', 'diagnosedAt', 'bovineId'],
              include: [
                { model: Bovine, as: 'bovine', attributes: ['id', 'earTag', 'name'] },
              ],
            },
            // E-04: bovino expuesto sin caso (cuando targetCaseId es null)
            { model: Bovine, as: 'targetBovine', attributes: ['id', 'earTag', 'name'], required: false },
          ],
          order: [['contactDate', 'ASC']],
        }),
        CaseContact.findAll({
          where: { targetCaseId: caseId },
          include: [
            {
              model: BovineDiseaseCase,
              as: 'sourceCase',
              attributes: ['id', 'status', 'severity', 'diagnosedAt', 'bovineId'],
              include: [
                { model: Bovine, as: 'bovine', attributes: ['id', 'earTag', 'name'] },
              ],
            },
          ],
          order: [['contactDate', 'ASC']],
        }),
      ]);

      return { asSource, asTarget };
    } catch (error) {
      logger.error('Error en getCaseContacts', this.context, { caseId }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Utilidad: DATEONLY string
  // --------------------------------------------------------------------------

  private toDateOnly(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const epidemiologicalService = new EpidemiologicalService();
