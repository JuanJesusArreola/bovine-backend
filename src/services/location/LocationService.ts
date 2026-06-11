// services/location/LocationService.ts
import { Op, Transaction, Sequelize } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import { LocationError, LocationNotFoundError, LocationValidationError, LocationOutsideRanchError } from '../../utils/LocationErrors';
import { ensureError } from '../../utils/errorUtils';
import { isPointInBoundary } from '../../utils/geoUtils';

import Location, {
  LocationAttributes,
  LocationCreationAttributes,
  LocationType,
  LocationStatus,
  GeofenceType,
  Coordinates,
} from '../../models/Location';
import Ranch from '../../models/Ranch';
import LocationCapacity from '../../models/LocationCapacity';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Subquery literal que calcula `currentAnimals` on-the-fly desde
 * BovineLocationHistory (estancias abiertas, exitedAt IS NULL).
 *
 * Se usa en los `attributes.include` del `LocationCapacity` cuando éste
 * se eager-loadea desde Location. Sequelize alias la tabla padre como
 * `"Location"`, por eso la subquery referencia `"Location"."id"`.
 */
const buildCurrentAnimalsLiteral = () =>
  sequelize.literal(`(
    SELECT COUNT(*)::int
    FROM bovine_location_history bh
    WHERE bh.location_id = "Location"."id"
      AND bh.exited_at IS NULL
      AND bh.deleted_at IS NULL
  )`);

/**
 * Include estándar de capacity con currentAnimals calculado on-the-fly.
 * NO lee la columna cacheada current_animals (deprecada).
 */
const capacityIncludeWithLiveCount = () => ({
  model: LocationCapacity,
  as: 'capacity' as const,
  required: false,
  attributes: {
    exclude: ['currentAnimals'],
    include: [
      [buildCurrentAnimalsLiteral(), 'currentAnimals'] as any,
    ],
  },
});

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface CreateLocationDTO {
  locationCode: string;
  name: string;
  ranchId: string;
  type: LocationType;
  coordinates: Coordinates;
  geom?: any; // Geometry, se puede construir a partir de coordinates
  geofenceConfig?: any;
  parentLocationId?: string;
  weatherStationId?: string;
  soilType?: string;
  elevation?: number;
  slope?: number;
  vegetation?: string[];
  waterSources?: any[];
  pastureQuality?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  status?: LocationStatus;
  isActive?: boolean;
  createdBy: string;
}

export interface UpdateLocationDTO extends Partial<CreateLocationDTO> {
  id: string;
  updatedBy: string;
}

