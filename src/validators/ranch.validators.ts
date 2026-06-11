// validators/ranch.validators.ts
/**
 * ============================================================================
 * VALIDADORES DEL MÓDULO DE RANCHOS
 * ============================================================================
 *
 * Cubre las dos operaciones principales del CRUD de ranchos:
 *   1. createRanch → todos los campos requeridos del modelo Ranch
 *   2. updateRanch → mismos campos, todos opcionales
 *
 * ¿QUÉ SE VALIDA AQUÍ Y QUÉ LE CORRESPONDE AL SERVICE?
 * Aquí: formato, rangos y enums (¿es un tipo válido? ¿tiene sentido el área?)
 * Service: unicidad (¿ya existe un rancho con ese ranchCode?), reglas de negocio
 *          complejas (¿puede transicionar de ACTIVE a PERMANENT_CLOSURE?).
 *
 * USO EN RUTAS:
 *   router.post('/',    validateRanch('createRanch'), ranchController.create)
 *   router.put('/:id',  validateRanch('updateRanch'), ranchController.update)
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { logMessage, LogLevel } from '../middleware/logging';
import {
  RanchType,
  RanchStatus,
  LandTenure,
  ClimateZone,
} from '../models/Ranch';

// ============================================================================
// TIPOS
// ============================================================================

export interface RanchValidationError {
  field: string;
  value: any;
  message: string;
  code: string;
}

interface FieldValidationResult {
  isValid: boolean;
  error?: RanchValidationError;
  sanitizedValue?: any;
}

type FieldValidator = (value: any, allData?: Record<string, any>) => FieldValidationResult;

interface FieldSchema {
  required: boolean;
  validators: FieldValidator[];
  source?: 'body' | 'query' | 'params';
}

type RanchSchema = Record<string, FieldSchema>;

// ============================================================================
// VALIDADORES PRIMITIVOS
// ============================================================================

const isRequired = (fieldName: string): FieldValidator => (value) => {
  const isEmpty =
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '');

  if (isEmpty) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `El campo ${fieldName} es requerido`,
        code: 'REQUIRED',
      },
    };
  }
  return { isValid: true, sanitizedValue: typeof value === 'string' ? value.trim() : value };
};

/**
 * Nombre del rancho: letras, números, espacios y caracteres comunes en
 * nombres de propiedades (punto, coma, apóstrofe, guion).
 * Longitud: 3–200 según el modelo.
 */
const isValidRanchName = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const str = String(value).trim();

  if (str.length < 3 || str.length > 200) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe tener entre 3 y 200 caracteres`,
        code: 'INVALID_LENGTH',
      },
    };
  }

  // Permite letras (con acentos y ñ), números, espacios y -.,'/
  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s\-\.\,\'\/]+$/;
  if (!nameRegex.test(str)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} contiene caracteres no permitidos`,
        code: 'INVALID_FORMAT',
      },
    };
  }

  return { isValid: true, sanitizedValue: str };
};

/**
 * Código de rancho: alfanumérico con guiones, 3–50 caracteres.
 * Se convierte a mayúsculas para normalizar.
 *
 * ¿POR QUÉ MAYÚSCULAS?
 * El código del rancho se usa como identificador visual (ej: en etiquetas,
 * reportes y QR). Normalizarlo a mayúsculas evita duplicados por capitalización
 * ("rch001" y "RCH001" serían el mismo código).
 */
const isValidRanchCode = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const str = String(value).trim().toUpperCase();

  if (str.length < 3 || str.length > 50) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe tener entre 3 y 50 caracteres`,
        code: 'INVALID_LENGTH',
      },
    };
  }

  const codeRegex = /^[A-Z0-9\-]+$/;
  if (!codeRegex.test(str)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} solo puede contener letras mayúsculas, números y guiones`,
        code: 'INVALID_FORMAT',
      },
    };
  }

  return { isValid: true, sanitizedValue: str };
};

/**
 * Valida el tipo de rancho según el enum RanchType del modelo.
 */
