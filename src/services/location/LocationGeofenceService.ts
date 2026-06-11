// services/location/LocationGeofenceService.ts
import { Op, QueryTypes  } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import { GeofenceValidationError } from '../../utils/LocationErrors';
import { ensureError } from '../../utils/errorUtils';

import Location, { GeofenceType, Coordinates } from '../../models/Location';

export interface Point {
  latitude: number;
  longitude: number;
}

export class LocationGeofenceService {
  private readonly context = 'LocationGeofenceService';

  /**
   * Verifica si un punto está dentro de la geocerca de una ubicación.
   * @param locationId ID de la ubicación (debe tener geofenceConfig)
   * @param point Punto a verificar
   * @returns true si está dentro, false si no o si no hay geocerca
   */
  async isPointInsideGeofence(locationId: string, point: Point): Promise<boolean> {
    try {
      const location = await Location.findByPk(locationId, {
        attributes: ['id', 'geofenceConfig', 'geom'],
      });
      if (!location) {
        throw new GeofenceValidationError(`Ubicación con ID ${locationId} no encontrada`);
      }
      if (!location.geofenceConfig) {
        // Si no tiene geocerca configurada, consideramos que no hay restricción? 
        // Podríamos retornar false o true según definición. Decidimos false porque no hay geocerca definida.
        return false;
      }

      // Usar PostGIS para verificar si el punto está dentro de la geometría de la ubicación
      // La geometría puede ser un polígono, punto, etc. Para geocerca, debería ser un polígono.
      // Pero usaremos la función ST_Within con el campo geom.
      const pointGeom = sequelize.fn(
        'ST_SetSRID',
        sequelize.fn('ST_MakePoint', point.longitude, point.latitude),
        4326
      );

      const result = await Location.findOne({
        where: {
          id: locationId,
          [Op.and]: sequelize.where(
            sequelize.fn('ST_Within', pointGeom, sequelize.col('geom')),
            true
          ),
        },
        attributes: ['id'],
      });

      return !!result;
    } catch (error) {
      logger.error('Error verificando punto dentro de geocerca', this.context, { locationId, point }, ensureError(error));
      throw new GeofenceValidationError('Error al verificar punto dentro de geocerca');
    }
  }

