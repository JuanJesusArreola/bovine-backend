// PROPÓSITO: Eventos PROGRAMADOS para bovinos (AGENDA)
import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { LocationData, HealthStatus } from './Bovine';

// =============================================
// ENUMS PARA EVENTOS PROGRAMADOS
// =============================================

export enum EventType {
  // Salud (programados)
  VACCINATION = 'VACCINATION',           // Vacunación programada
  HEALTH_CHECK = 'HEALTH_CHECK',         // Chequeo programado
  TREATMENT = 'TREATMENT',               // Tratamiento programado
  MEDICATION = 'MEDICATION',             // Medicación programada
  SURGERY = 'SURGERY',                   // Cirugía programada
  
  // Reproducción (programados)
  REPRODUCTION = 'REPRODUCTION',         // Servicio programado
  PREGNANCY_CHECK = 'PREGNANCY_CHECK',   // Chequeo de gestación programado
  BIRTH = 'BIRTH',                       // Parto esperado
  WEANING = 'WEANING',                    // Destete programado
  
  // Producción (programados)
  WEIGHING = 'WEIGHING',                  // Pesaje programado
  
  // Movimiento (programados)
  MOVEMENT = 'MOVEMENT',                  // Movimiento programado
  QUARANTINE = 'QUARANTINE',              // Cuarentena programada

  // Hitos del ciclo de vida (registrados, no programados)
  DEATH = 'DEATH',                        // Muerte / baja por fallecimiento (Módulo 8)

  // Generales
  OTHER = 'OTHER'
}

export enum EventStatus {
  SCHEDULED = 'SCHEDULED',      // Programado (futuro)
  IN_PROGRESS = 'IN_PROGRESS',  // En progreso (ahora)
  COMPLETED = 'COMPLETED',      // Completado (cuando se crea Health)
  CANCELLED = 'CANCELLED',      // Cancelado
  POSTPONED = 'POSTPONED'       // Pospuesto
}

export enum EventPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
  EMERGENCY = 'EMERGENCY'
}

export enum RecurrenceType {
  NONE = 'NONE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM'
}

// =============================================
// INTERFACES PARA PLANIFICACIÓN (NO resultados)
// =============================================

// Datos esperados para vacunación (NO resultados)
export interface ExpectedVaccinationData {
  vaccineType: string;
  vaccineName: string;
  manufacturer?: string;
  batchNumber?: string;        // Número de lote esperado
  expirationDate?: Date;       // Fecha de vencimiento esperada
  dosage: number;
  dosageUnit: string;
  applicationMethod: 'SUBCUTANEOUS' | 'INTRAMUSCULAR' | 'ORAL' | 'NASAL' | 'OTHER';
  applicationSite?: string;
  nextDueDate?: Date;          // Próxima fecha programada
}

// Datos esperados para tratamiento
export interface ExpectedTreatmentData {
  treatmentType: 'MEDICATION' | 'SURGERY' | 'THERAPY' | 'ISOLATION' | 'OTHER';
  medicationName?: string;
  activeIngredient?: string;
  dosage?: number;
  dosageUnit?: string;
  frequency?: string;
  duration?: number;
  administrationRoute?: 'ORAL' | 'INJECTABLE' | 'TOPICAL' | 'INTRAVENOUS' | 'OTHER';
  withdrawalPeriod?: number;
}

// Datos esperados para chequeo de salud
export interface ExpectedHealthCheckData {
  checkType: 'ROUTINE' | 'FOLLOW_UP' | 'EMERGENCY' | 'PRE_BREEDING' | 'POST_TREATMENT';
}

// Datos esperados para reproducción
export interface ExpectedReproductionData {
  reproductionType: 'NATURAL_BREEDING' | 'ARTIFICIAL_INSEMINATION' | 'EMBRYO_TRANSFER' | 'PREGNANCY_CHECK' | 'BIRTH' | 'WEANING';
  maleId?: string;
  semenSource?: string;
  semenBatch?: string;
  inseminationMethod?: 'CERVICAL' | 'INTRAUTERINE' | 'DEEP_UTERINE';
  expectedCalvingDate?: Date;
}

// Datos esperados para movimiento
export interface ExpectedMovementData {
  movementType: 'PASTURE_CHANGE' | 'FACILITY_TRANSFER' | 'TRANSPORT' | 'EXERCISE' | 'GRAZING';
  fromLocation?: LocationData;
  toLocation?: LocationData;
  transportMethod?: 'WALKING' | 'TRUCK' | 'TRAILER' | 'OTHER';
  reasonForMovement?: string;
}

export interface ScheduledHealthCheckData {
    type: 'SCHEDULED_HEALTH_CHECK';
    healthStatus: HealthStatus;
    interval: number;
    automatic: boolean;
    previousHealthRecordId?: string;
}

