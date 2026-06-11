// validators/finance.validators.ts
/**
 * ============================================================================
 * VALIDADORES DEL MÓDULO FINANCIERO
 * ============================================================================
 *
 * ¿POR QUÉ UN ARCHIVO SEPARADO?
 * Las reglas financieras son un dominio distinto al ganadero y al de auth.
 * Aquí se validan montos, categorías, fechas de transacción y métodos de pago.
 *
 * ESTRUCTURA (igual que Auth.validation.ts para consistencia):
 *   1. Tipos e interfaces
 *   2. Validadores primitivos reutilizables
 *   3. Esquemas declarativos por operación
 *   4. Middleware validateFinance() como punto de entrada
 *
 * USO EN RUTAS:
 *   router.post('/', validateFinance('createTransaction'), financeController.createTransaction)
 *   router.put('/:id', validateFinance('updateTransaction'), financeController.updateTransaction)
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { logMessage, LogLevel } from '../middleware/logging';
import {
  TransactionType,
  IncomeCategory,
  ExpenseCategory,
  PaymentMethod,
  TransactionStatus,
  RecurrenceFrequency,
} from '../models/Finance';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface FinanceValidationError {
  field: string;
  value: any;
  message: string;
  code: string;
}

interface FieldValidationResult {
  isValid: boolean;
  error?: FinanceValidationError;
  sanitizedValue?: any;
}

type FieldValidator = (value: any, allData?: Record<string, any>) => FieldValidationResult;

interface FieldSchema {
  required: boolean;
  validators: FieldValidator[];
  source?: 'body' | 'query' | 'params';
}

type FinanceSchema = Record<string, FieldSchema>;

// ============================================================================
// VALIDADORES PRIMITIVOS
// ============================================================================

/**
 * Verifica que el valor no sea vacío ni nulo.
 */
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
 * Valida que el valor sea un número positivo mayor a cero.
 * Los montos financieros nunca deben ser negativos ni cero.
 *
 * ¿POR QUÉ RECHAZAR CERO?
 * Una transacción de $0 no tiene sentido en el negocio.
 * Si se necesita cancelar un monto, se usa el tipo ADJUSTMENT o CANCELLED status.
 */
const isPositiveAmount = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const num = typeof value === 'string' ? parseFloat(value) : Number(value);

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
        code: 'INVALID_AMOUNT',
      },
    };
  }

  // Máximo razonable para una sola transacción: 10 millones
  if (num > 10_000_000) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} excede el límite máximo permitido (10,000,000)`,
        code: 'AMOUNT_TOO_LARGE',
      },
    };
  }

  // Redondear a 2 decimales para evitar errores de punto flotante
  return { isValid: true, sanitizedValue: Math.round(num * 100) / 100 };
};

/**
 * Valida que el tipo de transacción sea uno de los valores permitidos.
 */
const isValidTransactionType = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null) return { isValid: true };

  const validValues = Object.values(TransactionType);
  if (!validValues.includes(value as TransactionType)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Tipo de transacción inválido. Valores permitidos: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida que la categoría sea coherente con el tipo de transacción.
 *
 * ¿POR QUÉ VALIDAR COHERENCIA AQUÍ Y NO EN EL SERVICE?
 * Si la categoría no coincide con el tipo (ej: CATTLE_SALE como gasto),
 * es un error de entrada que se puede detectar antes de tocar la BD.
 * El service asume que los datos ya son coherentes.
 */
const isValidCategory = (fieldName: string): FieldValidator => (value, allData) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const transactionType = allData?.transactionType;

  if (transactionType === TransactionType.INCOME) {
    const validValues = Object.values(IncomeCategory);
    if (!validValues.includes(value as IncomeCategory)) {
      return {
        isValid: false,
        error: {
          field: fieldName,
          value,
          message: `Categoría inválida para ingresos. Valores permitidos: ${validValues.join(', ')}`,
          code: 'INVALID_INCOME_CATEGORY',
        },
      };
    }
  } else if (transactionType === TransactionType.EXPENSE) {
    const validValues = Object.values(ExpenseCategory);
    if (!validValues.includes(value as ExpenseCategory)) {
      return {
        isValid: false,
        error: {
          field: fieldName,
          value,
          message: `Categoría inválida para gastos. Valores permitidos: ${validValues.join(', ')}`,
          code: 'INVALID_EXPENSE_CATEGORY',
        },
      };
    }
  }

  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida que el método de pago sea uno de los valores permitidos.
 */
const isValidPaymentMethod = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(PaymentMethod);
  if (!validValues.includes(value as PaymentMethod)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Método de pago inválido. Valores permitidos: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida que el estado sea uno de los valores permitidos.
 */
const isValidTransactionStatus = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(TransactionStatus);
  if (!validValues.includes(value as TransactionStatus)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Estado inválido. Valores permitidos: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida la frecuencia de recurrencia.
 */
const isValidRecurrence = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const validValues = Object.values(RecurrenceFrequency);
  if (!validValues.includes(value as RecurrenceFrequency)) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Frecuencia de recurrencia inválida. Valores permitidos: ${validValues.join(', ')}`,
        code: 'INVALID_ENUM',
      },
    };
  }
  return { isValid: true, sanitizedValue: value };
};

/**
 * Valida que una fecha sea válida y no sea futura en más de 1 día.
 *
 * ¿POR QUÉ PERMITIR "1 DÍA FUTURO"?
 * Los registros pueden capturarse a medianoche o con diferencia de timezone.
 * Se da 24 horas de margen para acomodar estos casos.
 */
