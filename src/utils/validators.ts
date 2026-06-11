// Validadores específicos para la aplicación de seguimiento de ganado
import {
  CATTLE_HEALTH_STATUS,
  CATTLE_TYPES,
  CATTLE_BREEDS,
  EVENT_TYPES,
  VACCINE_TYPES,
  ILLNESS_SEVERITY,
  TREATMENT_STATUS,
  USER_ROLES,
  USER_STATUS,
  VALIDATION_RULES,
  GEOLOCATION,
  FILE_CONFIG,
  ERROR_MESSAGES
} from './constants';

import { validateCoordinates as coordsHelper, validateEmail as emailHelper } from './helpers';

// Funciones helper para validar valores de constantes
const isValidAnimalType = (value: string): boolean => {
  const cattleTypes = ['cow', 'bull', 'calf', 'heifer', 'steer', 'ox'];
  return cattleTypes.includes(value);
};

const isValidBreed = (value: string): boolean => {
  const breeds = ['holstein', 'angus', 'hereford', 'charolais', 'simmental', 'brahman', 'limousin', 'shorthorn', 'jersey', 'guernsey', 'brown_swiss', 'ayrshire', 'santa_gertrudis', 'brangus', 'beefmaster', 'gelbvieh', 'corriente', 'criollo', 'nelore', 'gyr', 'indo_brasil', 'mixed', 'other'];
  return breeds.includes(value);
};

const isValidHealthStatus = (value: string): boolean => {
  const statuses = ['healthy', 'sick', 'recovering', 'quarantine', 'deceased', 'unknown'];
  return statuses.includes(value);
};

const isValidEventType = (value: string): boolean => {
  const eventTypes = ['vaccination', 'illness', 'treatment', 'pregnancy_check', 'birth', 'weaning', 'breeding', 'injury', 'surgery', 'deworming', 'hoof_trimming', 'weight_check', 'body_condition_score', 'location_update', 'transfer', 'death', 'sale', 'purchase', 'other'];
  return eventTypes.includes(value);
};

const isValidVaccineType = (value: string): boolean => {
  const vaccineTypes = ['ibr', 'bvd', 'pi3', 'brsv', 'clostridium', 'blackleg', 'anthrax', 'pasteurella', 'mannheimia', 'brucellosis', 'leptospirosis', 'campylobacter', 'trichomonas', 'rabies', 'foot_and_mouth', 'lumpy_skin', 'hemorrhagic_septicemia', 'five_way', 'seven_way', 'nine_way', 'other'];
  return vaccineTypes.includes(value);
};

const isValidUserRole = (value: string): boolean => {
  const roles = ['admin', 'veterinarian', 'farm_manager', 'worker', 'viewer'];
  return roles.includes(value);
};

const isValidUserStatus = (value: string): boolean => {
  const statuses = ['active', 'inactive', 'suspended', 'pending'];
  return statuses.includes(value);
};

const isValidIllnessSeverity = (value: string): boolean => {
  const severities = ['mild', 'moderate', 'severe', 'critical'];
  return severities.includes(value);
};

const isValidTreatmentStatus = (value: string): boolean => {
  const statuses = ['planned', 'in_progress', 'completed', 'cancelled', 'overdue'];
  return statuses.includes(value);
};

// Interfaces para validadores
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

interface CattleData {
  tag: string;
  name?: string;
  type: string;
  breed: string;
  birthDate: string | Date;
  weight?: number;
  healthStatus?: string;
  latitude?: number;
  longitude?: number;
  motherId?: number;
  fatherId?: number;
  farmId?: number;
}

interface EventData {
  cattleId: number;
  eventType: string;
  eventDate: string | Date;
  description: string;
  veterinarianId?: number;
  notes?: string;
  vaccineType?: string;
  dosage?: number;
  nextDueDate?: string | Date;
  severity?: string;
  treatmentStatus?: string;
  medications?: string[];
  cost?: number;
  latitude?: number;
  longitude?: number;
}

