// services/location/LocationRelationService.ts
import { Op, WhereOptions } from 'sequelize';
import logger from '../../utils/logger';
import { LocationNotFoundError, LocationError, RelationCrossRanchError } from '../../utils/LocationErrors';
import { ensureError } from '../../utils/errorUtils';

import Location from '../../models/Location';
import LocationRelation, {
  RelationType,
  PathType,
  RestrictionType,
  RelationMetadata,
} from '../../models/LocationRelation';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface CreateRelationInput {
  sourceLocationId: string;
  targetLocationId: string;
  relationType: RelationType;
  distance?: number;
  bidirectional?: boolean;
  isPrimary?: boolean;
  metadata?: RelationMetadata;
  validFrom?: Date | string;
  validTo?: Date | string;
  isActive?: boolean;
  createdBy: string;
}

export interface UpdateRelationInput {
  id: string;
  relationType?: RelationType;
  distance?: number;
  bidirectional?: boolean;
  isPrimary?: boolean;
  metadata?: RelationMetadata;
  validFrom?: Date | string;
  validTo?: Date | string;
  isActive?: boolean;
  updatedBy: string;
}

export interface ListRelationsFilters {
  locationId?: string;          // relaciones donde la ubicación es source o target
  sourceLocationId?: string;
  targetLocationId?: string;
  relationType?: RelationType;
  isActive?: boolean;
  isPrimary?: boolean;
  bidirectional?: boolean;
}

export interface RecordUsageInput {
  id: string;
  updatedBy: string;
}

// ============================================================================
// SERVICIO
// ============================================================================

export class LocationRelationService {
  private readonly context = 'LocationRelationService';

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async assertLocationExists(locationId: string): Promise<void> {
    const loc = await Location.findByPk(locationId);
    if (!loc) throw new LocationNotFoundError(locationId);
  }

  private async assertBothLocationsExist(
    sourceId: string,
    targetId: string
  ): Promise<{ source: Location; target: Location }> {
    const [src, tgt] = await Promise.all([
      Location.findByPk(sourceId),
      Location.findByPk(targetId),
    ]);
    if (!src) throw new LocationNotFoundError(sourceId);
    if (!tgt) throw new LocationNotFoundError(targetId);
    return { source: src, target: tgt };
  }

  // ==========================================================================
  // CRUD
  // ==========================================================================

  async getById(id: string): Promise<LocationRelation | null> {
    try {
      return await LocationRelation.findByPk(id);
    } catch (error) {
      logger.error('Error en getById', this.context, { id }, ensureError(error));
      throw new LocationError('Error al obtener relación', 'RELATION_FETCH_ERROR', 500, ensureError(error));
    }
  }

  /**
   * Crea una relación entre dos ubicaciones. Valida que no sea autorreferencia
   * y que no exista ya una relación (source, target, type) vigente.
   */
  async create(input: CreateRelationInput): Promise<LocationRelation> {
    try {
      if (input.sourceLocationId === input.targetLocationId) {
        throw new LocationError(
          'Una ubicación no puede relacionarse consigo misma',
          'RELATION_SELF_REFERENCE',
          400
        );
      }

      const { source, target } = await this.assertBothLocationsExist(
        input.sourceLocationId,
        input.targetLocationId
      );

      // ── Validación cross-ranch ────────────────────────────────────────────
      // No se permiten relaciones entre ubicaciones de ranchos distintos.
      // Esto preserva la integridad del modelo: una location pertenece a UN
      // rancho y las relaciones (CONTAINS, ADJACENT, CONNECTED, NEARBY)
      // representan vínculos espaciales/operativos dentro de ese rancho.
      if ((source as any).ranchId !== (target as any).ranchId) {
        throw new RelationCrossRanchError({
          fromLocationId: (source as any).id,
          fromRanchId: (source as any).ranchId,
          toLocationId: (target as any).id,
          toRanchId: (target as any).ranchId,
        });
      }

      // Verificar duplicados (misma source, target, type)
      const existing = await LocationRelation.findOne({
        where: {
          sourceLocationId: input.sourceLocationId,
          targetLocationId: input.targetLocationId,
          relationType: input.relationType,
        } as any,
      });
      if (existing) {
        throw new LocationError(
          'Ya existe una relación de este tipo entre las ubicaciones',
          'RELATION_DUPLICATE',
          409
        );
      }

      const relation = await LocationRelation.create({
        sourceLocationId: input.sourceLocationId,
        targetLocationId: input.targetLocationId,
        relationType: input.relationType,
        distance: input.distance,
        bidirectional: input.bidirectional ?? true,
        isPrimary: input.isPrimary ?? false,
        metadata: input.metadata,
        usageCount: 0,
        validFrom: input.validFrom ? new Date(input.validFrom) : new Date(),
        validTo: input.validTo ? new Date(input.validTo) : undefined,
        isActive: input.isActive ?? true,
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
      } as any);

      logger.info(
        `Relación creada: ${input.sourceLocationId} -[${input.relationType}]-> ${input.targetLocationId}`,
        this.context
      );
      return relation;
    } catch (error) {
      if (error instanceof LocationError) throw error;
      logger.error('Error en create', this.context, { input }, ensureError(error));
      throw new LocationError('Error al crear relación', 'RELATION_CREATE_ERROR', 500, ensureError(error));
    }
  }