const isValidRanchType = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(RanchType);
  if (!validValues.includes(value as RanchType)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Tipo de rancho inválido. Valores permitidos: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida el estado del rancho según el enum RanchStatus del modelo.
 */
const isValidRanchStatus = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(RanchStatus);
  if (!validValues.includes(value as RanchStatus)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Estado de rancho inválido. Valores permitidos: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida el tipo de tenencia de la tierra según el enum LandTenure.
 */
const isValidLandTenure = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(LandTenure);
  if (!validValues.includes(value as LandTenure)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Tipo de tenencia inválido. Valores permitidos: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida la zona climática según el enum ClimateZone.
 */
const isValidClimateZone = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(ClimateZone);
  if (!validValues.includes(value as ClimateZone)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Zona climática inválida. Valores permitidos: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida coordenadas GPS (latitud y longitud).
 * Latitud: -90 a 90. Longitud: -180 a 180.
 * Se reciben dentro de un objeto coordinates: { lat, lng }.
 *
 * ¿POR QUÉ RECHAZAR (0, 0)?
 * El punto (0°, 0°) es el Golfo de Guinea en el Atlántico. Ningún rancho
 * ganadero está ubicado ahí. Si llegan estas coordenadas es un error de
 * captura o un valor por defecto sin inicializar del frontend.
 */
const isValidCoordinates = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  // Aceptar tanto { lat, lng } como { latitude, longitude }
  const lat = value?.lat ?? value?.latitude;
  const lng = value?.lng ?? value?.longitude;

  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe contener lat/lng o latitude/longitude`,
        code: 'MISSING_COORDINATES',
      },
    };
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (isNaN(latNum) || latNum < -90 || latNum > 90) {
    return {
      isValid: false,
      error: {
        field: `${fieldName}.lat`,
        value: lat,
        message: 'La latitud debe estar entre -90 y 90 grados',
        code: 'INVALID_LATITUDE',
      },
    };
  }

  if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
    return {
      isValid: false,
      error: {
        field: `${fieldName}.lng`,
        value: lng,
        message: 'La longitud debe estar entre -180 y 180 grados',
        code: 'INVALID_LONGITUDE',
      },
    };
  }

  if (latNum === 0 && lngNum === 0) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: 'Las coordenadas (0, 0) no son válidas para un rancho',
        code: 'NULL_ISLAND',
      },
    };
  }

  return {
    isValid: true,
    sanitizedValue: {
      lat: Math.round(latNum * 1_000_000) / 1_000_000,  // 6 decimales (~11 cm de precisión)
      lng: Math.round(lngNum * 1_000_000) / 1_000_000,
    },
  };
};

/**
 * Valida área en hectáreas. Rango práctico: 0.1 ha a 500,000 ha.
 *
 * ¿POR QUÉ 500,000 ha COMO MÁXIMO?
 * Las mayores estancias ganaderas del mundo (Australia, Brasil) rondan
 * los 1–4 millones de hectáreas, pero en México el límite práctico de
 * cualquier operación registrada es muy inferior. 500,000 ha filtra
 * errores de captura (ej: 5000000 en vez de 500) sin bloquear casos reales.
 */
const isValidArea = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = Number(value);
  if (isNaN(num) || num < 0.1 || num > 500_000) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe estar entre 0.1 y 500,000 hectáreas`,
        code: 'INVALID_AREA',
      },
    };
  }
  return { isValid: true, sanitizedValue: Math.round(num * 100) / 100 };
};

/**
 * Valida que el área de pastoreo no supere el área total.
 * Validador contextual: necesita acceso a totalArea del mismo request.
 */
const grazingAreaNotExceedsTotalArea = (): FieldValidator => (value, allData) => {
  if (value === undefined || value === null) return { isValid: true };
  if (allData?.totalArea === undefined) return { isValid: true }; // No podemos comparar sin totalArea

  const grazing = Number(value);
  const total = Number(allData.totalArea);

  if (!isNaN(grazing) && !isNaN(total) && grazing > total) {
    return {
      isValid: false,
      error: {
        field: 'grazingArea',
        value,
        message: 'El área de pastoreo no puede ser mayor que el área total del rancho',
        code: 'GRAZING_EXCEEDS_TOTAL',
      },
    };
  }
  return { isValid: true, sanitizedValue: Math.round(grazing * 100) / 100 };
};

