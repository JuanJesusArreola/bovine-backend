// services/BovineFullService.ts
// ============================================================================
// BOVINE FULL SERVICE
// ============================================================================
// Endpoint compuesto: agrega en una sola llamada todo lo que el frontend
// necesita para la pantalla de detalle del bovino. Reemplaza 6+ round-trips
// por uno solo.
//
// Composición (todo en paralelo con Promise.all):
//   1. Bovino + ranch + healthSnapshot (eager-load)
//   2. Media agrupada
//   3. Current-location consolidado (stay activa + último GPS)
//   4. Vaccination status (cache denormalizado)
//   5. Últimas 5 vacunas
//   6. Últimos 10 registros de salud
//   7. Últimos 20 movimientos (BovineLocationHistory)
//
// Cache: in-memory por bovineId, TTL 5min. Invalidación explícita desde:
//   - BovineService.update / delete
//   - VaccinationService.create / delete
//   - BovineMediaService.upload / delete
//   - registerEntry / registerExit (BovineLocationService)
//
// Nota: cuando se migre a Redis (bloque 11), reemplazar el Map.
// ============================================================================

import { Op } from 'sequelize';
import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';
import { BovineNotFoundError, BovineError } from '../utils/BovineErrors';

import Bovine from '../models/Bovine';
import Ranch from '../models/Ranch';
import BovineHealthSnapshot from '../models/BovineHealthSnapshot';
import BovineLocationHistory from '../models/BovineLocationHistory';
import Health from '../models/Health';
import Vaccination from '../models/Vaccination';
import BovineVaccinationStatus from '../models/BovineVaccinationStatus';
import BovineDiseaseCase, { CaseStatus } from '../models/BovineDiseaseCase';
import Disease from '../models/Disease';
import CaseSymptom from '../models/CaseSymptom';
import Symptom from '../models/Symptom';
import CaseTreatment from '../models/CaseTreatment';
import LabTest from '../models/LabTest';

import { bovineMediaService, MediaListResult } from './BovineMediaService';
import {
  bovineLocationService,
  ConsolidatedCurrentLocation,
} from './BovineLocationService';
import {
  bovineVaccinationStatusService,
  VaccinationStatusSnapshot,
} from './BovineVaccinationStatusService';
import BovineDeath from '../models/BovineDeath';
import { vaccinationService, VaccinationListItem } from './VaccinationService';
import { bovineService } from './BovineService';
import { BovineResponse } from '../dtos/bovine-response.dto';
import { deathCauseLabel } from '../constants/death.labels';
import { cacheService } from './CacheService';

// ============================================================================
// TIPOS PÚBLICOS
// ============================================================================

export interface BovineRecentHealthRecord {
  id: string;
  recordType: string;
  recordDate: Date;
  veterinarianName?: string | null;
  chiefComplaint?: string | null;
  diagnosisSummary?: string | null;
}

export interface BovineRecentMovement {
  historyId: string;
  bovineId: string;
  locationId: string;
  enteredAt: Date;
  exitedAt: Date | null;
  reason: string | null;
  movementType: string | null;
  recordedBy: string | null;
  notes: string | null;
}

export interface BovineFullResponse {
  bovine: any;                 // shape de Bovine + ranch + healthSnapshot eager-loaded (crudo)
  /**
   * D-01: vista formateada del bovino, IDÉNTICA a la que devuelve GET /api/bovines/:id.
   * Incluye labels (cattleTypeLabel, genderLabel, healthStatusLabel...),
   * clasificación etaria (classification/classificationLabel), isAdult, ageDisplay, etc.
   * El frontend debe leer de aquí para mostrar etiquetas/clasificación de forma
   * consistente entre el listado, el detalle simple y el detalle completo.
   */
  profile: BovineResponse;
  media: MediaListResult;
  currentLocation: ConsolidatedCurrentLocation;
  vaccinationStatus: VaccinationStatusSnapshot;
  recentVaccinations: VaccinationListItem[];     // últimas 5
  recentHealthRecords: BovineRecentHealthRecord[]; // últimos 10
  recentMovements: BovineRecentMovement[];         // últimos 20
  /** Caso clínico activo (abierto). null si no hay ninguno. */
  activeCase: BovineDiseaseCase | null;
  /** Módulo 8 (F-28): registro de muerte si el bovino falleció. null si vivo. */
  death: {
    deathDate: Date;
    cause: string;
    causeLabel: string | null;
    diseaseId: string | null;
    diseaseCaseId: string | null;
    locationId: string | null;
    weightAtDeath: number | null;
    slaughterValue: number | null;
    necropsyPerformed: boolean;
    necropsyResults: string | null;
    notes: string | null;
  } | null;
  computedAt: Date;
  ttlSeconds: number;
}

