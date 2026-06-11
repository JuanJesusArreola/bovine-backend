import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';

// Enums para medicamentos
export enum MedicationType {
  ANTIBIOTIC = 'ANTIBIOTIC',                   // Antibiótico
  ANTI_INFLAMMATORY = 'ANTI_INFLAMMATORY',     // Antiinflamatorio
  ANALGESIC = 'ANALGESIC',                     // Analgésico
  ANTIPARASITIC = 'ANTIPARASITIC',             // Antiparasitario
  ANTIFUNGAL = 'ANTIFUNGAL',                   // Antifúngico
  ANTIVIRAL = 'ANTIVIRAL',                     // Antiviral
  VACCINE = 'VACCINE',                         // Vacuna
  VITAMIN = 'VITAMIN',                         // Vitamina
  MINERAL = 'MINERAL',                         // Mineral
  HORMONE = 'HORMONE',                         // Hormona
  SEDATIVE = 'SEDATIVE',                       // Sedante
  ANESTHETIC = 'ANESTHETIC',                   // Anestésico
  REPRODUCTIVE = 'REPRODUCTIVE',               // Reproductivo
  NUTRITIONAL = 'NUTRITIONAL',                 // Nutricional
  IMMUNOMODULATOR = 'IMMUNOMODULATOR',         // Inmunomodulador
  ANTIDIARRHEAL = 'ANTIDIARRHEAL',             // Antidiarreico
  RESPIRATORY = 'RESPIRATORY',                 // Respiratorio
  CARDIOVASCULAR = 'CARDIOVASCULAR',           // Cardiovascular
  TOPICAL = 'TOPICAL',                         // Tópico
  DISINFECTANT = 'DISINFECTANT',               // Desinfectante
  SUPPLEMENT = 'SUPPLEMENT',                   // Suplemento
  PROBIOTIC = 'PROBIOTIC',                     // Probiótico
  PREBIOTIC = 'PREBIOTIC',                     // Prebiótico
  OTHER = 'OTHER'                              // Otro
}

export enum AdministrationRoute {
  ORAL = 'ORAL',                               // Oral
  INTRAMUSCULAR = 'INTRAMUSCULAR',             // Intramuscular
  SUBCUTANEOUS = 'SUBCUTANEOUS',               // Subcutánea
  INTRAVENOUS = 'INTRAVENOUS',                 // Intravenosa
  TOPICAL = 'TOPICAL',                         // Tópica
  INHALATION = 'INHALATION',                   // Inhalación
  INTRANASAL = 'INTRANASAL',                   // Intranasal
  OPHTHALMIC = 'OPHTHALMIC',                   // Oftálmica
  OTIC = 'OTIC',                               // Ótica
  RECTAL = 'RECTAL',                           // Rectal
  VAGINAL = 'VAGINAL',                         // Vaginal
  INTRAUTERINE = 'INTRAUTERINE',               // Intrauterina
  INTRAMAMMARY = 'INTRAMAMMARY',               // Intramamaria
  EPIDURAL = 'EPIDURAL',                       // Epidural
  INTRADERMAL = 'INTRADERMAL',                 // Intradérmica
  INTRAPERITONEAL = 'INTRAPERITONEAL',         // Intraperitoneal
  OTHER = 'OTHER'                              // Otra
}

export enum PrescriptionStatus {
  DRAFT = 'DRAFT',                             // Borrador
  ACTIVE = 'ACTIVE',                           // Activa
  COMPLETED = 'COMPLETED',                     // Completada
  SUSPENDED = 'SUSPENDED',                     // Suspendida
  CANCELLED = 'CANCELLED',                     // Cancelada
  EXPIRED = 'EXPIRED'                          // Vencida
}

export enum ControlledSubstanceClass {
  NONE = 'NONE',                               // No controlada
  CLASS_I = 'CLASS_I',                         // Clase I
  CLASS_II = 'CLASS_II',                       // Clase II
  CLASS_III = 'CLASS_III',                     // Clase III
  CLASS_IV = 'CLASS_IV',                       // Clase IV
  CLASS_V = 'CLASS_V'                          // Clase V
}

