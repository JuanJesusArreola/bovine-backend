// validators/bovine-health.validators.ts
import { body, param, query } from 'express-validator';
import { HealthStatus } from '../models/Bovine';

/**
 * ============================================================================
 * VALIDADORES PARA EL SERVICIO BOVINEHEALTH CONTROLLER (SALUD)
 * ============================================================================
 */

/**
 * Validación para registrar un chequeo de salud
 */
export const recordHealthCheckSchema = [
  body('bovineId')
    .notEmpty()
    .withMessage('El ID del bovino es requerido')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)'),

  body('checkDate')
    .notEmpty()
    .withMessage('La fecha del chequeo es requerida')
    .isISO8601()
    .withMessage('Fecha inválida (formato ISO8601 requerido)')
    .custom((value) => {
      if (new Date(value) > new Date()) {
        throw new Error('La fecha del chequeo no puede ser futura');
      }
      return true;
    }),

  body('veterinarianId')
    .notEmpty()
    .withMessage('El ID del veterinario es requerido')
    .isUUID()
    .withMessage('ID de veterinario inválido (debe ser UUID)'),

  body('diagnosis')
    .optional()
    .isLength({ min: 3, max: 500 })
    .withMessage('El diagnóstico debe tener entre 3 y 500 caracteres'),

  body('diagnosisDetails')
    .optional()
    .isObject()
    .withMessage('Los detalles del diagnóstico deben ser un objeto'),

  body('treatment')
    .optional()
    .isLength({ min: 3, max: 500 })
    .withMessage('El tratamiento debe tener entre 3 y 500 caracteres'),

  body('treatmentDetails')
    .optional()
    .isObject()
    .withMessage('Los detalles del tratamiento deben ser un objeto'),

  body('symptoms')
    .optional()
    .isArray()
    .withMessage('Los síntomas deben ser un array'),

  body('symptoms.*')
    .optional()
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage('Cada síntoma debe tener entre 2 y 100 caracteres'),

  body('vitalSigns')
    .optional()
    .isObject()
    .withMessage('Los signos vitales deben ser un objeto'),

  body('vitalSigns.temperature')
    .optional()
    .isFloat({ min: 35, max: 42 })
    .withMessage('La temperatura debe estar entre 35°C y 42°C')
    .toFloat(),

  body('vitalSigns.heartRate')
    .optional()
    .isInt({ min: 40, max: 120 })
    .withMessage('La frecuencia cardíaca debe estar entre 40 y 120 lpm')
    .toInt(),

  body('vitalSigns.respiratoryRate')
    .optional()
    .isInt({ min: 10, max: 40 })
    .withMessage('La frecuencia respiratoria debe estar entre 10 y 40 rpm')
    .toInt(),

  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Las notas no pueden exceder los 1000 caracteres'),

  body('followUpDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de seguimiento inválida (formato ISO8601 requerido)')
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.body.checkDate)) {
        throw new Error('La fecha de seguimiento debe ser posterior al chequeo');
      }
      return true;
    }),

  body('cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El costo debe ser un número positivo')
    .toFloat()
];

/**
 * Validación para verificar si necesita chequeo
 */
export const needsHealthCheckSchema = [
  param('bovineId')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)')
];

/**
 * Validación para programar próximo chequeo
 */
export const scheduleNextHealthCheckSchema = [
  param('bovineId')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)')
];

/**
 * Validación para actualizar estado de salud
 */
export const updateHealthStatusSchema = [
  param('bovineId')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)'),

  body('healthStatus')
    .notEmpty()
    .withMessage('El estado de salud es requerido')
    .isIn(Object.values(HealthStatus))
    .withMessage(`Estado de salud inválido. Valores permitidos: ${Object.values(HealthStatus).join(', ')}`),

  body('reason')
    .optional()
    .isLength({ min: 3, max: 500 })
    .withMessage('La razón debe tener entre 3 y 500 caracteres')
];

/**
 * Validación para obtener historial de salud
 */
export const getHealthHistorySchema = [
  param('bovineId')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)'),

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
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe estar entre 1 y 100')
    .toInt()
];

/**
 * Validación para obtener estadísticas de salud del hato
 */
export const getHerdHealthStatsSchema = [
  param('ranchId')
    .isUUID()
    .withMessage('ID de rancho inválido (debe ser UUID)')
];

/**
 * Validación para obtener línea de tiempo de salud
 */
export const getHealthTimelineSchema = [
  param('bovineId')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)'),

  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Los días deben estar entre 1 y 365')
    .toInt()
];