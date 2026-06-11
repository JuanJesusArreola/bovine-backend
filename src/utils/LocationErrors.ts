// utils/LocationErrors.ts

export class LocationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly cause?: Error;

  constructor(message: string, code: string = 'LOCATION_ERROR', statusCode: number = 500, cause?: Error) {
    super(message);
    this.name = 'LocationError';
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LocationError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      stack: this.stack,
      cause: this.cause?.message,
    };
  }
}

export class LocationNotFoundError extends LocationError {
  constructor(id: string) {
    super(`Ubicación con ID ${id} no encontrada`, 'LOCATION_NOT_FOUND', 404);
    this.name = 'LocationNotFoundError';
  }
}

export class LocationValidationError extends LocationError {
  constructor(message: string) {
    super(message, 'LOCATION_VALIDATION_ERROR', 400);
    this.name = 'LocationValidationError';
  }
}

export class GeofenceValidationError extends LocationError {
  constructor(message: string) {
    super(message, 'GEOFENCE_VALIDATION_ERROR', 400);
    this.name = 'GeofenceValidationError';
  }
}

/**
 * Punto fuera del perímetro del rancho.
 * Adjunta `details` con info útil para el frontend (point, ranchName, boundaryType).
 */
export class LocationOutsideRanchError extends LocationError {
  public readonly details: {
    point: { latitude: number; longitude: number };
    ranchName: string;
    ranchId: string;
    boundaryType: string;
  };

  constructor(
    point: { latitude: number; longitude: number },
    ranchName: string,
    ranchId: string,
    boundaryType: string
  ) {
    super(
      `Las coordenadas están fuera del perímetro del rancho "${ranchName}".`,
      'POINT_OUTSIDE_RANCH_BOUNDARY',
      400
    );
    this.name = 'LocationOutsideRanchError';
    this.details = { point, ranchName, ranchId, boundaryType };
  }

  toJSON() {
    return {
      ...super.toJSON(),
      details: this.details,
    };
  }
}

/*export class CapacityError extends LocationError {
  constructor(message: string) {
    super(message, 'CAPACITY_ERROR', 400);
    this.name = 'CapacityError';
  }
}*/

export class AccessDeniedError extends LocationError {
  constructor(userId: string, locationId: string) {
    super(`Usuario ${userId} no tiene acceso a la ubicación ${locationId}`, 'ACCESS_DENIED', 403);
    this.name = 'AccessDeniedError';
  }
}

export class AccessExpiredError extends LocationError {
  constructor(userId: string, locationId: string) {
    super(`Acceso expirado para usuario ${userId} a ubicación ${locationId}`, 'ACCESS_EXPIRED', 403);
    this.name = 'AccessExpiredError';
  }
}

export class RelationError extends LocationError {
  constructor(message: string) {
    super(message, 'RELATION_ERROR', 400);
    this.name = 'RelationError';
  }
}

/**
 * Intento de crear/actualizar una relación entre ubicaciones de ranchos distintos.
 * Adjunta `details` con los IDs y ranchos involucrados para que el frontend
 * pueda mostrar mensajes específicos.
 */
export class RelationCrossRanchError extends LocationError {
  public readonly details: {
    fromLocationId: string;
    fromRanchId: string;
    toLocationId: string;
    toRanchId: string;
  };

  constructor(details: {
    fromLocationId: string;
    fromRanchId: string;
    toLocationId: string;
    toRanchId: string;
  }) {
    super(
      'No se permite crear relaciones entre ubicaciones de ranchos distintos.',
      'RELATION_CROSS_RANCH',
      409
    );
    this.name = 'RelationCrossRanchError';
    this.details = details;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      details: this.details,
    };
  }
}

/**
 * Función helper para estandarizar el manejo de errores en controladores.
 * Lanza el error original si es LocationError, o lo envuelve en LocationError si no.
 */
export const handleLocationError = (error: unknown, defaultMessage: string = 'Error en operación de ubicación'): never => {
  if (error instanceof LocationError) {
    throw error;
  }
  throw new LocationError(defaultMessage, 'LOCATION_UNKNOWN_ERROR', 500, error as Error);
};

export class CapacityError extends LocationError {
  constructor(message: string, code: string = 'CAPACITY_ERROR', statusCode: number = 400, cause?: Error) {
    super(message, code, statusCode, cause);
    this.name = 'CapacityError';
  }
}

export class CapacityLimitExceededError extends CapacityError {
  constructor(locationId: string, current: number, max: number) {
    super(`Capacidad máxima excedida para ubicación ${locationId}: ${current}/${max}`, 'CAPACITY_LIMIT_EXCEEDED', 400);
    this.name = 'CapacityLimitExceededError';
  }
}

export class CapacityNegativeError extends CapacityError {
  constructor(locationId: string, current: number) {
    super(`Stock negativo no permitido para ubicación ${locationId}: ${current}`, 'CAPACITY_NEGATIVE', 400);
    this.name = 'CapacityNegativeError';
  }
}

export class AccessError extends LocationError {
  constructor(message: string, code: string = 'ACCESS_ERROR', statusCode: number = 403, cause?: Error) {
    super(message, code, statusCode, cause);
    this.name = 'AccessError';
  }
}

export class AccessNotFoundError extends AccessError {
  constructor(accessId: string) {
    super(`Acceso con ID ${accessId} no encontrado`, 'ACCESS_NOT_FOUND', 404);
    this.name = 'AccessNotFoundError';
  }
}

export class AccessAlreadyGrantedError extends AccessError {
  constructor(userId: string, locationId: string) {
    super(`El usuario ${userId} ya tiene acceso a la ubicación ${locationId}`, 'ACCESS_ALREADY_GRANTED', 409);
    this.name = 'AccessAlreadyGrantedError';
  }
}

export class AccessRevokedError extends AccessError {
  constructor(accessId: string) {
    super(`El acceso ${accessId} ya fue revocado`, 'ACCESS_REVOKED', 400);
    this.name = 'AccessRevokedError';
  }
}

export class TimeRestrictionViolationError extends AccessError {
  constructor(userId: string, locationId: string, restrictions: any) {
    super(`Restricción de tiempo violada para usuario ${userId} en ubicación ${locationId}`, 'TIME_RESTRICTION_VIOLATION', 403);
    this.name = 'TimeRestrictionViolationError';
  }
}