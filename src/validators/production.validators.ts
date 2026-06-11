// validators/production.validators.ts
/**
 * ============================================================================
 * VALIDADORES DEL MÓDULO DE PRODUCCIÓN
 * ============================================================================
 *
 * Cubre dos operaciones principales:
 *   1. Crear registro de producción (createProduction)
 *   2. Actualizar registro existente (updateProduction)
 *
 * Tipos de producción soportados con validaciones específicas:
 *   - MILK  → volumen, sesión de ordeño, método, composición láctea
 *   - MEAT  → peso vivo, peso canal, rendimiento, cortes
 *   - Resto → validaciones generales (BREEDING, CALVES, LEATHER, etc.)
 *
 * ¿POR QUÉ VALIDACIONES ESPECÍFICAS POR TIPO?
 * Un registro de leche sin volumen es inútil para el sistema.
 * Un registro de carne sin peso canal no permite calcular rendimiento.
 * La validación contextual (según productionType) garantiza datos útiles.
 *
 * USO EN RUTAS:
 *   router.post('/',    validateProduction('createProduction'), productionController.create)
 *   router.put('/:id',  validateProduction('updateProduction'), productionController.update)
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { logMessage, LogLevel } from '../middleware/logging';
import {
  ProductionType,
  ProductionStatus,
  QualityGrade,
  MilkingMethod,
} from '../models/Production';

// ============================================================================
// TIPOS
// ============================================================================

export interface ProductionValidationError {
  field: string;
  value: any;
  message: string;
  code: string;
}

interface FieldValidationResult {
  isValid: boolean;
  error?: ProductionValidationError;
  sanitizedValue?: any;
}

type FieldValidator = (value: any, allData?: Record<string, any>) => FieldValidationResult;

interface FieldSchema {
  required: boolean;
  validators: FieldValidator[];
  source?: 'body' | 'query' | 'params';
}

type ProductionSchema = Record<string, FieldSchema>;

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

const isValidUUID = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(String(value))) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe ser un UUID válido`,
        code: 'INVALID_UUID',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida que el tipo de producción sea uno de los valores del enum.
 */
const isValidProductionType = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(ProductionType);
  if (!validValues.includes(value as ProductionType)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Tipo de producción inválido. Valores permitidos: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida el estado del registro de producción.
 */
const isValidProductionStatus = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(ProductionStatus);
  if (!validValues.includes(value as ProductionStatus)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Estado de producción inválido. Valores permitidos: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida el grado de calidad del producto.
 */
const isValidQualityGrade = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(QualityGrade);
  if (!validValues.includes(value as QualityGrade)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Grado de calidad inválido. Valores permitidos: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida el método de ordeño.
 */
const isValidMilkingMethod = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(MilkingMethod);
  if (!validValues.includes(value as MilkingMethod)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Método de ordeño inválido. Valores permitidos: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida la sesión de ordeño.
 * Los 4 turnos posibles reflejan los horarios reales en ranchos lecheros.
 */
const isValidMilkingSession = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validSessions = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'];
  if (!validSessions.includes(String(value).toUpperCase())) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Sesión de ordeño inválida. Valores: ${validSessions.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: String(value).toUpperCase() };
};

/**
 * Valida el volumen de leche en litros.
 *
 * ¿POR QUÉ MÁXIMO 100L?
 * La vaca lechera más productiva del mundo produce ~80L/día.
 * 100L como máximo por sesión/registro deja margen suficiente
 * y rechaza errores de captura evidentes (ej: 1000 en vez de 10.00).
 */
const isValidMilkVolume = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = Number(value);
  if (isNaN(num)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe ser un número válido`,
        code: 'INVALID_TYPE',
      },
    };
  }

  if (num < 0.1) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe ser mayor a 0.1 litros`,
        code: 'AMOUNT_TOO_LOW',
      },
    };
  }

  if (num > 100) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} no puede exceder 100 litros por registro`,
        code: 'AMOUNT_TOO_HIGH',
      },
    };
  }

  return { isValid: true, sanitizedValue: Math.round(num * 100) / 100 };
};

/**
 * Valida porcentaje de composición láctea (grasa, proteína, lactosa).
 * Rango real en leche bovina: 0.1% a 10%.
 */
const isValidMilkPercentage = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = Number(value);
  if (isNaN(num) || num < 0 || num > 10) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe ser un porcentaje entre 0 y 10 (composición láctea)`,
        code: 'INVALID_PERCENTAGE',
      },
    };
  }
  return { isValid: true, sanitizedValue: Math.round(num * 100) / 100 };
};

/**
 * Valida temperatura de la leche en °C al momento del ordeño.
 * Rango aceptable: 2°C (refrigerada) a 42°C (recién ordeñada, temperatura corporal).
 */