export enum StorageRequirement {
  ROOM_TEMPERATURE = 'ROOM_TEMPERATURE',       // Temperatura ambiente
  REFRIGERATED = 'REFRIGERATED',               // Refrigerado (2-8°C)
  FROZEN = 'FROZEN',                           // Congelado (-20°C)
  CONTROLLED_TEMPERATURE = 'CONTROLLED_TEMPERATURE', // Temperatura controlada
  PROTECT_FROM_LIGHT = 'PROTECT_FROM_LIGHT',   // Proteger de la luz
  PROTECT_FROM_MOISTURE = 'PROTECT_FROM_MOISTURE', // Proteger de la humedad
  STORE_UPRIGHT = 'STORE_UPRIGHT',             // Almacenar en posición vertical
  DO_NOT_SHAKE = 'DO_NOT_SHAKE',               // No agitar
  SPECIAL_HANDLING = 'SPECIAL_HANDLING'        // Manejo especial
}

// Interface para información del principio activo
export interface ActiveIngredient {
  name: string;                                // Nombre del principio activo
  concentration: number;                       // Concentración
  concentrationUnit: string;                   // Unidad de concentración
  casNumber?: string;                          // Número CAS
  molecularWeight?: number;                    // Peso molecular
  molecularFormula?: string;                   // Fórmula molecular
  mechanism?: string;                          // Mecanismo de acción
}

// Interface para información de dosificación
export interface DosageInfo {
  species: string[];                           // Especies para las que aplica
  indication: string;                          // Indicación
  dosage: number;                              // Dosis
  dosageUnit: string;                          // Unidad de dosis
  frequency: string;                           // Frecuencia de administración
  duration: number;                            // Duración del tratamiento (días)
  route: AdministrationRoute;                  // Vía de administración
  maxDailyDose?: number;                       // Dosis máxima diaria
  loadingDose?: number;                        // Dosis de carga
  maintenanceDose?: number;                    // Dosis de mantenimiento
  adjustmentFactors?: Array<{                  // Factores de ajuste
    factor: string;                            // Factor (peso, edad, etc.)
    adjustment: string;                        // Ajuste recomendado
  }>;
  specialInstructions?: string[];              // Instrucciones especiales
}

// Interface para información farmacológica
export interface PharmacologicalInfo {
  mechanismOfAction?: string;                  // Mecanismo de acción
  pharmacokinetics?: {                         // Farmacocinética
    absorption?: string;
    distribution?: string;
    metabolism?: string;
    elimination?: string;
    halfLife?: number;                         // Vida media (horas)
    bioavailability?: number;                  // Biodisponibilidad (%)
    proteinBinding?: number;                   // Unión a proteínas (%)
  };
  pharmacodynamics?: {                         // Farmacodinamia
    onset?: number;                            // Inicio de acción (minutos)
    peakEffect?: number;                       // Efecto máximo (horas)
    duration?: number;                         // Duración de acción (horas)
    therapeuticRange?: string;                 // Rango terapéutico
  };
  efficacy?: number;                           // Eficacia (%)
  resistance?: string[];                       // Resistencia conocida
}

// Interface para efectos adversos
export interface AdverseEffects {
  common?: string[];                           // Efectos comunes (>10%)
  uncommon?: string[];                         // Efectos poco comunes (1-10%)
  rare?: string[];                             // Efectos raros (<1%)
  serious?: string[];                          // Efectos serios
  contraindications?: string[];                // Contraindicaciones
  warnings?: string[];                         // Advertencias
  precautions?: string[];                      // Precauciones
  drugInteractions?: Array<{                   // Interacciones medicamentosas
    drug: string;
    interaction: string;
    severity: 'MILD' | 'MODERATE' | 'SEVERE';
    management: string;
  }>;
  overdoseSymptoms?: string[];                 // Síntomas de sobredosis
  overdoseTreatment?: string;                  // Tratamiento de sobredosis
}

// Interface para información regulatoria
export interface RegulatoryInfo {
  registrationNumber?: string;                 // Número de registro
  regulatoryAuthority?: string;                // Autoridad regulatoria
  approvalDate?: Date;                         // Fecha de aprobación
  expirationDate?: Date;                       // Fecha de vencimiento del registro
  prescriptionRequired: boolean;               // Si requiere receta
  veterinaryPrescriptionOnly: boolean;         // Solo con receta veterinaria
  controlledSubstance: ControlledSubstanceClass; // Clase de sustancia controlada
  restrictions?: string[];                     // Restricciones especiales
  complianceRequirements?: string[];           // Requisitos de cumplimiento
  reportingRequirements?: string[];            // Requisitos de reporte
}

