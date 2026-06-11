// validators/reproduction.validators.ts
/**
 * ============================================================================
 * VALIDADORES DEL MÓDULO DE REPRODUCCIÓN
 * ============================================================================
 *
 * Cubre los 4 eventos del ciclo reproductivo:
 *   1. Detección de celo (heat)
 *   2. Inseminación / monta (insemination)
 *   3. Confirmación de preñez (pregnancy)
 *   4. Registro de parto (birth)
 *
 * También cubre la actualización de eventos existentes.
 *
 * USO EN RUTAS:
 *   router.post('/heat',          validateReproduction('recordHeat'),         ...)
 *   router.post('/insemination',  validateReproduction('recordInsemination'), ...)
 *   router.post('/pregnancy',     validateReproduction('confirmPregnancy'),   ...)
 *   router.post('/birth',         validateReproduction('recordBirth'),        ...)
 *   router.put('/events/:id',     validateReproduction('updateEvent'),        ...)
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { logMessage, LogLevel } from '../middleware/logging';
import {
  ReproductionType,
  ServiceStatus,
  HeatDetectionMethod,
  PregnancyDiagnosisMethod,
  CalvingDifficulty,
  CalfViability,
  WeaningMethod,
} from '../models/Reproduction';

// ============================================================================
// TIPOS
// ============================================================================

export interface ReproductionValidationError {
  field: string;
  value: any;
  message: string;
  code: string;
}

interface FieldValidationResult {
  isValid: boolean;
  error?: ReproductionValidationError;
  sanitizedValue?: any;
}

type FieldValidator = (value: any, allData?: Record<string, any>) => FieldValidationResult;

interface FieldSchema {
  required: boolean;
  validators: FieldValidator[];
  source?: 'body' | 'query' | 'params';
}

type ReproductionSchema = Record<string, FieldSchema>;

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
 * UUID válido para IDs de bovinos, ranchos, eventos, etc.
 */
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
 * Fecha válida, no puede ser futura para registros de campo.
 *
 * ¿POR QUÉ 24h DE MARGEN?
 * Los trabajadores en campo pueden registrar eventos con diferencia de timezone
 * o al final del día. Se da 1 día de gracia para estos casos.
 */
const isValidEventDate = (fieldName: string): FieldValidator => (value) => {
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

  // Máximo 10 años de antigüedad en un registro reproductivo
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  if (date < tenYearsAgo) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} es demasiado antigua (máximo 10 años)`,
        code: 'DATE_TOO_OLD',
      },
    };
  }

  return { isValid: true, sanitizedValue: date.toISOString() };
};

/**
 * Valida el método de detección de celo.
 */
const isValidHeatMethod = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(HeatDetectionMethod);
  if (!validValues.includes(value as HeatDetectionMethod)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Método de detección de celo inválido. Valores: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida el tipo de reproducción (monta natural, IA, TE, etc.)
 */
const isValidReproductionType = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(ReproductionType);
  if (!validValues.includes(value as ReproductionType)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Tipo de reproducción inválido. Valores: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida el estado del servicio reproductivo.
 */
const isValidServiceStatus = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(ServiceStatus);
  if (!validValues.includes(value as ServiceStatus)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Estado reproductivo inválido. Valores: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida el método de diagnóstico de preñez.
 */
const isValidPregnancyMethod = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(PregnancyDiagnosisMethod);
  if (!validValues.includes(value as PregnancyDiagnosisMethod)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Método de diagnóstico de preñez inválido. Valores: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida la dificultad al parto.
 */
const isValidCalvingDifficulty = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(CalvingDifficulty);
  if (!validValues.includes(value as CalvingDifficulty)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Dificultad al parto inválida. Valores: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida la viabilidad del ternero al nacer.
 */
const isValidCalfViability = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(CalfViability);
  if (!validValues.includes(value as CalfViability)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Viabilidad del ternero inválida. Valores: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida el método de destete.
 */
const isValidWeaningMethod = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(WeaningMethod);
  if (!validValues.includes(value as WeaningMethod)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Método de destete inválido. Valores: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida intensidad de celo (escala 1-3 usada en campo).
 * 1 = leve, 2 = moderado, 3 = intenso.
 */
const isValidHeatIntensity = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = Number(value);
  if (isNaN(num) || ![1, 2, 3].includes(num)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe ser 1 (leve), 2 (moderado) o 3 (intenso)`,
        code: 'INVALID_INTENSITY',
      },
    };
  }
  return { isValid: true, sanitizedValue: num };
};

/**
 * Valida días de gestación (rango biológico real para bovinos: 270-295 días).
 */
