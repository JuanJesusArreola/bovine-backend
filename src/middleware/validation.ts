import { Request, Response, NextFunction } from 'express';
import { logMessage, LogLevel } from './logging';

// Enums para validaciones específicas del sistema ganadero
export enum CattleType {
  CATTLE = 'cattle',
  BULL = 'bull', 
  COW = 'cow',
  CALF = 'calf',
  HEIFER = 'heifer',
  STEER = 'steer'
}

export enum CattleGender {
  MALE = 'male',
  FEMALE = 'female'
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  SICK = 'sick',
  RECOVERING = 'recovering',
  QUARANTINE = 'quarantine',
  DECEASED = 'deceased'
}

export enum VaccineType {
  VIRAL = 'viral',
  BACTERIAL = 'bacterial',
  PARASITIC = 'parasitic',
  FUNGAL = 'fungal',
  MIXED = 'mixed'
}

export enum IllnessSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ProductionType {
  MILK = 'milk',
  MEAT = 'meat',
  BREEDING = 'breeding',
  MIXED = 'mixed'
}

// Interface para errores de validación
export interface ValidationError {
  field: string;
  value: any;
  message: string;
  code: string;
}

// Interface para resultado de validación
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: any;
}

/**
 * Clase para manejo de validaciones del sistema ganadero
 */
class CattleValidator {
  
  /**
   * Validar número de arete (ear tag)
   */
  static validateEarTag(earTag: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!earTag || typeof earTag !== 'string') {
      errors.push({
        field: 'earTag',
        value: earTag,
        message: 'Número de arete es requerido',
        code: 'REQUIRED'
      });
      return { isValid: false, errors };
    }
    
    // Sanitizar: eliminar espacios y convertir a mayúsculas
    const sanitized = earTag.trim().toUpperCase();
    
    // Validar formato: letras y números, 3-15 caracteres
    const earTagRegex = /^[A-Z0-9]{3,15}$/;
    if (!earTagRegex.test(sanitized)) {
      errors.push({
        field: 'earTag',
        value: earTag,
        message: 'Formato de arete inválido. Debe contener solo letras y números (3-15 caracteres)',
        code: 'INVALID_FORMAT'
      });
    }
    
    // Validar prefijos reservados
    const reservedPrefixes = ['SYS', 'ADM', 'TEST', 'NULL'];
    if (reservedPrefixes.some(prefix => sanitized.startsWith(prefix))) {
      errors.push({
        field: 'earTag',
        value: earTag,
        message: 'Prefijo de arete reservado no permitido',
        code: 'RESERVED_PREFIX'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized
    };
  }
  
  /**
   * Validar peso del ganado
   */
  static validateWeight(weight: number, cattleType: CattleType): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (typeof weight !== 'number' || isNaN(weight)) {
      errors.push({
        field: 'weight',
        value: weight,
        message: 'Peso debe ser un número válido',
        code: 'INVALID_TYPE'
      });
      return { isValid: false, errors };
    }
    
    if (weight <= 0) {
      errors.push({
        field: 'weight',
        value: weight,
        message: 'Peso debe ser mayor a cero',
        code: 'INVALID_RANGE'
      });
    }
    
    // Rangos típicos por tipo de ganado (en kg)
    // Soporta tanto minúsculas (enum de validación) como mayúsculas (enum del modelo)
    const defaultRange = { min: 25, max: 1200 };
    const weightRanges: Record<string, { min: number; max: number }> = {
      [CattleType.CALF]: { min: 25, max: 150 },
      [CattleType.HEIFER]: { min: 150, max: 500 },
      [CattleType.COW]: { min: 400, max: 800 },
      [CattleType.BULL]: { min: 500, max: 1200 },
      [CattleType.STEER]: { min: 300, max: 800 },
      [CattleType.CATTLE]: defaultRange,
      // Variantes en mayúsculas del modelo Bovine
      'CALF': { min: 25, max: 150 },
      'COW': { min: 400, max: 800 },
      'BULL': { min: 500, max: 1200 },
      'CATTLE': defaultRange,
    };

    const range = weightRanges[cattleType] || defaultRange;
    if (weight < range.min || weight > range.max) {
      errors.push({
        field: 'weight',
        value: weight,
        message: `Peso fuera del rango esperado para ${cattleType}: ${range.min}-${range.max} kg`,
        code: 'OUT_OF_RANGE'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: Math.round(weight * 100) / 100 // Redondear a 2 decimales
    };
  }
  
  /**
   * Validar fecha de nacimiento
   */
  static validateBirthDate(birthDate: string | Date): ValidationResult {
    const errors: ValidationError[] = [];
    
    let date: Date;
    
    if (typeof birthDate === 'string') {
      date = new Date(birthDate);
    } else if (birthDate instanceof Date) {
      date = birthDate;
    } else {
      errors.push({
        field: 'birthDate',
        value: birthDate,
        message: 'Fecha de nacimiento debe ser una fecha válida',
        code: 'INVALID_TYPE'
      });
      return { isValid: false, errors };
    }
    
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'birthDate',
        value: birthDate,
        message: 'Fecha de nacimiento inválida',
        code: 'INVALID_DATE'
      });
      return { isValid: false, errors };
    }
    
