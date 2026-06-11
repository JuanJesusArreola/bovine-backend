// validators/vaccination.validators.ts
// ============================================================================
// VACCINATION VALIDATORS
// ============================================================================
// Schemas express-validator para los endpoints de vacunación.
// Patrón consistente con `bovine-health.validators.ts`.
// ============================================================================

import { body, param, query } from 'express-validator';
import { VaccineType, ApplicationRoute } from '../models/Vaccination';

/**
 * POST /api/bovines/:id/vaccinations
 * Registrar una nueva vacuna.
 */
export const createVaccinationSchema = [
  param('id')
    .isUUID()
    .withMessage('ID de bovino inválido (UUID requerido)'),

  body('vaccineType')
    .notEmpty()
    .withMessage('vaccineType es requerido')
    .isIn(Object.values(VaccineType))
    .withMessage(`vaccineType debe ser uno de: ${Object.values(VaccineType).join(', ')}`),

  body('vaccineName')
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ min: 1, max: 150 })
    .withMessage('vaccineName debe tener entre 1 y 150 caracteres'),

  body('manufacturer')
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ min: 1, max: 150 }),

  body('batchNumber')
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ min: 1, max: 100 }),

  body('doseNumber')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('doseNumber debe ser entero entre 1 y 20')
    .toInt(),

  body('doseAmountMl')
    .optional()
    .isFloat({ min: 0, max: 1000 })
    .withMessage('doseAmountMl debe ser número >= 0')
    .toFloat(),

  body('applicationRoute')
    .optional()
    .isIn(Object.values(ApplicationRoute))
    .withMessage(`applicationRoute debe ser uno de: ${Object.values(ApplicationRoute).join(', ')}`),

  body('applicationDate')
    .notEmpty()
    .withMessage('applicationDate es requerido')
    .isISO8601()
    .withMessage('applicationDate debe ser ISO8601')
    .custom((value) => {
      if (new Date(value) > new Date()) {
        throw new Error('applicationDate no puede ser futura');
      }
      return true;
    }),

  body('nextDueDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('nextDueDate debe ser ISO8601')
    .custom((value, { req }) => {
      const next = new Date(value);
      const app = req.body?.applicationDate ? new Date(req.body.applicationDate) : null;
      if (app && next <= app) {
        throw new Error('nextDueDate debe ser posterior a applicationDate');
      }
      return true;
    }),

  body('applicatorId')
    .optional({ checkFalsy: true })
    .isUUID()
    .withMessage('applicatorId debe ser UUID'),

  body('withdrawalPeriodDays')
    .optional()
    .isInt({ min: 0, max: 365 })
    .withMessage('withdrawalPeriodDays debe ser entero entre 0 y 365')
    .toInt(),

  body('immunityDurationDays')
    .optional()
    .isInt({ min: 0, max: 3650 })
    .withMessage('immunityDurationDays debe ser entero entre 0 y 3650')
    .toInt(),

  body('notes')
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ max: 2000 }),

  body('metadata')
    .optional()
    .isObject()
    .withMessage('metadata debe ser un objeto'),
];

/**
 * GET /api/bovines/:id/vaccinations
 * Filtros para listado.
 */
export const listVaccinationsSchema = [
  param('id')
    .isUUID()
    .withMessage('ID de bovino inválido (UUID requerido)'),

  query('vaccineType')
    .optional()
    .isIn(Object.values(VaccineType))
    .withMessage(`vaccineType debe ser uno de: ${Object.values(VaccineType).join(', ')}`),

  query('applicatorId')
    .optional()
    .isUUID()
    .withMessage('applicatorId debe ser UUID'),

  query('fromDate')
    .optional()
    .isISO8601()
    .withMessage('fromDate debe ser ISO8601'),

  query('toDate')
    .optional()
    .isISO8601()
    .withMessage('toDate debe ser ISO8601'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .toInt(),

  query('offset')
    .optional()
    .isInt({ min: 0 })
    .toInt(),
];

/**
 * GET /api/bovines/:id/vaccination-status
 */
export const getVaccinationStatusSchema = [
  param('id')
    .isUUID()
    .withMessage('ID de bovino inválido (UUID requerido)'),
];

/**
 * DELETE /api/vaccinations/:vaccinationId
 */
export const deleteVaccinationSchema = [
  param('vaccinationId')
    .isUUID()
    .withMessage('ID de vacuna inválido (UUID requerido)'),
];

/**
 * PATCH /api/vaccinations/:vaccinationId  (V-04)
 * Edición parcial: todos los campos opcionales.
 */
export const updateVaccinationSchema = [
  param('vaccinationId')
    .isUUID()
    .withMessage('ID de vacuna inválido (UUID requerido)'),

  body('vaccineType')
    .optional()
    .isIn(Object.values(VaccineType))
    .withMessage(`vaccineType debe ser uno de: ${Object.values(VaccineType).join(', ')}`),

  body('vaccineName').optional({ nullable: true }).isString().isLength({ max: 150 }),
  body('manufacturer').optional({ nullable: true }).isString().isLength({ max: 150 }),
  body('batchNumber').optional({ nullable: true }).isString().isLength({ max: 100 }),

  body('doseNumber').optional().isInt({ min: 1, max: 20 }).toInt(),
  body('doseAmountMl').optional({ nullable: true }).isFloat({ min: 0, max: 1000 }).toFloat(),

  body('applicationRoute')
    .optional({ nullable: true })
    .isIn(Object.values(ApplicationRoute))
    .withMessage(`applicationRoute debe ser uno de: ${Object.values(ApplicationRoute).join(', ')}`),

  body('applicationDate')
    .optional()
    .isISO8601()
    .withMessage('applicationDate debe ser ISO8601')
    .custom((value) => {
      if (new Date(value) > new Date()) throw new Error('applicationDate no puede ser futura');
      return true;
    }),

  body('nextDueDate')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('nextDueDate debe ser ISO8601'),

  body('applicatorId').optional().isUUID().withMessage('applicatorId debe ser UUID'),
  body('withdrawalPeriodDays').optional({ nullable: true }).isInt({ min: 0, max: 365 }).toInt(),
  body('immunityDurationDays').optional({ nullable: true }).isInt({ min: 0, max: 3650 }).toInt(),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  body('metadata').optional({ nullable: true }).isObject(),
];
