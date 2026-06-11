// services/BovineFiltersService.ts
// ============================================================================
// BOVINE FILTERS SERVICE
// ============================================================================
// Provee catálogos para los dropdowns del frontend (vista de listado y
// formularios de creación/edición). Concentra los enums del modelo + las
// razas distintas obtenidas dinámicamente de la BD + enfermedades del
// catálogo formal (tabla diseases — Fase 1).
//
// Cache: in-memory con TTL 1h. Es seguro porque:
//   - El payload es pequeño (algunos cientos de bytes).
//   - Es idéntico para todos los usuarios (catálogo global).
//   - Si crece la flota a múltiples instancias, migrar a Redis (bloque 11).
//
// Invalidación: solo por TTL. Crear bovinos con razas nuevas se reflejará en
// el siguiente refresco. Si se necesita invalidación inmediata, exponer
// `bovineFiltersService.invalidate()` desde donde corresponda.
// ============================================================================

import { fn, col, Op } from 'sequelize';
import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';

import Bovine, {
  CattleType,
  GenderType,
  HealthStatus,
  VaccinationStatus,
} from '../models/Bovine';
import { VaccineType, ApplicationRoute } from '../models/Vaccination';
import { cacheService } from './CacheService';
import Disease from '../models/Disease';
import BovineDiseaseCase, { CaseStatus } from '../models/BovineDiseaseCase';
import { BOVINE_CONSTANTS } from '../constants/bovine.constants';
import {
  VACCINE_TYPE_LABELS,
  APPLICATION_ROUTE_LABELS,
  VACCINATION_STATUS_LABELS,
} from '../constants/vaccination.labels';

// ============================================================================
// TIPOS PÚBLICOS
// ============================================================================

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
}

/** Preset de grupo etario para el filtro ?ageGroup= (B-02 / B-05) */
export interface AgeGroupOption {
  value: 'calf' | 'young' | 'adult';
  label: string;
  minMonths: number;
  maxMonths?: number;   // ausente = sin tope superior
}

export interface BovineFilterOptions {
  cattleTypes: FilterOption<CattleType>[];
  genders: FilterOption<GenderType>[];
  healthStatuses: FilterOption<HealthStatus>[];
  vaccinationStatuses: FilterOption<VaccinationStatus>[];
  vaccineTypes: FilterOption<VaccineType>[];
  applicationRoutes: FilterOption<ApplicationRoute>[];
  ageGroups: AgeGroupOption[];    // presets de edad (meses) — fuente: BOVINE_CONSTANTS
  breeds: string[];               // dinámico desde BD
  diseases: FilterOption[];       // catálogo formal (diseases table) — value=slug, label=name
  computedAt: Date;
  ttlSeconds: number;
}

// ============================================================================
// LABELS (locales en español)
// ============================================================================

const CATTLE_TYPE_LABELS: Record<CattleType, string> = {
  CATTLE: 'Ganado',
  BULL: 'Toro',
  COW: 'Vaca',
  CALF: 'Becerro',
};

const GENDER_LABELS: Record<GenderType, string> = {
  MALE: 'Macho',
  FEMALE: 'Hembra',
  UNKNOWN: 'Desconocido',
};

const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
  HEALTHY: 'Saludable',
  SICK: 'Enfermo',
  RECOVERING: 'En recuperación',
  QUARANTINE: 'En cuarentena',
  DECEASED: 'Fallecido',
  UNKNOWN: 'Desconocido',
};

// Los labels de vacunación (VACCINE_TYPE_LABELS, APPLICATION_ROUTE_LABELS,
// VACCINATION_STATUS_LABELS) ahora viven en constants/vaccination.labels.ts
// (fuente única — V-06) y se importan arriba.

// ============================================================================
// CACHE
// ============================================================================
// TTL 1h. Usa CacheService unificado (Redis con fallback a memoria).
// ============================================================================

const CACHE_KEY = 'bovine:filters:options';
const CACHE_TTL_SECONDS = 60 * 60; // 1 hora

// ============================================================================
// SERVICIO
// ============================================================================

export class BovineFiltersService {
  private readonly context = 'BovineFiltersService';

  /**
   * Devuelve el catálogo completo. Usa cache si está vigente.
   */
  async getFilterOptions(): Promise<BovineFilterOptions> {
    // Cache hit
    const cached = await cacheService.get<BovineFilterOptions>(CACHE_KEY);
    if (cached) {
      return cached;
    }

    try {
      // Razas distintas desde BD + enfermedades del catálogo formal (paralelo)
      const [breedRows, diseaseRows] = (await Promise.all([
        Bovine.findAll({
          attributes: [[fn('DISTINCT', col('breed')), 'breed']],
          where: { isActive: true } as any,
          order: [['breed', 'ASC']],
          raw: true,
        }),
        Disease.findAll({
          attributes: ['slug', 'name'],
          where: { isActive: true } as any,
          order: [['name', 'ASC']],
          raw: true,
        }),
      ])) as [any[], any[]];

      const breeds = breedRows
        .map((r) => r.breed as string | null)
        .filter((b): b is string => !!b && b.trim().length > 0);

      // diseases: { value: slug, label: name } — consistente con el patrón FilterOption
      const diseases: FilterOption[] = diseaseRows
        .filter((r) => r.slug && r.name)
        .map((r) => ({ value: r.slug as string, label: r.name as string }));

      const data: BovineFilterOptions = {
        cattleTypes: this.toOptions(CattleType, CATTLE_TYPE_LABELS),
        genders: this.toOptions(GenderType, GENDER_LABELS),
        healthStatuses: this.toOptions(HealthStatus, HEALTH_STATUS_LABELS),
        vaccinationStatuses: this.toOptions(VaccinationStatus, VACCINATION_STATUS_LABELS),
        vaccineTypes: this.toOptions(VaccineType, VACCINE_TYPE_LABELS),
        applicationRoutes: this.toOptions(ApplicationRoute, APPLICATION_ROUTE_LABELS),
        ageGroups: this.buildAgeGroups(),
        breeds,
        diseases,
        computedAt: new Date(),
        ttlSeconds: CACHE_TTL_SECONDS,
      };

      await cacheService.set(CACHE_KEY, data, CACHE_TTL_SECONDS);

      logger.debug(
        `Catálogo de filtros recalculado (${breeds.length} razas, ${diseases.length} enfermedades del catálogo)`,
        this.context
      );

      return data;
    } catch (error) {
      logger.error(
        'Error obteniendo catálogo de filtros de bovinos',
        this.context,
        {},
        ensureError(error)
      );
      throw error;
    }
  }