/**
 * Valida capacidad máxima de ganado. Rango: 1 a 100,000 cabezas.
 */
const isValidCattleCapacity = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = Number(value);
  if (isNaN(num) || !Number.isInteger(num) || num < 1 || num > 100_000) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe ser un número entero entre 1 y 100,000`,
        code: 'INVALID_CAPACITY',
      },
    };
  }
  return { isValid: true, sanitizedValue: num };
};

/**
 * Valida elevación sobre el nivel del mar en metros.
 * Rango real en México: -10 m (zonas costeras bajo el nivel del mar) a 5,636 m (Pico de Orizaba).
 * Se amplía ligeramente para no bloquear bordes.
 */
const isValidElevation = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = Number(value);
  if (isNaN(num) || num < -100 || num > 6000) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe estar entre -100 y 6,000 metros sobre el nivel del mar`,
        code: 'INVALID_ELEVATION',
      },
    };
  }
  return { isValid: true, sanitizedValue: Math.round(num * 10) / 10 };
};

/**
 * Valida precipitación anual en milímetros. Rango: 0 mm (desierto absoluto) a 12,000 mm
 * (selvas tropicales extremas como Chiapas).
 */
const isValidRainfall = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = Number(value);
  if (isNaN(num) || num < 0 || num > 12_000) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe estar entre 0 y 12,000 mm/año`,
        code: 'INVALID_RAINFALL',
      },
    };
  }
  return { isValid: true, sanitizedValue: Math.round(num * 10) / 10 };
};

/**
 * Valida temperatura promedio anual en °C. Rango: -20 a 50.
 */
const isValidTemperature = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = Number(value);
  if (isNaN(num) || num < -20 || num > 50) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe estar entre -20°C y 50°C`,
        code: 'INVALID_TEMPERATURE',
      },
    };
  }
  return { isValid: true, sanitizedValue: Math.round(num * 10) / 10 };
};

/**
 * Valida el radio operativo del rancho en kilómetros (Capa 3 geo-validación).
 * Rango práctico: 0.5 km (rancho muy pequeño) a 500 km (explotación extensiva enorme).
 *
 * Este valor define cuándo el frontend muestra advertencia o bloqueo al colocar
 * una ubicación o geocerca fuera del área esperada del rancho.
 */
