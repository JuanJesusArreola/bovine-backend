// services/location/LocationInfoService.ts
import logger from '../../utils/logger';
import { LocationNotFoundError, LocationError } from '../../utils/LocationErrors';
import { ensureError } from '../../utils/errorUtils';

import Location from '../../models/Location';
import LocationInfo, { CurrentCondition } from '../../models/LocationInfo';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export type MediaKind = 'images' | 'documents' | 'videos' | 'maps';

export interface CreateOrUpdateInfoInput {
  locationId: string;
  description?: string;
  currentCondition?: CurrentCondition;
  currentNotes?: string;
  notes?: string;
  tags?: string[];
  images?: string[];
  documents?: string[];
  videos?: string[];
  maps?: string[];
  nextInspectionDate?: Date | string;
  updatedBy: string;
}

export interface RecordInspectionInput {
  locationId: string;
  inspectionNotes?: string;
  nextInspectionDate?: Date | string;
  currentCondition?: CurrentCondition;
  currentNotes?: string;
  inspectedBy: string;
}

export interface RecordReviewInput {
  locationId: string;
  reviewedBy: string;
}

export interface AddMediaInput {
  locationId: string;
  kind: MediaKind;
  url: string;
  updatedBy: string;
}

export interface RemoveMediaInput {
  locationId: string;
  kind: MediaKind;
  url: string;
  updatedBy: string;
}

// ============================================================================
// SERVICIO
// ============================================================================

export class LocationInfoService {
  private readonly context = 'LocationInfoService';

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async assertLocationExists(locationId: string): Promise<void> {
    const loc = await Location.findByPk(locationId);
    if (!loc) throw new LocationNotFoundError(locationId);
  }

  private validateUrl(url: string): void {
    if (!url || typeof url !== 'string' || !/^https?:\/\/.+/.test(url)) {
      throw new LocationError(`URL inválida: ${url}`, 'INVALID_URL', 400);
    }
  }

  // ==========================================================================
  // CRUD
  // ==========================================================================

  /**
   * Obtiene la información de una ubicación.
   * Retorna null si no existe (no lanza error).
   */
  async getByLocationId(locationId: string): Promise<LocationInfo | null> {
    try {
      return await LocationInfo.findByPk(locationId);
    } catch (error) {
      logger.error('Error en getByLocationId', this.context, { locationId }, ensureError(error));
      throw new LocationError('Error al obtener información de ubicación', 'INFO_FETCH_ERROR', 500, ensureError(error));
    }
  }

  /**
   * Crea el registro de LocationInfo. Si ya existe, lanza error.
   */
  async create(input: CreateOrUpdateInfoInput): Promise<LocationInfo> {
    try {
      await this.assertLocationExists(input.locationId);

      const existing = await LocationInfo.findByPk(input.locationId);
      if (existing) {
        throw new LocationError(
          'Ya existe información para esta ubicación. Use update.',
          'INFO_ALREADY_EXISTS',
          409
        );
      }

      const info = await LocationInfo.create({
        locationId: input.locationId,
        description: input.description,
        currentCondition: input.currentCondition ?? CurrentCondition.GOOD,
        currentNotes: input.currentNotes,
        notes: input.notes ?? '',
        tags: input.tags ?? [],
        images: input.images ?? [],
        documents: input.documents ?? [],
        videos: input.videos ?? [],
        maps: input.maps ?? [],
        nextInspectionDate: input.nextInspectionDate ? new Date(input.nextInspectionDate) : undefined,
        lastUpdated: new Date(),
        updatedBy: input.updatedBy,
      } as any);

      logger.info(`LocationInfo creada para ${input.locationId}`, this.context);
      return info;
    } catch (error) {
      if (error instanceof LocationError) throw error;
      logger.error('Error en create', this.context, { input }, ensureError(error));
      throw new LocationError('Error al crear información de ubicación', 'INFO_CREATE_ERROR', 500, ensureError(error));
    }
  }