  /**
   * Actualiza metadatos de una relación.
   *
   * IMPORTANTE: `sourceLocationId` y `targetLocationId` son INMUTABLES después
   * de creada la relación. Cambiar cualquiera de los dos podría introducir
   * silenciosamente una relación cross-ranch (esquivando la validación de
   * `create()`). Si se necesita cambiar las ubicaciones, eliminar la relación
   * y crear una nueva. Los campos editables son: relationType, distance,
   * bidirectional, isPrimary, metadata, validFrom, validTo, isActive.
   */
  async update(input: UpdateRelationInput): Promise<LocationRelation> {
    try {
      const relation = await LocationRelation.findByPk(input.id);
      if (!relation) {
        throw new LocationError('Relación no encontrada', 'RELATION_NOT_FOUND', 404);
      }

      const updates: any = { updatedBy: input.updatedBy };
      if (input.relationType !== undefined) updates.relationType = input.relationType;
      if (input.distance !== undefined) updates.distance = input.distance;
      if (input.bidirectional !== undefined) updates.bidirectional = input.bidirectional;
      if (input.isPrimary !== undefined) updates.isPrimary = input.isPrimary;
      if (input.metadata !== undefined) updates.metadata = input.metadata;
      if (input.validFrom !== undefined) updates.validFrom = new Date(input.validFrom);
      if (input.validTo !== undefined) {
        updates.validTo = input.validTo ? new Date(input.validTo) : null;
      }
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      await relation.update(updates);
      logger.info(`Relación actualizada: ${input.id}`, this.context);
      return relation;
    } catch (error) {
      if (error instanceof LocationError) throw error;
      logger.error('Error en update', this.context, { input }, ensureError(error));
      throw new LocationError('Error al actualizar relación', 'RELATION_UPDATE_ERROR', 500, ensureError(error));
    }
  }

  async delete(id: string): Promise<void> {
    const relation = await LocationRelation.findByPk(id);
    if (!relation) throw new LocationError('Relación no encontrada', 'RELATION_NOT_FOUND', 404);
    await relation.destroy();
    logger.info(`Relación eliminada (soft): ${id}`, this.context);
  }

  async activate(id: string, updatedBy: string): Promise<LocationRelation> {
    const relation = await LocationRelation.findByPk(id);
    if (!relation) throw new LocationError('Relación no encontrada', 'RELATION_NOT_FOUND', 404);
    await relation.update({ isActive: true, updatedBy } as any);
    return relation;
  }

  async deactivate(id: string, updatedBy: string): Promise<LocationRelation> {
    const relation = await LocationRelation.findByPk(id);
    if (!relation) throw new LocationError('Relación no encontrada', 'RELATION_NOT_FOUND', 404);
    await relation.update({ isActive: false, updatedBy } as any);
    return relation;
  }

  // ==========================================================================
  // LISTADOS / CONSULTAS
  // ==========================================================================