const isValidBoundaryRadius = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = Number(value);
  if (isNaN(num) || num < 0.5 || num > 500) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe estar entre 0.5 y 500 km`,
        code: 'INVALID_BOUNDARY_RADIUS',
      },
    };
  }
  return { isValid: true, sanitizedValue: Math.round(num * 10) / 10 };
};

/**
 * Valida la estructura de Ranch.boundary (GeofenceConfig).
 * Reglas según el `type`:
 *   - CIRCULAR    → exige center{latitude,longitude} y radius > 0 (metros)
 *   - RECTANGULAR → exige boundingBox{north,south,east,west} con south<north y west<east
 *   - POLYGON     → exige coordinates con ≥3 vértices {latitude,longitude}
 *   - CORRIDOR    → exige coordinates con ≥2 puntos y width > 0 (metros)
 *
 * `null` se permite (para borrar el boundary y volver al fallback).
 */
const isValidBoundary = (fieldName: string): FieldValidator => (value) => {
  // null o undefined → permitido (no se está modificando o se está borrando)
  if (value === undefined || value === null) return { isValid: true, sanitizedValue: value };

  if (typeof value !== 'object' || Array.isArray(value)) {
    return {
      isValid: false,
      error: { field: fieldName, value, message: `${fieldName} debe ser un objeto`, code: 'INVALID_BOUNDARY' },
    };
  }

  const cfg = value as any;
  const ALLOWED = ['CIRCULAR', 'RECTANGULAR', 'POLYGON', 'CORRIDOR'];
  if (!ALLOWED.includes(cfg.type)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value: cfg.type,
        message: `${fieldName}.type debe ser uno de: ${ALLOWED.join(', ')}`,
        code: 'INVALID_BOUNDARY_TYPE',
      },
    };
  }

  const fail = (msg: string, code: string) => ({
    isValid: false,
    error: { field: fieldName, value: cfg, message: msg, code },
  });

  if (cfg.type === 'CIRCULAR') {
    if (!cfg.center || typeof cfg.center.latitude !== 'number' || typeof cfg.center.longitude !== 'number') {
      return fail(`${fieldName} CIRCULAR requiere center.latitude y center.longitude numéricos`, 'INVALID_BOUNDARY_CIRCULAR');
    }
    if (typeof cfg.radius !== 'number' || cfg.radius <= 0) {
      return fail(`${fieldName} CIRCULAR requiere radius > 0 (metros)`, 'INVALID_BOUNDARY_CIRCULAR');
    }
  }

  if (cfg.type === 'RECTANGULAR') {
    const bb = cfg.boundingBox;
    if (!bb || typeof bb.north !== 'number' || typeof bb.south !== 'number' ||
        typeof bb.east !== 'number' || typeof bb.west !== 'number') {
      return fail(`${fieldName} RECTANGULAR requiere boundingBox {north,south,east,west} numéricos`, 'INVALID_BOUNDARY_RECTANGULAR');
    }
    if (bb.south >= bb.north) return fail(`${fieldName}.boundingBox.south debe ser menor que north`, 'INVALID_BOUNDARY_BBOX');
    if (bb.west >= bb.east)   return fail(`${fieldName}.boundingBox.west debe ser menor que east`,  'INVALID_BOUNDARY_BBOX');
  }

  if (cfg.type === 'POLYGON') {
    if (!Array.isArray(cfg.coordinates) || cfg.coordinates.length < 3) {
      return fail(`${fieldName} POLYGON requiere coordinates con al menos 3 vértices`, 'INVALID_BOUNDARY_POLYGON');
    }
    for (const c of cfg.coordinates) {
      if (!c || typeof c.latitude !== 'number' || typeof c.longitude !== 'number') {
        return fail(`Cada vértice debe tener latitude y longitude numéricos`, 'INVALID_BOUNDARY_POLYGON');
      }
    }
  }

  if (cfg.type === 'CORRIDOR') {
    if (!Array.isArray(cfg.coordinates) || cfg.coordinates.length < 2) {
      return fail(`${fieldName} CORRIDOR requiere coordinates con al menos 2 puntos`, 'INVALID_BOUNDARY_CORRIDOR');
    }
    if (typeof cfg.width !== 'number' || cfg.width <= 0) {
      return fail(`${fieldName} CORRIDOR requiere width > 0 (metros)`, 'INVALID_BOUNDARY_CORRIDOR');
    }
  }

  return { isValid: true, sanitizedValue: cfg };
};

/**
 * Valida texto libre (dirección, ciudad, estado, país, etc.).
 */
const isValidText = (fieldName: string, minLength = 2, maxLength = 255): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const str = String(value).trim();

  if (str.length < minLength) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe tener al menos ${minLength} caracteres`,
        code: 'TOO_SHORT',
      },
    };
  }

  if (str.length > maxLength) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} no puede exceder ${maxLength} caracteres`,
        code: 'TOO_LONG',
      },
    };
  }

  return { isValid: true, sanitizedValue: str };
};

/**
 * Valida código postal: solo dígitos, 4–10 caracteres.
 * Se deja amplio para cubrir formatos de México (5 dígitos) y otros países.
 */
const isValidPostalCode = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const str = String(value).trim();
  const postalRegex = /^[0-9A-Z\-]{4,10}$/i;

  if (!postalRegex.test(str)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe tener entre 4 y 10 caracteres alfanuméricos`,
        code: 'INVALID_POSTAL_CODE',
      },
    };
  }
  return { isValid: true, sanitizedValue: str.toUpperCase() };
};