// Interface para información comercial
export interface CommercialInfo {
  manufacturer: string;                        // Fabricante
  distributor?: string;                        // Distribuidor
  supplier?: string;                           // Proveedor
  brandName: string;                           // Nombre comercial
  genericName?: string;                        // Nombre genérico
  presentation: string;                        // Presentación
  packaging?: string;                          // Empaque
  unitSize?: number;                           // Tamaño de unidad
  unitsPerPackage?: number;                    // Unidades por paquete
  cost?: number;                               // Costo
  currency?: string;                           // Moneda
  supplier_contact?: {                         // Contacto del proveedor
    name: string;
    phone: string;
    email: string;
  };
  orderingInfo?: {                             // Información de pedido
    minimumOrder?: number;
    leadTime?: number;                         // Tiempo de entrega (días)
    availability?: 'IN_STOCK' | 'BACK_ORDER' | 'DISCONTINUED';
  };
}

// Interface para información de calidad
export interface QualityInfo {
  specifications?: Array<{                     // Especificaciones de calidad
    parameter: string;
    specification: string;
    testMethod: string;
  }>;
  stabilityData?: {                            // Datos de estabilidad
    shelfLife?: number;                        // Vida útil (meses)
    stabilityConditions?: string;              // Condiciones de estabilidad
    degradationProducts?: string[];            // Productos de degradación
  };
  impurities?: Array<{                         // Impurezas
    name: string;
    limit: number;
    unit: string;
  }>;
  certificates?: string[];                     // URLs de certificados
  testReports?: string[];                      // URLs de reportes de prueba
  qualityControl?: {                           // Control de calidad
    testing_frequency?: string;
    responsible_lab?: string;
    last_test_date?: Date;
    next_test_date?: Date;
  };
}

