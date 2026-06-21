// services/ranch/RanchService.ts
import { Op, Transaction, QueryTypes } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import { RanchNotFoundError, RanchValidationError, RanchCapacityError, RanchAccessDeniedError } from '../../utils/RanchErrors';
import { ensureError } from '../../utils/errorUtils';

import Ranch, { RanchAttributes, RanchCreationAttributes, RanchType, RanchStatus } from '../../models/Ranch';
import User, { UserRole } from '../../models/User';
import type { GeofenceConfig } from '../../models/Location';
import { isPointInBoundary } from '../../utils/geoUtils';
import Bovine from '../../models/Bovine';
import Location from '../../models/Location';
import LocationCapacity from '../../models/LocationCapacity';
import BovineLocationHistory from '../../models/BovineLocationHistory';
// Modelos para el borrado total (cascada acotada).
import Finance from '../../models/Finance';
import Production from '../../models/Production';
import Reproduction from '../../models/Reproduction';
import EpidemiologicalSnapshot from '../../models/EpidemiologicalSnapshot';
import EpidemiologyAlert from '../../models/EpidemiologyAlert';

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

/**
 * Quién ejecuta una mutación sobre un rancho. Se usa para verificar propiedad
 * (scoping) y prevenir IDOR: un OWNER/RANCH_MANAGER solo puede mutar ranchos
 * dentro de su `ranchAccess`. SUPER_ADMIN tiene acceso global.
 */
export interface RanchActor {
  role: UserRole;
  /** IDs de ranchos a los que el actor tiene acceso ACTIVO. */
  ranchIds: string[];
}

export interface RanchFilters {
  type?: RanchType[];
  status?: RanchStatus[];
  isActive?: boolean;
  searchTerm?: string;
  limit?: number;
  offset?: number;
  // Scoping por usuario: si se provee, solo se devuelven estos ranchos.
  // `[]` (array vacío) significa "ninguno" → devuelve lista vacía.
  ranchIds?: string[];
  // Solo SUPER_ADMIN: incluir ranchos soft-deleted (desactivados) en el listado.
  includeDeleted?: boolean;
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

