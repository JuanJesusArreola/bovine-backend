// services/location/LocationCapacityService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import { LocationNotFoundError, CapacityError, CapacityLimitExceededError, CapacityNegativeError } from '../../utils/LocationErrors';
import { ensureError } from '../../utils/errorUtils';

import Location from '../../models/Location';
import LocationCapacity, { AreaUnit, SecurityLevel } from '../../models/LocationCapacity';
import Bovine from '../../models/Bovine';
import BovineLocationHistory from '../../models/BovineLocationHistory';
import Ranch from '../../models/Ranch';

// ============================================================================
// HELPERS — Cálculo on-the-fly de currentAnimals
// ============================================================================
// La columna LocationCapacity.currentAnimals se considera DEPRECADA.
// La fuente de verdad es BovineLocationHistory (estancias con exitedAt IS NULL).
// Estos helpers leen siempre del history.
// ============================================================================

/**
 * Cuenta animales actualmente dentro de una ubicación (estancias abiertas).
 */
async function countLiveAnimals(locationId: string): Promise<number> {
  return BovineLocationHistory.count({
    where: {
      locationId,
      exitedAt: { [Op.is]: null as any },
    },
  });
}

/**
 * Cuenta animales por ubicación para un set de IDs en una sola query.
 * Devuelve un Map<locationId, count>. Las ubicaciones sin estancias abiertas
 * no aparecen en el map (interpretar como 0).
 */