// Atributos del modelo Medication
export interface MedicationAttributes {
  id: string;
  medicationCode: string;                      // Código único del medicamento
  genericName: string;                         // Nombre genérico
  brandName?: string;                          // Nombre comercial
  type: MedicationType;                        // Tipo de medicamento
  activeIngredients: ActiveIngredient[];       // Principios activos
  strength?: string;                           // Concentración/potencia
  dosageForm: string;                          // Forma farmacéutica
  presentation: string;                        // Presentación comercial
  dosageInfo: DosageInfo[];                    // Información de dosificación
  pharmacologicalInfo?: PharmacologicalInfo;   // Información farmacológica
  adverseEffects?: AdverseEffects;             // Efectos adversos
  withdrawalPeriod: number;                    // Período de retiro (días)
  milkWithdrawalPeriod?: number;               // Período de retiro leche (días)
  storageRequirements: StorageRequirement[];   // Requisitos de almacenamiento
  storageTemperatureMin?: number;              // Temperatura mínima (°C)
  storageTemperatureMax?: number;              // Temperatura máxima (°C)
  shelfLife: number;                           // Vida útil (meses)
  regulatoryInfo: RegulatoryInfo;              // Información regulatoria
  commercialInfo: CommercialInfo;              // Información comercial
  qualityInfo?: QualityInfo;                   // Información de calidad
  targetSpecies: string[];                     // Especies objetivo
  indications: string[];                       // Indicaciones
  contraindications?: string[];                // Contraindicaciones
  images?: string[];                           // URLs de imágenes
  documents?: string[];                        // URLs de documentos
  safetyDataSheet?: string;                    // URL de hoja de seguridad
  productInsert?: string;                      // URL de inserto del producto
  notes?: string;                              // Notas adicionales
  isActive: boolean;                           // Si el medicamento está activo
  isAvailable: boolean;                        // Si está disponible
  isControlled: boolean;                       // Si es sustancia controlada
  requiresRefrigeration: boolean;              // Si requiere refrigeración
  isVaccine: boolean;                          // Si es vacuna
  isAntibiotic: boolean;                       // Si es antibiótico
  isPrescriptionOnly: boolean;                 // Si requiere receta
  lastUpdated?: Date;                          // Fecha de última actualización
  approvedBy?: string;                         // ID del usuario que aprobó
  approvedDate?: Date;                         // Fecha de aprobación
  createdBy: string;                           // ID del usuario que creó
  updatedBy?: string;                          // ID del usuario que actualizó
  
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

// Atributos opcionales al crear un nuevo medicamento
export interface MedicationCreationAttributes
  extends Optional<MedicationAttributes,
    'id' | 'brandName' | 'strength' | 'pharmacologicalInfo' | 'adverseEffects' |
    'milkWithdrawalPeriod' | 'storageTemperatureMin' | 'storageTemperatureMax' |
    'qualityInfo' | 'contraindications' | 'images' | 'documents' |
    'safetyDataSheet' | 'productInsert' | 'notes' | 'lastUpdated' |
    'approvedBy' | 'approvedDate' | 'updatedBy' |
    'deletedAt'
  > { }

// Clase del modelo Medication
class Medication extends Model<MedicationAttributes, MedicationCreationAttributes>
  implements MedicationAttributes {
  public id!: string;
  public medicationCode!: string;
  public genericName!: string;
  public brandName?: string;
  public type!: MedicationType;
  public activeIngredients!: ActiveIngredient[];
  public strength?: string;
  public dosageForm!: string;
  public presentation!: string;
  public dosageInfo!: DosageInfo[];
  public pharmacologicalInfo?: PharmacologicalInfo;
  public adverseEffects?: AdverseEffects;
  public withdrawalPeriod!: number;
  public milkWithdrawalPeriod?: number;
  public storageRequirements!: StorageRequirement[];
  public storageTemperatureMin?: number;
  public storageTemperatureMax?: number;
  public shelfLife!: number;
  public regulatoryInfo!: RegulatoryInfo;
  public commercialInfo!: CommercialInfo;
  public qualityInfo?: QualityInfo;
  public targetSpecies!: string[];
  public indications!: string[];
  public contraindications?: string[];
  public images?: string[];
  public documents?: string[];
  public safetyDataSheet?: string;
  public productInsert?: string;
  public notes?: string;
  public isActive!: boolean;
  public isAvailable!: boolean;
  public isControlled!: boolean;
  public requiresRefrigeration!: boolean;
  public isVaccine!: boolean;
  public isAntibiotic!: boolean;
  public isPrescriptionOnly!: boolean;
  public lastUpdated?: Date;
  public approvedBy?: string;
  public approvedDate?: Date;
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;


}

// Definición del modelo en Sequelize
Medication.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del medicamento'
    },
    medicationCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 50]
      },
      comment: 'Código único del medicamento'
    },
    genericName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 200]
      },
      comment: 'Nombre genérico del medicamento'
    },
    brandName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Nombre comercial del medicamento'
    },
    type: {
      type: DataTypes.ENUM(...Object.values(MedicationType)),
      allowNull: false,
    },
    activeIngredients: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        notEmpty: true,
        isValidIngredients(value: ActiveIngredient[]) {
          if (!Array.isArray(value) || value.length === 0) {
            throw new Error('Debe tener al menos un principio activo');
          }
          value.forEach(ingredient => {
            if (!ingredient.name || !ingredient.concentration) {
              throw new Error('Cada principio activo debe tener nombre y concentración');
            }
          });
        }
      },
      comment: 'Principios activos del medicamento'
    },
    strength: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Concentración o potencia del medicamento'
    },
    dosageForm: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      },
      comment: 'Forma farmacéutica (tableta, inyección, etc.)'
    },
    presentation: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true
      },
      comment: 'Presentación comercial'
    },
    dosageInfo: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        notEmpty: true,
        isValidDosage(value: DosageInfo[]) {
          if (!Array.isArray(value) || value.length === 0) {
            throw new Error('Debe tener al menos una información de dosificación');
          }
        }
      },
      comment: 'Información de dosificación por especie'
    },
    pharmacologicalInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información farmacológica detallada'
    },
    adverseEffects: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Efectos adversos e interacciones'
    },
    withdrawalPeriod: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 365
      },
      comment: 'Período de retiro para carne (días)'
    },
    milkWithdrawalPeriod: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
        max: 365
      },
      comment: 'Período de retiro para leche (días)'
    },
    storageRequirements: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      validate: {
        isValidRequirement(value: string[]) {
          const valid = Object.values(StorageRequirement);
          value.forEach(v => {
            if (!valid.includes(v as StorageRequirement)) {
              throw new Error(`Storage requirement inválido: ${v}`);
            }
          });
        }
      }
    },
    storageTemperatureMin: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Temperatura mínima de almacenamiento (°C)'
    },
    storageTemperatureMax: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Temperatura máxima de almacenamiento (°C)'
    },
    shelfLife: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 120
      },
      comment: 'Vida útil en meses'
    },
    regulatoryInfo: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        notEmpty: true,
        isValidRegulatory(value: RegulatoryInfo) {
          if (!value.controlledSubstance) {
            throw new Error('Información de sustancia controlada es requerida');
          }
        }
      },
      comment: 'Información regulatoria'
    },
    commercialInfo: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        notEmpty: true,
        isValidCommercial(value: CommercialInfo) {
          if (!value.manufacturer || !value.brandName) {
            throw new Error('Fabricante y nombre comercial son requeridos');
          }
        }
      },
      comment: 'Información comercial'
    },
    qualityInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de control de calidad'
    },
    targetSpecies: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      validate: {
        notEmpty: true
      },
      comment: 'Especies objetivo del medicamento'
    },
    indications: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      validate: {
        notEmpty: true
      },
      comment: 'Indicaciones del medicamento'
    },
    contraindications: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: 'Contraindicaciones del medicamento'
    },
    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de imágenes del medicamento'
    },
    documents: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de documentos relacionados'
    },
    safetyDataSheet: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL de la hoja de datos de seguridad'
    },
    productInsert: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL del inserto del producto'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales del medicamento'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el medicamento está activo'
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el medicamento está disponible'
    },
    isControlled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si es sustancia controlada'
    },
    requiresRefrigeration: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si requiere refrigeración'
    },
    isVaccine: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si es una vacuna'
    },
    isAntibiotic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si es un antibiótico'
    },
    isPrescriptionOnly: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si requiere receta médica'
    },
    lastUpdated: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de última actualización de información'
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que aprobó el medicamento'
    },
    approvedDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de aprobación del medicamento'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que creó el registro'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que actualizó el registro'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de eliminación (soft delete)'
    }
  },
  {
    sequelize,
    modelName: 'Medication',
    tableName: 'medications',
    timestamps: true,
    paranoid: true, // Habilita soft delete
    indexes: [
      // Índices para optimizar consultas
      {

        fields: ['medication_code']
      },
      {
        fields: ['generic_name']
      },
      {
        fields: ['brand_name']
      },
      {
        fields: ['type']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['is_available']
      },
      {
        fields: ['is_controlled']
      },
      {
        fields: ['is_vaccine']
      },
      {
        fields: ['is_antibiotic']
      },
      {
        fields: ['is_prescription_only']
      },
      {
        fields: ['withdrawal_period']
      },
      {
        name: 'medications_type_species',
        fields: ['type', 'target_species']
      },
      {
        name: 'medications_controlled_prescription',
        fields: ['is_controlled', 'is_prescription_only']
      },
      {
        name: 'medications_withdrawal_periods',
        fields: ['withdrawal_period', 'milk_withdrawal_period']
      }
    ],
    hooks: {
      // Hook para establecer flags automáticamente
      beforeSave: async (medication: Medication) => {
        // Establecer flag de vacuna
        if (medication.type === MedicationType.VACCINE) {
          medication.isVaccine = true;
        }

        // Establecer flag de antibiótico
        if (medication.type === MedicationType.ANTIBIOTIC) {
          medication.isAntibiotic = true;
        }

        // Establecer flag de sustancia controlada
        if (medication.regulatoryInfo.controlledSubstance !== ControlledSubstanceClass.NONE) {
          medication.isControlled = true;
        }

        // Establecer flag de prescripción
        if (medication.regulatoryInfo.prescriptionRequired ||
          medication.regulatoryInfo.veterinaryPrescriptionOnly) {
          medication.isPrescriptionOnly = true;
        }

        // Establecer flag de refrigeración
        if (medication.storageRequirements.includes(StorageRequirement.REFRIGERATED) ||
          medication.storageRequirements.includes(StorageRequirement.FROZEN)) {
          medication.requiresRefrigeration = true;
        }

        // Validar temperaturas de almacenamiento
        if (medication.storageTemperatureMin !== null && medication.storageTemperatureMin !== undefined &&
          medication.storageTemperatureMax !== null && medication.storageTemperatureMax !== undefined) {
          if (medication.storageTemperatureMin >= medication.storageTemperatureMax) {
            throw new Error('La temperatura mínima debe ser menor a la temperatura máxima');
          }
        }

        // Actualizar fecha de última modificación
        medication.lastUpdated = new Date();
      }
    },
    comment: 'Tabla para el manejo completo de medicamentos veterinarios'
  }
);

export default Medication;