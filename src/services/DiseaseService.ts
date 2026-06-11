// services/DiseaseService.ts
// ============================================================================
// DISEASE SERVICE
// ============================================================================
// Provee acceso al catálogo canónico de enfermedades bovinas.
//
// Métodos públicos:
//   getAllDiseases()           — listado completo con filtros opcionales
//   searchDiseases(q)         — búsqueda full-text en nombre + aliases
//   getDiseaseById(id)         — detalle por UUID
//   getDiseaseBySlug(slug)     — detalle por slug URL-friendly
//   getDiseasesWithSymptoms()  — listado con síntomas incluidos (catálogo completo)
//
// Cache: TTL 1h (mismo patrón que BovineFiltersService). El catálogo es
// global e inmutable durante el ciclo normal de la app. Invalidar con
// diseaseService.invalidateCache() tras correr seeders en producción.
// ============================================================================

import { Op, WhereOptions } from 'sequelize';
import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';
import { cacheService } from './CacheService';

import Disease, {
  DiseaseAttributes,
  DiseaseCategory,
  DiseaseSeverity,
} from '../models/Disease';
import DiseaseAlias from '../models/DiseaseAlias';
import Symptom from '../models/Symptom';
import DiseaseSymptom, { SymptomRelevance } from '../models/DiseaseSymptom';
import TransmissionMethod from '../models/TransmissionMethod';
import DiseaseMedia, { DiseaseMediaType } from '../models/DiseaseMedia';

// ============================================================================
// TIPOS PÚBLICOS
// ============================================================================

export interface DiseaseFilters {
  category?: DiseaseCategory;
  severity?: DiseaseSeverity;
  isContagious?: boolean;
  isZoonotic?: boolean;
  isActive?: boolean;
  search?: string;   // filtra por nombre (ILIKE)
  page?: number;     // paginación — default 1
  limit?: number;    // paginación — default 50
}

export interface DiseaseListResponse {
  data:       DiseaseSummary[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface SymptomSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
  severityWeight: number;
  relevance: SymptomRelevance;
  isCommon: boolean;
}

export interface TransmissionMethodSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  notes: string | null;  // notas específicas de esta vía para esta enfermedad (de la pivote)
}

export interface DiseaseSummary {
  id: string;
  name: string;
  slug: string;
  category: DiseaseCategory;
  severity: DiseaseSeverity;
  isContagious: boolean;
  isZoonotic: boolean;
  defaultQuarantineDays: number | null;
  affectedSystems: string[] | null;
  isActive: boolean;
}

export interface MediaSummary {
  id:           string;
  symptomId:    string | null;
  symptomName:  string | null;
  url:          string;
  thumbnailUrl: string | null;
  title:        string | null;
  description:  string | null;
  mediaType:    DiseaseMediaType;
  displayOrder: number;
  isReference:  boolean;
  source:       string | null;
}

