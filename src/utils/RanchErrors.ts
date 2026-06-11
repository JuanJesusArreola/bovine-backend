// utils/RanchErrors.ts
export class RanchError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly cause?: Error;

  constructor(message: string, code: string = 'RANCH_ERROR', statusCode: number = 500, cause?: Error) {
    super(message);
    this.name = 'RanchError';
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
    if (Error.captureStackTrace) Error.captureStackTrace(this, RanchError);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      stack: this.stack,
      cause: this.cause?.message,
    };
  }
}

export class RanchNotFoundError extends RanchError {
  constructor(id: string) {
    super(`Rancho con ID ${id} no encontrado`, 'RANCH_NOT_FOUND', 404);
    this.name = 'RanchNotFoundError';
  }
}

export class RanchValidationError extends RanchError {
  constructor(message: string) {
    super(message, 'RANCH_VALIDATION_ERROR', 400);
    this.name = 'RanchValidationError';
  }
}

export class RanchCapacityError extends RanchError {
  constructor(message: string) {
    super(message, 'RANCH_CAPACITY_ERROR', 400);
    this.name = 'RanchCapacityError';
  }
}

export class RanchOwnershipNotFoundError extends RanchError {
  constructor(ranchId: string) {
    super(`Información de propiedad no encontrada para el rancho ${ranchId}`, 'OWNERSHIP_NOT_FOUND', 404);
    this.name = 'RanchOwnershipNotFoundError';
  }
}

export class CertificationNotFoundError extends RanchError {
  constructor(id: string) {
    super(`Certificación con ID ${id} no encontrada`, 'CERTIFICATION_NOT_FOUND', 404);
    this.name = 'CertificationNotFoundError';
  }
}

export class LicenseNotFoundError extends RanchError {
  constructor(id: string) {
    super(`Licencia con ID ${id} no encontrada`, 'LICENSE_NOT_FOUND', 404);
    this.name = 'LicenseNotFoundError';
  }
}

export class InsuranceNotFoundError extends RanchError {
  constructor(id: string) {
    super(`Seguro con ID ${id} no encontrada`, 'INSURANCE_NOT_FOUND', 404);
    this.name = 'InsuranceNotFoundError';
  }
}

export class InvalidShareholdersError extends RanchError {
  constructor(message: string) {
    super(message, 'INVALID_SHAREHOLDERS', 400);
    this.name = 'InvalidShareholdersError';
  }
}


export class ProductionNotFoundError extends RanchError {
  constructor(ranchId: string, year: number) {
    super(`Datos de producción para el año ${year} del rancho ${ranchId} no encontrados`, 'PRODUCTION_NOT_FOUND', 404);
    this.name = 'ProductionNotFoundError';
  }
}

export class SustainabilityNotFoundError extends RanchError {
  constructor(ranchId: string) {
    super(`Datos de sostenibilidad del rancho ${ranchId} no encontrados`, 'SUSTAINABILITY_NOT_FOUND', 404);
    this.name = 'SustainabilityNotFoundError';
  }
}

export class TechnologyNotFoundError extends RanchError {
  constructor(ranchId: string) {
    super(`Datos de tecnología del rancho ${ranchId} no encontrados`, 'TECHNOLOGY_NOT_FOUND', 404);
    this.name = 'TechnologyNotFoundError';
  }
}

export class FinancialNotFoundError extends RanchError {
  constructor(ranchId: string, year: number) {
    super(`Datos financieros para el año ${year} del rancho ${ranchId} no encontrados`, 'FINANCIAL_NOT_FOUND', 404);
    this.name = 'FinancialNotFoundError';
  }
}


export class HRNotFoundError extends RanchError {
  constructor(ranchId: string) {
    super(`Datos de RRHH del rancho ${ranchId} no encontrados`, 'HR_NOT_FOUND', 404);
    this.name = 'HRNotFoundError';
  }
}

export class EmergencyNotFoundError extends RanchError {
  constructor(ranchId: string) {
    super(`Plan de emergencia del rancho ${ranchId} no encontrado`, 'EMERGENCY_NOT_FOUND', 404);
    this.name = 'EmergencyNotFoundError';
  }
}

export class MediaNotFoundError extends RanchError {
  constructor(mediaId: string) {
    super(`Archivo multimedia con ID ${mediaId} no encontrado`, 'MEDIA_NOT_FOUND', 404);
    this.name = 'MediaNotFoundError';
  }
}