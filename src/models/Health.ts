// PROPÓSITO: Registros COMPLETOS de salud YA OCURRIDOS
import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';
import { LocationData, HealthStatus } from './Bovine';
import { BovineValidationError } from '../utils/BovineErrors';

// Enums para registros de salud
export enum HealthRecordType {
  ROUTINE_CHECKUP = 'ROUTINE_CHECKUP',         // Chequeo rutinario
  EMERGENCY_VISIT = 'EMERGENCY_VISIT',         // Visita de emergencia
  FOLLOW_UP = 'FOLLOW_UP',                     // Seguimiento
  VACCINATION = 'VACCINATION',                 // Vacunación
  TREATMENT = 'TREATMENT',                     // Tratamiento
  SURGERY = 'SURGERY',                         // Cirugía
  LABORATORY_TEST = 'LABORATORY_TEST',         // Examen de laboratorio
  PHYSICAL_EXAM = 'PHYSICAL_EXAM',             // Examen físico
  REPRODUCTIVE_EXAM = 'REPRODUCTIVE_EXAM',     // Examen reproductivo
  NECROPSY = 'NECROPSY',                       // Necropsia
  QUARANTINE_ASSESSMENT = 'QUARANTINE_ASSESSMENT', // Evaluación de cuarentena
  PRE_TRANSPORT_EXAM = 'PRE_TRANSPORT_EXAM',   // Examen pre-transporte
  NUTRITION_ASSESSMENT = 'NUTRITION_ASSESSMENT', // Evaluación nutricional
  BEHAVIORAL_ASSESSMENT = 'BEHAVIORAL_ASSESSMENT', // Evaluación conductual
  OTHER = 'OTHER'                              // Otro tipo de registro
}

export enum DiagnosisStatus {

  CONFIRMED = 'CONFIRMED',     // Confirmado
  RULED_OUT = 'RULED_OUT',     // Descartado
  DIFFERENTIAL = 'DIFFERENTIAL', // Diferencial

}

export enum TreatmentStatus {

  COMPLETED = 'COMPLETED',     // Completado
  SUSPENDED = 'SUSPENDED',     // Suspendido
  FAILED = 'FAILED',           // Fallido
  CANCELLED = 'CANCELLED',     // Cancelado
  ACTIVE = 'ACTIVE'            // Activo (en curso)
}

export enum SeverityLevel {
  MILD = 'MILD',               // Leve
  MODERATE = 'MODERATE',       // Moderado
  SEVERE = 'SEVERE',           // Severo
  CRITICAL = 'CRITICAL',       // Crítico
  FATAL = 'FATAL'              // Fatal
}

export enum BodySystem {
  RESPIRATORY = 'RESPIRATORY',         // Respiratorio
  CARDIOVASCULAR = 'CARDIOVASCULAR',   // Cardiovascular
  DIGESTIVE = 'DIGESTIVE',             // Digestivo
  NERVOUS = 'NERVOUS',                 // Nervioso
  MUSCULOSKELETAL = 'MUSCULOSKELETAL', // Musculoesquelético
  REPRODUCTIVE = 'REPRODUCTIVE',       // Reproductivo
  URINARY = 'URINARY',                 // Urinario
  INTEGUMENTARY = 'INTEGUMENTARY',     // Tegumentario (piel)
  ENDOCRINE = 'ENDOCRINE',             // Endocrino
  IMMUNE = 'IMMUNE',                   // Inmunológico
  METABOLIC = 'METABOLIC',             // Metabólico
  OCULAR = 'OCULAR',                   // Ocular
  AUDITORY = 'AUDITORY',               // Auditivo
  DENTAL = 'DENTAL',                   // Dental
  SYSTEMIC = 'SYSTEMIC'                // Sistémico
}

// Interface para signos vitales
export interface VitalSigns {
  temperature?: number;          // Temperatura corporal (°C)
  heartRate?: number;           // Frecuencia cardíaca (latidos/min)
  respiratoryRate?: number;     // Frecuencia respiratoria (resp/min)
  bloodPressure?: {             // Presión arterial
    systolic: number;
    diastolic: number;
  };
  pulseQuality?: 'STRONG' | 'WEAK' | 'IRREGULAR' | 'ABSENT'; // Calidad del pulso
  mucousMembranes?: 'PINK' | 'PALE' | 'YELLOW' | 'BLUE' | 'RED'; // Membranas mucosas
  capillaryRefillTime?: number; // Tiempo de relleno capilar (segundos)
  hydrationStatus?: 'NORMAL' | 'MILD_DEHYDRATION' | 'MODERATE_DEHYDRATION' | 'SEVERE_DEHYDRATION';
  consciousnessLevel?: 'ALERT' | 'DEPRESSED' | 'STUPOROUS' | 'COMATOSE'; // Nivel de conciencia
}