    const now = new Date();
    const maxAge = new Date();
    maxAge.setFullYear(maxAge.getFullYear() - 25); // Máximo 25 años
    
    if (date > now) {
      errors.push({
        field: 'birthDate',
        value: birthDate,
        message: 'Fecha de nacimiento no puede ser futura',
        code: 'FUTURE_DATE'
      });
    }
    
    if (date < maxAge) {
      errors.push({
        field: 'birthDate',
        value: birthDate,
        message: 'Fecha de nacimiento demasiado antigua (máximo 25 años)',
        code: 'TOO_OLD'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: date.toISOString()
    };
  }
  
  /**
   * Validar coordenadas GPS
   */
  static validateCoordinates(latitude: number, longitude: number): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Validar latitud
    if (typeof latitude !== 'number' || isNaN(latitude)) {
      errors.push({
        field: 'latitude',
        value: latitude,
        message: 'Latitud debe ser un número válido',
        code: 'INVALID_TYPE'
      });
    } else if (latitude < -90 || latitude > 90) {
      errors.push({
        field: 'latitude',
        value: latitude,
        message: 'Latitud debe estar entre -90 y 90 grados',
        code: 'OUT_OF_RANGE'
      });
    }
    
    // Validar longitud
    if (typeof longitude !== 'number' || isNaN(longitude)) {
      errors.push({
        field: 'longitude',
        value: longitude,
        message: 'Longitud debe ser un número válido',
        code: 'INVALID_TYPE'
      });
    } else if (longitude < -180 || longitude > 180) {
      errors.push({
        field: 'longitude',
        value: longitude,
        message: 'Longitud debe estar entre -180 y 180 grados',
        code: 'OUT_OF_RANGE'
      });
    }
    
    // Validar que no sean coordenadas nulas (0,0)
    if (latitude === 0 && longitude === 0) {
      errors.push({
        field: 'coordinates',
        value: { latitude, longitude },
        message: 'Coordenadas nulas no son válidas',
        code: 'NULL_COORDINATES'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: {
        latitude: Math.round(latitude * 1000000) / 1000000, // 6 decimales
        longitude: Math.round(longitude * 1000000) / 1000000
      }
    };
  }
  
  /**
   * Validar dosis de vacuna
   */
  static validateVaccineDose(dose: string | number, vaccineType: VaccineType): ValidationResult {
    const errors: ValidationError[] = [];
    
    let numericDose: number;
    
    if (typeof dose === 'string') {
      // Extraer número de la cadena (ej: "2ml", "0.5cc")
      const match = dose.match(/(\d+\.?\d*)/);
      if (!match) {
        errors.push({
          field: 'dose',
          value: dose,
          message: 'Dosis debe contener un valor numérico',
          code: 'INVALID_FORMAT'
        });
        return { isValid: false, errors };
      }
      numericDose = parseFloat(match[1]);
    } else if (typeof dose === 'number') {
      numericDose = dose;
    } else {
      errors.push({
        field: 'dose',
        value: dose,
        message: 'Dosis debe ser un número o texto con valor numérico',
        code: 'INVALID_TYPE'
      });
      return { isValid: false, errors };
    }
    
    // Rangos típicos de dosis por tipo de vacuna (en ml)
    const doseRanges = {
      [VaccineType.VIRAL]: { min: 0.5, max: 5 },
      [VaccineType.BACTERIAL]: { min: 1, max: 10 },
      [VaccineType.PARASITIC]: { min: 2, max: 20 },
      [VaccineType.FUNGAL]: { min: 0.5, max: 5 },
      [VaccineType.MIXED]: { min: 0.5, max: 20 }
    };
    
    const range = doseRanges[vaccineType];
    if (numericDose < range.min || numericDose > range.max) {
      errors.push({
        field: 'dose',
        value: dose,
        message: `Dosis fuera del rango para vacuna ${vaccineType}: ${range.min}-${range.max} ml`,
        code: 'OUT_OF_RANGE'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: `${numericDose}ml`
    };
  }
  
  /**
   * Validar síntomas de enfermedad
   */
  static validateSymptoms(symptoms: string[]): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!Array.isArray(symptoms)) {
      errors.push({
        field: 'symptoms',
        value: symptoms,
        message: 'Síntomas debe ser una lista',
        code: 'INVALID_TYPE'
      });
      return { isValid: false, errors };
    }
    
    if (symptoms.length === 0) {
      errors.push({
        field: 'symptoms',
        value: symptoms,
        message: 'Debe especificar al menos un síntoma',
        code: 'REQUIRED'
      });
    }
    
    if (symptoms.length > 20) {
      errors.push({
        field: 'symptoms',
        value: symptoms,
        message: 'Máximo 20 síntomas permitidos',
        code: 'TOO_MANY'
      });
    }
    
    // Síntomas reconocidos en el sistema
    const validSymptoms = [
      'fiebre', 'tos', 'diarrea', 'vomito', 'letargo', 'perdida_apetito',
      'cojera', 'hinchazón', 'secrecion_nasal', 'secrecion_ocular',
      'respiracion_dificil', 'temblores', 'convulsiones', 'deshidratacion',
      'perdida_peso', 'comportamiento_anormal', 'mastitis', 'aborto',
      'retencion_placenta', 'prolapso', 'heridas', 'parasitos_externos',
      'perdida_pelo', 'lesiones_piel', 'sangrado'
    ];
    
    const sanitizedSymptoms: string[] = [];
    const invalidSymptoms: string[] = [];
    
    for (const symptom of symptoms) {
      if (typeof symptom !== 'string') {
        errors.push({
          field: 'symptoms',
          value: symptom,
          message: 'Cada síntoma debe ser texto',
          code: 'INVALID_ITEM_TYPE'
        });
        continue;
      }
      
      const normalized = symptom.toLowerCase().trim().replace(/\s+/g, '_');
      
      if (validSymptoms.includes(normalized)) {
        sanitizedSymptoms.push(normalized);
      } else {
        invalidSymptoms.push(symptom);
      }
    }
    
    if (invalidSymptoms.length > 0) {
      errors.push({
        field: 'symptoms',
        value: invalidSymptoms,
        message: `Síntomas no reconocidos: ${invalidSymptoms.join(', ')}`,
        code: 'INVALID_SYMPTOMS'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: [...new Set(sanitizedSymptoms)] // Eliminar duplicados
    };
  }
  
  /**
   * Validar rango de fechas
   */
  static validateDateRange(startDate: string | Date, endDate: string | Date): ValidationResult {
    const errors: ValidationError[] = [];
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime())) {
      errors.push({
        field: 'startDate',
        value: startDate,
        message: 'Fecha de inicio inválida',
        code: 'INVALID_DATE'
      });
    }
    
    if (isNaN(end.getTime())) {
      errors.push({
        field: 'endDate',
        value: endDate,
        message: 'Fecha de fin inválida',
        code: 'INVALID_DATE'
      });
    }
    
    if (errors.length > 0) {
      return { isValid: false, errors };
    }
    
    if (start >= end) {
      errors.push({
        field: 'dateRange',
        value: { startDate, endDate },
        message: 'Fecha de inicio debe ser anterior a fecha de fin',
        code: 'INVALID_RANGE'
      });
    }
    
    // Validar que el rango no sea mayor a 5 años
    const maxRange = 5 * 365 * 24 * 60 * 60 * 1000; // 5 años en ms
    if (end.getTime() - start.getTime() > maxRange) {
      errors.push({
        field: 'dateRange',
        value: { startDate, endDate },
        message: 'Rango de fechas no puede ser mayor a 5 años',
        code: 'RANGE_TOO_LARGE'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      }
    };
  }
  
  /**
   * Validar producción de leche
   */
  static validateMilkProduction(liters: number, date: string | Date): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (typeof liters !== 'number' || isNaN(liters)) {
      errors.push({
        field: 'liters',
        value: liters,
        message: 'Litros de leche debe ser un número válido',
        code: 'INVALID_TYPE'
      });
      return { isValid: false, errors };
    }
    
    if (liters < 0) {
      errors.push({
        field: 'liters',
        value: liters,
        message: 'Litros no puede ser negativo',
        code: 'NEGATIVE_VALUE'
      });
    }
    
    if (liters > 100) {
      errors.push({
        field: 'liters',
        value: liters,
        message: 'Producción diaria máxima 100 litros por vaca',
        code: 'EXCEEDS_MAXIMUM'
      });
    }
    
    // Validar fecha de producción
    const productionDate = new Date(date);
    if (isNaN(productionDate.getTime())) {
      errors.push({
        field: 'date',
        value: date,
        message: 'Fecha de producción inválida',
        code: 'INVALID_DATE'
      });
    } else {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      if (productionDate > now) {
        errors.push({
          field: 'date',
          value: date,
          message: 'Fecha de producción no puede ser futura',
          code: 'FUTURE_DATE'
        });
      }
      
      if (productionDate < yesterday) {
        // Permitir registros hasta de ayer, pero advertir si es más antiguo
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (productionDate < weekAgo) {
          errors.push({
            field: 'date',
            value: date,
            message: 'Fecha de producción muy antigua (más de 7 días)',
            code: 'TOO_OLD'
          });
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: {
        liters: Math.round(liters * 100) / 100, // 2 decimales
        date: productionDate.toISOString()
      }
    };
  }
}

/**
 * Esquemas de validación para diferentes entidades
 */
export const ValidationSchemas = {
  
  // Esquema para crear/actualizar ganado
  cattle: {
    required: ['earTag', 'type', 'gender', 'birthDate'],
    optional: ['name', 'breed', 'weight', 'motherEarTag', 'fatherEarTag', 'location', 'notes'],
    validators: {
      earTag: CattleValidator.validateEarTag,
      weight: (weight: number, data: any) => CattleValidator.validateWeight(weight, data.type),
      birthDate: CattleValidator.validateBirthDate,
      location: (location: any) => {
        if (location && location.latitude !== undefined && location.longitude !== undefined) {
          return CattleValidator.validateCoordinates(location.latitude, location.longitude);
        }
        return { isValid: true, errors: [] };
      }
    }
  },
  
  // Esquema para vacunación
  vaccination: {
    required: ['cattleId', 'vaccineType', 'vaccineName', 'dose', 'applicationDate', 'veterinarianName'],
    optional: ['nextDueDate', 'batchNumber', 'manufacturer', 'location', 'notes', 'sideEffects'],
    validators: {
      dose: (dose: any, data: any) => CattleValidator.validateVaccineDose(dose, data.vaccineType),
      applicationDate: CattleValidator.validateBirthDate,
      nextDueDate: (date: any) => date ? CattleValidator.validateBirthDate(date) : { isValid: true, errors: [] },
      location: (location: any) => {
        if (location && location.latitude !== undefined && location.longitude !== undefined) {
          return CattleValidator.validateCoordinates(location.latitude, location.longitude);
        }
        return { isValid: true, errors: [] };
      }
    }
  },
  
  // Esquema para enfermedad
  illness: {
    required: ['cattleId', 'diseaseName', 'diagnosisDate', 'symptoms', 'severity', 'veterinarianName'],
    optional: ['treatment', 'recoveryDate', 'location', 'notes', 'isContagious'],
    validators: {
      symptoms: CattleValidator.validateSymptoms,
      diagnosisDate: CattleValidator.validateBirthDate,
      recoveryDate: (date: any) => date ? CattleValidator.validateBirthDate(date) : { isValid: true, errors: [] },
      location: (location: any) => {
        if (location && location.latitude !== undefined && location.longitude !== undefined) {
          return CattleValidator.validateCoordinates(location.latitude, location.longitude);
        }
        return { isValid: true, errors: [] };
      }
    }
  },
  
  // Esquema para producción de leche
  milkProduction: {
    required: ['cattleId', 'liters', 'date'],
    optional: ['morningLiters', 'eveningLiters', 'quality', 'notes'],
    validators: {
      production: (data: any) => CattleValidator.validateMilkProduction(data.liters, data.date)
    }
  },
  
  // Esquema para búsquedas con filtros
  search: {
    required: [],
    optional: ['startDate', 'endDate', 'healthStatus', 'cattleType', 'breed', 'location', 'limit', 'offset'],
    validators: {
      dateRange: (data: any) => {
        if (data.startDate && data.endDate) {
          return CattleValidator.validateDateRange(data.startDate, data.endDate);
        }
        return { isValid: true, errors: [] };
      },
      limit: (limit: any) => {
        if (limit !== undefined) {
          const num = parseInt(limit);
          if (isNaN(num) || num < 1 || num > 1000) {
            return {
              isValid: false,
              errors: [{
                field: 'limit',
                value: limit,
                message: 'Límite debe ser un número entre 1 y 1000',
                code: 'INVALID_RANGE'
              }]
            };
          }
        }
        return { isValid: true, errors: [] };
      },
      offset: (offset: any) => {
        if (offset !== undefined) {
          const num = parseInt(offset);
          if (isNaN(num) || num < 0) {
            return {
              isValid: false,
              errors: [{
                field: 'offset',
                value: offset,
                message: 'Offset debe ser un número mayor o igual a 0',
                code: 'INVALID_RANGE'
              }]
            };
          }
        }
        return { isValid: true, errors: [] };
      }
    }
  }
};

/**
 * Middleware principal de validación
 */
export const validate = (schemaName: keyof typeof ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const schema = ValidationSchemas[schemaName];
      const data = { ...req.body, ...req.query, ...req.params };
      const errors: ValidationError[] = [];
      const sanitizedData: any = {};
      
      // Validar campos requeridos
      for (const field of schema.required) {
        const fieldName = field as string;
        if (data[fieldName] === undefined || data[fieldName] === null || data[fieldName] === '') {
          errors.push({
            field: fieldName,
            value: data[fieldName],
            message: `Campo ${fieldName} es requerido`,
            code: 'REQUIRED'
          });
        }
      }
      
      // Ejecutar validadores específicos
      for (const [field, validator] of Object.entries(schema.validators)) {
        const fieldName = field as string;
        const isRequired = (schema.required as string[]).includes(fieldName);
        
        if (data[fieldName] !== undefined || isRequired) {
          let result: ValidationResult;
          
          if (fieldName === 'production') {
            // Validador especial que toma múltiples campos
            result = validator(data);
          } else if (fieldName === 'weight') {
            // Validador que depende de otro campo
            result = validator(data[fieldName], data);
          } else if (fieldName === 'dose') {
            // Validador que depende de otro campo
            result = validator(data[fieldName], data);
          } else if (fieldName === 'dateRange') {
            // Validador de rango de fechas
            result = validator(data);
          } else {
            // Validador estándar
            result = validator(data[fieldName]);
          }
          
          if (!result.isValid) {
            errors.push(...result.errors);
          } else if (result.sanitizedData !== undefined) {
            if (fieldName === 'production') {
              Object.assign(sanitizedData, result.sanitizedData);
            } else if (fieldName === 'location' && result.sanitizedData) {
              sanitizedData[fieldName] = result.sanitizedData;
            } else {
              sanitizedData[fieldName] = result.sanitizedData;
            }
          }
        }
      }
      
      // Si hay errores, retornar respuesta de error
      if (errors.length > 0) {
        logMessage(
          LogLevel.WARN,
          'validation_failed',
          `Validación fallida para esquema ${schemaName}`,
          {
            userId: req.userId,
            userEmail: req.user?.email,
            schema: schemaName,
            errors: errors,
            data: data
          }
        );
        
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Error de validación de datos',
            details: {
              fieldErrors: errors,
              totalErrors: errors.length
            },
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
            method: req.method
          }
        });
        
        return;
      }
      
      // Agregar datos sanitizados al request
      req.body = { ...req.body, ...sanitizedData };
      (req as any).validatedData = sanitizedData;
      
      next();
      
    } catch (error) {
      logMessage(
        LogLevel.ERROR,
        'validation_error',
        `Error en middleware de validación: ${error}`,
        {
          schema: schemaName,
          error: error instanceof Error ? error.stack : error
        }
      );
      
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_MIDDLEWARE_ERROR',
          message: 'Error interno en validación',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};

/**
 * Middleware para sanitización de datos de entrada
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Función para sanitizar recursivamente
    const sanitize = (obj: any): any => {
      if (typeof obj === 'string') {
        // Eliminar espacios extra, tabs, y caracteres de control
        return obj.trim().replace(/\s+/g, ' ').replace(/[\x00-\x1F\x7F]/g, '');
      }
      
      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }
      
      if (obj !== null && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          // Sanitizar clave del objeto
          const cleanKey = key.replace(/[^\w.-]/g, '');
          if (cleanKey) {
            sanitized[cleanKey] = sanitize(value);
          }
        }
        return sanitized;
      }
      
      return obj;
    };
    
    // Sanitizar body, query y params
    if (req.body) {
      req.body = sanitize(req.body);
    }
    
    if (req.query) {
      req.query = sanitize(req.query);
    }
    
    if (req.params) {
      req.params = sanitize(req.params);
    }
    
    next();
    
  } catch (error) {
    logMessage(
      LogLevel.ERROR,
      'sanitization_error',
      `Error en sanitización: ${error}`,
      { error: error instanceof Error ? error.stack : error }
    );
    
    // En caso de error, continuar sin sanitizar
    next();
  }
};

/**
 * Middleware para validación de IDs
 */
export const validateId = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params[paramName];
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ID',
          message: `Parámetro ${paramName} es requerido`,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
    
