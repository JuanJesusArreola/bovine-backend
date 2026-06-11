// services/location/LocationMovementsService.ts
// ============================================================================
// LOCATION MOVEMENTS SERVICE
// ============================================================================
// Devuelve el historial de movimientos (entradas/salidas de bovinos) de una
// ubicación específica. Cada estancia (BovineLocationHistory) se descompone
// en dos eventos: ENTRY (al enteredAt) y EXIT (al exitedAt, si existe).
// ============================================================================

import { Op } from 'sequelize';
import logger from '../../utils/logger';
import { ensureError } from '../../utils/errorUtils';
import { LocationNotFoundError } from '../../utils/LocationErrors';

import Location from '../../models/Location';
import BovineLocationHistory, {
  MovementReason,
  MovementType,
} from '../../models/BovineLocationHistory';
import Bovine from '../../models/Bovine';
import User from '../../models/User';

// ============================================================================
// TIPOS
// ============================================================================

export type MovementEventType = 'ENTRY' | 'EXIT';

export interface MovementEvent {
  /** ID del registro BovineLocationHistory del que se derivó este evento */
  historyId: string;
  /** Tipo de evento: entrada o salida */
  type: MovementEventType;
  /** Cuándo ocurrió (enteredAt para ENTRY, exitedAt para EXIT) */
  occurredAt: Date;

  bovineId: string;
  bovineEarTag: string;
  bovineName: string | null;

  /** Razón del movimiento (GRAZING, MEDICAL, etc.) */
  reason: MovementReason;
  /** Cómo se registró (MANUAL, AUTOMATED, SCHEDULED) */
  movementType: MovementType;
  /** ID del usuario que registró */
  recordedBy: string;
  /** Nombre completo del usuario que registró (null si no se encuentra) */
  recordedByName: string | null;
  notes: string | null;
}

export interface GetMovementsOptions {
  /** Filtrar por tipo de evento */
  type?: MovementEventType;
  /** Solo movimientos posteriores a esta fecha */
  fromDate?: Date;
  /** Solo movimientos anteriores a esta fecha */
  toDate?: Date;
  /** Filtrar por motivo */
  reason?: MovementReason;
  /** Paginación */
  limit?: number;
  offset?: number;
}

export interface MovementsResult {
  locationId: string;
  total: number;
  limit: number;
  offset: number;
  movements: MovementEvent[];
}

// ============================================================================
// SERVICIO
// ============================================================================

export class LocationMovementsService {
  private readonly context = 'LocationMovementsService';

  /**
   * Devuelve los movimientos (entradas y salidas) de la ubicación.
   *
   * Estrategia: traemos los registros de BovineLocationHistory de la ubicación,
   * y por cada uno emitimos hasta dos eventos:
   *   - ENTRY (siempre, en enteredAt)
   *   - EXIT  (solo si exitedAt no es null, en exitedAt)
   * Luego ordenamos por fecha desc y paginamos en memoria.
   *
   * Nota: para datasets muy grandes se puede optimizar con UNION ALL en SQL,
   * pero con paginación razonable en frontend (limit ≤ 100) esto es suficiente.
   */
  async getLocationMovements(
    locationId: string,
    options: GetMovementsOptions = {}
  ): Promise<MovementsResult> {
    try {
      // Validar ubicación
      const location = await Location.findByPk(locationId, { attributes: ['id'] });
      if (!location) {
        throw new LocationNotFoundError(locationId);
      }

      const limit = Math.min(Math.max(options.limit ?? 20, 1), 200);
      const offset = Math.max(options.offset ?? 0, 0);

      // Construir filtro temporal sobre enteredAt/exitedAt (overlap)
      const dateConditions: any = {};
      if (options.fromDate) {
        // Una estancia es relevante si exitedAt >= fromDate (o aún sigue activa)
        // o si enteredAt >= fromDate
        dateConditions[Op.or] = [
          { enteredAt: { [Op.gte]: options.fromDate } },
          { exitedAt: { [Op.gte]: options.fromDate } },
          { exitedAt: null },
        ];
      }
      if (options.toDate) {
        dateConditions.enteredAt = { [Op.lte]: options.toDate };
      }

      const where: any = { locationId, ...dateConditions };
      if (options.reason) {
        where.reason = options.reason;
      }

      // Traemos suficientes registros para construir los eventos.
      // Cada registro genera 1 o 2 eventos. Para garantizar limit eventos
      // tras filtrar por type, traemos el doble de registros como límite alto.
      const fetchSize = (limit + offset) * 2;

      const stays = await BovineLocationHistory.findAll({
        where,
        include: [
          {
            model: Bovine,
            as: 'bovine',
            attributes: ['id', 'earTag', 'name'],
            required: true,
          },
        ],
        order: [
          ['enteredAt', 'DESC'],
          ['exitedAt', 'DESC'],
        ],
        limit: fetchSize,
      });

      // Lookup batch de nombres de usuarios (recordedBy)
      const recordedByIds = Array.from(new Set(stays.map((s) => s.recordedBy).filter(Boolean)));
      const userNameMap = new Map<string, string>();

      if (recordedByIds.length > 0) {
        const users = await User.findAll({
          where: { id: recordedByIds },
          attributes: ['id', 'username', 'personalInfo'],
        });
        for (const u of users) {
          const uAny: any = u;
          const firstName = uAny.personalInfo?.firstName;
          const middleName = uAny.personalInfo?.middleName;
          const lastName = uAny.personalInfo?.lastName;

          const fullName = [firstName, middleName, lastName]
            .filter(Boolean)
            .join(' ')
            .trim();
          userNameMap.set(uAny.id, fullName || uAny.username || null);
        }
      }

      // Descomponer en eventos
      const events: MovementEvent[] = [];
      for (const stay of stays) {
        const bovine: any = (stay as any).bovine;
        const baseEvent = {
          historyId: stay.id,
          bovineId: stay.bovineId,
          bovineEarTag: bovine?.earTag ?? '',
          bovineName: bovine?.name ?? null,
          reason: stay.reason,
          movementType: stay.movementType,
          recordedBy: stay.recordedBy,
          recordedByName: userNameMap.get(stay.recordedBy) ?? null,
          notes: stay.notes ?? null,
        };

        // ENTRY siempre existe
        events.push({
          ...baseEvent,
          type: 'ENTRY',
          occurredAt: stay.enteredAt,
        });

        // EXIT solo si ya salió
        if (stay.exitedAt) {
          events.push({
            ...baseEvent,
            type: 'EXIT',
            occurredAt: stay.exitedAt,
          });
        }
      }

      // Filtros adicionales en memoria (sobre los eventos derivados)
      let filtered = events;
      if (options.type) {
        filtered = filtered.filter((e) => e.type === options.type);
      }
      if (options.fromDate) {
        filtered = filtered.filter((e) => e.occurredAt >= options.fromDate!);
      }
      if (options.toDate) {
        filtered = filtered.filter((e) => e.occurredAt <= options.toDate!);
      }

      // Ordenar por fecha desc
      filtered.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

      const total = filtered.length;
      const paged = filtered.slice(offset, offset + limit);

      return {
        locationId,
        total,
        limit,
        offset,
        movements: paged,
      };
    } catch (error) {
      logger.error(
        `Error obteniendo movimientos de ubicación ${locationId}`,
        this.context,
        { locationId, options },
        ensureError(error)
      );
      throw error;
    }
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const locationMovementsService = new LocationMovementsService();
