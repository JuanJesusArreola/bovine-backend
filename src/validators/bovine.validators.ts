// validators/bovine.validators.ts
import { body, param, query } from 'express-validator';
import { CattleType, GenderType, HealthStatus, VaccinationStatus } from '../models/Bovine';

/**
 * ============================================================================
 * VALIDADORES PARA EL SERVICIO BOVINECONTROLLER (CRUD)
 * ============================================================================
 */

/**
 * Validación para crear un nuevo bovino
 */
export const createBovineSchema = [
  // Arete (obligatorio)
  body('earTag')
    .notEmpty()
    .withMessage('El arete es requerido')
    .isLength({ min: 3, max: 50 })
    .withMessage('El arete debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9-]+$/)
    .withMessage('El arete solo puede contener letras, números y guiones'),

  // Nombre (opcional)
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios'),

  // Tipo de ganado (obligatorio)
  body('cattleType')
    .notEmpty()
    .withMessage('El tipo de ganado es requerido')
    .isIn(Object.values(CattleType))
    .withMessage(`Tipo de ganado inválido. Valores permitidos: ${Object.values(CattleType).join(', ')}`),

  // Raza (obligatorio)
  body('breed')
    .notEmpty()
    .withMessage('La raza es requerida')
    .isLength({ min: 2, max: 100 })
    .withMessage('La raza debe tener entre 2 y 100 caracteres'),

  // Género (obligatorio)
  body('gender')
    .notEmpty()
    .withMessage('El género es requerido')
    .isIn(Object.values(GenderType))
    .withMessage(`Género inválido. Valores permitidos: ${Object.values(GenderType).join(', ')}`),

  // Fecha de nacimiento (obligatorio)
  body('birthDate')
    .notEmpty()
    .withMessage('La fecha de nacimiento es requerida')
    .isISO8601()
    .withMessage('Fecha de nacimiento inválida (formato ISO8601 requerido)')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();

      // No puede ser futura
      if (birthDate > today) {
        throw new Error('La fecha de nacimiento no puede ser futura');
      }

      // No puede ser muy antigua (más de 20 años)
      const maxAge = new Date();
      maxAge.setFullYear(maxAge.getFullYear() - 20);
      if (birthDate < maxAge) {
        throw new Error('La fecha de nacimiento es muy antigua (máximo 20 años)');
      }

      return true;
    }),

  // Peso (opcional)
  body('weight')
    .optional()
    .isFloat({ min: 1, max: 2000 })
    .withMessage('El peso debe estar entre 1 y 2000 kg')
    .toFloat(),

  // Ubicación - Latitud (opcional — el animal puede registrarse sin coordenadas GPS)
  body('location.latitude')
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('La latitud debe estar entre -90 y 90 grados')
    .toFloat(),

  // Ubicación - Longitud (opcional)
  body('location.longitude')
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('La longitud debe estar entre -180 y 180 grados')
    .toFloat(),

  // Ubicación - Altitud (opcional)
  body('location.altitude')
    .optional()
    .isFloat({ min: -500, max: 9000 })
    .withMessage('La altitud debe estar entre -500 y 9000 metros')
    .toFloat(),

  // Ubicación - Precisión (opcional)
  body('location.accuracy')
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage('La precisión debe ser un número positivo')
    .toFloat(),

  // ID del rancho (obligatorio)
  body('ranchId')
    .notEmpty()
    .withMessage('El ID del rancho es requerido')
    .isUUID()
    .withMessage('ID de rancho inválido (debe ser UUID)'),

  // ID del propietario (opcional)
  body('ownerId')
    .optional()
    .isUUID()
    .withMessage('ID de propietario inválido (debe ser UUID)'),

  // Estado de salud (opcional)
  body('healthStatus')
    .optional()
    .isIn(Object.values(HealthStatus))
    .withMessage(`Estado de salud inválido. Valores permitidos: ${Object.values(HealthStatus).join(', ')}`),

  // Estado de vacunación (opcional)
  body('vaccinationStatus')
    .optional()
    .isIn(Object.values(VaccinationStatus))
    .withMessage(`Estado de vacunación inválido. Valores permitidos: ${Object.values(VaccinationStatus).join(', ')}`),

  // Notas (opcional)
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Las notas no pueden exceder los 1000 caracteres'),

  // ID de la madre (opcional)
  body('motherId')
    .optional()
    .isUUID()
    .withMessage('ID de madre inválido (debe ser UUID)'),

  // ID del padre (opcional)
  body('fatherId')
    .optional()
    .isUUID()
    .withMessage('ID de padre inválido (debe ser UUID)'),

  // Fecha de adquisición (opcional)
  body('acquisitionDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de adquisición inválida (formato ISO8601 requerido)'),

  // Precio de adquisición (opcional)
  body('acquisitionPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El precio de adquisición debe ser un número positivo')
    .toFloat()
];

