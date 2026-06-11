// Funciones helper para la aplicación de seguimiento de ganado
import { 
  CATTLE_HEALTH_STATUS, 
  CATTLE_TYPES, 
  CATTLE_BREEDS,
  EVENT_TYPES,
  VACCINE_TYPES,
  DATE_FORMATS,
  GEOLOCATION,
  PAGINATION,
  VALIDATION_RULES 
} from './constants';

// Interfaces para helpers
interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface DistanceResult {
  distance: number;
  unit: 'km' | 'miles';
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface AgeInfo {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  category: 'calf' | 'young' | 'adult' | 'senior';
}

/**
 * Función para formatear fechas según diferentes formatos
 * @param date - Fecha a formatear
 * @param format - Formato deseado
 * @returns string - Fecha formateada
 */
export const formatDate = (date: Date | string, format: string = DATE_FORMATS.DISPLAY_DATE): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Fecha inválida';
    }
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    
    switch (format) {
      case DATE_FORMATS.DATE_ONLY:
        return `${year}-${month}-${day}`;
      case DATE_FORMATS.DATETIME:
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      case DATE_FORMATS.DISPLAY_DATE:
        return `${day}/${month}/${year}`;
      case DATE_FORMATS.DISPLAY_DATETIME:
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      case DATE_FORMATS.TIME_ONLY:
        return `${hours}:${minutes}:${seconds}`;
      default:
        return dateObj.toLocaleDateString('es-ES');
    }
  } catch (error) {
    console.error('❌ Error formateando fecha:', error);
    return 'Error en fecha';
  }
};

/**
 * Función para calcular la edad de un animal
 * @param birthDate - Fecha de nacimiento
 * @returns AgeInfo - Información detallada de la edad
 */
export const calculateAge = (birthDate: Date | string): AgeInfo => {
  try {
    const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
    const now = new Date();
    
    if (isNaN(birth.getTime()) || birth > now) {
      return {
        years: 0,
        months: 0,
        days: 0,
        totalDays: 0,
        category: 'calf'
      };
    }
    
    // Calcular diferencia en años, meses y días
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    let days = now.getDate() - birth.getDate();
    
    // Ajustar si los días son negativos
    if (days < 0) {
      months--;
      const daysInPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      days += daysInPrevMonth;
    }
    
    // Ajustar si los meses son negativos
    if (months < 0) {
      years--;
      months += 12;
    }
    
    // Calcular total de días
    const totalDays = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
    
    // Determinar categoría
    let category: 'calf' | 'young' | 'adult' | 'senior';
    if (totalDays < 365) {
      category = 'calf';
    } else if (totalDays < (2 * 365)) {
      category = 'young';
    } else if (totalDays < (8 * 365)) {
      category = 'adult';
    } else {
      category = 'senior';
    }
    
    return {
      years,
      months,
      days,
      totalDays,
      category
    };
  } catch (error) {
    console.error('❌ Error calculando edad:', error);
    return {
      years: 0,
      months: 0,
      days: 0,
      totalDays: 0,
      category: 'calf'
    };
  }
};

/**
 * Función para calcular la distancia entre dos coordenadas usando la fórmula de Haversine
 * @param coord1 - Primera coordenada
 * @param coord2 - Segunda coordenada
 * @param unit - Unidad de medida (km o miles)
 * @returns DistanceResult - Distancia calculada
 */
export const calculateDistance = (
  coord1: Coordinates,
  coord2: Coordinates,
  unit: 'km' | 'miles' = 'km'
): DistanceResult => {
  try {
    const R = unit === 'km' ? 6371 : 3959; // Radio de la Tierra
    
    const lat1Rad = coord1.latitude * (Math.PI / 180);
    const lat2Rad = coord2.latitude * (Math.PI / 180);
    const deltaLat = (coord2.latitude - coord1.latitude) * (Math.PI / 180);
    const deltaLng = (coord2.longitude - coord1.longitude) * (Math.PI / 180);
    
    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return {
      distance: Math.round(distance * 100) / 100, // Redondear a 2 decimales
      unit
    };
  } catch (error) {
    console.error('❌ Error calculando distancia:', error);
    return { distance: 0, unit };
  }
};

/**
 * Función para validar coordenadas geográficas
 * @param latitude - Latitud
 * @param longitude - Longitud
 * @returns ValidationResult - Resultado de validación
 */