export interface LocationFilters {
  ranchId?: string;
  type?: LocationType[];
  status?: LocationStatus[];
  isActive?: boolean;
  parentLocationId?: string | null; // null para buscar las que no tienen padre
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

export interface LocationSummary {
  id: string;
  locationCode: string;
  name: string;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  coordinates: Coordinates;
  parentLocationId?: string;
  ranchId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Capacidades (opcional, se pueden agregar después con joins)
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class LocationService {
  private readonly context = 'LocationService';

  // ==========================================================================
  // CRUD BÁSICO
  // ==========================================================================

  async createLocation(data: CreateLocationDTO, transaction?: Transaction): Promise<Location> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      // Verificar que el código no exista
      const existing = await Location.findOne({ where: { locationCode: data.locationCode }, transaction: t });
      if (existing) {
        throw new LocationValidationError(`Ya existe una ubicación con código ${data.locationCode}`);
      }

      // Verificar que el rancho existe
      const ranch = await Ranch.findByPk(data.ranchId, { transaction: t });
      if (!ranch) {
        throw new LocationValidationError(`Rancho con ID ${data.ranchId} no encontrado`);
      }

      // ================================================================
      // VALIDACIÓN POINT-IN-BOUNDARY (defensa en profundidad)
      // ================================================================
      // Si el rancho tiene un boundary configurado (POLYGON, RECTANGULAR,
      // CIRCULAR), verificamos que las coordenadas de la nueva location
      // caigan dentro. Si el rancho no tiene boundary, modo permisivo
      // (igual que hoy con boundaryRadius).
      this.validatePointInRanchBoundary(data.coordinates, ranch);

      // Construir el objeto de creación
      const locationData: LocationCreationAttributes = {
        locationCode: data.locationCode,
        name: data.name,
        ranchId: data.ranchId,
        type: data.type,
        coordinates: data.coordinates,
        // Construir geom a partir de coordinates (punto)
        geom: {
          type: 'Point',
          coordinates: [data.coordinates.longitude, data.coordinates.latitude],
        },
        geofenceConfig: data.geofenceConfig,
        parentLocationId: data.parentLocationId,
        weatherStationId: data.weatherStationId,
        soilType: data.soilType,
        elevation: data.elevation,
        slope: data.slope,
        vegetation: data.vegetation,
        waterSources: data.waterSources,
        pastureQuality: data.pastureQuality,
        status: data.status || LocationStatus.ACTIVE,
        isActive: data.isActive ?? true,
        createdBy: data.createdBy,
      };

      const location = await Location.create(locationData, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Ubicación creada: ${location.id}`, this.context, {
        locationId: location.id,
        code: location.locationCode,
        ranchId: data.ranchId,
        createdBy: data.createdBy,
        durationMs: Date.now() - startTime,
      });

      return location;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error('Error creando ubicación', this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async updateLocation(data: UpdateLocationDTO, transaction?: Transaction): Promise<Location> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const location = await Location.findByPk(data.id, { transaction: t });
      if (!location) {
        throw new LocationNotFoundError(data.id);
      }

      // Si se cambia el código, verificar duplicado
      if (data.locationCode && data.locationCode !== location.locationCode) {
        const existing = await Location.findOne({ where: { locationCode: data.locationCode }, transaction: t });
        if (existing) {
          throw new LocationValidationError(`Ya existe una ubicación con código ${data.locationCode}`);
        }
      }

      // Si se cambia la coordenada, actualizar geom también
      const updateData: any = { ...data };
      if (data.coordinates) {
        // Validación point-in-boundary contra el rancho dueño de la location.
        // Usamos el ranchId actual del registro (no el del payload) por
        // seguridad: el ranchId de una location no debería cambiar via update.
        const ranch = await Ranch.findByPk(location.ranchId, { transaction: t });
        if (ranch) {
          this.validatePointInRanchBoundary(data.coordinates, ranch);
        }

        updateData.geom = {
          type: 'Point',
          coordinates: [data.coordinates.longitude, data.coordinates.latitude],
        };
      }

      await location.update(updateData, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Ubicación actualizada: ${data.id}`, this.context, {
        locationId: data.id,
        updatedBy: data.updatedBy,
        durationMs: Date.now() - startTime,
      });

      return location;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error actualizando ubicación ${data.id}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async deleteLocation(id: string, deletedBy: string): Promise<void> {
    const transaction = await sequelize.transaction();
    const startTime = Date.now();

    try {
      const location = await Location.findByPk(id, { transaction });
      if (!location) {
        throw new LocationNotFoundError(id);
      }

      await location.destroy({ transaction });
      await transaction.commit();

      logger.info(`Ubicación eliminada (soft): ${id}`, this.context, {
        locationId: id,
        deletedBy,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error eliminando ubicación ${id}`, this.context, { id }, ensureError(error));
      throw error;
    }
  }

  async getLocationById(id: string): Promise<Location | null> {
    try {
      return await Location.findByPk(id, {
        include: [
          {
            model: Ranch,
            as: 'ranch',
            attributes: ['id', 'name', 'ranchCode'],
          },
          capacityIncludeWithLiveCount(),
        ],
      });
    } catch (error) {
      logger.error(`Error obteniendo ubicación por ID ${id}`, this.context, { id }, ensureError(error));
      throw error;
    }
  }

  async listLocations(filters: LocationFilters = {}): Promise<{ rows: Location[]; count: number }> {
    try {
      const where: any = {};

      if (filters.ranchId) where.ranchId = filters.ranchId;
      if (filters.type?.length) where.type = { [Op.in]: filters.type };
      if (filters.status?.length) where.status = { [Op.in]: filters.status };
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      if (filters.parentLocationId !== undefined) {
        // Si es null, buscamos las que no tienen padre (raíz)
        where.parentLocationId = filters.parentLocationId === null ? { [Op.is]: null } : filters.parentLocationId;
      }
      if (filters.searchTerm) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${filters.searchTerm}%` } },
          { locationCode: { [Op.iLike]: `%${filters.searchTerm}%` } },
        ];
      }

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const { rows, count } = await Location.findAndCountAll({
        where,
        limit,
        offset,
        order: [['name', 'ASC']],
        include: [
          {
            model: Ranch,
            as: 'ranch',
            attributes: ['id', 'name'],
          },
          capacityIncludeWithLiveCount(),
        ],
        // distinct evita inflado del count cuando hay includes con LEFT JOIN
        distinct: true,
      });

      logger.debug(`Ubicaciones listadas`, this.context, { count, filters });
      return { rows, count };
    } catch (error) {
      logger.error('Error listando ubicaciones', this.context, { filters }, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // VALIDACIÓN POINT-IN-BOUNDARY
  // ==========================================================================

  /**
   * Verifica que un punto (coordinates) caiga dentro del perímetro del rancho.
   *
   * Modo de operación:
   *  - Si `ranch.boundary` está configurado (POLYGON/RECTANGULAR/CIRCULAR/CORRIDOR)
   *    se evalúa con `isPointInBoundary`. Si el punto cae fuera lanza
   *    `LocationOutsideRanchError` (400, code POINT_OUTSIDE_RANCH_BOUNDARY).
   *
   *  - Si NO tiene `boundary` pero sí `boundaryRadius` (legacy en km),
   *    se construye un boundary CIRCULAR sintético usando
   *    `ranch.coordinates` como centro y se valida igual.
   *
   *  - Si no tiene ni boundary ni boundaryRadius → modo permisivo (no valida).
   *
   * Esta validación es defensa en profundidad: aunque el frontend ya bloquee
   * visualmente, cualquier llamada directa al API (curl, Postman, scripts,
   * mobile app, race conditions con cambios de boundary) debe ser bloqueada
   * aquí.
   */
  private validatePointInRanchBoundary(point: Coordinates, ranch: Ranch): void {
    const r: any = ranch;
    let boundary: any = r.boundary;

    // Fallback: si no hay boundary pero hay boundaryRadius, construir uno CIRCULAR
    if (!boundary && r.boundaryRadius && r.coordinates) {
      boundary = {
        type: 'CIRCULAR',
        center: {
          latitude: r.coordinates.latitude,
          longitude: r.coordinates.longitude,
        },
        radius: r.boundaryRadius * 1000, // km → metros
      };
    }

    // Sin boundary y sin boundaryRadius → permisivo (no valida)
    if (!boundary) return;

    const inside = isPointInBoundary(point, boundary);
    if (!inside) {
      throw new LocationOutsideRanchError(
        { latitude: point.latitude, longitude: point.longitude },
        r.name,
        r.id,
        boundary.type
      );
    }
  }

  // ==========================================================================
  // MÉTODOS GEOESPACIALES
  // ==========================================================================

  /**
   * Calcula la distancia en metros entre dos ubicaciones usando PostGIS.
   */
  async calculateDistance(locationId1: string, locationId2: string): Promise<number | null> {
    try {
      const result = await Location.findOne({
        where: { id: locationId1 },
        attributes: [
          [
            sequelize.fn(
              'ST_DistanceSphere',
              sequelize.col('geom'),
              sequelize.literal(`(SELECT geom FROM locations WHERE id = '${locationId2}')`)
            ),
            'distance',
          ],
        ],
        raw: true,
      });

      return result ? parseFloat((result as any).distance) : null;
    } catch (error) {
      logger.error('Error calculando distancia', this.context, { locationId1, locationId2 }, ensureError(error));
      throw error;
    }
  }

  /**
   * Obtiene ubicaciones cercanas a un punto (lat, lon) dentro de un radio en metros.
   */
  async getNearbyLocations(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    filters?: Omit<LocationFilters, 'limit' | 'offset'>
  ): Promise<Location[]> {
    try {
      const point = `POINT(${longitude} ${latitude})`;
      const where: any = {
        [Op.and]: [
          sequelize.where(
            sequelize.fn('ST_DWithin', sequelize.col('geom'), sequelize.fn('ST_GeomFromText', point, 4326), radiusMeters),
            true
          ),
        ],
      };

      if (filters?.ranchId) where.ranchId = filters.ranchId;
      if (filters?.type?.length) where.type = { [Op.in]: filters.type };
      if (filters?.status?.length) where.status = { [Op.in]: filters.status };
      if (filters?.isActive !== undefined) where.isActive = filters.isActive;

      const locations = await Location.findAll({
        where,
        order: [
          [
            sequelize.fn('ST_Distance', sequelize.col('geom'), sequelize.fn('ST_GeomFromText', point, 4326)),
            'ASC',
          ],
        ],
        include: [{ model: Ranch, as: 'ranch', attributes: ['id', 'name'] }],
      });

      return locations;
    } catch (error) {
      logger.error('Error obteniendo ubicaciones cercanas', this.context, { latitude, longitude, radiusMeters }, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // UTILIDADES DE ETIQUETAS
  // ==========================================================================

  getLocationTypeLabel(type: LocationType): string {
    const labels: Record<LocationType, string> = {
      PASTURE: 'Pastizal',
      CORRAL: 'Corral',
      BARN: 'Establo',
      MILKING_PARLOR: 'Sala de ordeño',
      FEED_AREA: 'Área de alimentación',
      WATER_SOURCE: 'Fuente de agua',
      VETERINARY_CLINIC: 'Clínica veterinaria',
      QUARANTINE_AREA: 'Área de cuarentena',
      LOADING_AREA: 'Área de carga',
      STORAGE: 'Almacén',
      OFFICE: 'Oficina',
      RESIDENTIAL: 'Área residencial',
      PROCESSING_PLANT: 'Planta de procesamiento',
      MARKET: 'Mercado',
      SLAUGHTERHOUSE: 'Rastro',
      BREEDING_CENTER: 'Centro de reproducción',
      LABORATORY: 'Laboratorio',
      WASTE_MANAGEMENT: 'Manejo de residuos',
      EQUIPMENT_SHED: 'Bodega de equipos',
      REPAIR_SHOP: 'Taller de reparaciones',
      FUEL_STATION: 'Estación de combustible',
      ENTRANCE_GATE: 'Puerta de entrada',
      SECURITY_POST: 'Puesto de seguridad',
      EMERGENCY_POINT: 'Punto de emergencia',
      RESTRICTED_AREA: 'Área restringida',
      DANGER_ZONE: 'Zona de peligro',
      SAFE_ZONE: 'Zona segura',
      ROUTE: 'Ruta',
      CHECKPOINT: 'Punto de control',
      OTHER: 'Otro',
    };
    return labels[type] || type;
  }

  getStatusLabel(status: LocationStatus): string {
    const labels: Record<LocationStatus, string> = {
      ACTIVE: 'Activa',
      INACTIVE: 'Inactiva',
      UNDER_CONSTRUCTION: 'En construcción',
      UNDER_MAINTENANCE: 'En mantenimiento',
      QUARANTINED: 'En cuarentena',
      FLOODED: 'Inundada',
      DAMAGED: 'Dañada',
      CLOSED: 'Cerrada',
      RESTRICTED: 'Restringida',
    };
    return labels[status] || status;
  }

  // ==========================================================================
  // RESUMEN
  // ==========================================================================

  getLocationSummary(location: Location): LocationSummary {
    return {
      id: location.id,
      locationCode: location.locationCode,
      name: location.name,
      type: location.type,
      typeLabel: this.getLocationTypeLabel(location.type),
      status: location.status,
      statusLabel: this.getStatusLabel(location.status),
      coordinates: location.coordinates,
      parentLocationId: location.parentLocationId || undefined,
      ranchId: location.ranchId,
      isActive: location.isActive,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
    };
  }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const locationService = new LocationService();