  /**
   * Upsert: crea si no existe, o actualiza si ya existe.
   */
  async upsert(input: CreateOrUpdateInfoInput): Promise<LocationInfo> {
    const existing = await LocationInfo.findByPk(input.locationId);
    if (existing) return this.update(input);
    return this.create(input);
  }

  /**
   * Actualiza la información de una ubicación existente.
   */
  async update(input: CreateOrUpdateInfoInput): Promise<LocationInfo> {
    try {
      const info = await LocationInfo.findByPk(input.locationId);
      if (!info) {
        throw new LocationNotFoundError(input.locationId);
      }

      const updates: any = { updatedBy: input.updatedBy };
      if (input.description !== undefined) updates.description = input.description;
      if (input.currentCondition !== undefined) updates.currentCondition = input.currentCondition;
      if (input.currentNotes !== undefined) updates.currentNotes = input.currentNotes;
      if (input.notes !== undefined) updates.notes = input.notes;
      if (input.tags !== undefined) updates.tags = input.tags;
      if (input.images !== undefined) updates.images = input.images;
      if (input.documents !== undefined) updates.documents = input.documents;
      if (input.videos !== undefined) updates.videos = input.videos;
      if (input.maps !== undefined) updates.maps = input.maps;
      if (input.nextInspectionDate !== undefined) {
        updates.nextInspectionDate = input.nextInspectionDate ? new Date(input.nextInspectionDate) : null;
      }

      await info.update(updates);
      logger.info(`LocationInfo actualizada: ${input.locationId}`, this.context);
      return info;
    } catch (error) {
      if (error instanceof LocationError) throw error;
      logger.error('Error en update', this.context, { input }, ensureError(error));
      throw new LocationError('Error al actualizar información', 'INFO_UPDATE_ERROR', 500, ensureError(error));
    }
  }

  /**
   * Soft delete del registro de información (no elimina la ubicación).
   */
  async delete(locationId: string): Promise<void> {
    try {
      const info = await LocationInfo.findByPk(locationId);
      if (!info) throw new LocationNotFoundError(locationId);
      await info.destroy(); // paranoid → soft delete
      logger.info(`LocationInfo eliminada (soft): ${locationId}`, this.context);
    } catch (error) {
      if (error instanceof LocationError) throw error;
      logger.error('Error en delete', this.context, { locationId }, ensureError(error));
      throw new LocationError('Error al eliminar información', 'INFO_DELETE_ERROR', 500, ensureError(error));
    }
  }

  // ==========================================================================
  // MEDIA (images, documents, videos, maps)
  // ==========================================================================

  /**
   * Agrega una URL al array de media del tipo indicado.
   * Si el registro no existe, lo crea con valores por defecto.
   */
  async addMedia(input: AddMediaInput): Promise<LocationInfo> {
    this.validateUrl(input.url);

    let info = await LocationInfo.findByPk(input.locationId);
    if (!info) {
      await this.assertLocationExists(input.locationId);
      info = await LocationInfo.create({
        locationId: input.locationId,
        currentCondition: CurrentCondition.GOOD,
        notes: '',
        tags: [],
        images: input.kind === 'images' ? [input.url] : [],
        documents: input.kind === 'documents' ? [input.url] : [],
        videos: input.kind === 'videos' ? [input.url] : [],
        maps: input.kind === 'maps' ? [input.url] : [],
        lastUpdated: new Date(),
        updatedBy: input.updatedBy,
      } as any);
      return info;
    }

    const current = (info[input.kind] as string[] | undefined) ?? [];
    if (current.includes(input.url)) {
      throw new LocationError(`La URL ya existe en ${input.kind}`, 'MEDIA_DUPLICATE', 409);
    }

    await info.update({
      [input.kind]: [...current, input.url],
      updatedBy: input.updatedBy,
    } as any);

    logger.info(`Media agregada a ${input.locationId}.${input.kind}`, this.context);
    return info;
  }