interface UserData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  status?: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: string | Date;
}

interface FileData {
  originalName: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
}

/**
 * Validador principal para datos de ganado
 * @param data - Datos del ganado a validar
 * @returns ValidationResult - Resultado de la validación
 */
export const validateCattleData = (data: Partial<CattleData>): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validar tag (requerido)
  if (!data.tag || typeof data.tag !== 'string') {
    errors.push('El tag del animal es requerido');
  } else {
    const tagValidation = validateCattleTag(data.tag);
    if (!tagValidation.isValid) {
      errors.push(...tagValidation.errors);
    }
  }

  // Validar tipo de animal (requerido)
  if (!data.type) {
    errors.push('El tipo de animal es requerido');
  } else if (!isValidAnimalType(data.type)) {
    errors.push(`Tipo de animal inválido. Valores permitidos: ${Object.values(CATTLE_TYPES).join(', ')}`);
  }

  // Validar raza (requerido)
  if (!data.breed) {
    errors.push('La raza del animal es requerida');
  } else if (!isValidBreed(data.breed)) {
    errors.push(`Raza inválida. Valores permitidos: ${Object.values(CATTLE_BREEDS).join(', ')}`);
  }

  // Validar fecha de nacimiento (requerido)
  if (!data.birthDate) {
    errors.push('La fecha de nacimiento es requerida');
  } else {
    const birthValidation = validateBirthDate(data.birthDate);
    if (!birthValidation.isValid) {
      errors.push(...birthValidation.errors);
    }
    if (birthValidation.warnings) {
      warnings.push(...birthValidation.warnings);
    }
  }

  // Validar nombre (opcional)
  if (data.name && typeof data.name === 'string') {
    if (data.name.length > VALIDATION_RULES.CATTLE_NAME_MAX_LENGTH) {
      errors.push(`El nombre no puede exceder ${VALIDATION_RULES.CATTLE_NAME_MAX_LENGTH} caracteres`);
    }
    if (data.name.trim().length === 0) {
      warnings.push('El nombre está vacío');
    }
  }

  // Validar peso (opcional)
  if (data.weight !== undefined) {
    const weightValidation = validateCattleWeight(data.weight);
    if (!weightValidation.isValid) {
      errors.push(...weightValidation.errors);
    }
  }

  // Validar estado de salud (opcional)
  if (data.healthStatus && !isValidHealthStatus(data.healthStatus)) {
    errors.push(`Estado de salud inválido. Valores permitidos: ${Object.values(CATTLE_HEALTH_STATUS).join(', ')}`);
  }

  // Validar coordenadas (opcional)
  if ((data.latitude !== undefined || data.longitude !== undefined)) {
    if (data.latitude === undefined || data.longitude === undefined) {
      errors.push('Si se proporciona ubicación, tanto latitud como longitud son requeridas');
    } else {
      const coordsValidation = coordsHelper(data.latitude, data.longitude);
      if (!coordsValidation.isValid) {
        errors.push(...coordsValidation.errors);
      }
    }
  }

  // Validar IDs de padres (opcional)
  if (data.motherId !== undefined && (!Number.isInteger(data.motherId) || data.motherId <= 0)) {
    errors.push('ID de madre inválido');
  }

  if (data.fatherId !== undefined && (!Number.isInteger(data.fatherId) || data.fatherId <= 0)) {
    errors.push('ID de padre inválido');
  }

  // Validar ID de granja (opcional)
  if (data.farmId !== undefined && (!Number.isInteger(data.farmId) || data.farmId <= 0)) {
    errors.push('ID de granja inválido');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
};

/**
 * Validador para tag/identificador de ganado
 * @param tag - Tag a validar
 * @returns ValidationResult - Resultado de la validación
 */