const isValidGestationDays = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = Number(value);
  if (isNaN(num) || num < 200 || num > 320) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe estar entre 200 y 320 días (promedio bovino: 270-295)`,
        code: 'INVALID_GESTATION',
      },
    };
  }
  return { isValid: true, sanitizedValue: num };
};

/**
 * Valida peso en kg dentro de un rango razonable.
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
 * Valida texto libre corto (notas, nombres de semental, etc.)
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

// ============================================================================
// ESQUEMAS DE VALIDACIÓN
// ============================================================================

export const ReproductionSchemas = {

  /**
   * POST /api/reproduction/heat
   * Registrar detección de celo.
   *
   * ¿POR QUÉ bovineId OBLIGATORIO?
   * El celo es un evento por bovino individual, no del herd completo.
   */
  recordHeat: {
    bovineId: {
      required: true,
      source: 'body',
      validators: [isRequired('bovineId'), isValidUUID('bovineId')],
    },
    detectionDate: {
      required: true,
      source: 'body',
      validators: [isRequired('detectionDate'), isValidEventDate('detectionDate')],
    },
    heatDetectionMethod: {
      required: true,
      source: 'body',
      validators: [isRequired('heatDetectionMethod'), isValidHeatMethod('heatDetectionMethod')],
    },
    heatIntensity: {
      required: false,
      source: 'body',
      validators: [isValidHeatIntensity('heatIntensity')],
    },
    duration: {
      required: false,
      source: 'body',
      validators: [
        // Duración en horas: el celo bovino dura entre 6 y 30 horas típicamente
        ((value) => {
          if (value === undefined || value === null) return { isValid: true };
          const num = Number(value);
          if (isNaN(num) || num < 1 || num > 72) {
            return {
              isValid: false,
              error: {
                field: 'duration',
                value,
                message: 'La duración del celo debe estar entre 1 y 72 horas',
                code: 'INVALID_DURATION',
              },
            };
          }
          return { isValid: true, sanitizedValue: num };
        }) as FieldValidator,
      ],
    },
    notes: {
      required: false,
      source: 'body',
      validators: [isValidText('notes', 500)],
    },
    ranchId: {
      required: false,
      source: 'body',
      validators: [isValidUUID('ranchId')],
    },
  } satisfies ReproductionSchema,

  /**
   * POST /api/reproduction/insemination
   * Registrar inseminación o monta natural.
   *
   * ¿POR QUÉ reproductionType OBLIGATORIO?
   * El manejo es diferente según sea monta natural, IA, TE, etc.
   * Los registros genéticos del semental solo aplican a ciertos tipos.
   */
  recordInsemination: {
    bovineId: {
      required: true,
      source: 'body',
      validators: [isRequired('bovineId'), isValidUUID('bovineId')],
    },
    serviceDate: {
      required: true,
      source: 'body',
      validators: [isRequired('serviceDate'), isValidEventDate('serviceDate')],
    },
    reproductionType: {
      required: true,
      source: 'body',
      validators: [isRequired('reproductionType'), isValidReproductionType('reproductionType')],
    },
    // Nombre del semental: obligatorio para monta natural e IA con semen identificado
    'sireInfo.sireName': {
      required: false,
      source: 'body',
      validators: [isValidText('sireInfo.sireName', 100)],
    },
    'sireInfo.sireBreed': {
      required: false,
      source: 'body',
      validators: [isValidText('sireInfo.sireBreed', 100)],
    },
    technicianName: {
      required: false,
      source: 'body',
      validators: [isValidText('technicianName', 100)],
    },
    notes: {
      required: false,
      source: 'body',
      validators: [isValidText('notes', 500)],
    },
    ranchId: {
      required: false,
      source: 'body',
      validators: [isValidUUID('ranchId')],
    },
  } satisfies ReproductionSchema,

  /**
   * POST /api/reproduction/pregnancy
   * Confirmar diagnóstico de preñez.
   */
  confirmPregnancy: {
    bovineId: {
      required: true,
      source: 'body',
      validators: [isRequired('bovineId'), isValidUUID('bovineId')],
    },
    diagnosisDate: {
      required: true,
      source: 'body',
      validators: [isRequired('diagnosisDate'), isValidEventDate('diagnosisDate')],
    },
    pregnancyDiagnosisMethod: {
      required: true,
      source: 'body',
      validators: [isRequired('pregnancyDiagnosisMethod'), isValidPregnancyMethod('pregnancyDiagnosisMethod')],
    },
    gestationDays: {
      required: false,
      source: 'body',
      validators: [isValidGestationDays('gestationDays')],
    },
    expectedBirthDate: {
      required: false,
      source: 'body',
      validators: [
        // La fecha esperada de parto SÍ puede ser futura (lógicamente debe serlo)
        ((value) => {
          if (value === undefined || value === null || value === '') return { isValid: true };
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return {
              isValid: false,
              error: {
                field: 'expectedBirthDate',
                value,
                message: 'expectedBirthDate debe ser una fecha válida',
                code: 'INVALID_DATE',
              },
            };
          }
          // Puede ser hasta 1 año en el futuro (gestación ~280 días)
          const maxFuture = new Date();
          maxFuture.setFullYear(maxFuture.getFullYear() + 1);
          if (date > maxFuture) {
            return {
              isValid: false,
              error: {
                field: 'expectedBirthDate',
                value,
                message: 'expectedBirthDate no puede ser más de 1 año en el futuro',
                code: 'TOO_FAR_FUTURE',
              },
            };
          }
          return { isValid: true, sanitizedValue: date.toISOString() };
        }) as FieldValidator,
      ],
    },
    veterinarianId: {
      required: false,
      source: 'body',
      validators: [isValidUUID('veterinarianId')],
    },
    notes: {
      required: false,
      source: 'body',
      validators: [isValidText('notes', 500)],
    },
  } satisfies ReproductionSchema,

  /**
   * POST /api/reproduction/birth
   * Registrar un parto.
   *
   * Es el evento más complejo: involucra al bovino madre y al ternero nacido.
   */
  recordBirth: {
    bovineId: {
      required: true,
      source: 'body',
      validators: [isRequired('bovineId'), isValidUUID('bovineId')],
    },
    birthDate: {
      required: true,
      source: 'body',
      validators: [isRequired('birthDate'), isValidEventDate('birthDate')],
    },
    calvingDifficulty: {
      required: true,
      source: 'body',
      validators: [isRequired('calvingDifficulty'), isValidCalvingDifficulty('calvingDifficulty')],
    },
    calfViability: {
      required: true,
      source: 'body',
      validators: [isRequired('calfViability'), isValidCalfViability('calfViability')],
    },
    birthWeight: {
      required: false,
      source: 'body',
      // Peso de ternero al nacer: rango biológico real 20-80 kg
      validators: [isValidWeight('birthWeight', 15, 80)],
    },
    calfGender: {
      required: false,
      source: 'body',
      validators: [
        ((value) => {
          if (value === undefined || value === null || value === '') return { isValid: true };
          if (!['MALE', 'FEMALE'].includes(String(value).toUpperCase())) {
            return {
              isValid: false,
              error: {
                field: 'calfGender',
                value,
                message: 'calfGender debe ser MALE o FEMALE',
                code: 'INVALID_ENUM',
              },
            };
          }
          return { isValid: true, sanitizedValue: String(value).toUpperCase() };
        }) as FieldValidator,
      ],
    },
    weaningMethod: {
      required: false,
      source: 'body',
      validators: [isValidWeaningMethod('weaningMethod')],
    },
    veterinarianId: {
      required: false,
      source: 'body',
      validators: [isValidUUID('veterinarianId')],
    },
    notes: {
      required: false,
      source: 'body',
      validators: [isValidText('notes', 500)],
    },
  } satisfies ReproductionSchema,

  /**
   * PUT /api/reproduction/events/:id
   * Actualizar un evento reproductivo existente. Todos los campos opcionales.
   */
  updateEvent: {
    serviceDate: {
      required: false,
      source: 'body',
      validators: [isValidEventDate('serviceDate')],
    },
    status: {
      required: false,
      source: 'body',
      validators: [isValidServiceStatus('status')],
    },
    reproductionType: {
      required: false,
      source: 'body',
      validators: [isValidReproductionType('reproductionType')],
    },
    gestationDays: {
      required: false,
      source: 'body',
      validators: [isValidGestationDays('gestationDays')],
    },
    notes: {
      required: false,
      source: 'body',
      validators: [isValidText('notes', 500)],
    },
  } satisfies ReproductionSchema,

} as const;

export type ReproductionSchemaName = keyof typeof ReproductionSchemas;

// ============================================================================
// MOTOR DE VALIDACIÓN
// ============================================================================

function runFieldValidators(
  value: any,
  validators: FieldValidator[],
  allData: Record<string, any>
): { error?: ReproductionValidationError; sanitizedValue?: any } {
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
 * validateReproduction - Middleware de validación para rutas del módulo reproductivo.
 *
 * @param schemaName - Nombre del esquema en ReproductionSchemas
 * @returns Middleware de Express
 */
export const validateReproduction = (schemaName: ReproductionSchemaName) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const schema = ReproductionSchemas[schemaName];
      const errors: ReproductionValidationError[] = [];
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
          'reproduction_validation_failed',
          `Validación reproductiva fallida [${schemaName}]`,
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
            message: 'Los datos del evento reproductivo no son válidos',
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
        'reproduction_validation_error',
        `Error interno en validateReproduction [${schemaName}]: ${error}`,
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
          message: 'Error interno al validar los datos reproductivos',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
};