export const validateCoordinates = (latitude: number, longitude: number): ValidationResult => {
  const errors: string[] = [];
  
  if (typeof latitude !== 'number' || isNaN(latitude)) {
    errors.push('La latitud debe ser un número válido');
  } else if (latitude < GEOLOCATION.MIN_LATITUDE || latitude > GEOLOCATION.MAX_LATITUDE) {
    errors.push(`La latitud debe estar entre ${GEOLOCATION.MIN_LATITUDE} y ${GEOLOCATION.MAX_LATITUDE}`);
  }
  
  if (typeof longitude !== 'number' || isNaN(longitude)) {
    errors.push('La longitud debe ser un número válido');
  } else if (longitude < GEOLOCATION.MIN_LONGITUDE || longitude > GEOLOCATION.MAX_LONGITUDE) {
    errors.push(`La longitud debe estar entre ${GEOLOCATION.MIN_LONGITUDE} y ${GEOLOCATION.MAX_LONGITUDE}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Función para calcular información de paginación
 * @param totalItems - Total de elementos
 * @param page - Página actual
 * @param limit - Elementos por página
 * @returns PaginationInfo - Información de paginación
 */
export const calculatePagination = (
  totalItems: number,
  page: number = PAGINATION.DEFAULT_PAGE,
  limit: number = PAGINATION.DEFAULT_LIMIT
): PaginationInfo => {
  // Validar y ajustar valores
  const validPage = Math.max(1, Math.floor(page));
  const validLimit = Math.min(Math.max(1, Math.floor(limit)), PAGINATION.MAX_LIMIT);
  const validTotal = Math.max(0, Math.floor(totalItems));
  
  const totalPages = Math.ceil(validTotal / validLimit);
  const currentPage = Math.min(validPage, totalPages || 1);
  
  return {
    page: currentPage,
    limit: validLimit,
    totalPages: totalPages,
    totalItems: validTotal,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  };
};

/**
 * Función para validar un tag/identificador de ganado
 * @param tag - Tag a validar
 * @returns ValidationResult - Resultado de validación
 */
export const validateCattleTag = (tag: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!tag || typeof tag !== 'string') {
    errors.push('El tag es requerido');
    return { isValid: false, errors };
  }
  
  const cleanTag = tag.trim();
  
  if (cleanTag.length < VALIDATION_RULES.CATTLE_TAG_MIN_LENGTH) {
    errors.push(`El tag debe tener al menos ${VALIDATION_RULES.CATTLE_TAG_MIN_LENGTH} caracteres`);
  }
  
  if (cleanTag.length > VALIDATION_RULES.CATTLE_TAG_MAX_LENGTH) {
    errors.push(`El tag no puede tener más de ${VALIDATION_RULES.CATTLE_TAG_MAX_LENGTH} caracteres`);
  }
  
  // Verificar caracteres válidos (letras, números, guiones)
  const validTagPattern = /^[A-Za-z0-9\-_]+$/;
  if (!validTagPattern.test(cleanTag)) {
    errors.push('El tag solo puede contener letras, números, guiones y guiones bajos');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Función para validar peso de ganado
 * @param weight - Peso a validar
 * @returns ValidationResult - Resultado de validación
 */
export const validateCattleWeight = (weight: number): ValidationResult => {
  const errors: string[] = [];
  
  if (typeof weight !== 'number' || isNaN(weight)) {
    errors.push('El peso debe ser un número válido');
    return { isValid: false, errors };
  }
  
  if (weight < VALIDATION_RULES.CATTLE_WEIGHT_MIN) {
    errors.push(`El peso mínimo es ${VALIDATION_RULES.CATTLE_WEIGHT_MIN} kg`);
  }
  
  if (weight > VALIDATION_RULES.CATTLE_WEIGHT_MAX) {
    errors.push(`El peso máximo es ${VALIDATION_RULES.CATTLE_WEIGHT_MAX} kg`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Función para validar email
 * @param email - Email a validar
 * @returns ValidationResult - Resultado de validación
 */
export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!email || typeof email !== 'string') {
    errors.push('El email es requerido');
    return { isValid: false, errors };
  }
  
  const cleanEmail = email.trim().toLowerCase();
  
  if (cleanEmail.length > VALIDATION_RULES.EMAIL_MAX_LENGTH) {
    errors.push(`El email no puede tener más de ${VALIDATION_RULES.EMAIL_MAX_LENGTH} caracteres`);
  }
  
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(cleanEmail)) {
    errors.push('El formato del email no es válido');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Función para generar un rango de fechas
 * @param startDate - Fecha inicial
 * @param endDate - Fecha final
 * @returns DateRange[] - Array de fechas en el rango
 */
export const generateDateRange = (startDate: Date, endDate: Date): Date[] => {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
};

/**
 * Función para obtener el siguiente evento de vacunación
 * @param lastVaccinationDate - Fecha de última vacunación
 * @param vaccineType - Tipo de vacuna
 * @returns Date | null - Fecha del próximo evento o null
 */
export const getNextVaccinationDate = (
  lastVaccinationDate: Date,
  vaccineType: string
): Date | null => {
  try {
    // Intervalos de vacunación por tipo (en meses)
    const vaccinationIntervals: Record<string, number> = {
      [VACCINE_TYPES.FOOT_AND_MOUTH]: 6, // Cada 6 meses
      [VACCINE_TYPES.BRUCELLOSIS]: 12,   // Anual
      [VACCINE_TYPES.RABIES]: 12,        // Anual
      [VACCINE_TYPES.CLOSTRIDIUM]: 12,   // Anual
      [VACCINE_TYPES.BLACKLEG]: 12,      // Anual
      [VACCINE_TYPES.ANTHRAX]: 12,       // Anual
      [VACCINE_TYPES.IBR]: 12,           // Anual
      [VACCINE_TYPES.BVD]: 12,           // Anual
      [VACCINE_TYPES.LEPTOSPIROSIS]: 12, // Anual
      [VACCINE_TYPES.FIVE_WAY]: 12,      // Anual
      [VACCINE_TYPES.SEVEN_WAY]: 12,     // Anual
      [VACCINE_TYPES.NINE_WAY]: 12,      // Anual
    };
    
    const interval = vaccinationIntervals[vaccineType] || 12; // Default: anual
    const nextDate = new Date(lastVaccinationDate);
    nextDate.setMonth(nextDate.getMonth() + interval);
    
    return nextDate;
  } catch (error) {
    console.error('❌ Error calculando próxima vacunación:', error);
    return null;
  }
};

/**
 * Función para formatear números con separadores de miles
 * @param number - Número a formatear
 * @param decimals - Número de decimales
 * @returns string - Número formateado
 */
export const formatNumber = (number: number, decimals: number = 0): string => {
  try {
    return number.toLocaleString('es-ES', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  } catch (error) {
    return number.toString();
  }
};

/**
 * Función para convertir string a slug (URL friendly)
 * @param text - Texto a convertir
 * @returns string - Slug generado
 */
export const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-') // Reemplazar espacios y caracteres especiales con -
    .replace(/^-+|-+$/g, '');   // Remover - al inicio y final
};

/**
 * Función para obtener el estado de salud basado en eventos recientes
 * @param events - Array de eventos del animal
 * @returns string - Estado de salud calculado
 */
export const calculateHealthStatus = (events: any[]): string => {
  if (!events || events.length === 0) {
    return CATTLE_HEALTH_STATUS.UNKNOWN;
  }
  
  // Ordenar eventos por fecha (más recientes primero)
  const sortedEvents = events.sort((a, b) => 
    new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  );
  
  // Buscar eventos de salud en los últimos 30 días
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentHealthEvents = sortedEvents.filter(event => 
    new Date(event.event_date) >= thirtyDaysAgo &&
    (event.event_type === EVENT_TYPES.ILLNESS || 
     event.event_type === EVENT_TYPES.TREATMENT ||
     event.event_type === EVENT_TYPES.INJURY)
  );
  
  if (recentHealthEvents.length === 0) {
    return CATTLE_HEALTH_STATUS.HEALTHY;
  }
  
  // Verificar el evento más reciente
  const latestEvent = recentHealthEvents[0];
  
  switch (latestEvent.event_type) {
    case EVENT_TYPES.ILLNESS:
      return CATTLE_HEALTH_STATUS.SICK;
    case EVENT_TYPES.TREATMENT:
      return CATTLE_HEALTH_STATUS.RECOVERING;
    case EVENT_TYPES.INJURY:
      return CATTLE_HEALTH_STATUS.SICK;
    default:
      return CATTLE_HEALTH_STATUS.HEALTHY;
  }
};

/**
 * Función para generar un color basado en un string (para UI)
 * @param text - Texto base
 * @returns string - Color en formato hexadecimal
 */
export const generateColorFromText = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 50%)`;
};

/**
 * Función para truncar texto con puntos suspensivos
 * @param text - Texto a truncar
 * @param maxLength - Longitud máxima
 * @returns string - Texto truncado
 */
export const truncateText = (text: string, maxLength: number = 50): string => {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength).trim() + '...';
};

/**
 * Función para obtener el ícono apropiado para un tipo de evento
 * @param eventType - Tipo de evento
 * @returns string - Nombre del ícono
 */
export const getEventIcon = (eventType: string): string => {
  const iconMap: Record<string, string> = {
    [EVENT_TYPES.VACCINATION]: 'syringe',
    [EVENT_TYPES.ILLNESS]: 'thermometer',
    [EVENT_TYPES.TREATMENT]: 'pill',
    [EVENT_TYPES.PREGNANCY_CHECK]: 'heart',
    [EVENT_TYPES.BIRTH]: 'baby',
    [EVENT_TYPES.BREEDING]: 'heart-handshake',
    [EVENT_TYPES.INJURY]: 'bandage',
    [EVENT_TYPES.SURGERY]: 'scissors',
    [EVENT_TYPES.DEWORMING]: 'bug',
    [EVENT_TYPES.WEIGHT_CHECK]: 'scale',
    [EVENT_TYPES.LOCATION_UPDATE]: 'map-pin',
    [EVENT_TYPES.TRANSFER]: 'truck',
    [EVENT_TYPES.DEATH]: 'skull',
    [EVENT_TYPES.SALE]: 'dollar-sign',
    [EVENT_TYPES.PURCHASE]: 'shopping-cart',
  };
  
  return iconMap[eventType] || 'calendar';
};

/**
 * Función para debounce (retrasar ejecución de función)
 * @param func - Función a ejecutar
 * @param delay - Retraso en millisegundos
 * @returns Function - Función con debounce aplicado
 */
export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Exportar tipos para uso en otros módulos
export type {
  DateRange,
  Coordinates,
  DistanceResult,
  ValidationResult,
  PaginationInfo,
  AgeInfo
};