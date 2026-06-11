// services/location/LocationAccessService.ts
import { Op, Transaction, Sequelize } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import {
  LocationNotFoundError,
  AccessError,
  AccessNotFoundError,
  AccessAlreadyGrantedError,
  AccessRevokedError,
  TimeRestrictionViolationError,
} from '../../utils/LocationErrors';
import { ensureError } from '../../utils/errorUtils';

import Location from '../../models/Location';
import User from '../../models/User';
import LocationAccess, {
  AccessLevel,
  AccessPurpose,
  TimeRestriction,
  LocationAccessAttributes,
  LocationAccessCreationAttributes,
} from '../../models/LocationAccess';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface GrantAccessDTO {
  locationId: string;
  userId: string;
  accessLevel: AccessLevel;
  expiresAt?: Date;
  timeRestrictions?: TimeRestriction[];
  purposeRestrictions?: AccessPurpose[];
  createdBy: string; // quien otorga el acceso
}

export interface ExtendAccessDTO {
  accessId: string;
  newExpirationDate: Date;
  extendedBy: string;
  reason?: string;
}

export interface ActiveAccessInfo {
  accessId: string;
  locationId: string;
  locationName: string;
  accessLevel: string;
  accessLevelLabel: string;
  grantedAt: Date;
  expiresAt?: Date;
  timeRestrictions?: TimeRestriction[];
  purposeRestrictions?: AccessPurpose[];
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class LocationAccessService {
  private readonly context = 'LocationAccessService';

  // ==========================================================================
  // VERIFICACIÓN DE ACCESO
  // ==========================================================================

  /**
   * Verifica si un usuario tiene acceso a una ubicación.
   * @param userId ID del usuario
   * @param locationId ID de la ubicación
   * @param purpose Propósito opcional (para verificar restricciones)
   * @returns true si tiene acceso activo y cumple restricciones
   */
  async canAccess(userId: string, locationId: string, purpose?: AccessPurpose): Promise<boolean> {
    try {
      const access = await LocationAccess.findOne({
        where: {
          userId,
          locationId,
          isActive: true,
          [Op.or]: [
            { expiresAt: null } as any,
            { expiresAt: { [Op.gt]: new Date() } },
          ],
        },
      });
      if (!access) return false;

      // Verificar restricciones de tiempo
      if (access.timeRestrictions && !this.checkTimeRestrictions(access.timeRestrictions)) {
        return false;
      }

      // Verificar restricciones de propósito
      if (purpose && access.purposeRestrictions && !access.purposeRestrictions.includes(purpose)) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error(`Error verificando acceso de usuario ${userId} a ubicación ${locationId}`, this.context, { userId, locationId }, ensureError(error));
      throw error;
    }
  }

  /**
   * Verifica restricciones de tiempo contra la hora actual.
   * @param restrictions Lista de restricciones de tiempo
   * @returns true si se permite el acceso en este momento
   */
  checkTimeRestrictions(restrictions: TimeRestriction[]): boolean {
    const now = new Date();
    const currentDay = now.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

    // Si no hay restricciones, acceso permitido
    if (!restrictions || restrictions.length === 0) return true;

    for (const r of restrictions) {
      if (r.dayOfWeek === currentDay) {
        // Comparar rangos horarios
        if (currentTime >= r.startTime && currentTime <= r.endTime) {
          return r.isAllowed;
        }
      }
    }
    // Si ningún día coincide, se considera permitido por defecto (o podría ser denegado, según lógica)
    // En este caso, si no hay restricción para el día actual, permitimos.
    return true;
  }

  // ==========================================================================
  // GESTIÓN DE ACCESOS
  // ==========================================================================

  /**
   * Otorga acceso a un usuario a una ubicación.
   * @param data Datos del acceso a crear
   * @param transaction Transacción opcional
   */
  async grantAccess(data: GrantAccessDTO, transaction?: Transaction): Promise<LocationAccess> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      // Verificar que la ubicación existe
      const location = await Location.findByPk(data.locationId, { transaction: t });
      if (!location) throw new LocationNotFoundError(data.locationId);

      // Verificar que el usuario existe
      const user = await User.findByPk(data.userId, { transaction: t });
      if (!user) throw new AccessError(`Usuario con ID ${data.userId} no encontrado`, 'USER_NOT_FOUND', 404);

      // Verificar si ya existe un acceso activo
      const existing = await LocationAccess.findOne({
        where: {
          locationId: data.locationId,
          userId: data.userId,
          isActive: true,
          [Op.or]: [
            { expiresAt: null } as any,
            { expiresAt: { [Op.gt]: new Date() } },
          ],
        },
        transaction: t,
      });
      if (existing) {
        throw new AccessAlreadyGrantedError(data.userId, data.locationId);
      }

      // Crear nuevo acceso
      const accessData: LocationAccessCreationAttributes = {
        locationId: data.locationId,
        userId: data.userId,
        accessLevel: data.accessLevel,
        grantedBy: data.createdBy,
        grantedAt: new Date(),
        expiresAt: data.expiresAt,
        timeRestrictions: data.timeRestrictions,
        purposeRestrictions: data.purposeRestrictions,
        isActive: true,
        accessCount: 0,
        createdBy: data.createdBy,
        updatedBy: data.createdBy,
      };

      const access = await LocationAccess.create(accessData, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Acceso otorgado: usuario ${data.userId} a ubicación ${data.locationId}`, this.context, {
        userId: data.userId,
        locationId: data.locationId,
        grantedBy: data.createdBy,
        durationMs: Date.now() - startTime,
      });

      return access;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error otorgando acceso a usuario ${data.userId} a ubicación ${data.locationId}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  /**
   * Revoca un acceso existente.
   * @param accessId ID del acceso
   * @param revokedBy Usuario que revoca
   * @param reason Motivo de la revocación
   * @param transaction Transacción opcional
   */
  async revokeAccess(accessId: string, revokedBy: string, reason?: string, transaction?: Transaction): Promise<LocationAccess> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const access = await LocationAccess.findByPk(accessId, { transaction: t });
      if (!access) throw new AccessNotFoundError(accessId);
      if (!access.isActive) throw new AccessRevokedError(accessId);

      access.isActive = false;
      access.revokedAt = new Date();
      access.revokedBy = revokedBy;
      access.revocationReason = reason;
      access.updatedBy = revokedBy;
      await access.save({ transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Acceso revocado: ${accessId}`, this.context, {
        accessId,
        revokedBy,
        reason,
        durationMs: Date.now() - startTime,
      });

      return access;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error revocando acceso ${accessId}`, this.context, { accessId, revokedBy }, ensureError(error));
      throw error;
    }
  }

  /**
   * Extiende la fecha de expiración de un acceso.
   * @param data Datos de extensión
   * @param transaction Transacción opcional
   */
  async extendAccess(data: ExtendAccessDTO, transaction?: Transaction): Promise<LocationAccess> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const access = await LocationAccess.findByPk(data.accessId, { transaction: t });
      if (!access) throw new AccessNotFoundError(data.accessId);
      if (!access.isActive) throw new AccessRevokedError(data.accessId);
      if (data.newExpirationDate <= new Date()) {
        throw new AccessError('La nueva fecha de expiración debe ser futura', 'INVALID_EXPIRATION', 400);
      }

      access.expiresAt = data.newExpirationDate;
      access.updatedBy = data.extendedBy;
      await access.save({ transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Acceso extendido: ${data.accessId} hasta ${data.newExpirationDate}`, this.context, {
        accessId: data.accessId,
        newExpirationDate: data.newExpirationDate,
        extendedBy: data.extendedBy,
        durationMs: Date.now() - startTime,
      });