// Interface para examen físico
export interface PhysicalExamination {
  bodyConditionScore?: number;   // Puntuación de condición corporal (1-9)
  locomotionScore?: number;      // Puntuación de locomoción (1-5)
  weight?: number;               // Peso en kg
  height?: number;               // Altura en cm
  bodyLength?: number;           // Longitud corporal en cm
  chestGirth?: number;          // Perímetro torácico en cm
  skinCondition?: 'NORMAL' | 'DRY' | 'OILY' | 'LESIONS' | 'PARASITES' | 'WOUNDS';
  coatCondition?: 'GLOSSY' | 'DULL' | 'ROUGH' | 'PATCHY' | 'MATTED';
  eyeCondition?: 'CLEAR' | 'DISCHARGE' | 'INFLAMMATION' | 'CLOUDINESS' | 'INJURY';
  noseCondition?: 'CLEAR' | 'DISCHARGE' | 'CRACKED' | 'LESIONS';
  mouthCondition?: 'NORMAL' | 'ULCERS' | 'EXCESSIVE_SALIVATION' | 'DENTAL_PROBLEMS';
  lymphNodes?: 'NORMAL' | 'ENLARGED' | 'PAINFUL'; // Estado de ganglios linfáticos
  udderCondition?: 'NORMAL' | 'MASTITIS' | 'INJURY' | 'ASYMMETRIC'; // Condición de ubre (hembras)
  hoofCondition?: 'NORMAL' | 'OVERGROWN' | 'CRACKED' | 'INFECTED' | 'LAME'; // Condición de pezuñas
}

// Interface para síntomas observados
export interface Symptoms {
  primary: string[];             // Síntomas principales
  secondary?: string[];          // Síntomas secundarios
  duration?: number;             // Duración en días
  severity?: SeverityLevel;      // Severidad de los síntomas
  progression?: 'IMPROVING' | 'WORSENING' | 'STABLE' | 'FLUCTUATING'; // Progresión
  onset?: 'SUDDEN' | 'GRADUAL' | 'CHRONIC'; // Inicio de síntomas
  affectedSystems?: BodySystem[]; // Sistemas corporales afectados
  behavioralChanges?: string[];   // Cambios de comportamiento
  appetiteChange?: 'NORMAL' | 'INCREASED' | 'DECREASED' | 'ABSENT'; // Cambio en apetito
  activityLevel?: 'NORMAL' | 'INCREASED' | 'DECREASED' | 'LETHARGIC'; // Nivel de actividad
}

// Interface para diagnósticos
export interface Diagnosis {
  primaryDiagnosis?: string;     // Diagnóstico principal
  secondaryDiagnoses?: string[]; // Diagnósticos secundarios
  differentialDiagnoses?: string[]; // Diagnósticos diferenciales
  diagnosticCode?: string;       // Código de diagnóstico (ICD, etc.)
  status: DiagnosisStatus;       // Estado del diagnóstico
  confidence?: number;           // Nivel de confianza (0-100)
  basedOn?: string[];           // En qué se basa el diagnóstico
  prognosis?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'GRAVE'; // Pronóstico
  actualRecoveryTime?: number; // Tiempo esperado de recuperación (días)
  confirmedAt?: Date | string;   // Fecha de confirmación (se sella al confirmar)
  confirmedBy?: string;          // Usuario que confirmó el diagnóstico
}