  /**
   * Invalida el cache. Llamar cuando se sepa que una raza nueva se agregó
   * y se quiera ver de inmediato (opcional — el TTL hará el refresco solo).
   */
  async invalidate(): Promise<void> {
    await cacheService.del(CACHE_KEY);
  }

  // --------------------------------------------------------------------------
  // getActiveDiseases
  // --------------------------------------------------------------------------

  /**
   * Devuelve solo las enfermedades que tienen al menos un caso clínico ACTIVO
   * en los ranchos accesibles del usuario.
   *
   * Resultado: [{ value: uuid, label: name, slug }]
   *   → value es el UUID de Disease (no el slug) para usarlo como filtro ?diseaseId=
   *
   * Cache TTL 5 min por combinación de ranchos (clave basada en hash del array).
   * null = SUPER_ADMIN/OWNER → sin restricción de ranchos.
   */
  async getActiveDiseases(ranchIds?: string[] | null): Promise<FilterOption[]> {
    // Sin acceso a ningún rancho
    if (Array.isArray(ranchIds) && ranchIds.length === 0) return [];

    // Clave de caché: "bovine:active-diseases:all" o "bovine:active-diseases:<sorted-ids-hash>"
    const cacheKey = ranchIds === null || ranchIds === undefined
      ? 'bovine:active-diseases:all'
      : `bovine:active-diseases:${[...ranchIds].sort().join(',')}`;

    const cached = await cacheService.get<FilterOption[]>(cacheKey);
    if (cached) return cached;

    try {
      const ACTIVE: CaseStatus[] = [
        CaseStatus.SUSPECTED,
        CaseStatus.CONFIRMED,
        CaseStatus.RECOVERING,
      ];

      const whereCase: any = { status: { [Op.in]: ACTIVE } };
      if (Array.isArray(ranchIds)) whereCase.ranchId = { [Op.in]: ranchIds };

      // IDs únicos de enfermedades con casos activos
      const caseRows = await BovineDiseaseCase.findAll({
        attributes: [[fn('DISTINCT', col('disease_id')), 'diseaseId']],
        where: whereCase,
        raw: true,
      }) as any[];

      const diseaseIds: string[] = caseRows.map((r: any) => r.diseaseId).filter(Boolean);

      if (diseaseIds.length === 0) return [];

      const diseases = await Disease.findAll({
        attributes: ['id', 'name', 'slug'],
        where: { id: { [Op.in]: diseaseIds } },
        order: [['name', 'ASC']],
        raw: true,
      }) as any[];

      const result: FilterOption[] = diseases.map((d: any) => ({
        value: d.id   as string,
        label: d.name as string,
      }));

      // Cache 5 min — los casos activos cambian con más frecuencia que el catálogo
      await cacheService.set(cacheKey, result, 5 * 60);

      logger.debug(
        `getActiveDiseases: ${result.length} enfermedades activas`,
        this.context,
        { ranchIds: ranchIds?.length ?? 'all' }
      );

      return result;
    } catch (error) {
      logger.error('Error obteniendo enfermedades activas', this.context, {}, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Presets de grupo etario derivados de BOVINE_CONSTANTS.AGE_GROUP_RANGES.
   * Mantiene al frontend alineado con los umbrales del backend (B-02/B-04/B-05).
   */
  private buildAgeGroups(): AgeGroupOption[] {
    const r = BOVINE_CONSTANTS.AGE_GROUP_RANGES;
    return [
      { value: 'calf',  label: 'Becerro / Becerra (0–12 meses)',   minMonths: r.calf.min,  maxMonths: r.calf.max },
      { value: 'young', label: 'Novillo / Vaquilla (12–24 meses)', minMonths: r.young.min, maxMonths: r.young.max },
      { value: 'adult', label: 'Toro / Vaca (≥ 24 meses)',         minMonths: r.adult.min },
    ];
  }

  private toOptions<T extends string>(
    enumObj: Record<string, T>,
    labels: Record<T, string>
  ): FilterOption<T>[] {
    return (Object.values(enumObj) as T[]).map((value) => ({
      value,
      label: labels[value] ?? value,
    }));
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const bovineFiltersService = new BovineFiltersService();
