// validators/inventory.validators.ts
/**
 * ============================================================================
 * VALIDADORES DEL MÓDULO DE INVENTARIO
 * ============================================================================
 *
 * Cubre las 3 operaciones de stock que expone el API:
 *   1. updateStock  → entrada/salida general con tipo de movimiento
 *   2. reserveStock → apartar unidades para un uso específico (tratamiento, etc.)
 *   3. releaseStock → liberar unidades previamente reservadas
 *
 * ¿POR QUÉ ESTOS 3 Y NO MÁS?
 * Las rutas actuales son:
 *   POST /api/inventory/:itemId/update-stock  → updateStock
 *   POST /api/inventory/:itemId/reserve       → reserveStock
 *   POST /api/inventory/:itemId/release       → releaseStock
 * Los endpoints GET no necesitan validación de body.
 * La creación de items de inventario no tiene ruta pública actualmente.
 *
 * USO EN RUTAS:
 *   router.post('/:itemId/update-stock', validateInventory('updateStock'), ...)
 *   router.post('/:itemId/reserve',      validateInventory('reserveStock'), ...)
 *   router.post('/:itemId/release',      validateInventory('releaseStock'), ...)
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { logMessage, LogLevel } from '../middleware/logging';
import {
  MovementType,
  UnitOfMeasure,
  StorageCondition,
  InventoryCategory,
} from '../models/Inventory';

// ============================================================================
// TIPOS
// ============================================================================

export interface InventoryValidationError {
  field: string;
  value: any;
  message: string;
  code: string;
}

interface FieldValidationResult {
  isValid: boolean;
  error?: InventoryValidationError;
  sanitizedValue?: any;
}

type FieldValidator = (value: any, allData?: Record<string, any>) => FieldValidationResult;

interface FieldSchema {
  required: boolean;
  validators: FieldValidator[];
  source?: 'body' | 'query' | 'params';
}

type InventorySchema = Record<string, FieldSchema>;

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
 * Valida que la cantidad sea un número positivo mayor a cero.
 *
 * ¿POR QUÉ NO PERMITIR NEGATIVOS?
 * La dirección del movimiento (entrada vs salida) la define el MovementType,
 * no el signo de la cantidad. Aceptar negativos crearía ambigüedad:
 *   quantity: -5 + movementType: USE = ¿entrada o salida doble?
 * La cantidad siempre es positiva; el tipo de movimiento determina el efecto.
 */
const isPositiveQuantity = (fieldName: string): FieldValidator => (value) => {
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

  if (num <= 0) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe ser mayor a cero`,
        code: 'QUANTITY_NOT_POSITIVE',
      },
    };
  }

  // Límite máximo: 1,000,000 unidades por movimiento
  // Previene errores de captura (ej: 100000 en vez de 100.000)
  if (num > 1_000_000) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} excede el límite por movimiento (1,000,000)`,
        code: 'QUANTITY_TOO_LARGE',
      },
    };
  }

  // Redondear a 3 decimales (suficiente para ml, gramos, etc.)
  return { isValid: true, sanitizedValue: Math.round(num * 1000) / 1000 };
};

/**
 * Valida el tipo de movimiento de inventario.
 *
 * ¿POR QUÉ TODOS LOS TIPOS EN updateStock Y NO EN reserve/release?
 * updateStock es la operación general: puede ser compra, uso, ajuste, robo, etc.
 * reserve/release son operaciones específicas que no necesitan tipo porque
 * su semantica ya está definida por la ruta misma.
 */