    // Validar formato UUID o ID numérico
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const numericRegex = /^\d+$/;
    
    if (!uuidRegex.test(id) && !numericRegex.test(id)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID_FORMAT',
          message: `Formato de ${paramName} inválido`,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
    
    next();
  };
};

/**
 * Función helper para validación manual
 */
export const validateData = (data: any, schemaName: keyof typeof ValidationSchemas): ValidationResult => {
  const schema = ValidationSchemas[schemaName];
  const errors: ValidationError[] = [];
  const sanitizedData: any = {};
  
  // Validar campos requeridos
  for (const field of schema.required) {
    const fieldName = field as string;
    if (data[fieldName] === undefined || data[fieldName] === null || data[fieldName] === '') {
      errors.push({
        field: fieldName,
        value: data[fieldName],
        message: `Campo ${fieldName} es requerido`,
        code: 'REQUIRED'
      });
    }
  }
  
  // Ejecutar validadores
  for (const [field, validator] of Object.entries(schema.validators)) {
    const fieldName = field as string;
    if (data[fieldName] !== undefined) {
      const result = validator(data[fieldName], data);
      
      if (!result.isValid) {
        errors.push(...result.errors);
      } else if (result.sanitizedData !== undefined) {
        sanitizedData[fieldName] = result.sanitizedData;
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};