  /**
   * Verifica si un punto está dentro de un círculo.
   * @param center Centro del círculo (lat, lon)
   * @param radius Radio en metros
   * @param point Punto a verificar
   */
  isPointInCircle(center: Point, radius: number, point: Point): boolean {
    if (radius <= 0) throw new GeofenceValidationError('El radio debe ser positivo');
    const earthRadius = 6371000; // metros
    const lat1 = this.toRadians(center.latitude);
    const lon1 = this.toRadians(center.longitude);
    const lat2 = this.toRadians(point.latitude);
    const lon2 = this.toRadians(point.longitude);

    const dlat = lat2 - lat1;
    const dlon = lon2 - lon1;

    const a = Math.sin(dlat / 2) * Math.sin(dlat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dlon / 2) * Math.sin(dlon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadius * c;

    return distance <= radius;
  }

  /**
   * Verifica si un punto está dentro de un rectángulo definido por boundingBox.
   * @param boundingBox { north, south, east, west } en grados decimales
   */
  isPointInRectangle(
    boundingBox: { north: number; south: number; east: number; west: number },
    point: Point
  ): boolean {
    const { latitude, longitude } = point;
    return (
      latitude <= boundingBox.north &&
      latitude >= boundingBox.south &&
      longitude <= boundingBox.east &&
      longitude >= boundingBox.west
    );
  }

  /**
   * Verifica si un punto está dentro de un polígono (algoritmo de ray casting).
   * @param polygon Array de puntos en orden (cierra el polígono, no necesita repetir el primero)
   */
  isPointInPolygon(polygon: Point[], point: Point): boolean {
    if (polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].longitude, yi = polygon[i].latitude;
      const xj = polygon[j].longitude, yj = polygon[j].latitude;

      const intersect = ((yi > point.latitude) !== (yj > point.latitude)) &&
        (point.longitude < (xj - xi) * (point.latitude - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Verifica si un punto está dentro de un corredor (definido por una línea y un ancho).
   * @param linePoints Array de puntos que definen la línea central del corredor
   * @param width Ancho del corredor en metros
   */
  async isPointInCorridor(linePoints: Point[], width: number, point: Point): Promise<boolean> {
    if (linePoints.length < 2) return false;
    // Convertir puntos a geometría de línea usando PostGIS para calcular distancia a la línea
    const lineWkt = this.pointsToLineWKT(linePoints);
    const pointGeom = `POINT(${point.longitude} ${point.latitude})`;

    const query = `
      SELECT ST_DWithin(
        ST_GeomFromText(:lineWkt, 4326),
        ST_GeomFromText(:pointGeom, 4326),
        :width
      ) as inside
    `;

    const [result] = await sequelize.query(query, {
      replacements: { lineWkt, pointGeom, width },
      type: QueryTypes.SELECT,
    });

    return (result as any).inside;
  }

  /**
   * Calcula la distancia mínima desde un punto a un segmento de línea.
   * @param segmentStart Inicio del segmento
   * @param segmentEnd Fin del segmento
   * @param point Punto
   * @returns Distancia en metros
   */
  distanceToSegment(segmentStart: Point, segmentEnd: Point, point: Point): number {
    // Usar fórmula de distancia punto a segmento en el plano cartesiano (aproximación)
    // Nota: Para mayor precisión se debería usar proyección, pero asumimos distancias pequeñas.
    const x1 = segmentStart.longitude;
    const y1 = segmentStart.latitude;
    const x2 = segmentEnd.longitude;
    const y2 = segmentEnd.latitude;
    const x0 = point.longitude;
    const y0 = point.latitude;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      // Segmento es un punto
      return this.haversineDistance(segmentStart, point);
    }

    // Proyección del punto sobre la línea
    const t = ((x0 - x1) * dx + (y0 - y1) * dy) / lengthSq;
    if (t < 0) {
      // Proyección más allá del inicio
      return this.haversineDistance(segmentStart, point);
    }
    if (t > 1) {
      // Proyección más allá del fin
      return this.haversineDistance(segmentEnd, point);
    }

    // Punto proyectado dentro del segmento
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    const projPoint = { latitude: projY, longitude: projX };
    return this.haversineDistance(projPoint, point);
  }

  /**
   * Obtiene el centro de una geocerca (para círculo es el centro; para polígono, el centroide).
   * @param locationId ID de la ubicación
   * @returns Centro como punto (lat, lon) o null si no tiene geocerca
   */
  async getGeofenceCenter(locationId: string): Promise<Point | null> {
    try {
      const location = await Location.findByPk(locationId, {
        attributes: ['geofenceConfig', 'geom'],
      });
      if (!location) {
        throw new GeofenceValidationError(`Ubicación con ID ${locationId} no encontrada`);
      }

      if (location.geofenceConfig?.type === GeofenceType.CIRCULAR && location.geofenceConfig.center) {
        // Si es circular, devolvemos el centro definido en la configuración
        return {
          latitude: location.geofenceConfig.center.latitude,
          longitude: location.geofenceConfig.center.longitude,
        };
      }

      // Para otros tipos, calcular centroide usando PostGIS sobre la geometría
      const result = await Location.findOne({
        where: { id: locationId },
        attributes: [
          [
            sequelize.fn('ST_X', sequelize.fn('ST_Centroid', sequelize.col('geom'))),
            'longitude',
          ],
          [
            sequelize.fn('ST_Y', sequelize.fn('ST_Centroid', sequelize.col('geom'))),
            'latitude',
          ],
        ],
        raw: true,
      });

      if (result) {
        return {
          latitude: parseFloat((result as any).latitude),
          longitude: parseFloat((result as any).longitude),
        };
      }
      return null;
    } catch (error) {
      logger.error('Error obteniendo centro de geocerca', this.context, { locationId }, ensureError(error));
      throw new GeofenceValidationError('Error al obtener centro de geocerca');
    }
  }

  // ==========================================================================
  // Utilidades privadas
  // ==========================================================================

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private haversineDistance(p1: Point, p2: Point): number {
    const R = 6371000; // metros
    const φ1 = this.toRadians(p1.latitude);
    const φ2 = this.toRadians(p2.latitude);
    const Δφ = this.toRadians(p2.latitude - p1.latitude);
    const Δλ = this.toRadians(p2.longitude - p1.longitude);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private pointsToLineWKT(points: Point[]): string {
    const coords = points.map(p => `${p.longitude} ${p.latitude}`).join(', ');
    return `LINESTRING(${coords})`;
  }
}

export const locationGeofenceService = new LocationGeofenceService();