const isValidMovementType = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(MovementType);
  if (!validValues.includes(value as MovementType)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Tipo de movimiento inválido. Valores permitidos: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida la unidad de medida.
 * El sistema tiene 24 unidades que cubren peso, volumen, longitud, área,
 * unidades discretas y tiempo.
 */
const isValidUnitOfMeasure = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(UnitOfMeasure);
  if (!validValues.includes(value as UnitOfMeasure)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Unidad de medida inválida. Valores permitidos: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida la condición de almacenamiento del ítem.
 */
const isValidStorageCondition = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(StorageCondition);
  if (!validValues.includes(value as StorageCondition)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Condición de almacenamiento inválida. Valores: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida la categoría del ítem de inventario.
 */
const isValidInventoryCategory = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(InventoryCategory);
  if (!validValues.includes(value as InventoryCategory)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Categoría de inventario inválida. Valores: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida texto libre: razón del movimiento, notas, referencia de orden.
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
 * Valida que el costo unitario sea un número no negativo.
 *
 * ¿POR QUÉ PERMITIR CERO?
 * Algunos movimientos pueden ser donaciones o transferencias internas
 * con costo $0. A diferencia de las transacciones financieras donde
 * cero no tiene sentido, aquí sí puede ser válido.
 */
const isValidUnitCost = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = Number(value);
  if (isNaN(num) || num < 0) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe ser un número mayor o igual a cero`,
        code: 'INVALID_COST',
      },
    };
  }

  if (num > 10_000_000) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} excede el límite máximo permitido (10,000,000)`,
        code: 'COST_TOO_LARGE',
      },
    };
  }

  return { isValid: true, sanitizedValue: Math.round(num * 100) / 100 };
};

/**
 * Valida una fecha de vencimiento (expirationDate).
 * A diferencia de otros módulos, aquí la fecha SÍ puede ser pasada
 * porque se puede registrar un item que ya venció (para darlo de baja).
 * Solo se rechaza fechas claramente absurdas (>50 años en el futuro).
 */
const isValidExpirationDate = (fieldName: string): FieldValidator => (value) => {
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

  // Máximo 50 años en el futuro (equipos con garantía extendida)
  const maxFuture = new Date();
  maxFuture.setFullYear(maxFuture.getFullYear() + 50);
  if (date > maxFuture) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} no puede ser más de 50 años en el futuro`,
        code: 'DATE_TOO_FAR',
      },
    };
  }

  return { isValid: true, sanitizedValue: date.toISOString() };
};

/**
 * Valida que el movementType sea coherente con la operación de reserva.
 *
 * ¿POR QUÉ ESTA RESTRICCIÓN?
 * Solo tiene sentido reservar stock para operaciones internas:
 * USE (para tratamiento de un animal), TRANSFER (mover entre ubicaciones).
 * Reservar para THEFT, WASTE, EXPIRATION no tiene sentido de negocio.
 */
const isValidReservationMovementType = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const allowedForReservation = [MovementType.USE, MovementType.TRANSFER];
  if (!allowedForReservation.includes(value as MovementType)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Para reservas, movementType debe ser: ${allowedForReservation.join(', ')}`,
        code: 'INVALID_RESERVATION_TYPE',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

// ============================================================================
// ESQUEMAS DE VALIDACIÓN
// ============================================================================