/**
 * Validación para actualizar un bovino existente
 */
export const updateBovineSchema = [
  // ID del bovino (obligatorio en params)
  param('id')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)'),

  // Todos los campos son opcionales en actualización
  body('earTag')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('El arete debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9-]+$/)
    .withMessage('El arete solo puede contener letras, números y guiones'),

  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios'),

  body('cattleType')
    .optional()
    .isIn(Object.values(CattleType))
    .withMessage(`Tipo de ganado inválido. Valores permitidos: ${Object.values(CattleType).join(', ')}`),

  body('breed')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('La raza debe tener entre 2 y 100 caracteres'),

  body('gender')
    .optional()
    .isIn(Object.values(GenderType))
    .withMessage(`Género inválido. Valores permitidos: ${Object.values(GenderType).join(', ')}`),

  body('birthDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de nacimiento inválida (formato ISO8601 requerido)')
    .custom((value) => {
      if (new Date(value) > new Date()) {
        throw new Error('La fecha de nacimiento no puede ser futura');
      }
      return true;
    }),

  body('weight')
    .optional()
    .isFloat({ min: 1, max: 2000 })
    .withMessage('El peso debe estar entre 1 y 2000 kg')
    .toFloat(),

  body('location.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('La latitud debe estar entre -90 y 90 grados')
    .toFloat(),

  body('location.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('La longitud debe estar entre -180 y 180 grados')
    .toFloat(),

  body('location.altitude')
    .optional()
    .isFloat({ min: -500, max: 9000 })
    .withMessage('La altitud debe estar entre -500 y 9000 metros')
    .toFloat(),

  body('healthStatus')
    .optional()
    .isIn(Object.values(HealthStatus))
    .withMessage(`Estado de salud inválido. Valores permitidos: ${Object.values(HealthStatus).join(', ')}`),

  body('vaccinationStatus')
    .optional()
    .isIn(Object.values(VaccinationStatus))
    .withMessage(`Estado de vacunación inválido. Valores permitidos: ${Object.values(VaccinationStatus).join(', ')}`),

  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Las notas no pueden exceder los 1000 caracteres'),

  body('motherId')
    .optional()
    .isUUID()
    .withMessage('ID de madre inválido (debe ser UUID)'),

  body('fatherId')
    .optional()
    .isUUID()
    .withMessage('ID de padre inválido (debe ser UUID)'),

  body('acquisitionPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El precio de adquisición debe ser un número positivo')
    .toFloat()
];

/**
 * Validación para obtener un bovino por ID
 */
export const getBovineByIdSchema = [
  param('id')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)')
];

/**
 * Validación para obtener bovino por arete
 */
export const getBovineByEarTagSchema = [
  param('earTag')
    .notEmpty()
    .withMessage('El arete es requerido')
    .isLength({ min: 3, max: 50 })
    .withMessage('El arete debe tener entre 3 y 50 caracteres'),

  query('ranchId')
    .optional()
    .isUUID()
    .withMessage('ID de rancho inválido (debe ser UUID)')
];

/**
 * Validación para listar bovinos con filtros
 */
export const listBovinesSchema = [
  query('searchTerm')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('El término de búsqueda debe tener entre 1 y 100 caracteres'),

  query('cattleType')
    .optional()
    .isIn(Object.values(CattleType))
    .withMessage(`Tipo de ganado inválido`),

  query('breed')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('La raza debe tener entre 1 y 100 caracteres'),

  query('gender')
    .optional()
    .isIn(Object.values(GenderType))
    .withMessage(`Género inválido`),

  query('healthStatus')
    .optional()
    .isIn(Object.values(HealthStatus))
    .withMessage(`Estado de salud inválido`),

  query('vaccinationStatus')
    .optional()
    .isIn(Object.values(VaccinationStatus))
    .withMessage(`Estado de vacunación inválido`),

  query('ranchId')
    .optional()
    .isUUID()
    .withMessage('ID de rancho inválido'),

  query('ranchIds')
    .optional()
    .custom((value) => {
      // CSV de UUIDs
      if (typeof value !== 'string') {
        throw new Error('ranchIds debe ser CSV de UUIDs');
      }
      const ids = value.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        throw new Error('ranchIds no puede estar vacío');
      }
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const id of ids) {
        if (!uuidRe.test(id)) {
          throw new Error(`ranchIds contiene un UUID inválido: ${id}`);
        }
      }
      return true;
    }),

  query('locationId')
    .optional()
    .isUUID()
    .withMessage('ID de ubicación inválido'),
    
  query('disease')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('El diagnóstico no puede superar 100 caracteres'),

  query('diseaseId')
    .optional()
    .isUUID()
    .withMessage('diseaseId debe ser un UUID válido'),

  query('ageMin')
    .optional()
    .isInt({ min: 0, max: 240 })
    .withMessage('Edad mínima debe estar entre 0 y 240 meses'),

  query('ageMax')
    .optional()
    .isInt({ min: 0, max: 240 })
    .withMessage('Edad máxima debe estar entre 0 y 240 meses')
    .custom((value, { req }) => {
      if (req.query?.ageMin && value < parseInt(req.query.ageMin as string)) {
        throw new Error('La edad máxima debe ser mayor o igual a la edad mínima');
      }
      return true;
    }),

  query('ageGroup')
    .optional()
    .isIn(['calf', 'young', 'adult'])
    .withMessage("ageGroup debe ser 'calf', 'young' o 'adult'"),

  // G-03: candidatos genealógicos
  query('purpose')
    .optional()
    .isIn(['dam', 'sire'])
    .withMessage("purpose debe ser 'dam' (madre) o 'sire' (padre)"),

  query('excludeIds')
    .optional()
    .isString()
    .withMessage('excludeIds debe ser una lista de UUIDs separada por comas'),

  query('weightMin')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El peso mínimo debe ser un número positivo'),

  query('weightMax')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El peso máximo debe ser un número positivo')
    .custom((value, { req }) => {
      if (req.query?.weightMin && value < parseFloat(req.query.weightMin as string)) {
        throw new Error('El peso máximo debe ser mayor o igual al peso mínimo');
      }
      return true;
    }),

  query('isPregnant')
    .optional()
    .isBoolean()
    .withMessage('isPregnant debe ser true o false')
    .toBoolean(),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero mayor a 0')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe estar entre 1 y 100')
    .toInt(),

  query('sortBy')
    .optional()
    .isIn(['earTag', 'name', 'birthDate', 'weight', 'createdAt', 'updatedAt'])
    .withMessage('Campo de ordenamiento inválido'),

  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Orden debe ser ASC o DESC')
];

/**
 * Validación para regenerar QR
 */
export const regenerateQRSchema = [
  param('id')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)')
];

/**
 * Validación para eliminar bovino
 */
export const deleteBovineSchema = [
  param('id')
    .isUUID()
    .withMessage('ID de bovino inválido (debe ser UUID)')
];

/**
 * Validación para obtener estadísticas
 */
export const getStatisticsSchema = [
  query('ranchId')
    .optional()
    .isUUID()
    .withMessage('ID de rancho inválido (debe ser UUID)')
];