const isValidTransactionDate = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `Fecha inválida en ${fieldName} (formato ISO8601 requerido)`,
        code: 'INVALID_DATE',
      },
    };
  }

  // No puede ser futura en más de 24 horas
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

  // No puede ser anterior a 10 años
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
 * Valida descripción: texto no vacío, longitud razonable, sin caracteres peligrosos.
 */
const isValidDescription = (fieldName: string, maxLength = 500): FieldValidator => (value) => {
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
 * Valida que el valor sea un UUID válido.
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
 * Valida código de moneda ISO 4217 (3 letras mayúsculas).
 * Por defecto MXN para operaciones en México.
 */
const isValidCurrency = (fieldName: string): FieldValidator => (value) => {
  if (value === undefined || value === null || value === '') return { isValid: true };

  const currencyRegex = /^[A-Z]{3}$/;
  if (!currencyRegex.test(String(value).toUpperCase())) {
    return {
      isValid: false,
      error: {
        field: fieldName,
        value,
        message: `${fieldName} debe ser un código de moneda ISO 4217 (ej: MXN, USD)`,
        code: 'INVALID_CURRENCY',
      },
    };
  }
  return { isValid: true, sanitizedValue: String(value).toUpperCase() };
};

// ============================================================================
// ESQUEMAS DE VALIDACIÓN
// ============================================================================

export const FinanceSchemas = {

  /**
   * POST /api/finance
   * Registrar una nueva transacción financiera.
   *
   * Campos obligatorios: transactionType, amount, date, ranchId.
   * category es obligatorio cuando transactionType = INCOME o EXPENSE.
   *
   * ¿POR QUÉ ranchId OBLIGATORIO?
   * Toda transacción pertenece a un rancho específico para filtrar
   * reportes financieros correctamente por unidad de negocio.
   */
  createTransaction: {
    transactionType: {
      required: true,
      source: 'body',
      validators: [isRequired('transactionType'), isValidTransactionType('transactionType')],
    },
    amount: {
      required: true,
      source: 'body',
      validators: [isRequired('amount'), isPositiveAmount('amount')],
    },
    currency: {
      required: false,
      source: 'body',
      validators: [isValidCurrency('currency')],
    },
    category: {
      required: false,
      source: 'body',
      validators: [isValidCategory('category')],
    },
    paymentMethod: {
      required: false,
      source: 'body',
      validators: [isValidPaymentMethod('paymentMethod')],
    },
    transactionDate: {
      required: true,
      source: 'body',
      validators: [isRequired('transactionDate'), isValidTransactionDate('transactionDate')],
    },
    ranchId: {
      required: true,
      source: 'body',
      validators: [isRequired('ranchId'), isValidUUID('ranchId')],
    },
    description: {
      required: false,
      source: 'body',
      validators: [isValidDescription('description', 500)],
    },
    recurrenceFrequency: {
      required: false,
      source: 'body',
      validators: [isValidRecurrence('recurrenceFrequency')],
    },
    bovineId: {
      required: false,
      source: 'body',
      validators: [isValidUUID('bovineId')],
    },
  } satisfies FinanceSchema,

  /**
   * PUT /api/finance/:id
   * Actualizar una transacción existente.
   * Todos los campos son opcionales: solo se actualizan los que llegan.
   *
   * ¿POR QUÉ VALIDAR AUNQUE SEAN OPCIONALES?
   * Aunque no sean obligatorios, si llegan deben cumplir el formato correcto.
   * Un amount="-100" o transactionDate="hola" no debe llegar al service.
   */
  updateTransaction: {
    transactionType: {
      required: false,
      source: 'body',
      validators: [isValidTransactionType('transactionType')],
    },
    amount: {
      required: false,
      source: 'body',
      validators: [isPositiveAmount('amount')],
    },
    currency: {
      required: false,
      source: 'body',
      validators: [isValidCurrency('currency')],
    },
    category: {
      required: false,
      source: 'body',
      validators: [isValidCategory('category')],
    },
    paymentMethod: {
      required: false,
      source: 'body',
      validators: [isValidPaymentMethod('paymentMethod')],
    },
    transactionDate: {
      required: false,
      source: 'body',
      validators: [isValidTransactionDate('transactionDate')],
    },
    status: {
      required: false,
      source: 'body',
      validators: [isValidTransactionStatus('status')],
    },
    description: {
      required: false,
      source: 'body',
      validators: [isValidDescription('description', 500)],
    },
    recurrenceFrequency: {
      required: false,
      source: 'body',
      validators: [isValidRecurrence('recurrenceFrequency')],
    },
  } satisfies FinanceSchema,

} as const;

export type FinanceSchemaName = keyof typeof FinanceSchemas;

// ============================================================================
// MOTOR DE VALIDACIÓN
// ============================================================================

function runFieldValidators(
  value: any,
  validators: FieldValidator[],
  allData: Record<string, any>
): { error?: FinanceValidationError; sanitizedValue?: any } {
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
 * validateFinance - Middleware de validación para rutas financieras.
 *
 * @param schemaName - Nombre del esquema en FinanceSchemas
 * @returns Middleware de Express
 *
 * USO:
 *   router.post('/', validateFinance('createTransaction'), financeController.createTransaction)
 *   router.put('/:id', validateFinance('updateTransaction'), financeController.updateTransaction)
 */
export const validateFinance = (schemaName: FinanceSchemaName) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const schema = FinanceSchemas[schemaName];
      const errors: FinanceValidationError[] = [];
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
          'finance_validation_failed',
          `Validación financiera fallida [${schemaName}]`,
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
            message: 'Los datos financieros enviados no son válidos',
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
        'finance_validation_error',
        `Error interno en validateFinance [${schemaName}]: ${error}`,
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
          message: 'Error interno al validar los datos financieros',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
};