export const InventorySchemas = {

  /**
   * POST /api/inventory/:itemId/update-stock
   * Registrar cualquier tipo de movimiento de inventario.
   *
   * Es la operación más general: compras, ventas, ajustes, pérdidas, etc.
   * La cantidad siempre es positiva; movementType define si entra o sale.
   *
   * Movimientos que AGREGAN stock:
   *   PURCHASE, RETURN, DONATION, PRODUCTION
   * Movimientos que REDUCEN stock:
   *   SALE, USE, WASTE, THEFT, EXPIRATION, DAMAGE
   * Movimientos NEUTROS (no cambian el total, solo el estado):
   *   TRANSFER, ADJUSTMENT
   *
   * Esta clasificación la maneja el InventoryService internamente.
   * El validador solo verifica que el tipo sea válido.
   */
  updateStock: {
    quantity: {
      required: true,
      source: 'body',
      validators: [isRequired('quantity'), isPositiveQuantity('quantity')],
    },
    movementType: {
      required: true,
      source: 'body',
      validators: [isRequired('movementType'), isValidMovementType('movementType')],
    },
    reason: {
      required: false,
      source: 'body',
      validators: [isValidText('reason', 500)],
    },
    unitCost: {
      required: false,
      source: 'body',
      validators: [isValidUnitCost('unitCost')],
    },
    unitOfMeasure: {
      required: false,
      source: 'body',
      validators: [isValidUnitOfMeasure('unitOfMeasure')],
    },
    // Número de lote para medicamentos y vacunas (trazabilidad)
    batchNumber: {
      required: false,
      source: 'body',
      validators: [isValidText('batchNumber', 100)],
    },
    expirationDate: {
      required: false,
      source: 'body',
      validators: [isValidExpirationDate('expirationDate')],
    },
    // Referencia al proveedor o a la orden de compra
    supplierId: {
      required: false,
      source: 'body',
      validators: [isValidUUID('supplierId')],
    },
    // Bovino al que se destina (aplica para USE de medicamentos)
    bovineId: {
      required: false,
      source: 'body',
      validators: [isValidUUID('bovineId')],
    },
    // ID del tratamiento veterinario relacionado
    treatmentId: {
      required: false,
      source: 'body',
      validators: [isValidUUID('treatmentId')],
    },
    notes: {
      required: false,
      source: 'body',
      validators: [isValidText('notes', 500)],
    },
  } satisfies InventorySchema,

  /**
   * POST /api/inventory/:itemId/reserve
   * Apartar unidades para uso futuro garantizado.
   *
   * Casos de uso:
   *   - Reservar medicamento antes de administrarlo a un animal
   *   - Reservar dosis de vacuna para una campaña programada
   *   - Reservar insumos para una operación quirúrgica
   *
   * ¿POR QUÉ movementType ES OPCIONAL AQUÍ?
   * La reserva siempre implica USE o TRANSFER internamente.
   * Si el usuario no lo especifica, el service asume USE por defecto.
   * Se incluye en el validador pero es opcional para no forzar al frontend.
   */
  reserveStock: {
    quantity: {
      required: true,
      source: 'body',
      validators: [isRequired('quantity'), isPositiveQuantity('quantity')],
    },
    reason: {
      required: true,
      source: 'body',
      validators: [
        isRequired('reason'),
        isValidText('reason', 500),
      ],
    },
    movementType: {
      required: false,
      source: 'body',
      validators: [isValidReservationMovementType('movementType')],
    },
    // Bovino al que se reserva (muy recomendado para trazabilidad médica)
    bovineId: {
      required: false,
      source: 'body',
      validators: [isValidUUID('bovineId')],
    },
    // Tratamiento veterinario que va a consumir la reserva
    treatmentId: {
      required: false,
      source: 'body',
      validators: [isValidUUID('treatmentId')],
    },
    // Fecha hasta la que aplica la reserva
    // Si el stock no se usa antes de esta fecha, puede liberarse automáticamente
    reservedUntil: {
      required: false,
      source: 'body',
      validators: [
        ((value) => {
          if (value === undefined || value === null || value === '') return { isValid: true };

          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return {
              isValid: false,
              error: {
                field: 'reservedUntil',
                value,
                message: 'reservedUntil debe ser una fecha válida',
                code: 'INVALID_DATE',
              },
            };
          }
          // La fecha de reserva debe ser futura
          if (date <= new Date()) {
            return {
              isValid: false,
              error: {
                field: 'reservedUntil',
                value,
                message: 'reservedUntil debe ser una fecha futura',
                code: 'PAST_DATE',
              },
            };
          }
          // Máximo 1 año de reserva
          const oneYearAhead = new Date();
          oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
          if (date > oneYearAhead) {
            return {
              isValid: false,
              error: {
                field: 'reservedUntil',
                value,
                message: 'reservedUntil no puede ser más de 1 año en el futuro',
                code: 'DATE_TOO_FAR',
              },
            };
          }
          return { isValid: true, sanitizedValue: date.toISOString() };
        }) as FieldValidator,
      ],
    },
    notes: {
      required: false,
      source: 'body',
      validators: [isValidText('notes', 500)],
    },
  } satisfies InventorySchema,

  /**
   * POST /api/inventory/:itemId/release
   * Liberar unidades previamente reservadas.
   *
   * Casos de uso:
   *   - El tratamiento fue cancelado y la reserva ya no aplica
   *   - Se usó menos cantidad de la reservada
   *   - La reserva expiró y se devuelve al stock general
   *
   * ¿POR QUÉ quantity ES OPCIONAL?
   * Si no se especifica, el service libera TODA la reserva del ítem.
   * Si se especifica, libera solo esa cantidad (liberación parcial).
   * Esto es útil cuando se usó parte de la reserva y sobró el resto.
   */
  releaseStock: {
    quantity: {
      required: false,
      source: 'body',
      validators: [isPositiveQuantity('quantity')],
    },
    reason: {
      required: true,
      source: 'body',
      validators: [
        isRequired('reason'),
        isValidText('reason', 500),
      ],
    },
    bovineId: {
      required: false,
      source: 'body',
      validators: [isValidUUID('bovineId')],
    },
    treatmentId: {
      required: false,
      source: 'body',
      validators: [isValidUUID('treatmentId')],
    },
    notes: {
      required: false,
      source: 'body',
      validators: [isValidText('notes', 500)],
    },
  } satisfies InventorySchema,

  /**
   * Esquema reutilizable para validar campos al crear/actualizar
   * un ítem de inventario (para cuando se agregue esa ruta en el futuro).
   * Por ahora no está expuesta en el router pero el validador ya existe.
   */
  createItem: {
    name: {
      required: true,
      source: 'body',
      validators: [isRequired('name'), isValidText('name', 200)],
    },
    category: {
      required: true,
      source: 'body',
      validators: [isRequired('category'), isValidInventoryCategory('category')],
    },
    unitOfMeasure: {
      required: true,
      source: 'body',
      validators: [isRequired('unitOfMeasure'), isValidUnitOfMeasure('unitOfMeasure')],
    },
    storageCondition: {
      required: false,
      source: 'body',
      validators: [isValidStorageCondition('storageCondition')],
    },
    ranchId: {
      required: true,
      source: 'body',
      validators: [isRequired('ranchId'), isValidUUID('ranchId')],
    },
    minimumStock: {
      required: false,
      source: 'body',
      validators: [isPositiveQuantity('minimumStock')],
    },
    unitCost: {
      required: false,
      source: 'body',
      validators: [isValidUnitCost('unitCost')],
    },
    description: {
      required: false,
      source: 'body',
      validators: [isValidText('description', 500)],
    },
  } satisfies InventorySchema,

} as const;

export type InventorySchemaName = keyof typeof InventorySchemas;

// ============================================================================
// MOTOR DE VALIDACIÓN
// ============================================================================

function runFieldValidators(
  value: any,
  validators: FieldValidator[],
  allData: Record<string, any>
): { error?: InventoryValidationError; sanitizedValue?: any } {
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
 * validateInventory - Middleware de validación para rutas del módulo de inventario.
 *
 * @param schemaName - Nombre del esquema en InventorySchemas
 * @returns Middleware de Express
 *
 * USO:
 *   router.post('/:itemId/update-stock', validateInventory('updateStock'), ...)
 *   router.post('/:itemId/reserve',      validateInventory('reserveStock'), ...)
 *   router.post('/:itemId/release',      validateInventory('releaseStock'), ...)
 */
export const validateInventory = (schemaName: InventorySchemaName) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const schema = InventorySchemas[schemaName];
      const errors: InventoryValidationError[] = [];
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
          'inventory_validation_failed',
          `Validación de inventario fallida [${schemaName}]`,
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
            message: 'Los datos del movimiento de inventario no son válidos',
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
        'inventory_validation_error',
        `Error interno en validateInventory [${schemaName}]: ${error}`,
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
          message: 'Error interno al validar los datos de inventario',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
};
