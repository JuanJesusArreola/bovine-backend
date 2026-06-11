// src/utils/geoUtils.ts
export const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

export const haversineDistance = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const R = 6371; // km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const getBoundingBox = (
  center: { lat: number; lng: number },
  radiusKm: number
): { north: number; south: number; east: number; west: number } => {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos(toRadians(center.lat)));
  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lng + lngDelta,
    west: center.lng - lngDelta,
  };
};

export const isPointInPolygon = (point: { lat: number; lng: number }, polygon: Array<{ lat: number; lng: number }>): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = ((yi > point.lng) != (yj > point.lng)) &&
      (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// ============================================================================
// POINT-IN-BOUNDARY — verificación contra GeofenceConfig
// ============================================================================
// Recibe un punto y un GeofenceConfig (estructura usada en Ranch.boundary y
// Location.geofenceConfig) y decide si el punto cae dentro de la forma.
//
// Convenciones de unidades (deben coincidir con el modelo):
//   - CIRCULAR.radius      → METROS
//   - RECTANGULAR.boundingBox → grados decimales (lat/lng)
//   - POLYGON.coordinates  → grados decimales
//   - CORRIDOR.width       → METROS (no implementado aquí; tratado como permisivo)
// ============================================================================

interface PointLatLng { latitude: number; longitude: number }
interface AnyBoundary {
  type: 'CIRCULAR' | 'RECTANGULAR' | 'POLYGON' | 'CORRIDOR';
  center?: PointLatLng;
  radius?: number;
  boundingBox?: { north: number; south: number; east: number; west: number };
  coordinates?: PointLatLng[];
  width?: number;
}

/**
 * Verifica si un punto está dentro de una forma definida por un GeofenceConfig.
 *
 * Si `boundary` es null/undefined, retorna `true` (modo permisivo: sin
 * boundary configurado, no se valida nada). Esto preserva el comportamiento
 * actual del backend cuando el rancho aún no tiene perímetro definido.
 */
export const isPointInBoundary = (
  point: PointLatLng,
  boundary: AnyBoundary | null | undefined
): boolean => {
  if (!boundary) return true; // permisivo

  switch (boundary.type) {
    case 'CIRCULAR': {
      if (!boundary.center || typeof boundary.radius !== 'number') return true;
      const distKm = haversineDistance(
        boundary.center.latitude, boundary.center.longitude,
        point.latitude, point.longitude
      );
      const distMeters = distKm * 1000;
      return distMeters <= boundary.radius;
    }
    case 'RECTANGULAR': {
      const bb = boundary.boundingBox;
      if (!bb) return true;
      return (
        point.latitude  >= bb.south &&
        point.latitude  <= bb.north &&
        point.longitude >= bb.west  &&
        point.longitude <= bb.east
      );
    }
    case 'POLYGON': {
      if (!boundary.coordinates || boundary.coordinates.length < 3) return true;
      const polygon = boundary.coordinates.map((c) => ({ lat: c.latitude, lng: c.longitude }));
      return isPointInPolygon({ lat: point.latitude, lng: point.longitude }, polygon);
    }
    case 'CORRIDOR': {
      // No implementamos validación de corredor por ahora — modo permisivo.
      // Cuando se requiera, calcular distancia mínima a la línea poligonal y
      // comparar con boundary.width / 2.
      return true;
    }
    default:
      return true;
  }
};