  /**
   * Lista relaciones aplicando filtros. Si se pasa `locationId`, retorna
   * relaciones donde la ubicación aparece como source o target.
   */
  async list(filters: ListRelationsFilters = {}): Promise<LocationRelation[]> {
    const where: WhereOptions = {};

    if (filters.locationId) {
      (where as any)[Op.or] = [
        { sourceLocationId: filters.locationId },
        { targetLocationId: filters.locationId },
      ];
    }
    if (filters.sourceLocationId) (where as any).sourceLocationId = filters.sourceLocationId;
    if (filters.targetLocationId) (where as any).targetLocationId = filters.targetLocationId;
    if (filters.relationType) (where as any).relationType = filters.relationType;
    if (filters.isActive !== undefined) (where as any).isActive = filters.isActive;
    if (filters.isPrimary !== undefined) (where as any).isPrimary = filters.isPrimary;
    if (filters.bidirectional !== undefined) (where as any).bidirectional = filters.bidirectional;

    return LocationRelation.findAll({
      where,
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Obtiene todas las ubicaciones "hijas" de una ubicación (jerarquía CONTAINS).
   */
  async getChildren(parentLocationId: string): Promise<LocationRelation[]> {
    await this.assertLocationExists(parentLocationId);
    return LocationRelation.findAll({
      where: {
        sourceLocationId: parentLocationId,
        relationType: RelationType.CONTAINS,
        isActive: true,
      } as any,
    });
  }

  /**
   * Obtiene la(s) ubicación(es) "padre" de una ubicación (inversa de CONTAINS).
   */
  async getParents(childLocationId: string): Promise<LocationRelation[]> {
    await this.assertLocationExists(childLocationId);
    return LocationRelation.findAll({
      where: {
        targetLocationId: childLocationId,
        relationType: RelationType.CONTAINS,
        isActive: true,
      } as any,
    });
  }

  /**
   * Obtiene ubicaciones adyacentes (ADJACENT).
   */
  async getAdjacent(locationId: string): Promise<LocationRelation[]> {
    await this.assertLocationExists(locationId);
    return LocationRelation.findAll({
      where: {
        [Op.or]: [
          { sourceLocationId: locationId },
          { targetLocationId: locationId, bidirectional: true },
        ],
        relationType: RelationType.ADJACENT,
        isActive: true,
      } as any,
    });
  }

  /**
   * Obtiene ubicaciones conectadas físicamente (CONNECTED).
   */
  async getConnected(locationId: string): Promise<LocationRelation[]> {
    await this.assertLocationExists(locationId);
    return LocationRelation.findAll({
      where: {
        [Op.or]: [
          { sourceLocationId: locationId },
          { targetLocationId: locationId, bidirectional: true },
        ],
        relationType: RelationType.CONNECTED,
        isActive: true,
      } as any,
    });
  }

  /**
   * Busca una relación directa entre dos ubicaciones.
   */
  async findBetween(
    locationA: string,
    locationB: string,
    relationType?: RelationType
  ): Promise<LocationRelation[]> {
    const where: any = {
      [Op.or]: [
        { sourceLocationId: locationA, targetLocationId: locationB },
        { sourceLocationId: locationB, targetLocationId: locationA, bidirectional: true },
      ],
      isActive: true,
    };
    if (relationType) where.relationType = relationType;
    return LocationRelation.findAll({ where });
  }

  // ==========================================================================
  // USO / MÉTRICAS
  // ==========================================================================

  /**
   * Incrementa el contador de uso y actualiza lastUsedAt.
   * Útil para telemetría de tránsito de ganado entre ubicaciones.
   */
  async recordUsage(input: RecordUsageInput): Promise<LocationRelation> {
    const relation = await LocationRelation.findByPk(input.id);
    if (!relation) throw new LocationError('Relación no encontrada', 'RELATION_NOT_FOUND', 404);

    await relation.update({
      usageCount: relation.usageCount + 1,
      lastUsedAt: new Date(),
      updatedBy: input.updatedBy,
    } as any);

    return relation;
  }

  // ==========================================================================
  // MANTENIMIENTO / UTILIDADES
  // ==========================================================================

  /**
   * Desactiva relaciones expiradas (validTo < now y isActive=true).
   * Pensado para un job/cron.
   */
  async deactivateExpired(): Promise<number> {
    const [affected] = await LocationRelation.update(
      { isActive: false } as any,
      {
        where: {
          validTo: { [Op.lt]: new Date() },
          isActive: true,
        } as any,
      }
    );
    if (affected > 0) {
      logger.info(`${affected} relaciones expiradas desactivadas`, this.context);
    }
    return affected;
  }

  /**
   * Resumen: conteos por tipo de relación activa.
   */
  async getStats(locationId?: string): Promise<Record<RelationType, number>> {
    const baseWhere: any = { isActive: true };
    if (locationId) {
      baseWhere[Op.or] = [
        { sourceLocationId: locationId },
        { targetLocationId: locationId },
      ];
    }

    const result: Record<RelationType, number> = {
      [RelationType.CONTAINS]: 0,
      [RelationType.ADJACENT]: 0,
      [RelationType.CONNECTED]: 0,
      [RelationType.NEARBY]: 0,
    };

    await Promise.all(
      (Object.values(RelationType) as RelationType[]).map(async (type) => {
        result[type] = await LocationRelation.count({
          where: { ...baseWhere, relationType: type } as any,
        });
      })
    );

    return result;
  }
}

export const locationRelationService = new LocationRelationService();