// Union type para datos esperados
export type ExpectedEventData = 
  | ExpectedVaccinationData 
  | ExpectedTreatmentData 
  | ExpectedHealthCheckData 
  | ExpectedReproductionData 
  | ExpectedMovementData
  | ScheduledHealthCheckData;

// Configuración de recurrencia
export interface RecurrenceConfig {
  type: RecurrenceType;
  interval?: number;
  endDate?: Date;
  maxOccurrences?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  monthsOfYear?: number[];
}

// Configuración de notificaciones
export interface NotificationConfig {
  enabled: boolean;
  advanceNotice?: number;      // Días antes de notificar
  reminderFrequency?: 'ONCE' | 'DAILY' | 'WEEKLY';
  notificationMethods: ('EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP')[];
  recipients: string[];
}

// =============================================
// ATRIBUTOS DEL MODELO EVENT (SOLO PROGRAMACIÓN)
// =============================================

export interface EventAttributes {
  id: string;
  bovineId: string;
  
  // Relación con Health (cuando se complete)
  healthRecordId?: string;  // Se llena al completarse
  
  // Datos básicos
  eventType: EventType;
  title: string;
  description?: string;
  
  // Estado
  status: EventStatus;
  priority: EventPriority;
  
  // Fechas
  scheduledDate: Date;      // Cuándo debería ocurrir
  startDate?: Date;         // Cuándo empezó realmente (solo para tracking)
  endDate?: Date;           // Cuándo terminó (solo para tracking)
  
  // Ubicación esperada
  expectedLocation?: LocationData;
  
  // Responsables
  assignedTo?: string;      // ID del usuario asignado
  veterinarianId?: string;  // ID del veterinario (si aplica)
  
  // Costo estimado
  estimatedCost?: number;
  currency?: string;
  
  // Datos esperados (lo que se planea hacer)
  expectedData?: ExpectedEventData;
  
  // Recurrencia
  recurrence?: RecurrenceConfig;
  parentEventId?: string;   // Para eventos recurrentes
  
  // Notificaciones
  notifications?: NotificationConfig;
  
  // Documentos (protocolos, instrucciones, etc.)
  attachments?: string[];
  
  // Notas de planificación
  planningNotes?: string;
  internalNotes?: string;
  
  // Requerimientos
  requiresVeterinarian: boolean;
  requiresEquipment?: string[];
  requiresFacility?: string;
  
  // Recordatorios
  reminderSent: boolean;
  reminderDate?: Date;
  
  // Metadata
  isActive: boolean;
  metadata?: any;
  