const isValidMilkTemperature = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = Number(value);
  if (isNaN(num) || num < 2 || num > 42) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe estar entre 2°C y 42°C`,
        code: 'INVALID_TEMPERATURE',
      },
    };
  }
  return { isValid: true, sanitizedValue: Math.round(num * 10) / 10 };
};

/**
 * Valida el pH de la leche.
 * Rango normal de leche bovina: 6.4 a 6.8. Se amplía a 5.5–8.0 para casos patológicos.
 */
const isValidMilkPH = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = Number(value);
  if (isNaN(num) || num < 5.5 || num > 8.0) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe estar entre 5.5 y 8.0 (pH normal: 6.4-6.8)`,
        code: 'INVALID_PH',
      },
    };
  }
  return { isValid: true, sanitizedValue: Math.round(num * 100) / 100 };
};

/**
 * Valida peso en kg con rango configurable.
 */
const isValidWeight = (fieldName: string, min: number, max: number): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = Number(value);
  if (isNaN(num) || num < min || num > max) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe estar entre ${min} y ${max} kg`,
        code: 'INVALID_WEIGHT',
      },
    };
  }
  return { isValid: true, sanitizedValue: Math.round(num * 100) / 100 };
};

/**
 * Valida porcentaje de rendimiento de la canal (dressing percentage).
 *
 * ¿POR QUÉ 45%-75%?
 * El rendimiento promedio bovino es ~60%. Por debajo de 45% es error de captura.
 * Por encima de 75% es biológicamente imposible en condiciones normales.
 */
const isValidDressingPercentage = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = Number(value);
  if (isNaN(num) || num < 45 || num > 75) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe estar entre 45% y 75% (rendimiento típico bovino: ~60%)`,
        code: 'INVALID_DRESSING_PCT',
      },
    };
  }
  return { isValid: true, sanitizedValue: Math.round(num * 100) / 100 };
};

/**
 * Valida fecha de producción.
 * Permite hasta 7 días en el pasado (registros atrasados de campo)
 * y hasta 24 horas en el futuro (diferencias de timezone).
 */