// Interface para tratamientos
export interface Treatment {
  treatmentPlan?: string;        // Plan de tratamiento
  medications?: Array<{          // Medicamentos prescritos
    medicationId: string;
    name: string;
    activeIngredient?: string;
    dosage: number;
    dosageUnit: string;
    frequency: string;
    duration: number; // días
    route: 'ORAL' | 'INJECTABLE' | 'TOPICAL' | 'INTRAVENOUS' | 'INTRAMUSCULAR' | 'SUBCUTANEOUS';
    withdrawalPeriod?: number; // días
    cost?: number;
    inventoryItemId?: string;
    administeredAt: Date[];
  }>;
  procedures?: Array<{           // Procedimientos realizados
    name: string;
    description?: string;
    duration?: number; // minutos
    anesthesia?: boolean;
    complications?: string;
    outcome?: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILURE';
    performedAt: Date;
  }>;
  status: TreatmentStatus;       // Estado del tratamiento
  startDate?: Date;              // Fecha de inicio
  endDate?: Date;                // Fecha de finalización
  response?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NO_RESPONSE'; // Respuesta al tratamiento
  sideEffects?: string[];        // Efectos secundarios observados
  complications?: string[];      // Complicaciones del tratamiento
  followUpRequired?: boolean;    // Si requiere seguimiento
  followUpDate?: Date;           // Fecha de seguimiento
  followUpNotes?: string;
}

// Interface para resultados de laboratorio
export interface LaboratoryResults {
  testType?: string;             // Tipo de examen
  sampleType?: 'BLOOD' | 'URINE' | 'FECES' | 'TISSUE' | 'MILK' | 'SWAB' | 'OTHER'; // Tipo de muestra
  sampleDate?: Date;             // Fecha de toma de muestra
  testDate?: Date;               // Fecha de análisis
  laboratory?: string;           // Laboratorio que realizó el análisis
  results?: Array<{              // Resultados individuales
    parameter: string;
    value: string | number;
    unit?: string;
    referenceRange?: string;
    status?: 'NORMAL' | 'ABNORMAL' | 'CRITICAL' | 'PENDING';
    notes?: string;
  }>;
  interpretation?: string;       // Interpretación de resultados
  recommendations?: string[];    // Recomendaciones basadas en resultados
  cost?: number;                 // Costo del examen
  reportUrl?: string;
}

// Interface para evaluación nutricional
export interface NutritionalAssessment {
  bodyConditionScore?: number;   // Puntuación de condición corporal
  weightChange?: number;         // Cambio de peso (kg)
  appetiteAssessment?: 'NORMAL' | 'INCREASED' | 'DECREASED' | 'ABSENT';
  feedIntake?: number;           // Consumo de alimento (kg/día)
  waterIntake?: number;          // Consumo de agua (litros/día)
  supplementsGiven?: Array<{     // Suplementos administrados
    name: string;
    dosage: number;
    unit: string;
    frequency: string;
    administered: boolean;
  }>;
  nutritionalDeficiencies?: string[]; // Deficiencias identificadas
  recommendations?: string[];    // Recomendaciones nutricionales
}

// Interface para evaluación reproductiva
export interface ReproductiveAssessment {
  reproductiveStatus?: 'CYCLING' | 'PREGNANT' | 'LACTATING' | 'DRY' | 'ANESTRUS';
  gestationDay?: number;         // Día de gestación
  expectedCalvingDate?: Date;    // Fecha esperada de parto
  breedingSoundness?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNSOUND';
  reproductiveAbnormalities?: string[]; // Anormalidades reproductivas
  uterineHealth?: 'NORMAL' | 'INFECTION' | 'INFLAMMATION' | 'ABNORMAL_DISCHARGE';
  ovaryCondition?: 'NORMAL' | 'CYSTS' | 'INACTIVE' | 'ABNORMAL';
  milkProduction?: number;       // Producción de leche (litros/día)
  milkQuality?: 'NORMAL' | 'ABNORMAL' | 'MASTITIS_PRESENT';
}

// Atributos del modelo Health
export interface HealthAttributes {

  id: string;
  bovineId: string;

  // Relación OPCIONAL con el evento que lo generó
  eventId?: string;  // Para trazabilidad

  // Relación OPCIONAL con el catálogo de enfermedades
  diseaseId?: string;  // FK a diseases.id

  // Datos del registro
  recordType: HealthRecordType;
  recordDate: Date;  // Cuándo ocurrió realmente

  // Personal
  veterinarianId?: string;
  veterinarianName?: string;
  veterinarianLicense?: string;
  technicianId?: string;

  // Ubicación
  location?: LocationData;

  // Historia clínica
  chiefComplaint?: string;
  historyPresent?: string;
  historyPast?: string;