async function countLiveAnimalsBatch(
  locationIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (locationIds.length === 0) return map;

  const rows = (await BovineLocationHistory.findAll({
    attributes: [
      'locationId',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    where: {
      locationId: locationIds,
      exitedAt: { [Op.is]: null as any },
    },
    group: ['locationId'],
    raw: true,
  })) as any[];

  for (const r of rows) {
    map.set(r.locationId, parseInt(r.count, 10));
  }
  return map;
}

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface CapacityInfo {
  locationId: string;
  locationName?: string;
  maxAnimals: number;
  currentAnimals: number;
  available: number;
  occupancyPercentage: number;
  isFull: boolean;
  areaHa: number; // área en hectáreas
  carryingCapacity: number; // animales por hectárea
  waterSources: number;
  feedingStations: number;
  shelters: number;
  hasElectricity: boolean;
  hasWater: boolean;
  hasInternet: boolean;
  hasRoadAccess: boolean;
  securityLevel: string;
}

export interface CapacityStats extends CapacityInfo {
  recommendation?: string;
  lastUpdated: Date;
  updatedBy: string;
}

export interface CapacityUpsertInput {
  maxAnimals?: number;
  currentAnimals?: number;
  area?: number;
  areaUnit?: AreaUnit | string;
  carryingCapacity?: number;
  waterSources?: number;
  feedingStations?: number;
  shelters?: number;
  hasElectricity?: boolean;
  hasWater?: boolean;
  hasInternet?: boolean;
  hasRoadAccess?: boolean;
  securityLevel?: SecurityLevel | string;
}

export interface Requirements {
  minAreaHa?: number;
  minWaterSources?: number;
  minFeedingStations?: number;
  minShelters?: number;
  requiresElectricity?: boolean;
  requiresWater?: boolean;
  requiresInternet?: boolean;
  requiresRoadAccess?: boolean;
  securityLevel?: string;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class LocationCapacityService {
  private readonly context = 'LocationCapacityService';

  /**
   * Obtiene la capacidad de una ubicación.
   *
   * NOTA: el campo `currentAnimals` se sobreescribe con el conteo en vivo
   * desde BovineLocationHistory (estancias abiertas). La columna cacheada
   * está deprecada.
   */
  async getCapacity(locationId: string): Promise<LocationCapacity> {
    try {
      const capacity = await LocationCapacity.findByPk(locationId);
      if (!capacity) {
        throw new CapacityError(`No hay información de capacidad para la ubicación ${locationId}`);
      }
      // Sobreescribir con el conteo en vivo (no escribir en BD).
      const live = await countLiveAnimals(locationId);
      (capacity as any).setDataValue('currentAnimals', live);
      return capacity;
    } catch (error) {
      logger.error(`Error obteniendo capacidad para ubicación ${locationId}`, this.context, { locationId }, ensureError(error));
      throw error;
    }
  }

  /**
   * Obtiene el porcentaje de ocupación (basado en conteo en vivo).
   */
  async getOccupancyPercentage(locationId: string): Promise<number> {
    const capacity = await LocationCapacity.findByPk(locationId);
    if (!capacity) {
      throw new CapacityError(`No hay información de capacidad para la ubicación ${locationId}`);
    }
    if (capacity.maxAnimals === 0) return 0;
    const current = await countLiveAnimals(locationId);
    return (current / capacity.maxAnimals) * 100;
  }

  /**
   * Verifica si la ubicación está a máxima capacidad (basado en conteo en vivo).
   */
  async isAtCapacity(locationId: string): Promise<boolean> {
    const capacity = await LocationCapacity.findByPk(locationId);
    if (!capacity) {
      throw new CapacityError(`No hay información de capacidad para la ubicación ${locationId}`);
    }
    const current = await countLiveAnimals(locationId);
    return current >= capacity.maxAnimals;
  }

  /**
   * Obtiene la capacidad disponible (animales que aún pueden entrar).
   * Basado en conteo en vivo desde BovineLocationHistory.
   */
  async getAvailableCapacity(locationId: string): Promise<number> {
    const capacity = await LocationCapacity.findByPk(locationId);
    if (!capacity) {
      throw new CapacityError(`No hay información de capacidad para la ubicación ${locationId}`);
    }
    const current = await countLiveAnimals(locationId);
    return Math.max(0, capacity.maxAnimals - current);
  }

  // ==========================================================================
  // INCREMENT / DECREMENT — DEPRECADOS
  // ==========================================================================
  // currentAnimals ya no se calcula desde un caché; se deriva en vivo de
  // BovineLocationHistory. Estos métodos quedan como no-op para compatibilidad
  // con código que aún los llame (p. ej. flujos antiguos de registerEntry/Exit).
  // El controlador HTTP responde 410 Gone.
  // ==========================================================================

  /**
   * @deprecated Usar BovineLocationHistory (registerEntry) como fuente de verdad.
   * No-op: ya no escribe la columna cacheada `currentAnimals`.
   */
  async incrementAnimals(
    locationId: string,
    _amount: number = 1,
    _userId: string,
    _transaction?: Transaction
  ): Promise<LocationCapacity> {
    logger.warn(
      `incrementAnimals() es deprecado — currentAnimals se calcula on-the-fly desde BovineLocationHistory`,
      this.context,
      { locationId }
    );
    return this.getCapacity(locationId);
  }

  /**
   * @deprecated Usar BovineLocationHistory (registerExit) como fuente de verdad.
   * No-op: ya no escribe la columna cacheada `currentAnimals`.
   */
  async decrementAnimals(
    locationId: string,
    _amount: number = 1,
    _userId: string,
    _transaction?: Transaction
  ): Promise<LocationCapacity> {
    logger.warn(
      `decrementAnimals() es deprecado — currentAnimals se calcula on-the-fly desde BovineLocationHistory`,
      this.context,
      { locationId }
    );
    return this.getCapacity(locationId);
  }

  /**
   * Verifica si una ubicación cumple con los requisitos mínimos.
   * @param locationId ID de la ubicación
   * @param requirements Requisitos a verificar
   */
  async meetsRequirements(locationId: string, requirements: Requirements): Promise<{ meets: boolean; missing: string[] }> {
    const capacity = await this.getCapacity(locationId);
    const missing: string[] = [];

    if (requirements.minAreaHa !== undefined) {
      const areaHa = this.convertToHa(capacity.area, capacity.areaUnit);
      if (areaHa < requirements.minAreaHa) missing.push(`Área mínima requerida: ${requirements.minAreaHa} ha (actual: ${areaHa} ha)`);
    }
    if (requirements.minWaterSources !== undefined && capacity.waterSources < requirements.minWaterSources) {
      missing.push(`Fuentes de agua mínimas: ${requirements.minWaterSources} (actual: ${capacity.waterSources})`);
    }
    if (requirements.minFeedingStations !== undefined && capacity.feedingStations < requirements.minFeedingStations) {
      missing.push(`Estaciones de alimentación mínimas: ${requirements.minFeedingStations} (actual: ${capacity.feedingStations})`);
    }
    if (requirements.minShelters !== undefined && capacity.shelters < requirements.minShelters) {
      missing.push(`Refugios mínimos: ${requirements.minShelters} (actual: ${capacity.shelters})`);
    }
    if (requirements.requiresElectricity && !capacity.hasElectricity) missing.push('Requiere electricidad');
    if (requirements.requiresWater && !capacity.hasWater) missing.push('Requiere acceso a agua');
    if (requirements.requiresInternet && !capacity.hasInternet) missing.push('Requiere internet');
    if (requirements.requiresRoadAccess && !capacity.hasRoadAccess) missing.push('Requiere acceso por carretera');
    if (requirements.securityLevel && capacity.securityLevel !== requirements.securityLevel) {
      missing.push(`Nivel de seguridad: requiere ${requirements.securityLevel} (actual: ${capacity.securityLevel})`);
    }

    return { meets: missing.length === 0, missing };
  }

  /**
   * Obtiene estadísticas completas de capacidad.
   */
  async getCapacityStats(locationId: string): Promise<CapacityStats> {
    try {
      const capacity = await LocationCapacity.findByPk(locationId);
      if (!capacity) {
        throw new CapacityError(`No hay información de capacidad para la ubicación ${locationId}`);
      }
      const location = await Location.findByPk(locationId, { attributes: ['id', 'name'] });
      const areaHa = this.convertToHa(capacity.area, capacity.areaUnit);
      const maxAnimals = capacity.maxAnimals;
      // Conteo en vivo desde BovineLocationHistory
      const currentAnimals = await countLiveAnimals(locationId);
      const available = Math.max(0, maxAnimals - currentAnimals);
      const occupancyPercentage = maxAnimals === 0 ? 0 : (currentAnimals / maxAnimals) * 100;
      const isFull = currentAnimals >= maxAnimals;

      // Calcular recomendación simple
      let recommendation: string | undefined;
      if (occupancyPercentage > 90) {
        recommendation = 'Ocupación muy alta. Considere aumentar capacidad máxima o reducir animales.';
      } else if (occupancyPercentage < 20 && maxAnimals > 0) {
        recommendation = 'Ocupación baja. Podría reducir capacidad máxima para optimizar recursos.';
      } else {
        recommendation = 'Ocupación adecuada.';
      }

      const stats: CapacityStats = {
        locationId,
        locationName: location?.name,
        maxAnimals,
        currentAnimals,
        available,
        occupancyPercentage,
        isFull,
        areaHa,
        carryingCapacity: capacity.carryingCapacity,
        waterSources: capacity.waterSources,
        feedingStations: capacity.feedingStations,
        shelters: capacity.shelters,
        hasElectricity: capacity.hasElectricity,
        hasWater: capacity.hasWater,
        hasInternet: capacity.hasInternet,
        hasRoadAccess: capacity.hasRoadAccess,
        securityLevel: capacity.securityLevel,
        recommendation,
        lastUpdated: capacity.lastUpdated,
        updatedBy: capacity.updatedBy,
      };
      return stats;
    } catch (error) {
      logger.error(`Error obteniendo estadísticas de capacidad para ubicación ${locationId}`, this.context, { locationId }, ensureError(error));
      throw error;
    }
  }

  /**
   * Recomienda ajustes de capacidad basados en métricas.
   * Por ahora, solo devuelve una recomendación textual.
   */
  async recommendCapacityAdjustment(locationId: string): Promise<string> {
    const stats = await this.getCapacityStats(locationId);
    return stats.recommendation || 'No se requiere ajuste.';
  }

  // ==========================================================================
  // CREATE / UPDATE / UPSERT
  // ==========================================================================

  /**
   * Crea el registro de capacidad para una ubicación.
   * Lanza error si ya existe (usa upsertCapacity o updateCapacity en su lugar).
   */
  async createCapacity(
    locationId: string,
    data: Partial<CapacityUpsertInput>,
    userId: string
  ): Promise<LocationCapacity> {
    // Validar que la ubicación exista
    const location = await Location.findByPk(locationId);
    if (!location) {
      throw new LocationNotFoundError(locationId);
    }

    // Verificar que NO exista ya
    const existing = await LocationCapacity.findByPk(locationId);
    if (existing) {
      throw new CapacityError(
        `Ya existe un registro de capacidad para la ubicación ${locationId}. Usa PUT para actualizar.`
      );
    }

    this.validateCapacityInput(data);

    // Validación cruzada: la suma de maxAnimals de las locations del rancho
    // no debe exceder Ranch.maxCattleCapacity.
    await this.validateRanchCapacityNotExceeded(
      (location as any).ranchId,
      data.maxAnimals ?? 0,
      0 // no hay registro previo
    );

    const created = await LocationCapacity.create({
      locationId,
      maxAnimals: data.maxAnimals ?? 0,
      // currentAnimals es deprecado: siempre 0 al crear; el valor real
      // se calcula on-the-fly desde BovineLocationHistory.
      currentAnimals: 0,
      area: data.area ?? 0,
      areaUnit: (data.areaUnit as AreaUnit) ?? AreaUnit.HA,
      carryingCapacity: data.carryingCapacity ?? 0,
      waterSources: data.waterSources ?? 0,
      feedingStations: data.feedingStations ?? 0,
      shelters: data.shelters ?? 0,
      hasElectricity: data.hasElectricity ?? false,
      hasWater: data.hasWater ?? false,
      hasInternet: data.hasInternet ?? false,
      hasRoadAccess: data.hasRoadAccess ?? false,
      securityLevel: (data.securityLevel as SecurityLevel) ?? SecurityLevel.MEDIUM,
      lastUpdated: new Date(),
      updatedBy: userId,
    } as any);

    logger.info(`Capacidad creada para ubicación ${locationId}`, this.context, { locationId, userId });
    return created;
  }

  /**
   * Actualiza el registro de capacidad existente.
   * Lanza 404 si no existe.
   */
  async updateCapacity(
    locationId: string,
    data: Partial<CapacityUpsertInput>,
    userId: string
  ): Promise<LocationCapacity> {
    const capacity = await LocationCapacity.findByPk(locationId);
    if (!capacity) {
      throw new CapacityError(
        `No existe capacidad para la ubicación ${locationId}. Usa POST para crear.`
      );
    }

    this.validateCapacityInput(data, capacity);

    // Validación cruzada: si cambia maxAnimals, verificar que la nueva suma
    // no exceda Ranch.maxCattleCapacity.
    if (data.maxAnimals !== undefined && data.maxAnimals !== capacity.maxAnimals) {
      const location = await Location.findByPk(locationId, { attributes: ['ranchId'] });
      if (location) {
        await this.validateRanchCapacityNotExceeded(
          (location as any).ranchId,
          data.maxAnimals,
          capacity.maxAnimals // descontar el valor anterior
        );
      }
    }

    // Aplicar solo los campos enviados
    if (data.maxAnimals !== undefined) capacity.maxAnimals = data.maxAnimals;
    // currentAnimals es deprecado: se ignora si llega en el body.
    // El valor real se calcula on-the-fly desde BovineLocationHistory.
    if (data.area !== undefined) capacity.area = data.area;
    if (data.areaUnit !== undefined) capacity.areaUnit = data.areaUnit as AreaUnit;
    if (data.carryingCapacity !== undefined) capacity.carryingCapacity = data.carryingCapacity;
    if (data.waterSources !== undefined) capacity.waterSources = data.waterSources;
    if (data.feedingStations !== undefined) capacity.feedingStations = data.feedingStations;
    if (data.shelters !== undefined) capacity.shelters = data.shelters;
    if (data.hasElectricity !== undefined) capacity.hasElectricity = data.hasElectricity;
    if (data.hasWater !== undefined) capacity.hasWater = data.hasWater;
    if (data.hasInternet !== undefined) capacity.hasInternet = data.hasInternet;
    if (data.hasRoadAccess !== undefined) capacity.hasRoadAccess = data.hasRoadAccess;
    if (data.securityLevel !== undefined) capacity.securityLevel = data.securityLevel as SecurityLevel;

    capacity.lastUpdated = new Date();
    capacity.updatedBy = userId;

    await capacity.save();

    logger.info(`Capacidad actualizada para ubicación ${locationId}`, this.context, { locationId, userId });
    return capacity;
  }

  /**
   * Upsert: crea si no existe, actualiza si existe.
   * Útil para el frontend que no sabe si ya se creó el registro.
   */
  /**
   * Devuelve la ocupación actual de una ubicación: cuántos animales hay,
   * cuántos caben, cuántos lugares libres y el porcentaje de ocupación.
   */
  async getCurrentOccupancy(locationId: string): Promise<{
    locationId: string;
    locationName?: string;
    currentAnimals: number;
    maxAnimals: number;
    available: number;
    percentage: number;
    isFull: boolean;
  }> {
    const location = await Location.findByPk(locationId, {
      attributes: ['id', 'name'],
    });
    if (!location) {
      throw new LocationNotFoundError(locationId);
    }

    const capacity = await LocationCapacity.findByPk(locationId);
    // Conteo en vivo desde BovineLocationHistory (fuente de verdad).
    // Si no hay registro de capacidad, maxAnimals = 0 pero currentAnimals
    // sigue siendo el real (puede haber bovinos en ubicación sin capacity configurada).
    const currentAnimals = await countLiveAnimals(locationId);
    const maxAnimals = capacity?.maxAnimals ?? 0;
    const available = Math.max(0, maxAnimals - currentAnimals);
    const percentage = maxAnimals > 0 ? (currentAnimals / maxAnimals) * 100 : 0;

    return {
      locationId,
      locationName: (location as any).name,
      currentAnimals,
      maxAnimals,
      available,
      percentage: Math.round(percentage * 100) / 100,
      isFull: maxAnimals > 0 && currentAnimals >= maxAnimals,
    };
  }

  /**
   * Suma las ocupaciones actuales de todas las ubicaciones de un rancho.
   * Devuelve el total agregado + desglose por ubicación.
   */
  async getRanchOccupancy(ranchId: string): Promise<{
    ranchId: string;
    totalCurrentAnimals: number;
    totalMaxAnimals: number;
    totalAvailable: number;
    averagePercentage: number;
    locationsCount: number;
    locationsWithCapacity: number;
    locations: Array<{
      locationId: string;
      locationName?: string;
      currentAnimals: number;
      maxAnimals: number;
      available: number;
      percentage: number;
      isFull: boolean;
    }>;
  }> {
    // Traer todas las ubicaciones del rancho
    const locations = await Location.findAll({
      where: { ranchId },
      attributes: ['id', 'name'],
    });

    if (locations.length === 0) {
      return {
        ranchId,
        totalCurrentAnimals: 0,
        totalMaxAnimals: 0,
        totalAvailable: 0,
        averagePercentage: 0,
        locationsCount: 0,
        locationsWithCapacity: 0,
        locations: [],
      };
    }

    const locationIds = locations.map((l) => (l as any).id);

    // Una sola query para todos los registros de capacity
    const capacities = await LocationCapacity.findAll({
      where: { locationId: locationIds },
    });
    const capacityMap = new Map(capacities.map((c) => [c.locationId, c]));

    // Una sola query para todos los conteos en vivo (desde BovineLocationHistory)
    const liveCountMap = await countLiveAnimalsBatch(locationIds);

    const locationDetails = locations.map((loc) => {
      const id = (loc as any).id;
      const cap = capacityMap.get(id);
      const currentAnimals = liveCountMap.get(id) ?? 0;
      const maxAnimals = cap?.maxAnimals ?? 0;
      const available = Math.max(0, maxAnimals - currentAnimals);
      const percentage = maxAnimals > 0 ? (currentAnimals / maxAnimals) * 100 : 0;
      return {
        locationId: id,
        locationName: (loc as any).name,
        currentAnimals,
        maxAnimals,
        available,
        percentage: Math.round(percentage * 100) / 100,
        isFull: maxAnimals > 0 && currentAnimals >= maxAnimals,
      };
    });

    const totalCurrentAnimals = locationDetails.reduce((s, l) => s + l.currentAnimals, 0);
    const totalMaxAnimals = locationDetails.reduce((s, l) => s + l.maxAnimals, 0);
    const totalAvailable = Math.max(0, totalMaxAnimals - totalCurrentAnimals);
    const averagePercentage =
      totalMaxAnimals > 0 ? (totalCurrentAnimals / totalMaxAnimals) * 100 : 0;

    return {
      ranchId,
      totalCurrentAnimals,
      totalMaxAnimals,
      totalAvailable,
      averagePercentage: Math.round(averagePercentage * 100) / 100,
      locationsCount: locations.length,
      locationsWithCapacity: capacities.length,
      locations: locationDetails,
    };
  }

  async upsertCapacity(
    locationId: string,
    data: Partial<CapacityUpsertInput>,
    userId: string
  ): Promise<{ capacity: LocationCapacity; created: boolean }> {
    const existing = await LocationCapacity.findByPk(locationId);
    if (existing) {
      const updated = await this.updateCapacity(locationId, data, userId);
      return { capacity: updated, created: false };
    } else {
      const created = await this.createCapacity(locationId, data, userId);
      return { capacity: created, created: true };
    }
  }

  // ==========================================================================
  // Métodos auxiliares
  // ==========================================================================

  /**
   * Valida invariantes de entrada para create/update.
   * @param data entrada parcial
   * @param existing opcional: registro actual para validar contra valores no enviados
   */
  private validateCapacityInput(
    data: Partial<CapacityUpsertInput>,
    existing?: LocationCapacity
  ): void {
    const max = data.maxAnimals ?? existing?.maxAnimals ?? 0;
    const area = data.area ?? existing?.area ?? 0;

    if (max < 0) throw new CapacityError('maxAnimals no puede ser negativo');
    if (area < 0) throw new CapacityError('area no puede ser negativa');
    // NOTA: ya no validamos current vs max aquí. currentAnimals es deprecado;
    // el conteo real viene de BovineLocationHistory. Si quieres bloquear
    // entradas que excedan la capacidad, hazlo en el flujo de registerEntry.
    if (data.waterSources !== undefined && data.waterSources < 0) {
      throw new CapacityError('waterSources no puede ser negativo');
    }
    if (data.feedingStations !== undefined && data.feedingStations < 0) {
      throw new CapacityError('feedingStations no puede ser negativo');
    }
    if (data.shelters !== undefined && data.shelters < 0) {
      throw new CapacityError('shelters no puede ser negativo');
    }
    if (data.areaUnit !== undefined && !Object.values(AreaUnit).includes(data.areaUnit as AreaUnit)) {
      throw new CapacityError(`areaUnit inválido. Permitidos: ${Object.values(AreaUnit).join(', ')}`);
    }
    if (
      data.securityLevel !== undefined &&
      !Object.values(SecurityLevel).includes(data.securityLevel as SecurityLevel)
    ) {
      throw new CapacityError(
        `securityLevel inválido. Permitidos: ${Object.values(SecurityLevel).join(', ')}`
      );
    }
  }

  /**
   * Valida que la suma de maxAnimals de todas las locations del rancho
   * (con el nuevo valor propuesto) no exceda Ranch.maxCattleCapacity.
   *
   * @param ranchId        rancho al que pertenece la location
   * @param newMaxAnimals  nuevo maxAnimals propuesto para esta location
   * @param previousValue  maxAnimals anterior de esta location (0 si está creando)
   */
  private async validateRanchCapacityNotExceeded(
    ranchId: string,
    newMaxAnimals: number,
    previousValue: number
  ): Promise<void> {
    const ranch = await Ranch.findByPk(ranchId, {
      attributes: ['id', 'maxCattleCapacity', 'name'],
    });
    if (!ranch) return; // si el rancho no existe, otra validación lo capturará

    // Suma actual de maxAnimals en TODAS las locations del rancho
    const result = (await LocationCapacity.findAll({
      attributes: [
        [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('max_animals')), 0), 'total'],
      ],
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
    const currentSum = parseInt(result[0]?.total ?? '0', 10);

    // Suma proyectada con el cambio
    const projectedSum = currentSum - previousValue + newMaxAnimals;

    if (projectedSum > (ranch as any).maxCattleCapacity) {
      throw new CapacityError(
        `La suma de maxAnimals de las locations del rancho (${projectedSum}) ` +
        `excedería la capacidad máxima del rancho "${(ranch as any).name}" ` +
        `(${(ranch as any).maxCattleCapacity}). Reduce maxAnimals o aumenta ` +
        `Ranch.maxCattleCapacity primero.`
      );
    }
  }

  private convertToHa(area: number, unit: string): number {
    if (unit === 'HA') return area;
    if (unit === 'M2') return area / 10000;
    if (unit === 'ACRE') return area * 0.404686;
    return area;
  }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const locationCapacityService = new LocationCapacityService();