  // Auditoría
  createdBy: string;
  updatedBy?: string;
  deletedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

// Atributos opcionales al crear
export interface EventCreationAttributes
  extends Optional<EventAttributes,
    'id' | 'healthRecordId' | 'description' | 'startDate' | 'endDate' |
    'expectedLocation' | 'assignedTo' | 'veterinarianId' | 'estimatedCost' |
    'currency' | 'expectedData' | 'recurrence' | 'parentEventId' |
    'notifications' | 'attachments' | 'planningNotes' | 'internalNotes' |
    'requiresEquipment' | 'requiresFacility' | 'reminderSent' | 'reminderDate' |
    'updatedBy' | 'deletedAt' | 'metadata'
  > {}

// Clase del modelo Event (ANÉMICA - sin métodos de negocio)
class Event extends Model<EventAttributes, EventCreationAttributes>
  implements EventAttributes {
  
  public id!: string;
  public bovineId!: string;
  public healthRecordId?: string;
  public eventType!: EventType;
  public title!: string;
  public description?: string;
  public status!: EventStatus;
  public priority!: EventPriority;
  public scheduledDate!: Date;
  public startDate?: Date;
  public endDate?: Date;
  public expectedLocation?: LocationData;
  public assignedTo?: string;
  public veterinarianId?: string;
  public estimatedCost?: number;
  public currency?: string;
  public expectedData?: ExpectedEventData;
  public recurrence?: RecurrenceConfig;
  public parentEventId?: string;
  public notifications?: NotificationConfig;
  public attachments?: string[];
  public planningNotes?: string;
  public internalNotes?: string;
  public requiresVeterinarian!: boolean;
  public requiresEquipment?: string[];
  public requiresFacility?: string;
  public reminderSent!: boolean;
  public reminderDate?: Date;
  public isActive!: boolean;
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
   public metadata?: any;

  // ❌ NO MÉTODOS DE NEGOCIO AQUÍ
  // Todos van en servicios
}

// Definición del modelo en Sequelize
Event.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del evento programado'
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
      comment: 'ID del bovino relacionado con el evento'
    },
    healthRecordId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'health_records',
        key: 'id'
      },
      comment: 'ID del registro de salud cuando se completa el evento'
    },
    eventType: {
      type: DataTypes.ENUM(...Object.values(EventType)),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 200]
      },
      comment: 'Título descriptivo del evento'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción detallada del evento'
    },
    status: {
      type: DataTypes.ENUM(...Object.values(EventStatus)),
      allowNull: false,
      defaultValue: EventStatus.SCHEDULED,
    },
    priority: {
      type: DataTypes.ENUM(...Object.values(EventPriority)),
      allowNull: false,
      defaultValue: EventPriority.MEDIUM,
    },
    scheduledDate: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isFuture(this: any, value: Date) {
          // Para eventos ya completados o cancelados se permite fecha pasada/presente
          const status = this.status;
          if (status === EventStatus.COMPLETED || status === EventStatus.CANCELLED) {
            return;
          }
          if (value < new Date()) {
            throw new Error('La fecha programada debe ser futura');
          }
        }
      },
      comment: 'Fecha y hora programada del evento'
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora de inicio real del evento (solo para seguimiento)'
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora de finalización del evento (solo para seguimiento)'
    },
    expectedLocation: {
      type: DataTypes.JSONB,
      allowNull: true,
      validate: {
        isValidLocation(value: LocationData) {
          if (value && (!value.latitude || !value.longitude)) {
            throw new Error('La ubicación debe tener latitud y longitud');
          }
        }
      },
      comment: 'Ubicación geográfica esperada para el evento'
    },
    assignedTo: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario asignado al evento'
    },
    veterinarianId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del veterinario responsable (si aplica)'
    },
    estimatedCost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: {
        min: 0
      },
      comment: 'Costo estimado del evento'
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      defaultValue: 'MXN',
      validate: {
        len: [3, 3]
      },
      comment: 'Moneda del costo estimado (código ISO)'
    },
    expectedData: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Datos específicos esperados según el tipo de evento'
    },
    recurrence: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configuración de recurrencia del evento'
    },
    parentEventId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'events',
        key: 'id'
      },
      comment: 'ID del evento padre (para eventos recurrentes)'
    },
    notifications: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configuración de notificaciones'
    },
    attachments: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de archivos adjuntos (protocolos, instrucciones)'
    },
    planningNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas de planificación del evento'
    },
    internalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas internas para el equipo'
    },
    requiresVeterinarian: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si el evento requiere presencia de veterinario'
    },
    requiresEquipment: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: 'Equipamiento necesario para el evento'
    },
    requiresFacility: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Instalación necesaria para el evento'
    },
    reminderSent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si ya se envió recordatorio'
    },
    reminderDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha programada para enviar recordatorio'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el evento está activo'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que creó el evento'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que actualizó el evento'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de eliminación (soft delete)'
    },
    metadata: {
      type: DataTypes.JSONB,  // ← Campo JSONB para datos adicionales
      allowNull: true,
      defaultValue: {}
    }
  },
  {
    sequelize,
    modelName: 'Event',
    tableName: 'events',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['bovine_id'] },
      { fields: ['event_type'] },
      { fields: ['status'] },
      { fields: ['priority'] },
      { fields: ['scheduled_date'] },
      { fields: ['assigned_to'] },
      { fields: ['veterinarian_id'] },
      { fields: ['health_record_id'] },
      { fields: ['parent_event_id'] },
      { fields: ['reminder_date'] },
      { name: 'events_scheduled_status', fields: ['scheduled_date', 'status'] },
      { name: 'events_bovine_type', fields: ['bovine_id', 'event_type'] },
      { name: 'events_location_gin', fields: ['expected_location'], using: 'gin' }
    ],
    hooks: {
      // Hook para actualizar fechas según estado (solo tracking, no resultados)
      beforeUpdate: async (event: Event) => {
        if (event.changed('status')) {
          if (event.status === EventStatus.IN_PROGRESS && !event.startDate) {
            event.startDate = new Date();
          }
          if (event.status === EventStatus.COMPLETED && !event.endDate) {
            event.endDate = new Date();
          }
        }
      },

      // Hook para validaciones de integridad
      beforeSave: async (event: Event) => {
        // Si se completa, debe tener healthRecordId
        if (event.status === EventStatus.COMPLETED && !event.healthRecordId) {
          throw new Error('Los eventos completados deben referenciar un registro de salud');
        }

        // Validar fechas
        if (event.startDate && event.endDate) {
          if (event.startDate > event.endDate) {
            throw new Error('La fecha de inicio no puede ser posterior a la fecha de fin');
          }
        }

        // Validar que scheduledDate sea futura (solo para SCHEDULED)
        if (event.status === EventStatus.SCHEDULED && event.scheduledDate < new Date()) {
          throw new Error('Los eventos programados deben tener fecha futura');
        }
      }
    },
    comment: 'Eventos programados para bovinos (agenda) - No almacena resultados, solo planificación'
  }
);

export default Event;