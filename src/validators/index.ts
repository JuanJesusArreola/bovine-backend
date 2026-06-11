// validators/index.ts
import { Request, Response, NextFunction } from 'express';
import { ValidationChain, validationResult } from 'express-validator';
import { logMessage, LogLevel } from '../middleware/logging';

/**
 * ============================================================================
 * EXPORTACIONES UNIFICADAS DE VALIDADORES
 * ============================================================================
 */

// Bovino CRUD
export * from './bovine.validators';

// Mapas
export * from './bovine-geo.validators';

// Salud
export * from './bovine-health.validators';

// Vacunación
export * from './vaccination.validators';

// Tracking GPS
export * from './bovine-tracking.validators';

// Ubicaciones lógicas
export * from './bovine-location.validators';

// Finanzas
export * from './finance.validators';

// Reproducción
export * from './reproduction.validators';

// Producción (leche, carne, etc.)
export * from './production.validators';

// Inventario y movimientos de stock
export * from './inventory.validators';

// Ranchos
export * from './ranch.validators';

// Administración (creación de usuarios por admin)
export * from './admin.validators';

/**
 * ============================================================================
 * MIDDLEWARE RUNNER PARA express-validator
 * ============================================================================
 *
 * Ejecuta un array de ValidationChain y, si hay errores, devuelve
 * una respuesta 400 con el mismo formato que el resto del sistema.
 *
 * Uso en rutas:
 *   import { createBovineSchema, runValidation } from '../validators';
 *   router.post('/', ...createBovineSchema, runValidation, controller.create);
 */
export const runValidation = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    next();
    return;
  }

  const fieldErrors = errors.array().map((err: any) => ({
    field: err.path || err.param,
    value: err.value,
    message: err.msg,
    code: 'VALIDATION_ERROR'
  }));

  logMessage(
    LogLevel.WARN,
    'validation_failed',
    `Validación fallida (express-validator)`,
    {
      userId: req.userId,
      userEmail: req.user?.email,
      errors: fieldErrors,
      data: req.body
    }
  );

  res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Error de validación de datos',
      details: {
        fieldErrors,
        totalErrors: fieldErrors.length
      },
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method
    }
  });
};
