// services/ranch/RanchService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import { RanchNotFoundError, RanchValidationError, RanchCapacityError } from '../../utils/RanchErrors';
import { ensureError } from '../../utils/errorUtils';

import Ranch, { RanchAttributes, RanchCreationAttributes, RanchType, RanchStatus } from '../../models/Ranch';
import type { GeofenceConfig } from '../../models/Location';
import { isPointInBoundary } from '../../utils/geoUtils';
import Bovine from '../../models/Bovine';
import Location from '../../models/Location';
import LocationCapacity from '../../models/LocationCapacity';
import BovineLocationHistory from '../../models/BovineLocationHistory';

// ============================================================================
// HELPERS — Conteo en vivo de cattle por rancho
// ============================================================================
// La columna Ranch.currentCattleCount se considera DEPRECADA. La fuente de
// verdad es BovineLocationHistory (estancias abiertas) joineado por
// location.ranchId. Esto evita desincronización del caché.
// ============================================================================

/**
 * Cuenta animales actualmente dentro de un rancho (estancias abiertas
 * en cualquier location del rancho).
 */
async function countLiveCattleInRanch(ranchId: string): Promise<number> {
  const result = (await BovineLocationHistory.findAll({
    attributes: [[sequelize.fn('COUNT', sequelize.col('BovineLocationHistory.id')), 'count']],
    where: { exitedAt: { [Op.is]: null as any } },
    include: [
      {
        model: Location,
        as: 'location',
        attributes: [],
        required: true,
        where: { ranchId },
      },
    ],
    raw: true,
  })) as any[];
  return parseInt(result[0]?.count ?? '0', 10);
}

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface CreateRanchDTO {
  ranchCode: string;
  name: string;
  type: RanchType;
  address: string;
  city: string;
  state: string;
  country: string;
  timezone?: string;                 // opcional
  coordinates: any;                 // LocationData
  landTenure: any;
  climateZone: any;
  elevation?: number;               // opcional
  annualRainfall?: number;          // opcional
  averageTemperature?: number;      // opcional
  totalArea: number;
  grazingArea: number;
  maxCattleCapacity: number;
  currentCattleCount?: number;
  boundaryRadius?: number;          // legacy fallback (km)
  boundary?: GeofenceConfig;        // perímetro real (POLYGON / RECTANGULAR / CIRCULAR / CORRIDOR)
  status?: RanchStatus;             // opcional (por si se envía)
  isActive?: boolean;
  isVerified?: boolean;             // ✅ Agregado
  createdBy: string;
}

export interface UpdateRanchDTO extends Partial<CreateRanchDTO> {
  id: string;
  updatedBy: string;
}

