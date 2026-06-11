// validators/bovine-tracking.validators.ts
import { body, param, query } from 'express-validator';
import { TrackingSource } from '../models/BovineTracking';
import { HealthStatus } from '../models/Bovine';

/**
 * ============================================================================
 * VALIDADORES PARA EL SERVICIO BOVINETRACKING CONTROLLER (GPS)
 * ============================================================================
 */

/**
 * Validación para registrar un punto de ubicación
 */
export const recordLocationSchema = [
  body('bovineId')
    .notEmpty()
    .withMessage('El ID del bovino es requerido')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)'),

  body('latitude')
    .notEmpty()
    .withMessage('La latitud es requerida')
    .isFloat({ min: -90, max: 90 })
    .withMessage('La latitud debe estar entre -90 y 90 grados')
    .toFloat(),

  body('longitude')
    .notEmpty()
    .withMessage('La longitud es requerida')
    .isFloat({ min: -180, max: 180 })
    .withMessage('La longitud debe estar entre -180 y 180 grados')
    .toFloat(),

  body('altitude')
    .optional()
    .isFloat({ min: -500, max: 9000 })
    .withMessage('La altitud debe estar entre -500 y 9000 metros')
    .toFloat(),

  body('accuracy')
    .optional()
    .isFloat({ min: 0, max: 1000 })
    .withMessage('La precisión debe ser un número positivo')
    .toFloat(),

  body('speed')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('La velocidad debe estar entre 0 y 100 km/h')
    .toFloat(),

  body('heading')
    .optional()
    .isFloat({ min: 0, max: 360 })
    .withMessage('El rumbo debe estar entre 0 y 360 grados')
    .toFloat(),

  body('batteryLevel')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('El nivel de batería debe estar entre 0 y 100')
    .toInt(),

  body('deviceId')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('El ID del dispositivo debe tener entre 1 y 100 caracteres'),

  body('recordedAt')
    .optional()
    .isISO8601()
    .withMessage('Fecha de registro inválida (formato ISO8601 requerido)')
    .custom((value) => {
      if (new Date(value) > new Date()) {
        throw new Error('La fecha de registro no puede ser futura');
      }
      return true;
    }),

  body('source')
    .optional()
    .isIn(Object.values(TrackingSource))
    .withMessage(`Fuente de tracking inválida. Valores permitidos: ${Object.values(TrackingSource).join(', ')}`),

  body('healthStatusAtTime')
    .optional()
    .isIn(Object.values(HealthStatus))
    .withMessage('Estado de salud inválido')
];

/**
 * Validación para registrar múltiples ubicaciones
 */
export const recordBatchLocationsSchema = [
  body('points')
    .notEmpty()
    .withMessage('El array de puntos es requerido')
    .isArray()
    .withMessage('points debe ser un array'),

  body('points.*.bovineId')
    .notEmpty()
    .withMessage('El ID del bovino es requerido')
    .isUUID()
    .withMessage('ID de bovino inválido'),

  body('points.*.latitude')
    .notEmpty()
    .withMessage('La latitud es requerida')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitud inválida'),

  body('points.*.longitude')
    .notEmpty()
    .withMessage('La longitud es requerida')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitud inválida'),

  body('points.*.recordedAt')
    .optional()
    .isISO8601()
    .withMessage('Fecha de registro inválida')
];

/**
 * Validación para obtener última ubicación
 */
export const getLastLocationSchema = [
  param('bovineId')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)')
];

/**
 * Validación para obtener historial de ubicaciones
 */
export const getTrackingHistorySchema = [
  param('bovineId')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)'),

  query('startDate')
    .notEmpty()
    .withMessage('La fecha de inicio es requerida')
    .isISO8601()
    .withMessage('Fecha de inicio inválida'),

  query('endDate')
    .notEmpty()
    .withMessage('La fecha de fin es requerida')
    .isISO8601()
    .withMessage('Fecha de fin inválida')
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.query?.startDate as string)) {
        throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
      }
      return true;
    }),

  query('maxPoints')
    .optional()
    .isInt({ min: 10, max: 10000 })
    .withMessage('maxPoints debe estar entre 10 y 10000')
    .toInt()
];

/**
 * Validación para obtener ruta de movimiento
 */
export const getMovementPathSchema = [
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
];

/**
 * Validación para obtener estadísticas de movimiento
 */
export const getMovementStatsSchema = [
  param('bovineId')
    .isUUID()
    .withMessage('ID de bovino inválido'),

  query('date')
    .notEmpty()
    .withMessage('La fecha es requerida')
    .isISO8601()
    .withMessage('Fecha inválida')
];

/**
 * Validación para calcular distancia
 */
export const calculateDistanceSchema = [
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
];

/**
 * Validación para obtener estado del dispositivo
 */
export const getDeviceStatusSchema = [
  param('deviceId')
    .notEmpty()
    .withMessage('El ID del dispositivo es requerido')
    .isLength({ min: 1, max: 100 })
    .withMessage('ID de dispositivo inválido')
];