      return access;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error extendiendo acceso ${data.accessId}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  /**
   * Registra el uso de un acceso (incrementa contador y actualiza lastAccessedAt).
   * @param accessId ID del acceso
   * @param transaction Transacción opcional
   */
  async recordAccess(accessId: string, transaction?: Transaction): Promise<void> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const access = await LocationAccess.findByPk(accessId, { transaction: t });
      if (!access) throw new AccessNotFoundError(accessId);
      if (!access.isActive) throw new AccessRevokedError(accessId);

      access.accessCount += 1;
      access.lastAccessedAt = new Date();
      await access.save({ transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.debug(`Uso registrado para acceso ${accessId}`, this.context, {
        accessId,
        count: access.accessCount,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error registrando uso de acceso ${accessId}`, this.context, { accessId }, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // CONSULTAS
  // ==========================================================================

  /**
   * Obtiene todos los accesos activos de un usuario.
   * @param userId ID del usuario
   * @returns Lista de accesos activos con información de ubicación
   */
  async getUserActiveAccesses(userId: string): Promise<ActiveAccessInfo[]> {
    try {
      const accesses = await LocationAccess.findAll({
        where: {
          userId,
          isActive: true,
          [Op.or]: [
            { expiresAt: null } as any,
            { expiresAt: { [Op.gt]: new Date() } },
          ],
        },
        include: [
          {
            model: Location,
            as: 'location',
            attributes: ['id', 'name'],
          },
        ],
        order: [['grantedAt', 'DESC']],
      });

      return accesses.map(access => ({
        accessId: access.id,
        locationId: access.locationId,
        locationName: (access as any).location?.name || 'Desconocido',
        accessLevel: access.accessLevel,
        accessLevelLabel: this.getAccessLevelLabel(access.accessLevel),
        grantedAt: access.grantedAt,
        expiresAt: access.expiresAt,
        timeRestrictions: access.timeRestrictions,
        purposeRestrictions: access.purposeRestrictions,
      }));
    } catch (error) {
      logger.error(`Error obteniendo accesos activos del usuario ${userId}`, this.context, { userId }, ensureError(error));
      throw error;
    }
  }

  /**
   * Limpia los accesos expirados (los marca como inactivos).
   * @param transaction Transacción opcional
   */
  async cleanupExpiredAccesses(transaction?: Transaction): Promise<number> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const [updatedCount] = await LocationAccess.update(
        {
          isActive: false,
          updatedBy: 'system',
        },
        {
          where: {
            isActive: true,
            expiresAt: { [Op.lt]: new Date() },
          },
          transaction: t,
        }
      );

      if (isOwnTransaction) await t.commit();

      logger.info(`Limpieza de accesos expirados completada: ${updatedCount} accesos desactivados`, this.context, {
        count: updatedCount,
        durationMs: Date.now() - startTime,
      });

      return updatedCount;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error('Error limpiando accesos expirados', this.context, {}, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // UTILIDADES
  // ==========================================================================

  private getAccessLevelLabel(level: AccessLevel): string {
    const labels: Record<AccessLevel, string> = {
      [AccessLevel.PUBLIC]: 'Público',
      [AccessLevel.RESTRICTED]: 'Restringido',
      [AccessLevel.PRIVATE]: 'Privado',
      [AccessLevel.AUTHORIZED_ONLY]: 'Solo autorizados',
      [AccessLevel.EMERGENCY_ONLY]: 'Solo emergencias',
      [AccessLevel.STAFF_ONLY]: 'Solo personal',
      [AccessLevel.VETERINARY_ONLY]: 'Solo veterinarios',
      [AccessLevel.OWNER_ONLY]: 'Solo propietarios',
    };
    return labels[level] || level;
  }
}

export const locationAccessService = new LocationAccessService();