      // ── Fix A: registrar la pertenencia del creador ─────────────────
      // Al crear un rancho, el creador queda vinculado a él vía ranchAccess
      // (accessLevel OWNER). Sin esto, un OWNER aparecía "sin rancho" y el
      // scoping por rancho (p. ej. crear usuarios de su rancho) no encontraba
      // ningún rancho suyo.
      if (data.createdBy) {
        await this.grantCreatorRanchAccess(data.createdBy, ranch, t);
      }

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
      // Sequelize envuelve el error real de Postgres en `parent`/`original`.
      // Lo exponemos para no perder el mensaje/detalle (constraint, columna, code).
      const pg = (error as any)?.parent || (error as any)?.original;
      logger.error('Error creando rancho', this.context, {
        data,
        dbMessage: pg?.message,
        dbDetail: pg?.detail,
        dbCode: pg?.code,
        dbConstraint: pg?.constraint,
        dbColumn: pg?.column,
        dbTable: pg?.table,
      }, ensureError(error));
      throw error;
    }
  }

  /**
   * Fix A — Vincula al creador de un rancho con dicho rancho a través de su
   * `ranchAccess` (accessLevel OWNER). Es idempotente: si el usuario ya tiene
   * acceso activo a ese rancho, no hace nada. Si el creador no existe, no
   * rompe la creación del rancho (solo se omite el vínculo).
   */
  private async grantCreatorRanchAccess(
    userId: string,
    ranch: Ranch,
    transaction: Transaction
  ): Promise<void> {
    const user = await User.findByPk(userId, { transaction });
    if (!user) return;

    const existing = (user.ranchAccess || []) as NonNullable<User['ranchAccess']>;
    if (existing.some((a) => a.ranchId === ranch.id && a.isActive)) return;

    const updated = [
      ...existing,
      {
        ranchId: ranch.id,
        ranchName: ranch.name,
        accessLevel: 'OWNER' as const,
        permissions: [],
        grantedBy: userId,
        grantedDate: new Date(),
        isActive: true,
      },
    ];

    await user.update({ ranchAccess: updated }, { transaction });
  }

  /**
   * Propaga el nuevo nombre de un rancho al campo denormalizado `ranchName`
   * dentro del `ranchAccess` (JSONB) de cada usuario que tenga acceso a él.
   * Sin esto, el topbar / badges mostraban el nombre viejo tras renombrar.
   */
  private async syncRanchNameInUsersAccess(
    ranchId: string,
    newName: string,
    transaction: Transaction
  ): Promise<void> {
    // Usuarios cuyo ranchAccess contiene este rancho (cualquier entrada).
    const rows = await sequelize.query<{ id: string }>(
      `SELECT id FROM users
         WHERE deleted_at IS NULL
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements(ranch_access) AS access
             WHERE access->>'ranchId' = :ranchId
           )`,
      { replacements: { ranchId }, type: QueryTypes.SELECT, transaction }
    );

    for (const { id } of rows) {
      const user = await User.findByPk(id, { transaction });
      if (!user) continue;

      const access = (user.ranchAccess || []) as NonNullable<User['ranchAccess']>;
      let changed = false;
      const updated = access.map((a) => {
        if (a.ranchId === ranchId && a.ranchName !== newName) {
          changed = true;
          return { ...a, ranchName: newName };
        }
        return a;
      });
      if (changed) await user.update({ ranchAccess: updated }, { transaction });
    }

    logger.info(
      `ranchName sincronizado en ${rows.length} usuario(s) tras renombrar rancho ${ranchId}`,
      this.context
    );
  }

  /**
   * Verifica que `actor` tenga permiso para mutar el rancho `ranchId`.
   * SUPER_ADMIN siempre pasa. Cualquier otro rol debe tener el rancho en su
   * `ranchAccess` activo; si no, lanza 403 (previene IDOR horizontal).
   * Si `actor` es undefined (llamada interna/legacy) NO se aplica scoping.
   */
  private assertRanchAccess(ranchId: string, actor?: RanchActor): void {
    if (!actor) return;
    if (actor.role === UserRole.SUPER_ADMIN) return;
    if (!actor.ranchIds.includes(ranchId)) {
      throw new RanchAccessDeniedError(ranchId);
    }
  }

  async updateRanch(data: UpdateRanchDTO, actor?: RanchActor, transaction?: Transaction): Promise<Ranch> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      // Scoping/IDOR: verificar propiedad antes de tocar nada.
      this.assertRanchAccess(data.id, actor);

      const ranch = await Ranch.findByPk(data.id, { transaction: t });
      if (!ranch) throw new RanchNotFoundError(data.id);

      // Nombre previo: para detectar un rename y propagarlo al `ranchAccess`
      // denormalizado de los usuarios (el topbar y los badges lo muestran).
      const previousName = ranch.name;

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

      // Si cambió el nombre, sincronizar el `ranchName` denormalizado en el
      // ranchAccess de todos los usuarios con acceso a este rancho.
      if (typeof data.name === 'string' && data.name !== previousName) {
        await this.syncRanchNameInUsersAccess(data.id, data.name, t);
      }

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

  async deleteRanch(id: string, deletedBy: string, actor?: RanchActor): Promise<void> {
    const transaction = await sequelize.transaction();
    const startTime = Date.now();

    try {
      // Scoping/IDOR: verificar propiedad antes de borrar.
      this.assertRanchAccess(id, actor);

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

  /**
   * Reactiva un rancho soft-deleted (limpia deleted_at). Solo SUPER_ADMIN.
   */
  async restoreRanch(id: string): Promise<Ranch> {
    const ranch = await Ranch.findByPk(id, { paranoid: false });
    if (!ranch) throw new RanchNotFoundError(id);
    if (!ranch.deletedAt) return ranch; // ya estaba activo
    await ranch.restore();
    logger.info(`Rancho restaurado: ${id}`, this.context, { ranchId: id });
    return ranch;
  }

  /**
   * BORRADO TOTAL (a nivel BD) — irreversible. Cascada ACOTADA:
   * elimina bovinos, ubicaciones, finanzas, producción, reproducción,
   * snapshots y alertas del rancho (por ranchId/bovineId), limpia el
   * ranchAccess de los usuarios y borra el rancho definitivamente.
   * NO persigue tablas derivadas de 2º nivel (síntomas de caso, etc.).
   */
  async hardDeleteRanch(id: string): Promise<void> {
    const t = await sequelize.transaction();
    const startTime = Date.now();
    try {
      // Incluir soft-deleted: se puede borrar permanentemente algo ya desactivado.
      const ranch = await Ranch.findByPk(id, { paranoid: false, transaction: t });
      if (!ranch) throw new RanchNotFoundError(id);

      const bovines = await Bovine.findAll({
        where: { ranchId: id },
        attributes: ['id'],
        paranoid: false,
        transaction: t,
      });
      const bovineIds = bovines.map((b) => b.id);

      const force = { force: true, transaction: t };

      // Registros ligados a los bovinos del rancho.
      if (bovineIds.length > 0) {
        await Production.destroy({ where: { bovineId: { [Op.in]: bovineIds } }, ...force });
        await Finance.destroy({ where: { bovineId: { [Op.in]: bovineIds } }, ...force });
      }

      // Registros ligados directamente al rancho.
      await Finance.destroy({ where: { ranchId: id }, ...force });
      await Reproduction.destroy({ where: { ranchId: id }, ...force });
      await EpidemiologicalSnapshot.destroy({ where: { ranchId: id }, ...force });
      await EpidemiologyAlert.destroy({ where: { ranchId: id }, ...force });
      await Location.destroy({ where: { ranchId: id }, ...force });
      await Bovine.destroy({ where: { ranchId: id }, ...force });

      // Quitar el rancho del ranchAccess de todos los usuarios.
      await this.removeRanchFromAllUsersAccess(id, t);

      // Borrar el rancho definitivamente.
      await ranch.destroy({ force: true, transaction: t });

      await t.commit();
      logger.warn(
        `Rancho ELIMINADO permanentemente: ${id} (bovinos: ${bovineIds.length})`,
        this.context,
        { ranchId: id, bovinesDeleted: bovineIds.length, durationMs: Date.now() - startTime }
      );
    } catch (error) {
      await t.rollback();
      logger.error(`Error en borrado total del rancho ${id}`, this.context, { id }, ensureError(error));
      throw error;
    }
  }

  /**
   * Quita la entrada de un rancho del `ranchAccess` (JSONB) de todos los
   * usuarios que la tengan. Usado por el borrado total.
   */
  private async removeRanchFromAllUsersAccess(
    ranchId: string,
    transaction: Transaction
  ): Promise<void> {
    const rows = await sequelize.query<{ id: string }>(
      `SELECT id FROM users
         WHERE EXISTS (
           SELECT 1 FROM jsonb_array_elements(ranch_access) AS access
           WHERE access->>'ranchId' = :ranchId
         )`,
      { replacements: { ranchId }, type: QueryTypes.SELECT, transaction }
    );

    for (const { id } of rows) {
      const user = await User.findByPk(id, { transaction });
      if (!user) continue;
      const access = (user.ranchAccess || []) as NonNullable<User['ranchAccess']>;
      const updated = access.filter((a) => a.ranchId !== ranchId);
      if (updated.length !== access.length) {
        await user.update({ ranchAccess: updated }, { transaction });
      }
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
      if (filters.ranchIds) where.id = { [Op.in]: filters.ranchIds };
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
        // includeDeleted (solo SUPER_ADMIN): trae también los soft-deleted,
        // que el frontend marca como "desactivado" por su deletedAt.
        paranoid: !filters.includeDeleted,
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