export interface RanchFilters {
  type?: RanchType[];
  status?: RanchStatus[];
  isActive?: boolean;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

export interface RanchSummary {
  id: string;
  ranchCode: string;
  name: string;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  totalArea: number;
  grazingArea: number;
  maxCattleCapacity: number;
  currentCattleCount: number;
  occupancyRate: number;        // current / max * 100
  cattleDensity: number;         // currentCattleCount / totalArea (animales/ha)
  isAtCapacity: boolean;
  availableCapacity: number;
  coordinates: any;
  boundaryRadius?: number;          // legacy (km), null si no configurado
  boundary?: GeofenceConfig | null; // perímetro real
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class RanchCoreService {
  private readonly context = 'RanchCoreService';

  // ==========================================================================
  // CRUD
  // ==========================================================================

  async createRanch(data: CreateRanchDTO, transaction?: Transaction): Promise<Ranch> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      // Verificar que el código no exista
      const existing = await Ranch.findOne({ where: { ranchCode: data.ranchCode }, transaction: t });
      if (existing) {
        throw new RanchValidationError(`Ya existe un rancho con código ${data.ranchCode}`);
      }

      // Validar área de pastoreo vs total
      if (data.grazingArea > data.totalArea) {
        throw new RanchValidationError('El área de pastoreo no puede exceder el área total');
      }

      // currentCattleCount es deprecado: se calcula on-the-fly desde
      // BovineLocationHistory. Forzamos 0 al crear (la columna sigue NOT NULL en BD).
      const currentCattleCount = 0;

      const ranchData: RanchCreationAttributes = {
        ranchCode: data.ranchCode,
        name: data.name,
        type: data.type,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        timezone: data.timezone || 'America/Mexico_City',
        coordinates: data.coordinates,
        landTenure: data.landTenure,
        climateZone: data.climateZone,
        elevation: data.elevation,
        annualRainfall: data.annualRainfall,
        averageTemperature: data.averageTemperature,
        boundaryRadius: data.boundaryRadius,
        boundary: data.boundary,
        totalArea: data.totalArea,
        grazingArea: data.grazingArea,
        maxCattleCapacity: data.maxCattleCapacity,
        currentCattleCount,
        status: data.status || RanchStatus.ACTIVE,
        isActive: data.isActive ?? true,
        isVerified: data.isVerified ?? false,
        createdBy: data.createdBy,
      };

      const ranch = await Ranch.create(ranchData, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Rancho creado: ${ranch.id}`, this.context, {
        ranchId: ranch.id,
        name: ranch.name,
        createdBy: data.createdBy,
        durationMs: Date.now() - startTime,
      });

      return ranch;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error('Error creando rancho', this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async updateRanch(data: UpdateRanchDTO, transaction?: Transaction): Promise<Ranch> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const ranch = await Ranch.findByPk(data.id, { transaction: t });
      if (!ranch) throw new RanchNotFoundError(data.id);

      // Validar área de pastoreo vs total si se actualizan
      if (data.grazingArea && data.totalArea && data.grazingArea > data.totalArea) {
        throw new RanchValidationError('El área de pastoreo no puede exceder el área total');
      }

      // currentCattleCount es deprecado: se ignora si llega en el body.
      // El valor real se calcula on-the-fly desde BovineLocationHistory.
      const { currentCattleCount: _ignored, ...updateData } = data as any;

      // Validación cruzada: si cambia maxCattleCapacity, no puede ser menor
      // que la suma de maxAnimals de las locations del rancho.
      if (data.maxCattleCapacity !== undefined) {
        const sumLocations = await this.getSumLocationCapacities(data.id, t);
        if (data.maxCattleCapacity < sumLocations) {
          throw new RanchValidationError(
            `maxCattleCapacity (${data.maxCattleCapacity}) no puede ser menor que la ` +
            `suma de capacidades de las locations del rancho (${sumLocations}).`
          );
        }
      }

      await ranch.update(updateData, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Rancho actualizado: ${data.id}`, this.context, {
        ranchId: data.id,
        updatedBy: data.updatedBy,
        durationMs: Date.now() - startTime,
      });

      return ranch;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error actualizando rancho ${data.id}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async deleteRanch(id: string, deletedBy: string): Promise<void> {
    const transaction = await sequelize.transaction();
    const startTime = Date.now();

    try {
      const ranch = await Ranch.findByPk(id, { transaction });
      if (!ranch) throw new RanchNotFoundError(id);

      await ranch.destroy({ transaction });
      await transaction.commit();

      logger.info(`Rancho eliminado (soft): ${id}`, this.context, {
        ranchId: id,
        deletedBy,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error eliminando rancho ${id}`, this.context, { id }, ensureError(error));
      throw error;
    }
  }

  async getRanchById(id: string): Promise<Ranch | null> {
    try {
      return await Ranch.findByPk(id);
    } catch (error) {
      logger.error(`Error obteniendo rancho por ID ${id}`, this.context, { id }, ensureError(error));
      throw error;
    }
  }

  async listRanches(filters: RanchFilters = {}): Promise<{ rows: Ranch[]; count: number }> {
    try {
      const where: any = {};
      if (filters.type?.length) where.type = { [Op.in]: filters.type };
      if (filters.status?.length) where.status = { [Op.in]: filters.status };
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      if (filters.searchTerm) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${filters.searchTerm}%` } },
          { ranchCode: { [Op.iLike]: `%${filters.searchTerm}%` } },
        ];
      }

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const { rows, count } = await Ranch.findAndCountAll({
        where,
        limit,
        offset,
        order: [['name', 'ASC']],
      });

      logger.debug(`Ranchos listados`, this.context, { count, filters });
      return { rows, count };
    } catch (error) {
      logger.error('Error listando ranchos', this.context, { filters }, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // MÉTRICAS DE CAPACIDAD Y OCUPACIÓN
  // ==========================================================================

  async getOccupancyRate(ranchId: string): Promise<number> {
    const ranch = await Ranch.findByPk(ranchId);
    if (!ranch) throw new RanchNotFoundError(ranchId);
    if (ranch.maxCattleCapacity === 0) return 0;
    const current = await countLiveCattleInRanch(ranchId);
    return (current / ranch.maxCattleCapacity) * 100;
  }

  async getAvailableCapacity(ranchId: string): Promise<number> {
    const ranch = await Ranch.findByPk(ranchId);
    if (!ranch) throw new RanchNotFoundError(ranchId);
    const current = await countLiveCattleInRanch(ranchId);
    return Math.max(0, ranch.maxCattleCapacity - current);
  }

  async isAtCapacity(ranchId: string): Promise<boolean> {
    const ranch = await Ranch.findByPk(ranchId);
    if (!ranch) throw new RanchNotFoundError(ranchId);
    const current = await countLiveCattleInRanch(ranchId);
    return current >= ranch.maxCattleCapacity;
  }

  /**
   * Suma `maxAnimals` de todas las LocationCapacity del rancho.
   * Útil para validar que `Ranch.maxCattleCapacity` ≥ suma de capacidades
   * de sus locations.
   */
  async getSumLocationCapacities(ranchId: string, transaction?: Transaction): Promise<number> {
    const result = (await LocationCapacity.findAll({
      attributes: [[sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('max_animals')), 0), 'total']],
      include: [
        {
          model: Location,
          as: 'location',
          attributes: [],
          required: true,
          where: { ranchId },
        },
      ],
      raw: true,
      transaction,
    })) as any[];
    return parseInt(result[0]?.total ?? '0', 10);
  }