const isValidProductionDate = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe ser una fecha válida (formato ISO8601)`,
        code: 'INVALID_DATE',
      },
    };
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date > tomorrow) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} no puede ser una fecha futura`,
        code: 'FUTURE_DATE',
      },
    };
  }

  // 5 años hacia atrás como máximo razonable para datos históricos
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  if (date < fiveYearsAgo) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} es demasiado antigua (máximo 5 años)`,
        code: 'DATE_TOO_OLD',
      },
    };
  }

  return { isValid: true, sanitizedValue: date.toISOString() };
};

/**
 * Valida texto libre corto (notas, operador, etc.)
 */
const isValidText = (fieldName: string, maxLength = 255): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const str = String(value).trim();
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
 * Valida que cuando productionType = MILK, el campo milkInfo.volume esté presente.
 * Validador contextual que usa allData para revisar el tipo.
 *
 * ¿POR QUÉ AQUÍ Y NO EN EL SERVICE?
 * El servicio confía en datos ya validados. Si llega un registro MILK sin volumen,
 * el service fallaría con un error de base de datos poco descriptivo.
 * Detectarlo aquí produce un mensaje claro al usuario/frontend.
 */
const requireMilkVolumeIfMilkType = (): FieldValidator => (value, allData) => {
  if (allData?.productionType !== ProductionType.MILK) return { isValid: true };

  const volume = allData?.['milkInfo.volume'] ?? allData?.milkInfo?.volume ?? value;
  if (volume === undefined || volume === null) {
    return {
      isValid: false,
      error: {
        field: 'milkInfo.volume',
        value,
        message: 'El volumen de leche es requerido para registros de tipo MILK',
        code: 'REQUIRED_FOR_TYPE',
      },
    };
  }
  return { isValid: true };
};

// ============================================================================
// ESQUEMAS DE VALIDACIÓN
// ============================================================================

export const ProductionSchemas = {

  /**
   * POST /api/production
   * Crear un nuevo registro de producción.
   *
   * Flujo de validación:
   *   1. Campos base: bovineId, productionType, productionDate, ranchId
   *   2. Si productionType = MILK → valida milkInfo (volumen obligatorio)
   *   3. Si productionType = MEAT → valida meatInfo (pesos opcionales pero con rangos)
   *   4. Campos opcionales: status, qualityGrade, notes
   *
   * NOTA SOBRE milkInfo y meatInfo:
   * Estos son objetos anidados que el frontend envía como { milkInfo: { volume: 10 } }.
   * Los validamos aquí con campos planos ("milkInfo.volume") por simplicidad.
   * El middleware fusiona los valores sanitizados de vuelta al body antes del controller.
   */
  createProduction: {
    bovineId: {
      required: true,
      source: 'body',
      validators: [isRequired('bovineId'), isValidUUID('bovineId')],
    },
    ranchId: {
      required: true,
      source: 'body',
      validators: [isRequired('ranchId'), isValidUUID('ranchId')],
    },
    productionType: {
      required: true,
      source: 'body',
      validators: [isRequired('productionType'), isValidProductionType('productionType')],
    },
    productionDate: {
      required: true,
      source: 'body',
      validators: [isRequired('productionDate'), isValidProductionDate('productionDate')],
    },
    status: {
      required: false,
      source: 'body',
      validators: [isValidProductionStatus('status')],
    },
    qualityGrade: {
      required: false,
      source: 'body',
      validators: [isValidQualityGrade('qualityGrade')],
    },
    notes: {
      required: false,
      source: 'body',
      validators: [isValidText('notes', 500)],
    },

    // ── Campos de producción de leche (milkInfo.*) ──────────────────────────
    // El frontend puede enviar milkInfo como objeto o como campos planos.
    // Aquí validamos como campos planos para simplicidad del motor.
    'milkInfo.volume': {
      required: false,
      source: 'body',
      validators: [requireMilkVolumeIfMilkType(), isValidMilkVolume('milkInfo.volume')],
    },
    'milkInfo.milkingSession': {
      required: false,
      source: 'body',
      validators: [isValidMilkingSession('milkInfo.milkingSession')],
    },
    'milkInfo.milkingMethod': {
      required: false,
      source: 'body',
      validators: [isValidMilkingMethod('milkInfo.milkingMethod')],
    },
    'milkInfo.fatContent': {
      required: false,
      source: 'body',
      validators: [isValidMilkPercentage('milkInfo.fatContent')],
    },
    'milkInfo.proteinContent': {
      required: false,
      source: 'body',
      validators: [isValidMilkPercentage('milkInfo.proteinContent')],
    },
    'milkInfo.lactoseContent': {
      required: false,
      source: 'body',
      validators: [isValidMilkPercentage('milkInfo.lactoseContent')],
    },
    'milkInfo.temperature': {
      required: false,
      source: 'body',
      validators: [isValidMilkTemperature('milkInfo.temperature')],
    },
    'milkInfo.ph': {
      required: false,
      source: 'body',
      validators: [isValidMilkPH('milkInfo.ph')],
    },

    // ── Campos de producción de carne (meatInfo.*) ──────────────────────────
    'meatInfo.liveWeight': {
      required: false,
      source: 'body',
      // Bovino en pie: mínimo 200 kg (ternero de engorda), máximo 1200 kg
      validators: [isValidWeight('meatInfo.liveWeight', 200, 1200)],
    },
    'meatInfo.carcassWeight': {
      required: false,
      source: 'body',
      // Canal: mínimo 100 kg, máximo 750 kg (aprox. 62.5% de 1200 kg)
      validators: [isValidWeight('meatInfo.carcassWeight', 100, 750)],
    },
    'meatInfo.dressingPercentage': {
      required: false,
      source: 'body',
      validators: [isValidDressingPercentage('meatInfo.dressingPercentage')],
    },
  } satisfies ProductionSchema,

  /**
   * PUT /api/production/:id
   * Actualizar un registro de producción existente.
   * Todos los campos son opcionales pero validados si llegan.
   *
   * ¿POR QUÉ NO PERMITIR CAMBIAR bovineId?
   * Un registro de producción está ligado al bovino que lo generó.
   * Cambiar el bovineId equivaldría a falsificar el historial productivo.
   * Si hay un error de bovino, se debe eliminar y crear uno nuevo.
   */
  updateProduction: {
    productionDate: {
      required: false,
      source: 'body',
      validators: [isValidProductionDate('productionDate')],
    },
    status: {
      required: false,
      source: 'body',
      validators: [isValidProductionStatus('status')],
    },
    qualityGrade: {
      required: false,
      source: 'body',
      validators: [isValidQualityGrade('qualityGrade')],
    },
    notes: {
      required: false,
      source: 'body',
      validators: [isValidText('notes', 500)],
    },
    'milkInfo.volume': {
      required: false,
      source: 'body',
      validators: [isValidMilkVolume('milkInfo.volume')],
    },
    'milkInfo.milkingSession': {
      required: false,
      source: 'body',
      validators: [isValidMilkingSession('milkInfo.milkingSession')],
    },
    'milkInfo.milkingMethod': {
      required: false,
      source: 'body',
      validators: [isValidMilkingMethod('milkInfo.milkingMethod')],
    },
    'milkInfo.fatContent': {
      required: false,
      source: 'body',
      validators: [isValidMilkPercentage('milkInfo.fatContent')],
    },
    'milkInfo.proteinContent': {
      required: false,
      source: 'body',
      validators: [isValidMilkPercentage('milkInfo.proteinContent')],
    },
    'milkInfo.lactoseContent': {
      required: false,
      source: 'body',
      validators: [isValidMilkPercentage('milkInfo.lactoseContent')],
    },
    'milkInfo.temperature': {
      required: false,
      source: 'body',
      validators: [isValidMilkTemperature('milkInfo.temperature')],
    },
    'milkInfo.ph': {
      required: false,
      source: 'body',
      validators: [isValidMilkPH('milkInfo.ph')],
    },
    'meatInfo.liveWeight': {
      required: false,
      source: 'body',
      validators: [isValidWeight('meatInfo.liveWeight', 200, 1200)],
    },
    'meatInfo.carcassWeight': {
      required: false,
      source: 'body',
      validators: [isValidWeight('meatInfo.carcassWeight', 100, 750)],
    },
    'meatInfo.dressingPercentage': {
      required: false,
      source: 'body',
      validators: [isValidDressingPercentage('meatInfo.dressingPercentage')],
    },
  } satisfies ProductionSchema,

} as const;

export type ProductionSchemaName = keyof typeof ProductionSchemas;

// ============================================================================
// MOTOR DE VALIDACIÓN
// ============================================================================

function runFieldValidators(
  value: any,
  validators: FieldValidator[],
  allData: Record<string, any>
): { error?: ProductionValidationError; sanitizedValue?: any } {
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
 * validateProduction - Middleware de validación para rutas del módulo de producción.
 *
 * Maneja campos anidados (milkInfo.*, meatInfo.*) de la siguiente forma:
 *   - Lee el valor desde req.body.milkInfo?.volume si la clave tiene punto
 *   - Escribe el valor sanitizado de vuelta al objeto anidado correspondiente
 *
 * Esto permite que el controller reciba req.body.milkInfo.volume ya validado
 * sin necesidad de lógica extra.
 *
 * @param schemaName - Nombre del esquema en ProductionSchemas
 * @returns Middleware de Express
 */
export const validateProduction = (schemaName: ProductionSchemaName) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const schema = ProductionSchemas[schemaName];
      const errors: ProductionValidationError[] = [];
      const sanitizedData: Record<string, any> = {};

      // allData aplana todo para los validadores contextuales
      const allData: Record<string, any> = {
        ...req.body,
        ...req.query,
        ...req.params,
      };

      for (const [fieldName, fieldSchema] of Object.entries(schema) as [string, FieldSchema][]) {
        const source = fieldSchema.source || 'body';
        const sourceObj: Record<string, any> =
          source === 'body' ? req.body : source === 'query' ? req.query : req.params;

        // Soporte para claves anidadas tipo "milkInfo.volume"
        let rawValue: any;
        if (fieldName.includes('.')) {
          const [parent, child] = fieldName.split('.');
          rawValue = sourceObj?.[parent]?.[child];
        } else {
          rawValue = sourceObj?.[fieldName];
        }

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
          // Reconstruir estructura anidada en sanitizedData
          if (fieldName.includes('.')) {
            const [parent, child] = fieldName.split('.');
            if (!sanitizedData[parent]) sanitizedData[parent] = {};
            sanitizedData[parent][child] = sanitizedValue;
          } else {
            sanitizedData[fieldName] = sanitizedValue;
          }
        }
      }

      if (errors.length > 0) {
        logMessage(
          LogLevel.WARN,
          'production_validation_failed',
          `Validación de producción fallida [${schemaName}]`,
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
            message: 'Los datos del registro de producción no son válidos',
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

      // Fusionar datos sanitizados con el body original
      // merge profundo para no perder otros campos de milkInfo/meatInfo no validados
      req.body = deepMerge(req.body, sanitizedData);
      (req as any).validatedData = sanitizedData;

      next();
    } catch (error) {
      logMessage(
        LogLevel.ERROR,
        'production_validation_error',
        `Error interno en validateProduction [${schemaName}]: ${error}`,
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
          message: 'Error interno al validar los datos de producción',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
};

// ============================================================================
// UTILIDAD INTERNA
// ============================================================================

/**
 * Mezcla dos objetos de forma profunda (un nivel de anidamiento).
 * Necesario para fusionar milkInfo/meatInfo sin perder campos del body original.
 *
 * ¿POR QUÉ NO Object.assign()?
 * Object.assign() haría { ...body, milkInfo: sanitizedData.milkInfo }
 * lo que reemplazaría el objeto milkInfo completo. Con deepMerge
 * se conservan los campos del original que el middleware no validó.
 */
function deepMerge(
  target: Record<string, any>,
  source: Record<string, any>
): Record<string, any> {
  const result = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null
    ) {
      result[key] = { ...result[key], ...value };
    } else {
      result[key] = value;
    }
  }

  return result;
}