  /**
   * Quita una URL del array de media del tipo indicado.
   */
  async removeMedia(input: RemoveMediaInput): Promise<LocationInfo> {
    const info = await LocationInfo.findByPk(input.locationId);
    if (!info) throw new LocationNotFoundError(input.locationId);

    const current = (info[input.kind] as string[] | undefined) ?? [];
    if (!current.includes(input.url)) {
      throw new LocationError(`La URL no existe en ${input.kind}`, 'MEDIA_NOT_FOUND', 404);
    }

    await info.update({
      [input.kind]: current.filter((u) => u !== input.url),
      updatedBy: input.updatedBy,
    } as any);

    logger.info(`Media removida de ${input.locationId}.${input.kind}`, this.context);
    return info;
  }

  // ==========================================================================
  // INSPECCIÓN / REVISIÓN
  // ==========================================================================

  async recordInspection(input: RecordInspectionInput): Promise<LocationInfo> {
    try {
      let info = await LocationInfo.findByPk(input.locationId);
      if (!info) {
        await this.assertLocationExists(input.locationId);
        info = await LocationInfo.create({
          locationId: input.locationId,
          currentCondition: input.currentCondition ?? CurrentCondition.GOOD,
          currentNotes: input.currentNotes,
          notes: '',
          tags: [],
          images: [],
          documents: [],
          videos: [],
          maps: [],
          lastInspectionDate: new Date(),
          nextInspectionDate: input.nextInspectionDate ? new Date(input.nextInspectionDate) : undefined,
          inspectionNotes: input.inspectionNotes,
          inspectedBy: input.inspectedBy,
          lastUpdated: new Date(),
          updatedBy: input.inspectedBy,
        } as any);
      } else {
        await info.update({
          lastInspectionDate: new Date(),
          nextInspectionDate: input.nextInspectionDate ? new Date(input.nextInspectionDate) : info.nextInspectionDate,
          inspectionNotes: input.inspectionNotes ?? info.inspectionNotes,
          inspectedBy: input.inspectedBy,
          currentCondition: input.currentCondition ?? info.currentCondition,
          currentNotes: input.currentNotes ?? info.currentNotes,
          updatedBy: input.inspectedBy,
        } as any);
      }

      logger.info(`Inspección registrada en ${input.locationId}`, this.context);
      return info;
    } catch (error) {
      if (error instanceof LocationError) throw error;
      logger.error('Error en recordInspection', this.context, { input }, ensureError(error));
      throw new LocationError('Error al registrar inspección', 'INSPECTION_ERROR', 500, ensureError(error));
    }
  }

  async recordReview(input: RecordReviewInput): Promise<LocationInfo> {
    const info = await LocationInfo.findByPk(input.locationId);
    if (!info) throw new LocationNotFoundError(input.locationId);

    await info.update({
      lastReviewedAt: new Date(),
      reviewedBy: input.reviewedBy,
      updatedBy: input.reviewedBy,
    } as any);

    logger.info(`Revisión registrada en ${input.locationId}`, this.context);
    return info;
  }

  // ==========================================================================
  // UTILIDADES
  // ==========================================================================

  /**
   * Devuelve el resumen formateado (usa el método del modelo).
   */
  async getSummary(locationId: string): Promise<ReturnType<LocationInfo['getInfoSummary']>> {
    const info = await LocationInfo.findByPk(locationId);
    if (!info) throw new LocationNotFoundError(locationId);
    return info.getInfoSummary();
  }

  /**
   * Lista ubicaciones que necesitan inspección (fecha próxima vencida o sin fecha).
   */
  async listNeedingInspection(): Promise<LocationInfo[]> {
    const now = new Date();
    const { Op } = await import('sequelize');
    return LocationInfo.findAll({
      where: {
        [Op.or]: [
          { nextInspectionDate: null },
          { nextInspectionDate: { [Op.lte]: now } },
        ],
      } as any,
    });
  }
}

export const locationInfoService = new LocationInfoService();