  async getCattleDensity(ranchId: string): Promise<number> {
    const ranch = await Ranch.findByPk(ranchId);
    if (!ranch) throw new RanchNotFoundError(ranchId);
    if (ranch.totalArea === 0) return 0;
    const current = await countLiveCattleInRanch(ranchId);
    return current / ranch.totalArea; // animales por hectárea
  }

  // ==========================================================================
  // UTILIDADES DE ETIQUETAS
  // ==========================================================================

  getRanchTypeLabel(type: RanchType): string {
    const labels: Record<RanchType, string> = {
      DAIRY: 'Lechero',
      BEEF: 'Carne',
      MIXED: 'Mixto',
      BREEDING: 'Reproducción/Cría',
      FEEDLOT: 'Engorda',
      ORGANIC: 'Orgánico',
      SUSTAINABLE: 'Sostenible',
      COMMERCIAL: 'Comercial',
      FAMILY_FARM: 'Familiar',
      COOPERATIVE: 'Cooperativa',
      CORPORATE: 'Corporativo',
      RESEARCH: 'Investigación',
      EDUCATIONAL: 'Educativo',
    };
    return labels[type] || type;
  }

  getStatusLabel(status: RanchStatus): string {
    const labels: Record<RanchStatus, string> = {
      ACTIVE: 'Activo',
      INACTIVE: 'Inactivo',
      UNDER_CONSTRUCTION: 'En construcción',
      RENOVATION: 'En renovación',
      TEMPORARY_CLOSURE: 'Cierre temporal',
      PERMANENT_CLOSURE: 'Cierre permanente',
      QUARANTINE: 'En cuarentena',
      SUSPENDED: 'Suspendido',
      PENDING_APPROVAL: 'Pendiente de aprobación',
    };
    return labels[status] || status;
  }

  // ==========================================================================
  // RESUMEN COMPLETO DEL RANCHO
  // ==========================================================================

  async getRanchSummary(ranchId: string): Promise<RanchSummary> {
    const ranch = await Ranch.findByPk(ranchId);
    if (!ranch) throw new RanchNotFoundError(ranchId);

    // Conteo en vivo desde BovineLocationHistory (NO desde la columna cacheada)
    const currentCattleCount = await countLiveCattleInRanch(ranchId);

    const occupancyRate = ranch.maxCattleCapacity === 0 ? 0 : (currentCattleCount / ranch.maxCattleCapacity) * 100;
    const cattleDensity = ranch.totalArea === 0 ? 0 : currentCattleCount / ranch.totalArea;
    const availableCapacity = Math.max(0, ranch.maxCattleCapacity - currentCattleCount);
    const isAtCapacity = currentCattleCount >= ranch.maxCattleCapacity;

    return {
      id: ranch.id,
      ranchCode: ranch.ranchCode,
      name: ranch.name,
      type: ranch.type,
      typeLabel: this.getRanchTypeLabel(ranch.type),
      status: ranch.status,
      statusLabel: this.getStatusLabel(ranch.status),
      totalArea: ranch.totalArea,
      grazingArea: ranch.grazingArea,
      maxCattleCapacity: ranch.maxCattleCapacity,
      currentCattleCount,
      occupancyRate,
      cattleDensity,
      isAtCapacity,
      availableCapacity,
      coordinates: ranch.coordinates,
      boundaryRadius: (ranch as any).boundaryRadius ?? undefined,
      boundary: (ranch as any).boundary ?? null,
      isActive: ranch.isActive,
      createdAt: ranch.createdAt,
      updatedAt: ranch.updatedAt,
    };
  }

