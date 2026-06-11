// validators/bovine-geo.validators.ts
import { body, query, param } from 'express-validator';
import { HealthStatus } from '../models/Bovine';

/**
 * ============================================================================
 * VALIDADORES PARA EL SERVICIO BOVINEGEO CONTROLLER (MAPAS)
 * ============================================================================
 */

/**
 * Validación para obtener datos de heatmap
 */
export const getHeatmapSchema = [
  param('ranchId')
    .isUUID()
    .withMessage('ID de rancho inválido (debe ser UUID)'),

  query('healthStatus')
    .optional()
    .customSanitizer(value => {
      if (typeof value === 'string') {
        return value.split(',');
      }
      return value;
    })
    .custom(value => {
      if (value && !Array.isArray(value)) {
        throw new Error('healthStatus debe ser un array o string separado por comas');
      }
      
      if (value && value.some((v: string) => !(Object.values(HealthStatus) as string[]).includes(v))) {
        throw new Error(`Estado de salud inválido. Valores permitidos: ${Object.values(HealthStatus).join(', ')}`);
      }
      return true;
    }),

  query('breeds')
    .optional()
    .customSanitizer(value => {
      if (typeof value === 'string') {
        return value.split(',');
      }
      return value;
    })
    .custom(value => {
      if (value && !Array.isArray(value)) {
        throw new Error('breeds debe ser un array o string separado por comas');
      }
      return true;
    }),

  query('ageMin')
    .optional()
    .isInt({ min: 0, max: 240 })
    .withMessage('Edad mínima debe estar entre 0 y 240 meses')
    .toInt(),

  query('ageMax')
    .optional()
    .isInt({ min: 0, max: 240 })
    .withMessage('Edad máxima debe estar entre 0 y 240 meses')
    .toInt()
    .custom((value, { req }) => {
      if (req.query?.ageMin && value < parseInt(req.query.ageMin as string)) {
        throw new Error('La edad máxima debe ser mayor o igual a la edad mínima');
      }
      return true;
    }),

  query('diseases')
    .optional()
    .customSanitizer(value => {
      if (typeof value === 'string') {
        return value.split(',');
      }
      return value;
    })
    .custom(value => {
      if (value && !Array.isArray(value)) {
        throw new Error('diseases debe ser un array o string separado por comas');
      }
      return true;
    })
];

/**
 * Validación para obtener clusters
 */
export const getClustersSchema = [
  param('ranchId')
    .isUUID()
    .withMessage('ID de rancho inválido (debe ser UUID)'),

  body('bounds')
    .notEmpty()
    .withMessage('Los límites del mapa son requeridos'),

  body('bounds.north')
    .notEmpty()
    .withMessage('El límite norte es requerido')
    .isFloat({ min: -90, max: 90 })
    .withMessage('El límite norte debe estar entre -90 y 90 grados')
    .toFloat(),

  body('bounds.south')
    .notEmpty()
    .withMessage('El límite sur es requerido')
    .isFloat({ min: -90, max: 90 })
    .withMessage('El límite sur debe estar entre -90 y 90 grados')
    .toFloat()
    .custom((value, { req }) => {
      if (value > req.body?.bounds?.north) {
        throw new Error('El límite sur debe ser menor al límite norte');
      }
      return true;
    }),

  body('bounds.east')
    .notEmpty()
    .withMessage('El límite este es requerido')
    .isFloat({ min: -180, max: 180 })
    .withMessage('El límite este debe estar entre -180 y 180 grados')
    .toFloat(),

  body('bounds.west')
    .notEmpty()
    .withMessage('El límite oeste es requerido')
    .isFloat({ min: -180, max: 180 })
    .withMessage('El límite oeste debe estar entre -180 y 180 grados')
    .toFloat()
    .custom((value, { req }) => {
      if (value > req.body?.bounds?.east) {
        throw new Error('El límite oeste debe ser menor al límite este');
      }
      return true;
    }),

  body('zoom')
    .notEmpty()
    .withMessage('El nivel de zoom es requerido')
    .isInt({ min: 0, max: 20 })
    .withMessage('El nivel de zoom debe estar entre 0 y 20')
    .toInt(),

  body('filters')
    .optional()
    .isObject()
    .withMessage('Los filtros deben ser un objeto'),

  body('filters.healthStatus')
    .optional()
    .isArray()
    .withMessage('healthStatus debe ser un array')
    .custom(value => {
      if (value && value.some((v: string) => !(Object.values(HealthStatus) as string[]).includes(v))) {
        throw new Error('Estado de salud inválido');
      }
      return true;
    })
];

/**
 * Validación para expandir cluster
 */
export const expandClusterSchema = [
  param('ranchId')
    .isUUID()
    .withMessage('ID de rancho inválido (debe ser UUID)'),

  body('bounds')
    .notEmpty()
    .withMessage('Los límites del cluster son requeridos'),

  body('bounds.north')
    .isFloat({ min: -90, max: 90 })
    .withMessage('El límite norte debe estar entre -90 y 90 grados'),

  body('bounds.south')
    .isFloat({ min: -90, max: 90 })
    .withMessage('El límite sur debe estar entre -90 y 90 grados'),

  body('bounds.east')
    .isFloat({ min: -180, max: 180 })
    .withMessage('El límite este debe estar entre -180 y 180 grados'),

  body('bounds.west')
    .isFloat({ min: -180, max: 180 })
    .withMessage('El límite oeste debe estar entre -180 y 180 grados'),

  body('filters')
    .optional()
    .isObject()
    .withMessage('Los filtros deben ser un objeto')
];

/**
 * Validación para obtener punto de bovino
 */
export const getBovinePointSchema = [
  param('bovineId')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)')
];

/**
 * Validación para refrescar snapshots
 */
export const refreshSnapshotsSchema = [
  param('ranchId')
    .isUUID()
    .withMessage('ID de rancho inválido (debe ser UUID)')
];