  // Exámenes REALIZADOS
  vitalSigns?: VitalSigns;
  physicalExam?: PhysicalExamination;
  symptoms?: Symptoms;

  // Diagnóstico CONFIRMADO
  diagnosis: Diagnosis;

  // Tratamiento APLICADO
  treatment?: Treatment;

  // Resultados de laboratorio
  laboratoryResults?: LaboratoryResults[];

  // Evaluaciones
  nutritionalAssessment?: NutritionalAssessment;
  reproductiveAssessment?: ReproductiveAssessment;

  // Resultado final
  overallHealthStatus: HealthStatus;
  recommendations?: string[];

  // Documentación
  attachments?: string[];
  photos?: string[];
  xrays?: string[];
  videos?: string[];

  // Notas
  notes?: string;
  privateNotes?: string;

  // Costos reales
  cost?: number;
  currency?: string;

  // Seguimiento REALIZADO
  followUpRequired: boolean;
  followUpDate?: Date;
  followUpNotes?: string;

  // Metadata
  isEmergency: boolean;
  isCompleted: boolean;  // Siempre true para Health
  isActive: boolean;

  // Factores externos
  weatherConditions?: string;
  environmentalFactors?: string[];

  // Auditoría
  createdBy: string;
  updatedBy?: string;

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

// Atributos opcionales al crear un nuevo registro de salud
export interface HealthCreationAttributes
  extends Optional<HealthAttributes,
    'id' | 'eventId' | 'diseaseId' | 'veterinarianId' | 'veterinarianName' | 'veterinarianLicense' |
    'technicianId' | 'location' | 'chiefComplaint' | 'historyPresent' | 'historyPast' |
    'vitalSigns' | 'physicalExam' | 'symptoms' | 'treatment' | 'laboratoryResults' |
    'nutritionalAssessment' | 'reproductiveAssessment' | 'recommendations' |
    'attachments' | 'photos' | 'xrays' | 'videos' | 'notes' | 'privateNotes' |
    'cost' | 'currency' | 'followUpDate' | 'followUpNotes' | 'weatherConditions' |
    'environmentalFactors' | 'updatedBy' | 'deletedAt'
  > { }

// Clase del modelo Health
class Health extends Model<HealthAttributes, HealthCreationAttributes>
  implements HealthAttributes {
  public id!: string;
  public bovineId!: string;
  public eventId?: string;
  public diseaseId?: string;
  public recordType!: HealthRecordType;
  public recordDate!: Date;
  public veterinarianId?: string;
  public veterinarianName?: string;
  public veterinarianLicense?: string;
  public technicianId?: string;
  public location?: LocationData;
  public chiefComplaint?: string;
  public historyPresent?: string;
  public historyPast?: string;
  public vitalSigns?: VitalSigns;
  public physicalExam?: PhysicalExamination;
  public symptoms?: Symptoms;
  public diagnosis!: Diagnosis;
  public treatment?: Treatment;
  public laboratoryResults?: LaboratoryResults[];
  public nutritionalAssessment?: NutritionalAssessment;
  public reproductiveAssessment?: ReproductiveAssessment;
  public overallHealthStatus!: HealthStatus;
  public recommendations?: string[];
  public attachments?: string[];
  public photos?: string[];
  public xrays?: string[];
  public videos?: string[];
  public notes?: string;
  public privateNotes?: string;
  public cost?: number;
  public currency?: string;
  public followUpRequired!: boolean;
  public followUpDate?: Date;
  public followUpNotes?: string;
  public isEmergency!: boolean;
  public isCompleted!: boolean;
  public isActive!: boolean;
  public weatherConditions?: string;
  public environmentalFactors?: string[];
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;

}

// Definición del modelo en Sequelize
Health.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del registro de salud'
    },
    bovineId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'bovines',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'ID del bovino relacionado'
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'events', key: 'id' },
      comment: 'ID del evento que generó este registro (opcional)'
    },
    diseaseId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'diseases', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'FK opcional al catálogo canónico de enfermedades'
    },
    recordType: {
      type: DataTypes.ENUM(...Object.values(HealthRecordType)),
      allowNull: false,
    },
    recordDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha y hora del registro'
    },
    veterinarianId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del veterinario responsable'
    },
    veterinarianName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    veterinarianLicense: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    technicianId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del técnico que asistió'
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Ubicación geográfica del examen'
    },
    chiefComplaint: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Queja principal o motivo de consulta'
    },
    historyPresent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Historia de la enfermedad actual'
    },
    historyPast: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Historia médica pasada'
    },
    vitalSigns: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Signos vitales registrados'
    },
    physicalExam: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Hallazgos del examen físico'
    },
    symptoms: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Síntomas observados'
    },
    diagnosis: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Diagnósticos realizados'
    },
    treatment: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Tratamientos prescritos y realizados'
    },
    laboratoryResults: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Resultados de exámenes de laboratorio'
    },
    nutritionalAssessment: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Evaluación nutricional'
    },
    reproductiveAssessment: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Evaluación reproductiva'
    },
    overallHealthStatus: {
      type: DataTypes.ENUM(...Object.values(HealthStatus)),
      allowNull: false,
      defaultValue: HealthStatus.UNKNOWN,
    },
    recommendations: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: true,
      defaultValue: [],
      comment: 'Recomendaciones médicas'
    },
    attachments: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de archivos adjuntos'
    },
    photos: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de fotos del examen'
    },
    xrays: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de radiografías'
    },
    videos: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de videos del examen'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales del examen'
    },
    privateNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas privadas del veterinario'
    },
    cost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: {
        min: 0
      },
      comment: 'Costo del examen/tratamiento'
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      defaultValue: 'MXN',
      comment: 'Moneda del costo'
    },
    followUpRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si requiere seguimiento'
    },
    followUpDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha programada para seguimiento'
    },
    followUpNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas de seguimiento'
    },
    isEmergency: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si fue una emergencia'
    },
    isCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si el registro está completo'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el registro está activo'
    },
    weatherConditions: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Condiciones climáticas durante el examen'
    },
    environmentalFactors: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'Factores ambientales relevantes'
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
    },
  },
  {
    sequelize,
    modelName: 'Health',
    tableName: 'health_records',
    timestamps: true,
    paranoid: true, // Habilita soft delete
    indexes: [
      // Índices para optimizar consultas
      {
        fields: ['bovine_id']
      },
      { fields: ['event_id'] },
      {
        fields: ['record_type']
      },
      {
        fields: ['record_date']
      },
      {
        fields: ['overall_health_status']
      },
      {
        fields: ['veterinarian_id']
      },
      {
        fields: ['is_emergency']
      },
      {
        fields: ['is_completed']
      },
      {
        fields: ['follow_up_required']
      },
      {
        fields: ['follow_up_date']
      },
      {
        name: 'health_bovine_date',
        fields: ['bovine_id', 'record_date']
      },
      {
        name: 'health_status_date',
        fields: ['overall_health_status', 'record_date']
      },
      {
        name: 'health_emergency_date',
        fields: ['is_emergency', 'record_date']
      },
      {
        name: 'health_followup_date',
        fields: ['follow_up_required', 'follow_up_date']
      },
      {
        name: 'health_location_gin',
        fields: ['location'],
        using: 'gin',
        where: {
          location: {
            [Op.ne]: null
          }
        }
      },
      {
        name: 'health_diagnosis_gin',
        fields: ['diagnosis'],
        using: 'gin'
      }
    ],
    hooks: {
      beforeSave: async (health: Health) => {
        if (!health.diagnosis) {
          throw new BovineValidationError(
            'El registro de salud requiere un diagnóstico. Proporciona al menos { status, primaryDiagnosis }.'
          );
        }

        // Validar estructura mínima del objeto diagnosis
        if (!health.diagnosis.status) {
          throw new BovineValidationError(
            'El diagnóstico debe incluir el campo "status" (CONFIRMED | DIFFERENTIAL | RULED_OUT).'
          );
        }

        // Health siempre está completado
        health.isCompleted = true;

        // Validar coherencia de fechas de seguimiento
        if (health.followUpDate && health.followUpDate <= new Date(health.recordDate)) {
          throw new BovineValidationError(
            'La fecha de seguimiento debe ser posterior a la fecha del registro.'
          );
        }

        // Si requiere seguimiento, la fecha debe estar presente
        if (health.followUpRequired && !health.followUpDate) {
          throw new BovineValidationError(
            'Se marcó followUpRequired como true pero no se proporcionó followUpDate.'
          );
        }
      }
    },
    comment: 'Tabla para almacenar registros completos de salud y exámenes médicos de bovinos'
  }
);

export default Health;