  // ==========================================================================
  // BOUNDARY — endpoint dedicado
  // ==========================================================================

  /**
   * Devuelve solo el `boundary` del rancho (más `boundaryRadius` y `coordinates`
   * como contexto). Útil para el componente de mapa que carga el perímetro
   * sin tener que traerse el rancho completo.
   */
  async getRanchBoundary(ranchId: string): Promise<{
    ranchId: string;
    name: string;
    coordinates: any;
    boundaryRadius?: number;
    boundary: GeofenceConfig | null;
  }> {
    const ranch = await Ranch.findByPk(ranchId, {
      attributes: ['id', 'name', 'coordinates', 'boundaryRadius', 'boundary'],
    });
    if (!ranch) throw new RanchNotFoundError(ranchId);

    return {
      ranchId: ranch.id,
      name: (ranch as any).name,
      coordinates: (ranch as any).coordinates,
      boundaryRadius: (ranch as any).boundaryRadius ?? undefined,
      boundary: (ranch as any).boundary ?? null,
    };
  }

  /**
   * Actualiza únicamente el `boundary` del rancho.
   *
   * Validación cruzada: si el nuevo boundary deja FUERA a alguna location
   * existente del rancho, se rechaza con 409 + lista de locations afectadas.
   * Esto previene "achicar" el rancho dejando ubicaciones huérfanas.
   *
   * Pasar `boundary: null` borra el perímetro y el sistema vuelve al
   * fallback CIRCULAR derivado de `boundaryRadius`.
   */
  async updateRanchBoundary(
    ranchId: string,
    boundary: GeofenceConfig | null,
    userId: string
  ): Promise<{
    ranchId: string;
    boundary: GeofenceConfig | null;
  }> {
    const ranch = await Ranch.findByPk(ranchId);
    if (!ranch) throw new RanchNotFoundError(ranchId);

    // Validación cruzada solo si se está estableciendo un boundary (no si se borra).
    if (boundary) {
      // Importación tardía para evitar ciclos
      const Location = (await import('../../models/Location')).default;

      const locations = await Location.findAll({
        where: { ranchId },
        attributes: ['id', 'name', 'coordinates', 'locationCode'],
      });

      const outside: Array<{ id: string; name: string; locationCode: string; coordinates: any }> = [];
      for (const loc of locations) {
        const coords = (loc as any).coordinates;
        if (!coords || typeof coords.latitude !== 'number') continue;
        const inside = isPointInBoundary(
          { latitude: coords.latitude, longitude: coords.longitude },
          boundary as any
        );
        if (!inside) {
          outside.push({
            id: (loc as any).id,
            name: (loc as any).name,
            locationCode: (loc as any).locationCode,
            coordinates: coords,
          });
        }
      }

      if (outside.length > 0) {
        const err = new RanchValidationError(
          `El nuevo perímetro dejaría ${outside.length} ubicación(es) fuera del rancho. ` +
          `Reubique las ubicaciones afectadas o ajuste el perímetro.`
        );
        (err as any).statusCode = 409;
        (err as any).code = 'BOUNDARY_LEAVES_LOCATIONS_OUTSIDE';
        (err as any).details = { outsideLocations: outside, boundaryType: boundary.type };
        throw err;
      }
    }

    (ranch as any).boundary = boundary;
    (ranch as any).updatedBy = userId;
    await ranch.save();

    logger.info(`Boundary actualizado para rancho ${ranchId}`, this.context, {
      ranchId,
      boundaryType: boundary?.type ?? null,
      userId,
    });

    return {
      ranchId,
      boundary: (ranch as any).boundary ?? null,
    };
  }
}

export const ranchCoreService = new RanchCoreService();