/**
 * Valida zona horaria en formato IANA (ej: "America/Mexico_City").
 * Lista completa en https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
 *
 * ¿POR QUÉ NO VALIDAR CONTRA LA LISTA COMPLETA?
 * La lista tiene 600+ entradas. Usar un regex para el formato básico
 * rechaza valores claramente inválidos ("UTC+6", "hora_central", "CST")
 * sin depender de una lista hardcodeada que puede desactualizarse.
 * Si el valor pasa el regex, el service/BD lo aceptará o rechazará con
 * un error descriptivo si no existe.
 */
const isValidTimezone = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const str = String(value).trim();
  // Formato IANA: "Continent/City" o "Continent/Region/City"
  const tzRegex = /^[A-Za-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$|^UTC$/;

  if (!tzRegex.test(str)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe ser una zona horaria IANA válida (ej: America/Mexico_City)`,
        code: 'INVALID_TIMEZONE',
      },
    };
  }
  return { isValid: true, sanitizedValue: str };
};

// ============================================================================
// ESQUEMAS DE VALIDACIÓN
// ============================================================================

export const RanchSchemas = {

  /**
   * POST /api/ranch
   * Crear un nuevo rancho.
   *
   * Campos obligatorios: los que el modelo define como NOT NULL sin default.
   * Ver RanchCreationAttributes en el modelo para confirmar cuáles son opcionales.
   *
   * Flujo de validación:
   *   1. Identidad del rancho (code, name, type, status)
   *   2. Ubicación geográfica (address, city, state, country, timezone, coordinates)
   *   3. Características físicas (landTenure, climateZone, elevation, rainfall, temp)
   *   4. Capacidad (totalArea, grazingArea, maxCattleCapacity)
   */
  createRanch: {
    // ── Identidad ────────────────────────────────────────────────────────────
    ranchCode: {
      required: true,
      source: 'body',
      validators: [isRequired('ranchCode'), isValidRanchCode('ranchCode')],
    },
    name: {
      required: true,
      source: 'body',
      validators: [isRequired('name'), isValidRanchName('name')],
    },
    type: {
      required: true,
      source: 'body',
      validators: [isRequired('type'), isValidRanchType('type')],
    },
    status: {
      required: true,
      source: 'body',
      validators: [isRequired('status'), isValidRanchStatus('status')],
    },
    description: {
      required: false,
      source: 'body',
      validators: [isValidText('description', 0, 1000)],
    },

    // ── Ubicación ────────────────────────────────────────────────────────────
    address: {
      required: true,
      source: 'body',
      validators: [isRequired('address'), isValidText('address', 5, 500)],
    },
    city: {
      required: true,
      source: 'body',
      validators: [isRequired('city'), isValidText('city', 2, 100)],
    },
    state: {
      required: true,
      source: 'body',
      validators: [isRequired('state'), isValidText('state', 2, 100)],
    },
    country: {
      required: true,
      source: 'body',
      validators: [isRequired('country'), isValidText('country', 2, 100)],
    },
    postalCode: {
      required: false,
      source: 'body',
      validators: [isValidPostalCode('postalCode')],
    },
    timezone: {
      required: true,
      source: 'body',
      validators: [isRequired('timezone'), isValidTimezone('timezone')],
    },
    coordinates: {
      required: true,
      source: 'body',
      validators: [isRequired('coordinates'), isValidCoordinates('coordinates')],
    },

    // ── Características físicas ───────────────────────────────────────────────
    landTenure: {
      required: true,
      source: 'body',
      validators: [isRequired('landTenure'), isValidLandTenure('landTenure')],
    },
    climateZone: {
      required: true,
      source: 'body',
      validators: [isRequired('climateZone'), isValidClimateZone('climateZone')],
    },
    elevation: {
      required: false,
      source: 'body',
      validators: [isValidElevation('elevation')],
    },
    annualRainfall: {
      required: false,
      source: 'body',
      validators: [isValidRainfall('annualRainfall')],
    },
    averageTemperature: {
      required: false,
      source: 'body',
      validators: [isValidTemperature('averageTemperature')],
    },

    // ── Capacidad ────────────────────────────────────────────────────────────
    totalArea: {
      required: true,
      source: 'body',
      validators: [isRequired('totalArea'), isValidArea('totalArea')],
    },
    grazingArea: {
      required: true,
      source: 'body',
      // Validar rango primero, luego coherencia con totalArea
      validators: [isRequired('grazingArea'), isValidArea('grazingArea'), grazingAreaNotExceedsTotalArea()],
    },
    maxCattleCapacity: {
      required: true,
      source: 'body',
      validators: [isRequired('maxCattleCapacity'), isValidCattleCapacity('maxCattleCapacity')],
    },

    // ── Geo-validación (Capa 3) ───────────────────────────────────────────────
    boundaryRadius: {
      required: false,
      source: 'body',
      validators: [isValidBoundaryRadius('boundaryRadius')],
    },
    boundary: {
      required: false,
      source: 'body',
      validators: [isValidBoundary('boundary')],
    },
  } satisfies RanchSchema,

  /**
   * PUT /api/ranch/:id
   * Actualizar un rancho existente.
   * Todos los campos son opcionales pero validados si llegan.
   *
   * ¿POR QUÉ ranchCode ES OPCIONAL PERO VALIDADO?
   * Cambiar el código de un rancho es una operación administrativa válida
   * (ej: cambio de propietario, reestructuración de la empresa).
   * El service debe verificar que el nuevo código no esté en uso por otro rancho.
   */
  updateRanch: {
    ranchCode: {
      required: false,
      source: 'body',
      validators: [isValidRanchCode('ranchCode')],
    },
    name: {
      required: false,
      source: 'body',
      validators: [isValidRanchName('name')],
    },
    type: {
      required: false,
      source: 'body',
      validators: [isValidRanchType('type')],
    },
    status: {
      required: false,
      source: 'body',
      validators: [isValidRanchStatus('status')],
    },
    description: {
      required: false,
      source: 'body',
      validators: [isValidText('description', 0, 1000)],
    },
    address: {
      required: false,
      source: 'body',
      validators: [isValidText('address', 5, 500)],
    },
    city: {
      required: false,
      source: 'body',
      validators: [isValidText('city', 2, 100)],
    },
    state: {
      required: false,
      source: 'body',
      validators: [isValidText('state', 2, 100)],
    },
    country: {
      required: false,
      source: 'body',
      validators: [isValidText('country', 2, 100)],
    },
    postalCode: {
      required: false,
      source: 'body',
      validators: [isValidPostalCode('postalCode')],
    },
    timezone: {
      required: false,
      source: 'body',
      validators: [isValidTimezone('timezone')],
    },
    coordinates: {
      required: false,
      source: 'body',
      validators: [isValidCoordinates('coordinates')],
    },
    landTenure: {
      required: false,
      source: 'body',
      validators: [isValidLandTenure('landTenure')],
    },
    climateZone: {
      required: false,
      source: 'body',
      validators: [isValidClimateZone('climateZone')],
    },
    elevation: {
      required: false,
      source: 'body',
      validators: [isValidElevation('elevation')],
    },
    annualRainfall: {
      required: false,
      source: 'body',
      validators: [isValidRainfall('annualRainfall')],
    },
    averageTemperature: {
      required: false,
      source: 'body',
      validators: [isValidTemperature('averageTemperature')],
    },
    totalArea: {
      required: false,
      source: 'body',
      validators: [isValidArea('totalArea')],
    },
    grazingArea: {
      required: false,
      source: 'body',
      validators: [isValidArea('grazingArea'), grazingAreaNotExceedsTotalArea()],
    },
    maxCattleCapacity: {
      required: false,
      source: 'body',
      validators: [isValidCattleCapacity('maxCattleCapacity')],
    },

    // ── Geo-validación (Capa 3) ───────────────────────────────────────────────
    boundaryRadius: {
      required: false,
      source: 'body',
      validators: [isValidBoundaryRadius('boundaryRadius')],
    },
    boundary: {
      required: false,
      source: 'body',
      validators: [isValidBoundary('boundary')],
    },
  } satisfies RanchSchema,

  /**
   * PUT /api/ranches/:id/boundary
   * Endpoint dedicado para editar SOLO el perímetro del rancho.
   * Acepta `boundary: GeofenceConfig | null` (null borra y vuelve a fallback CIRCULAR).
   */
  updateBoundary: {
    boundary: {
      required: false, // null permitido (borrado)
      source: 'body',
      validators: [isValidBoundary('boundary')],
    },
  } satisfies RanchSchema,

} as const;

export type RanchSchemaName = keyof typeof RanchSchemas;

// ============================================================================
// MOTOR DE VALIDACIÓN
// ============================================================================

function runFieldValidators(
  value: any,
  validators: FieldValidator[],
  allData: Record<string, any>
): { error?: RanchValidationError; sanitizedValue?: any } {
  let currentValue = value;

  for (const validator of validators) {
    const result = validator(currentValue, allData);
    if (!result.isValid) {
      return { error: result.error };
    }
    if (result.sanitizedValue !== undefined) {
      currentValue = result.sanitizedValue;
    }
  }

  return { sanitizedValue: currentValue };
}

// ============================================================================
// MIDDLEWARE PRINCIPAL
// ============================================================================

/**
 * validateRanch - Middleware de validación para rutas del módulo de ranchos.
 *
 * @param schemaName - Nombre del esquema en RanchSchemas
 * @returns Middleware de Express
 *
 * USO:
 *   router.post('/',   validateRanch('createRanch'), ranchController.create)
 *   router.put('/:id', validateRanch('updateRanch'), ranchController.update)
 */
export const validateRanch = (schemaName: RanchSchemaName) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const schema = RanchSchemas[schemaName];
      const errors: RanchValidationError[] = [];
      const sanitizedData: Record<string, any> = {};

      const allData: Record<string, any> = {
        ...req.body,
        ...req.query,
        ...req.params,
      };

      for (const [fieldName, fieldSchema] of Object.entries(schema) as [string, FieldSchema][]) {
        const source = fieldSchema.source || 'body';
        const sourceMap = { body: req.body, query: req.query, params: req.params };
        const rawValue = sourceMap[source]?.[fieldName];

        const isEmpty =
          rawValue === undefined ||
          rawValue === null ||
          (typeof rawValue === 'string' && rawValue.trim() === '');

        if (!fieldSchema.required && isEmpty) continue;

        const { error, sanitizedValue } = runFieldValidators(
          rawValue,
          fieldSchema.validators,
          allData
        );

        if (error) {
          errors.push(error);
        } else if (sanitizedValue !== undefined) {
          sanitizedData[fieldName] = sanitizedValue;
        }
      }

      if (errors.length > 0) {
        logMessage(
          LogLevel.WARN,
          'ranch_validation_failed',
          `Validación de rancho fallida [${schemaName}]`,
          {
            schema: schemaName,
            path: req.originalUrl,
            method: req.method,
            errorFields: errors.map((e) => ({ field: e.field, code: e.code })),
            ip: req.ip,
          }
        );

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Los datos del rancho no son válidos',
            details: {
              fieldErrors: errors,
              totalErrors: errors.length,
            },
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
            method: req.method,
          },
        });
        return;
      }

      req.body = { ...req.body, ...sanitizedData };
      (req as any).validatedData = sanitizedData;

      next();
    } catch (error) {
      logMessage(
        LogLevel.ERROR,
        'ranch_validation_error',
        `Error interno en validateRanch [${schemaName}]: ${error}`,
        {
          schema: schemaName,
          path: req.originalUrl,
          error: error instanceof Error ? error.stack : String(error),
        }
      );

      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_MIDDLEWARE_ERROR',
          message: 'Error interno al validar los datos del rancho',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
};