export const validateCattleTag = (tag: string): ValidationResult => {
  const errors: string[] = [];

  if (!tag || typeof tag !== 'string') {
    errors.push('El tag es requerido');
    return { isValid: false, errors };
  }

  const cleanTag = tag.trim().toUpperCase();

  if (cleanTag.length < VALIDATION_RULES.CATTLE_TAG_MIN_LENGTH) {
    errors.push(`El tag debe tener al menos ${VALIDATION_RULES.CATTLE_TAG_MIN_LENGTH} caracteres`);
  }

  if (cleanTag.length > VALIDATION_RULES.CATTLE_TAG_MAX_LENGTH) {
    errors.push(`El tag no puede exceder ${VALIDATION_RULES.CATTLE_TAG_MAX_LENGTH} caracteres`);
  }

  // Validar formato: letras, números, guiones y guiones bajos
  const validTagPattern = /^[A-Z0-9\-_]+$/;
  if (!validTagPattern.test(cleanTag)) {
    errors.push('El tag solo puede contener letras mayúsculas, números, guiones y guiones bajos');
  }

  // Validar que no sea solo números (debe tener al menos una letra)
  if (/^\d+$/.test(cleanTag)) {
    errors.push('El tag debe contener al menos una letra');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validador para peso de ganado
 * @param weight - Peso a validar
 * @returns ValidationResult - Resultado de la validación
 */
export const validateCattleWeight = (weight: number): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof weight !== 'number' || isNaN(weight)) {
    errors.push('El peso debe ser un número válido');
    return { isValid: false, errors };
  }

  if (weight <= 0) {
    errors.push('El peso debe ser mayor que cero');
  }

  if (weight < VALIDATION_RULES.CATTLE_WEIGHT_MIN) {
    errors.push(`El peso mínimo es ${VALIDATION_RULES.CATTLE_WEIGHT_MIN} kg`);
  }

  if (weight > VALIDATION_RULES.CATTLE_WEIGHT_MAX) {
    errors.push(`El peso máximo es ${VALIDATION_RULES.CATTLE_WEIGHT_MAX} kg`);
  }

  // Advertencias para pesos inusuales
  if (weight < 20) {
    warnings.push('Peso muy bajo, verificar si es correcto');
  }

  if (weight > 1200) {
    warnings.push('Peso muy alto, verificar si es correcto');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
};

/**
 * Validador para fecha de nacimiento
 * @param birthDate - Fecha de nacimiento a validar
 * @returns ValidationResult - Resultado de la validación
 */
export const validateBirthDate = (birthDate: string | Date): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  let date: Date;

  if (typeof birthDate === 'string') {
    date = new Date(birthDate);
  } else if (birthDate instanceof Date) {
    date = birthDate;
  } else {
    errors.push('Fecha de nacimiento inválida');
    return { isValid: false, errors };
  }

  if (isNaN(date.getTime())) {
    errors.push('Formato de fecha de nacimiento inválido');
    return { isValid: false, errors };
  }

  const now = new Date();
  const maxAge = new Date();
  maxAge.setFullYear(maxAge.getFullYear() - 25); // 25 años máximo

  if (date > now) {
    errors.push('La fecha de nacimiento no puede ser futura');
  }

  if (date < maxAge) {
    errors.push('La fecha de nacimiento es demasiado antigua (máximo 25 años)');
  }

  // Advertencias
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  if (date > oneYearAgo) {
    warnings.push('Animal muy joven, verificar fecha');
  }

  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

  if (date < tenYearsAgo) {
    warnings.push('Animal de edad avanzada');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
};

/**
 * Validador principal para datos de eventos
 * @param data - Datos del evento a validar
 * @returns ValidationResult - Resultado de la validación
 */
export const validateEventData = (data: Partial<EventData>): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validar ID de ganado (requerido)
  if (!data.cattleId || !Number.isInteger(data.cattleId) || data.cattleId <= 0) {
    errors.push('ID de ganado válido es requerido');
  }

  // Validar tipo de evento (requerido)
  if (!data.eventType) {
    errors.push('El tipo de evento es requerido');
  } else if (!isValidEventType(data.eventType)) {
    errors.push(`Tipo de evento inválido. Valores permitidos: ${Object.values(EVENT_TYPES).join(', ')}`);
  }

  // Validar fecha del evento (requerido)
  if (!data.eventDate) {
    errors.push('La fecha del evento es requerida');
  } else {
    const dateValidation = validateEventDate(data.eventDate);
    if (!dateValidation.isValid) {
      errors.push(...dateValidation.errors);
    }
    if (dateValidation.warnings) {
      warnings.push(...dateValidation.warnings);
    }
  }

  // Validar descripción (requerido)
  if (!data.description || typeof data.description !== 'string') {
    errors.push('La descripción del evento es requerida');
  } else if (data.description.trim().length === 0) {
    errors.push('La descripción no puede estar vacía');
  } else if (data.description.length > VALIDATION_RULES.EVENT_DESCRIPTION_MAX_LENGTH) {
    errors.push(`La descripción no puede exceder ${VALIDATION_RULES.EVENT_DESCRIPTION_MAX_LENGTH} caracteres`);
  }

  // Validaciones específicas por tipo de evento
  if (data.eventType === EVENT_TYPES.VACCINATION) {
    const vaccineValidation = validateVaccinationEvent(data);
    if (!vaccineValidation.isValid) {
      errors.push(...vaccineValidation.errors);
    }
  }

  if (data.eventType === EVENT_TYPES.ILLNESS) {
    const illnessValidation = validateIllnessEvent(data);
    if (!illnessValidation.isValid) {
      errors.push(...illnessValidation.errors);
    }
  }

  if (data.eventType === EVENT_TYPES.TREATMENT) {
    const treatmentValidation = validateTreatmentEvent(data);
    if (!treatmentValidation.isValid) {
      errors.push(...treatmentValidation.errors);
    }
  }

  // Validar ID de veterinario (opcional)
  if (data.veterinarianId !== undefined && (!Number.isInteger(data.veterinarianId) || data.veterinarianId <= 0)) {
    errors.push('ID de veterinario inválido');
  }

  // Validar notas (opcional)
  if (data.notes && data.notes.length > VALIDATION_RULES.EVENT_NOTES_MAX_LENGTH) {
    errors.push(`Las notas no pueden exceder ${VALIDATION_RULES.EVENT_NOTES_MAX_LENGTH} caracteres`);
  }

  // Validar costo (opcional)
  if (data.cost !== undefined) {
    if (typeof data.cost !== 'number' || isNaN(data.cost)) {
      errors.push('El costo debe ser un número válido');
    } else if (data.cost < 0) {
      errors.push('El costo no puede ser negativo');
    } else if (data.cost > 1000000) {
      warnings.push('Costo muy alto, verificar si es correcto');
    }
  }

  // Validar coordenadas (opcional)
  if ((data.latitude !== undefined || data.longitude !== undefined)) {
    if (data.latitude === undefined || data.longitude === undefined) {
      errors.push('Si se proporciona ubicación, tanto latitud como longitud son requeridas');
    } else {
      const coordsValidation = coordsHelper(data.latitude, data.longitude);
      if (!coordsValidation.isValid) {
        errors.push(...coordsValidation.errors);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
};

/**
 * Validador específico para eventos de vacunación
 * @param data - Datos del evento de vacunación
 * @returns ValidationResult - Resultado de la validación
 */
export const validateVaccinationEvent = (data: Partial<EventData>): ValidationResult => {
  const errors: string[] = [];

  // Tipo de vacuna es requerido para vacunaciones
  if (!data.vaccineType) {
    errors.push('El tipo de vacuna es requerido para eventos de vacunación');
  } else if (!isValidVaccineType(data.vaccineType)) {
    errors.push(`Tipo de vacuna inválido. Valores permitidos: ${Object.values(VACCINE_TYPES).join(', ')}`);
  }

  // Validar dosificación (opcional pero recomendada)
  if (data.dosage !== undefined) {
    if (typeof data.dosage !== 'number' || isNaN(data.dosage)) {
      errors.push('La dosificación debe ser un número válido');
    } else if (data.dosage <= 0) {
      errors.push('La dosificación debe ser mayor que cero');
    } else if (data.dosage > 100) {
      errors.push('Dosificación muy alta, verificar');
    }
  }

  // Validar fecha de próxima dosis (opcional)
  if (data.nextDueDate) {
    const nextDateValidation = validateFutureDate(data.nextDueDate);
    if (!nextDateValidation.isValid) {
      errors.push('Fecha de próxima dosis inválida: ' + nextDateValidation.errors.join(', '));
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validador específico para eventos de enfermedad
 * @param data - Datos del evento de enfermedad
 * @returns ValidationResult - Resultado de la validación
 */
export const validateIllnessEvent = (data: Partial<EventData>): ValidationResult => {
  const errors: string[] = [];

  // Severidad es recomendada para enfermedades
  if (data.severity && !isValidIllnessSeverity(data.severity)) {
    errors.push(`Severidad inválida. Valores permitidos: ${Object.values(ILLNESS_SEVERITY).join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validador específico para eventos de tratamiento
 * @param data - Datos del evento de tratamiento
 * @returns ValidationResult - Resultado de la validación
 */
export const validateTreatmentEvent = (data: Partial<EventData>): ValidationResult => {
  const errors: string[] = [];

  // Estado de tratamiento (opcional)
  if (data.treatmentStatus && !isValidTreatmentStatus(data.treatmentStatus)) {
    errors.push(`Estado de tratamiento inválido. Valores permitidos: ${Object.values(TREATMENT_STATUS).join(', ')}`);
  }

  // Validar medicamentos (opcional)
  if (data.medications) {
    if (!Array.isArray(data.medications)) {
      errors.push('Los medicamentos deben ser un array');
    } else {
      data.medications.forEach((med, index) => {
        if (typeof med !== 'string' || med.trim().length === 0) {
          errors.push(`Medicamento ${index + 1} inválido`);
        }
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validador para fecha de evento
 * @param eventDate - Fecha del evento a validar
 * @returns ValidationResult - Resultado de la validación
 */
export const validateEventDate = (eventDate: string | Date): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  let date: Date;

  if (typeof eventDate === 'string') {
    date = new Date(eventDate);
  } else if (eventDate instanceof Date) {
    date = eventDate;
  } else {
    errors.push('Fecha de evento inválida');
    return { isValid: false, errors };
  }

  if (isNaN(date.getTime())) {
    errors.push('Formato de fecha de evento inválido');
    return { isValid: false, errors };
  }

  const now = new Date();
  const maxPastDate = new Date();
  maxPastDate.setFullYear(maxPastDate.getFullYear() - 2); // Máximo 2 años en el pasado

  const maxFutureDate = new Date();
  maxFutureDate.setMonth(maxFutureDate.getMonth() + 6); // Máximo 6 meses en el futuro

  if (date > maxFutureDate) {
    errors.push('La fecha del evento no puede ser más de 6 meses en el futuro');
  }

  if (date < maxPastDate) {
    errors.push('La fecha del evento no puede ser más de 2 años en el pasado');
  }

  // Advertencias
  const oneWeekFuture = new Date();
  oneWeekFuture.setDate(oneWeekFuture.getDate() + 7);

  if (date > oneWeekFuture) {
    warnings.push('Evento programado para más de una semana en el futuro');
  }

  const sixMonthsPast = new Date();
  sixMonthsPast.setMonth(sixMonthsPast.getMonth() - 6);

  if (date < sixMonthsPast) {
    warnings.push('Evento de hace más de 6 meses');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
};

/**
 * Validador para fechas futuras
 * @param futureDate - Fecha futura a validar
 * @returns ValidationResult - Resultado de la validación
 */
export const validateFutureDate = (futureDate: string | Date): ValidationResult => {
  const errors: string[] = [];

  let date: Date;

  if (typeof futureDate === 'string') {
    date = new Date(futureDate);
  } else if (futureDate instanceof Date) {
    date = futureDate;
  } else {
    errors.push('Fecha inválida');
    return { isValid: false, errors };
  }

  if (isNaN(date.getTime())) {
    errors.push('Formato de fecha inválido');
    return { isValid: false, errors };
  }

  const now = new Date();
  if (date <= now) {
    errors.push('La fecha debe ser futura');
  }

  const maxFutureDate = new Date();
  maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 5); // Máximo 5 años en el futuro

  if (date > maxFutureDate) {
    errors.push('La fecha no puede ser más de 5 años en el futuro');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validador principal para datos de usuario
 * @param data - Datos del usuario a validar
 * @returns ValidationResult - Resultado de la validación
 */
export const validateUserData = (data: Partial<UserData>): ValidationResult => {
  const errors: string[] = [];

  // Validar nombre de usuario (requerido)
  if (!data.username || typeof data.username !== 'string') {
    errors.push('El nombre de usuario es requerido');
  } else {
    const usernameValidation = validateUsername(data.username);
    if (!usernameValidation.isValid) {
      errors.push(...usernameValidation.errors);
    }
  }

  // Validar email (requerido)
  if (!data.email) {
    errors.push('El email es requerido');
  } else {
    const emailValidation = emailHelper(data.email);
    if (!emailValidation.isValid) {
      errors.push(...emailValidation.errors);
    }
  }

  // Validar contraseña (requerido)
  if (!data.password) {
    errors.push('La contraseña es requerida');
  } else {
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }
  }

  // Validar nombre (requerido)
  if (!data.firstName || typeof data.firstName !== 'string' || data.firstName.trim().length === 0) {
    errors.push('El nombre es requerido');
  } else if (data.firstName.length > 50) {
    errors.push('El nombre no puede exceder 50 caracteres');
  }

  // Validar apellido (requerido)
  if (!data.lastName || typeof data.lastName !== 'string' || data.lastName.trim().length === 0) {
    errors.push('El apellido es requerido');
  } else if (data.lastName.length > 50) {
    errors.push('El apellido no puede exceder 50 caracteres');
  }

  // Validar rol (requerido)
  if (!data.role) {
    errors.push('El rol es requerido');
  } else if (!isValidUserRole(data.role)) {
    errors.push(`Rol inválido. Valores permitidos: ${Object.values(USER_ROLES).join(', ')}`);
  }

  // Validar teléfono (opcional)
  if (data.phone) {
    const phoneValidation = validatePhone(data.phone);
    if (!phoneValidation.isValid) {
      errors.push(...phoneValidation.errors);
    }
  }

  // Validar estado (opcional)
  if (data.status && !isValidUserStatus(data.status)) {
    errors.push(`Estado inválido. Valores permitidos: ${Object.values(USER_STATUS).join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validador para nombre de usuario
 * @param username - Nombre de usuario a validar
 * @returns ValidationResult - Resultado de la validación
 */
export const validateUsername = (username: string): ValidationResult => {
  const errors: string[] = [];

  if (!username || typeof username !== 'string') {
    errors.push('El nombre de usuario es requerido');
    return { isValid: false, errors };
  }

  const cleanUsername = username.trim().toLowerCase();

  if (cleanUsername.length < VALIDATION_RULES.USERNAME_MIN_LENGTH) {
    errors.push(`El nombre de usuario debe tener al menos ${VALIDATION_RULES.USERNAME_MIN_LENGTH} caracteres`);
  }

  if (cleanUsername.length > VALIDATION_RULES.USERNAME_MAX_LENGTH) {
    errors.push(`El nombre de usuario no puede exceder ${VALIDATION_RULES.USERNAME_MAX_LENGTH} caracteres`);
  }

  // Validar formato: letras, números, guiones y guiones bajos
  const validUsernamePattern = /^[a-z0-9_-]+$/;
  if (!validUsernamePattern.test(cleanUsername)) {
    errors.push('El nombre de usuario solo puede contener letras minúsculas, números, guiones y guiones bajos');
  }

  // No puede empezar o terminar con guiones
  if (cleanUsername.startsWith('-') || cleanUsername.endsWith('-')) {
    errors.push('El nombre de usuario no puede empezar o terminar con guiones');
  }

  // Nombres reservados
  const reservedUsernames = ['admin', 'root', 'administrator', 'system', 'api', 'test', 'null', 'undefined'];
  if (reservedUsernames.some(reserved => reserved === cleanUsername)) {
    errors.push('Este nombre de usuario está reservado');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validador para contraseñas
 * @param password - Contraseña a validar
 * @returns ValidationResult - Resultado de la validación
 */
export const validatePassword = (password: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!password || typeof password !== 'string') {
    errors.push('La contraseña es requerida');
    return { isValid: false, errors };
  }

  if (password.length < VALIDATION_RULES.PASSWORD_MIN_LENGTH) {
    errors.push(`La contraseña debe tener al menos ${VALIDATION_RULES.PASSWORD_MIN_LENGTH} caracteres`);
  }

  if (password.length > VALIDATION_RULES.PASSWORD_MAX_LENGTH) {
    errors.push(`La contraseña no puede exceder ${VALIDATION_RULES.PASSWORD_MAX_LENGTH} caracteres`);
  }

  // Verificar complejidad
  let complexity = 0;
  
  if (/[a-z]/.test(password)) complexity++;      // Minúsculas
  if (/[A-Z]/.test(password)) complexity++;      // Mayúsculas
  if (/[0-9]/.test(password)) complexity++;      // Números
  if (/[^a-zA-Z0-9]/.test(password)) complexity++; // Caracteres especiales

  if (complexity < 3) {
    errors.push('La contraseña debe contener al menos 3 de los siguientes: minúsculas, mayúsculas, números, caracteres especiales');
  }

  // Verificar patrones comunes débiles
  const weakPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /admin/i
  ];

  for (const pattern of weakPatterns) {
    if (pattern.test(password)) {
      warnings.push('La contraseña contiene patrones comunes que la hacen vulnerable');
      break;
    }
  }

  // Verificar repetición de caracteres
  if (/(.)\1{3,}/.test(password)) {
    warnings.push('La contraseña contiene demasiados caracteres repetidos');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
};

/**
 * Validador para números de teléfono
 * @param phone - Número de teléfono a validar
 * @returns ValidationResult - Resultado de la validación
 */
export const validatePhone = (phone: string): ValidationResult => {
  const errors: string[] = [];

  if (!phone || typeof phone !== 'string') {
    errors.push('El número de teléfono es requerido');
    return { isValid: false, errors };
  }

  // Limpiar formato
  const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');

  if (cleanPhone.length < 10) {
    errors.push('El número de teléfono debe tener al menos 10 dígitos');
  }

  if (cleanPhone.length > 15) {
    errors.push('El número de teléfono no puede exceder 15 dígitos');
  }

  if (!/^\d+$/.test(cleanPhone)) {
    errors.push('El número de teléfono solo puede contener dígitos');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validador para datos de ubicación
 * @param data - Datos de ubicación a validar
 * @returns ValidationResult - Resultado de la validación
 */
export const validateLocationData = (data: Partial<LocationData>): ValidationResult => {
  const errors: string[] = [];

  // Validar coordenadas (requeridas)
  if (data.latitude === undefined || data.longitude === undefined) {
    errors.push('Latitud y longitud son requeridas');
    return { isValid: false, errors };
  }

  const coordsValidation = coordsHelper(data.latitude, data.longitude);
  if (!coordsValidation.isValid) {
    errors.push(...coordsValidation.errors);
  }

  // Validar precisión (opcional)
  if (data.accuracy !== undefined) {
    if (typeof data.accuracy !== 'number' || isNaN(data.accuracy)) {
      errors.push('La precisión debe ser un número válido');
    } else if (data.accuracy < 0) {
      errors.push('La precisión no puede ser negativa');
    } else if (data.accuracy > 10000) {
      errors.push('La precisión es demasiado baja (máximo 10km)');
    }
  }

  // Validar timestamp (opcional)
  if (data.timestamp) {
    let date: Date;
    if (typeof data.timestamp === 'string') {
      date = new Date(data.timestamp);
    } else {
      date = data.timestamp;
    }

    if (isNaN(date.getTime())) {
      errors.push('Timestamp inválido');
    } else {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      if (date > now) {
        errors.push('El timestamp no puede ser futuro');
      }
      
      if (date < oneHourAgo) {
        errors.push('El timestamp es demasiado antiguo (máximo 1 hora)');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validador para archivos subidos
 * @param file - Datos del archivo a validar
 * @param fileType - Tipo de archivo esperado ('image' | 'document')
 * @returns ValidationResult - Resultado de la validación
 */
export const validateFileUpload = (file: Partial<FileData>, fileType: 'image' | 'document' = 'image'): ValidationResult => {
  const errors: string[] = [];

  // Verificar que el archivo existe
  if (!file || !file.originalName || !file.mimetype || !file.size) {
    errors.push('Archivo inválido o corrupto');
    return { isValid: false, errors };
  }

  // Validar tamaño
  if (file.size > FILE_CONFIG.MAX_FILE_SIZE) {
    errors.push(`El archivo excede el tamaño máximo de ${FILE_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  if (file.size === 0) {
    errors.push('El archivo está vacío');
  }

  // Validar tipo MIME según el tipo esperado
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedDocumentTypes = ['application/pdf', 'text/plain', 'application/msword'];
  
  const allowedTypes = fileType === 'image' ? allowedImageTypes : allowedDocumentTypes;

  if (!allowedTypes.includes(file.mimetype)) {
    errors.push(`Tipo de archivo no permitido. Tipos permitidos: ${allowedTypes.join(', ')}`);
  }

  // Validar nombre del archivo
  if (file.originalName.length > VALIDATION_RULES.FILENAME_MAX_LENGTH) {
    errors.push(`El nombre del archivo no puede exceder ${VALIDATION_RULES.FILENAME_MAX_LENGTH} caracteres`);
  }

  // Verificar extensión vs tipo MIME
  const extension = file.originalName.split('.').pop()?.toLowerCase();
  const mimeExtensionMap: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'application/pdf': ['pdf'],
    'text/plain': ['txt'],
    'application/msword': ['doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx']
  };

  const expectedExtensions = mimeExtensionMap[file.mimetype];
  if (expectedExtensions && extension && !expectedExtensions.some(ext => ext === extension)) {
    errors.push('La extensión del archivo no coincide con su tipo');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validador para rangos de fechas
 * @param startDate - Fecha de inicio
 * @param endDate - Fecha de fin
 * @returns ValidationResult - Resultado de la validación
 */
export const validateDateRange = (startDate: string | Date, endDate: string | Date): ValidationResult => {
  const errors: string[] = [];

  let start: Date, end: Date;

  // Convertir a objetos Date
  try {
    start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  } catch (error) {
    errors.push('Formato de fecha inválido');
    return { isValid: false, errors };
  }

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    errors.push('Fechas inválidas');
    return { isValid: false, errors };
  }

  if (start >= end) {
    errors.push('La fecha de inicio debe ser anterior a la fecha de fin');
  }

  // Verificar que el rango no sea demasiado grande
  const diffInDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (diffInDays > 365 * 2) { // 2 años máximo
    errors.push('El rango de fechas no puede exceder 2 años');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Exportar tipos para uso en otros módulos
export type {
  ValidationResult,
  CattleData,
  EventData,
  UserData,
  LocationData,
  FileData
};