export interface DiseaseDetail extends DiseaseSummary {
  normalizedName: string;
  description: string | null;
  incubationDaysMin: number | null;
  incubationDaysMax: number | null;
  recommendedAction: string | null;
  metadata: Record<string, any> | null;
  aliases: string[];
  symptoms: SymptomSummary[];
  transmissionMethods: TransmissionMethodSummary[];
  media: MediaSummary[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DiseaseSearchResult {
  id: string;
  name: string;
  slug: string;
  category: DiseaseCategory;
  severity: DiseaseSeverity;
  matchedAlias: string | null;
}

// ============================================================================
// CACHE KEYS
// ============================================================================

const CACHE_KEY_ALL      = 'disease:catalog:all';
const CACHE_KEY_WITH_SYM = 'disease:catalog:with-symptoms-v2'; // v2: incluye transmissionMethods
const CACHE_TTL          = 60 * 60; // 1h

// ============================================================================
// SERVICIO
// ============================================================================

export class DiseaseService {
  private readonly context = 'DiseaseService';

  // --------------------------------------------------------------------------
  // getAllDiseases
  // --------------------------------------------------------------------------

  /**
   * Devuelve el listado completo (o filtrado) de enfermedades activas.
   * Resultado cacheado 1h cuando no se aplican filtros.
   */
  async getAllDiseases(filters: DiseaseFilters = {}): Promise<DiseaseListResponse> {
    const page  = Math.max(1, filters.page  ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
    const offset = (page - 1) * limit;

    const hasFilters = !!(
      filters.category    ||
      filters.severity    ||
      filters.isContagious !== undefined ||
      filters.isZoonotic  !== undefined  ||
      filters.search
    );

    // Cache solo para la consulta sin filtros y primera página
    if (!hasFilters && page === 1 && limit === 50) {
      const cached = await cacheService.get<DiseaseListResponse>(CACHE_KEY_ALL);
      if (cached) return cached;
    }

    try {
      const where: WhereOptions<DiseaseAttributes> = {
        isActive: filters.isActive ?? true,
      } as any;

      if (filters.category)                    (where as any).category    = filters.category;
      if (filters.severity)                    (where as any).severity    = filters.severity;
      if (filters.isContagious !== undefined)  (where as any).isContagious = filters.isContagious;
      if (filters.isZoonotic   !== undefined)  (where as any).isZoonotic   = filters.isZoonotic;

      if (filters.search) {
        const q = filters.search.trim();
        const normalized = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        (where as any)[Op.or] = [
          { name:           { [Op.iLike]: `%${q}%` } },
          { normalizedName: { [Op.iLike]: `%${normalized}%` } },
          { slug:           { [Op.iLike]: `%${normalized}%` } },
        ];
      }

      const { rows, count } = await Disease.findAndCountAll({
        where,
        attributes: [
          'id', 'name', 'slug', 'category', 'severity',
          'isContagious', 'isZoonotic', 'defaultQuarantineDays',
          'affectedSystems', 'isActive',
        ],
        order: [['name', 'ASC']],
        limit,
        offset,
        distinct: true,
      });

      const result: DiseaseListResponse = {
        data:       rows as unknown as DiseaseSummary[],
        total:      count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      };

      if (!hasFilters && page === 1 && limit === 50) {
        await cacheService.set(CACHE_KEY_ALL, result, CACHE_TTL);
      }

      return result;
    } catch (error) {
      logger.error('Error obteniendo catálogo de enfermedades', this.context, {}, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // searchDiseases
  // --------------------------------------------------------------------------

  /**
   * Busca enfermedades por nombre canónico o alias.
   * Prioriza coincidencias en nombre antes que en alias.
   */
  async searchDiseases(query: string): Promise<DiseaseSearchResult[]> {
    if (!query || query.trim().length < 2) return [];

    try {
      const q = query.trim();
      const normalizedQ = q
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');

      // 1. Buscar en nombre canónico
      const byName = await Disease.findAll({
        where: {
          isActive: true,
          [Op.or]: [
            { name:           { [Op.iLike]: `%${q}%` } },
            { normalizedName: { [Op.iLike]: `%${normalizedQ}%` } },
          ],
        } as any,
        attributes: ['id', 'name', 'slug', 'category', 'severity'],
        order: [['name', 'ASC']],
        raw: true,
      });

      // 2. Buscar en aliases (excluir IDs ya encontrados)
      const foundIds = new Set((byName as any[]).map((d) => d.id));

      const byAlias = await DiseaseAlias.findAll({
        where: {
          normalizedAlias: { [Op.iLike]: `%${normalizedQ}%` },
        } as any,
        include: [
          {
            model: Disease,
            as: 'disease',
            where: { isActive: true } as any,
            attributes: ['id', 'name', 'slug', 'category', 'severity'],
            required: true,
          },
        ],
        raw: false,
      });

      // 3. Combinar resultados
      const results: DiseaseSearchResult[] = (byName as any[]).map((d) => ({
        id:           d.id,
        name:         d.name,
        slug:         d.slug,
        category:     d.category,
        severity:     d.severity,
        matchedAlias: null,
      }));

      for (const aliasRow of byAlias as any[]) {
        const disease = aliasRow.disease;
        if (!disease || foundIds.has(disease.id)) continue;
        foundIds.add(disease.id);
        results.push({
          id:           disease.id,
          name:         disease.name,
          slug:         disease.slug,
          category:     disease.category,
          severity:     disease.severity,
          matchedAlias: aliasRow.alias,
        });
      }

      return results;
    } catch (error) {
      logger.error('Error en búsqueda de enfermedades', this.context, { query }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // getDiseaseById
  // --------------------------------------------------------------------------

  /**
   * Devuelve el detalle completo de una enfermedad por UUID,
   * incluyendo aliases y síntomas asociados.
   */
  async getDiseaseById(id: string): Promise<DiseaseDetail | null> {
    try {
      return await this.fetchDiseaseDetail({ id } as any);
    } catch (error) {
      logger.error('Error obteniendo enfermedad por id', this.context, { id }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // getDiseaseBySlug
  // --------------------------------------------------------------------------

  /**
   * Devuelve el detalle completo de una enfermedad por slug URL-friendly.
   */
  async getDiseaseBySlug(slug: string): Promise<DiseaseDetail | null> {
    try {
      return await this.fetchDiseaseDetail({ slug } as any);
    } catch (error) {
      logger.error('Error obteniendo enfermedad por slug', this.context, { slug }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // getDiseasesWithSymptoms
  // --------------------------------------------------------------------------

  /**
   * Devuelve el catálogo completo con los síntomas de cada enfermedad.
   * Resultado cacheado 1h (usado por el frontend para el formulario de casos).
   */
  async getDiseasesWithSymptoms(): Promise<DiseaseDetail[]> {
    const cached = await cacheService.get<DiseaseDetail[]>(CACHE_KEY_WITH_SYM);
    if (cached) return cached;

    try {
      const diseases = await Disease.findAll({
        where: { isActive: true } as any,
        include: [
          {
            model: DiseaseAlias,
            as: 'aliases',
            attributes: ['alias'],
          },
          {
            model: DiseaseSymptom,
            as: 'diseaseSymptoms',
            attributes: ['relevance', 'isCommon'],
            include: [
              {
                model: Symptom,
                as: 'symptom',
                attributes: ['id', 'name', 'slug', 'category', 'severityWeight'],
              },
            ],
          },
          {
            model: TransmissionMethod,
            as: 'transmissionMethods',
            attributes: ['id', 'name', 'slug', 'description'],
            through: { attributes: ['notes'] },
          },
          {
            model: DiseaseMedia,
            as: 'media',
            attributes: [
              'id', 'symptomId', 'url', 'thumbnailUrl', 'title',
              'description', 'mediaType', 'displayOrder', 'isReference', 'source',
            ],
            include: [
              {
                model: Symptom,
                as: 'symptom',
                attributes: ['id', 'name'],
                required: false,
              },
            ],
            required: false,
          },
        ],
        order: [['name', 'ASC']],
      });

      const data: DiseaseDetail[] = diseases.map((d) => this.toDetail(d));

      await cacheService.set(CACHE_KEY_WITH_SYM, data, CACHE_TTL);
      return data;
    } catch (error) {
      logger.error('Error obteniendo enfermedades con síntomas', this.context, {}, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // invalidateCache
  // --------------------------------------------------------------------------

  /** Invalida todas las entradas de cache del catálogo. */
  async invalidateCache(): Promise<void> {
    await Promise.all([
      cacheService.del(CACHE_KEY_ALL),
      cacheService.del(CACHE_KEY_WITH_SYM),
    ]);
    logger.debug('Cache de enfermedades invalidado', this.context);
  }

  // ==========================================================================
  // HELPERS PRIVADOS
  // ==========================================================================

  private async fetchDiseaseDetail(
    where: WhereOptions<DiseaseAttributes>
  ): Promise<DiseaseDetail | null> {
    const disease = await Disease.findOne({
      where,
      include: [
        {
          model: DiseaseAlias,
          as: 'aliases',
          attributes: ['alias'],
        },
        {
          model: DiseaseSymptom,
          as: 'diseaseSymptoms',
          attributes: ['relevance', 'isCommon'],
          include: [
            {
              model: Symptom,
              as: 'symptom',
              attributes: ['id', 'name', 'slug', 'category', 'severityWeight'],
            },
          ],
        },
        {
          model: TransmissionMethod,
          as: 'transmissionMethods',
          attributes: ['id', 'name', 'slug', 'description'],
          through: { attributes: ['notes'] },
        },
        {
          model: DiseaseMedia,
          as: 'media',
          attributes: [
            'id', 'symptomId', 'url', 'thumbnailUrl', 'title',
            'description', 'mediaType', 'displayOrder', 'isReference', 'source',
          ],
          include: [
            {
              model: Symptom,
              as: 'symptom',
              attributes: ['id', 'name'],
              required: false,
            },
          ],
          required: false,
          order: [['displayOrder', 'ASC'], ['created_at', 'ASC']] as any,
        },
      ],
    });

    if (!disease) return null;
    return this.toDetail(disease);
  }

  private toDetail(disease: any): DiseaseDetail {
    const aliases: string[] = (disease.aliases ?? []).map((a: any) => a.alias);

    const symptoms: SymptomSummary[] = (disease.diseaseSymptoms ?? [])
      .filter((ds: any) => ds.symptom)
      .map((ds: any) => ({
        id:             ds.symptom.id,
        name:           ds.symptom.name,
        slug:           ds.symptom.slug,
        category:       ds.symptom.category,
        severityWeight: parseFloat(ds.symptom.severityWeight),
        relevance:      ds.relevance,
        isCommon:       ds.isCommon,
      }))
      .sort((a: SymptomSummary, b: SymptomSummary) => {
        const order: Record<string, number> = {
          [SymptomRelevance.PATHOGNOMONIC]: 0,
          [SymptomRelevance.COMMON]:        1,
          [SymptomRelevance.OCCASIONAL]:    2,
          [SymptomRelevance.RARE]:          3,
        };
        return (order[a.relevance] ?? 9) - (order[b.relevance] ?? 9);
      });

    // transmissionMethods viene del M:N — cada elemento tiene la fila pivote en `.DiseaseTransmission`
    const transmissionMethods: TransmissionMethodSummary[] = (disease.transmissionMethods ?? [])
      .map((tm: any) => ({
        id:          tm.id,
        name:        tm.name,
        slug:        tm.slug,
        description: tm.description ?? null,
        notes:       tm.DiseaseTransmission?.notes ?? null,
      }))
      .sort((a: TransmissionMethodSummary, b: TransmissionMethodSummary) =>
        a.name.localeCompare(b.name)
      );

    const media: MediaSummary[] = (disease.media ?? []).map((m: any) => ({
      id:           m.id,
      symptomId:    m.symptomId   ?? null,
      symptomName:  m.symptom?.name ?? null,
      url:          m.url,
      thumbnailUrl: m.thumbnailUrl ?? null,
      title:        m.title        ?? null,
      description:  m.description  ?? null,
      mediaType:    m.mediaType,
      displayOrder: m.displayOrder,
      isReference:  m.isReference,
      source:       m.source       ?? null,
    }));

    return {
      id:                   disease.id,
      name:                 disease.name,
      normalizedName:       disease.normalizedName,
      slug:                 disease.slug,
      description:          disease.description ?? null,
      category:             disease.category,
      severity:             disease.severity,
      isContagious:         disease.isContagious,
      isZoonotic:           disease.isZoonotic,
      defaultQuarantineDays:disease.defaultQuarantineDays ?? null,
      incubationDaysMin:    disease.incubationDaysMin ?? null,
      incubationDaysMax:    disease.incubationDaysMax ?? null,
      recommendedAction:    disease.recommendedAction ?? null,
      affectedSystems:      disease.affectedSystems ?? null,
      isActive:             disease.isActive,
      metadata:             disease.metadata ?? null,
      aliases,
      symptoms,
      transmissionMethods,
      media,
      createdAt:            disease.createdAt,
      updatedAt:            disease.updatedAt,
    };
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const diseaseService = new DiseaseService();
