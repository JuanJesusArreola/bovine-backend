// validators/bovine-location.validators.ts
import { body, param, query } from 'express-validator';
import { MovementReason, MovementType } from '../models/BovineLocationHistory';

/**
 * ============================================================================
 * VALIDADORES PARA EL SERVICIO BOVINELOCATION CONTROLLER (UBICACIONES LÓGICAS)
 * ============================================================================
 */

/**
 * Validación para registrar entrada a una ubicación
 */
export const recordEntrySchema = [
  body('bovineId')
    .notEmpty()
    .withMessage('El ID del bovino es requerido')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)'),

  body('locationId')
    .notEmpty()
    .withMessage('El ID de la ubicación es requerido')
    .isUUID()
    .withMessage('ID de ubicación inválido (debe ser UUID)'),

  body('enteredAt')
    .optional()
    .isISO8601()
    .withMessage('Fecha de entrada inválida (formato ISO8601 requerido)')
    .custom((value) => {
      if (new Date(value) > new Date()) {
        throw new Error('La fecha de entrada no puede ser futura');
      }
      return true;
    }),

  body('reason')
    .notEmpty()
    .withMessage('La razón del movimiento es requerida')
    .isIn(Object.values(MovementReason))
    .withMessage(`Razón inválida. Valores permitidos: ${Object.values(MovementReason).join(', ')}`),

  body('movementType')
    .notEmpty()
    .withMessage('El tipo de movimiento es requerido')
    .isIn(Object.values(MovementType))
    .withMessage(`Tipo de movimiento inválido. Valores permitidos: ${Object.values(MovementType).join(', ')}`),

  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Las notas no pueden exceder los 500 caracteres'),

  body('eventId')
    .optional()
    .isUUID()
    .withMessage('ID de evento inválido (debe ser UUID)')
];

/**
 * Validación para registrar salida de una ubicación
 */
export const recordExitSchema = [
  body('bovineId')
    .notEmpty()
    .withMessage('El ID del bovino es requerido')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)'),

  body('exitedAt')
    .optional()
    .isISO8601()
    .withMessage('Fecha de salida inválida (formato ISO8601 requerido)')
    .custom((value) => {
      if (new Date(value) > new Date()) {
        throw new Error('La fecha de salida no puede ser futura');
      }
      return true;
    }),

  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Las notas no pueden exceder los 500 caracteres')
];

/**
 * Validación para obtener ubicación actual
 */
export const getCurrentLocationSchema = [
  param('bovineId')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)')
];

/**
 * Validación para obtener bovinos en una ubicación
 */
export const getCurrentBovinesAtLocationSchema = [
  param('locationId')
    .isUUID()
    .withMessage('ID de ubicación inválido (debe ser UUID)')
];

/**
 * Validación para obtener historial de ubicaciones
 */
export const getLocationHistorySchema = [
  param('bovineId')
    .isUUID()
    .withMessage('ID de bovino inválido'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de inicio inválida'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de fin inválida'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('El límite debe estar entre 1 y 1000')
    .toInt()
];

/**
 * Validación para calcular tiempo por ubicación
 */
export const getTimeSpentPerLocationSchema = [
  param('bovineId')
    .isUUID()
    .withMessage('ID de bovino inválido'),

  query('startDate')
    .notEmpty()
    .withMessage('La fecha de inicio es requerida')
    .isISO8601(),

  query('endDate')
    .notEmpty()
    .withMessage('La fecha de fin es requerida')
    .isISO8601()
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.query?.startDate as string)) {
        throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
      }
      return true;
    })
];

/**
 * Validación para generar reporte de movimientos
 */
export const generateMovementReportSchema = [
  param('ranchId')
    .isUUID()
    .withMessage('ID de rancho inválido (debe ser UUID)'),

  query('startDate')
    .notEmpty()
    .withMessage('La fecha de inicio es requerida')
    .isISO8601(),

  query('endDate')
    .notEmpty()
    .withMessage('La fecha de fin es requerida')
    .isISO8601()
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.query?.startDate as string)) {
        throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
      }
      return true;
    })
];

/**
 * Validación para obtener utilización de potreros
 */
export const getPastureUtilizationSchema = [
  param('ranchId')
    .isUUID()
    .withMessage('ID de rancho inválido'),

  query('startDate')
    .notEmpty()
    .withMessage('La fecha de inicio es requerida')
    .isISO8601(),

  query('endDate')
    .notEmpty()
    .withMessage('La fecha de fin es requerida')
    .isISO8601()
];