// ============================================================================
// CACHE
// ============================================================================
// TTL 5min. Usa CacheService unificado (Redis con fallback a memoria).
// Key: `bovine:full:{bovineId}`. Invalidación cruzada desde:
//   - BovineService.update / delete
//   - VaccinationService.create / delete
//   - BovineMediaService.upload / delete
//   - BovineLocationService.recordEntry / recordExit
// ============================================================================

const CACHE_PREFIX = 'bovine:full:';
const CACHE_TTL_SECONDS = 5 * 60;

const cacheKey = (bovineId: string) => `${CACHE_PREFIX}${bovineId}`;

// ============================================================================
// SERVICIO
// ============================================================================

export class BovineFullService {
  private readonly context = 'BovineFullService';

  /**
   * Devuelve el detalle COMPLETO del bovino. Cachea por 5 minutos.
   */
  async getFullDetail(bovineId: string): Promise<BovineFullResponse> {
    // Cache hit
    const cached = await cacheService.get<BovineFullResponse>(cacheKey(bovineId));
    if (cached) {
      return cached;
    }

    try {
      // ────────────────────────────────────────────────────────────────
      // PASO 1: Bovino base + ranch + healthSnapshot (UNA query con includes)
      // ────────────────────────────────────────────────────────────────
      const bovine = await Bovine.findByPk(bovineId, {
        include: [
          {
            model: Ranch,
            as: 'ranch',
            attributes: ['id', 'name', 'ranchCode'],
          },
          {
            model: BovineHealthSnapshot,
            as: 'healthSnapshot',
            required: false,
          },
          // G-05/D-01: madre y padre como mini-objetos → profile.mother / profile.father
          {
            model: Bovine,
            as: 'mother',
            attributes: ['id', 'earTag', 'name', 'gender', 'breed'],
            required: false,
          },
          {
            model: Bovine,
            as: 'father',
            attributes: ['id', 'earTag', 'name', 'gender', 'breed'],
            required: false,
          },
          // Módulo 8 (F-28): registro de muerte si el bovino falleció
          {
            model: BovineDeath,
            as: 'death',
            required: false,
          },
        ],
      });

      if (!bovine) {
        throw new BovineNotFoundError(bovineId);
      }

      // ────────────────────────────────────────────────────────────────
      // PASO 2: Datasets paralelizables
      // ────────────────────────────────────────────────────────────────
      const [
        media,
        currentLocation,
        vaccinationStatus,
        vaccinationsResult,
        recentHealth,
        recentMovementsRaw,
        activeCase,
      ] = await Promise.all([
        bovineMediaService.listMedia(bovineId),
        bovineLocationService.getCurrentLocationConsolidated(bovineId),
        bovineVaccinationStatusService.get(bovineId),
        vaccinationService.listByBovine({ bovineId, limit: 5, offset: 0 }),
        Health.findAll({
          where: { bovineId },
          attributes: [
            'id',
            'recordType',
            'recordDate',
            'veterinarianName',
            'chiefComplaint',
            'diagnosis',
          ],
          order: [['recordDate', 'DESC']],
          limit: 10,
        }),
        BovineLocationHistory.findAll({
          where: { bovineId },
          attributes: [
            'id',
            'bovineId',
            'locationId',
            'enteredAt',
            'exitedAt',
            'reason',
            'movementType',
            'recordedBy',
            'notes',
          ],
          order: [['enteredAt', 'DESC']],
          limit: 20,
        }),
        // Caso clínico activo: el más reciente cuyo status no sea terminal
        BovineDiseaseCase.findOne({
          where: {
            bovineId,
            status: {
              [Op.notIn]: [CaseStatus.RECOVERED, CaseStatus.DECEASED, CaseStatus.DISCARDED],
            },
          },
          include: [
            { model: Disease,  as: 'disease',  attributes: ['id', 'name', 'slug', 'category', 'severity'] },
            {
              model: CaseSymptom,
              as: 'caseSymptoms',
              include: [{ model: Symptom, as: 'symptom', attributes: ['id', 'name', 'slug', 'category', 'severityWeight'] }],
            },
            { model: CaseTreatment, as: 'treatments' },
            { model: LabTest,       as: 'labTests' },
          ],
          order: [['diagnosedAt', 'DESC']],
        }),
      ]);

      // ────────────────────────────────────────────────────────────────
      // PASO 3: Mapear datasets a DTOs
      // ────────────────────────────────────────────────────────────────
      const recentHealthRecords: BovineRecentHealthRecord[] = (recentHealth as any[]).map((h) => ({
        id: h.id,
        recordType: h.recordType,
        recordDate: h.recordDate,
        veterinarianName: h.veterinarianName ?? null,
        chiefComplaint: h.chiefComplaint ?? null,
        diagnosisSummary:
          (h.diagnosis && typeof h.diagnosis === 'object'
            ? (h.diagnosis as any).primary || (h.diagnosis as any).summary
            : null) ?? null,
      }));

      const recentMovements: BovineRecentMovement[] = recentMovementsRaw.map((m: any) => ({
        historyId: m.id,
        bovineId: m.bovineId,
        locationId: m.locationId,
        enteredAt: m.enteredAt,
        exitedAt: m.exitedAt ?? null,
        reason: m.reason ?? null,
        movementType: m.movementType ?? null,
        recordedBy: m.recordedBy ?? null,
        notes: m.notes ?? null,
      }));

      // D-01: vista formateada (labels + clasificación), misma que GET /:id.
      // El bovine ya trae `ranch` eager-loaded, así que el formatter lo incluye.
      const profile = bovineService.formatBovineResponse(bovine);

      // F-28: bloque de muerte (si el bovino falleció) con label de causa
      const deathRow = (bovine as any).death as BovineDeath | null | undefined;
      const death = deathRow
        ? {
            deathDate:         deathRow.deathDate,
            cause:             deathRow.cause,
            causeLabel:        deathCauseLabel(deathRow.cause),
            diseaseId:         deathRow.diseaseId ?? null,
            diseaseCaseId:     deathRow.diseaseCaseId ?? null,
            locationId:        deathRow.locationId ?? null,
            weightAtDeath:     deathRow.weightAtDeath ?? null,
            slaughterValue:    deathRow.slaughterValue ?? null,
            necropsyPerformed: deathRow.necropsyPerformed,
            necropsyResults:   deathRow.necropsyResults ?? null,
            notes:             deathRow.notes ?? null,
          }
        : null;

      const data: BovineFullResponse = {
        bovine,
        profile,
        death,
        media,
        currentLocation,
        vaccinationStatus,
        recentVaccinations: vaccinationsResult.items,
        recentHealthRecords,
        recentMovements,
        activeCase: activeCase ?? null,
        computedAt: new Date(),
        ttlSeconds: CACHE_TTL_SECONDS,
      };

      // Cachear
      await cacheService.set(cacheKey(bovineId), data, CACHE_TTL_SECONDS);

      return data;
    } catch (error) {
      // Si el bovino no existe, propagar tal cual
      if (error instanceof BovineError) throw error;

      logger.error(
        `Error obteniendo detalle completo del bovino ${bovineId}`,
        this.context,
        { bovineId },
        ensureError(error)
      );
      throw error;
    }
  }

  /**
   * Invalida el cache del bovino. Llamar desde cualquier flujo que mute datos
   * relacionados (bovino, vacunas, media, movimientos, salud).
   *
   * Es fire-and-forget desde el caller (no se await). Si Redis tarda, no
   * bloquea la response de la mutación. La inconsistencia es de milisegundos.
   */
  invalidate(bovineId: string): void {
    cacheService.del(cacheKey(bovineId)).catch(() => { /* swallow */ });
  }

  /**
   * Invalida TODO el cache de detalle. Útil tras cambios masivos.
   */
  async invalidateAll(): Promise<void> {
    await cacheService.delByPrefix(CACHE_PREFIX);
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const bovineFullService = new BovineFullService();
