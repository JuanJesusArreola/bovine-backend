// src/models/ranch/RanchHR.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Ranch from './Ranch';

// Enums
export enum EmploymentType {
  PERMANENT = 'PERMANENT',
  TEMPORARY = 'TEMPORARY',
  SEASONAL = 'SEASONAL',
  CONTRACTOR = 'CONTRACTOR',
  INTERN = 'INTERN'
}

export enum SkillLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT'
}

export enum TrainingType {
  SAFETY = 'SAFETY',
  TECHNICAL = 'TECHNICAL',
  MANAGEMENT = 'MANAGEMENT',
  ANIMAL_WELFARE = 'ANIMAL_WELFARE',
  ENVIRONMENTAL = 'ENVIRONMENTAL',
  EQUIPMENT = 'EQUIPMENT',
  SOFTWARE = 'SOFTWARE',
  REGULATORY = 'REGULATORY'
}

// Interfaces
export interface SkillLevels {
  beginner: number;
  intermediate: number;
  advanced: number;
  expert: number;
}

export interface TrainingProgram {
  name: string;
  type: TrainingType;
  frequency: string;        // ej: "ANNUAL", "QUARTERLY", "MONTHLY"
  participants: number;
  lastSession: Date;
  nextSession?: Date;
  duration?: number;         // horas
  provider?: string;
  cost?: number;
  mandatory: boolean;
  completionRate?: number;   // porcentaje
}

export interface SafetyMetrics {
  accidentRate: number;      // accidentes por año
  trainingHours: number;      // horas de capacitación
  safetyEquipmentUsage: number; // porcentaje
  lastSafetyAudit: Date;
  incidentsReported: number;
  daysWithoutAccident: number;
  safetyScore: number;        // 0-100
}

export interface LaborCosts {
  averageWage: number;        // salario promedio
  benefits: number;           // costo de beneficios
  trainingCosts: number;      // costo de capacitación
  totalAnnualCost: number;    // costo anual total
  overtimeRate?: number;      // porcentaje de horas extra
  turnoverCost?: number;      // costo de rotación
}

export interface Position {
  title: string;
  filled: number;
  vacant: number;
  budgeted: number;
  averageTenure?: number;      // meses
}

// Atributos del modelo
export interface RanchHRAttributes {
  ranchId: string;                    // PK y FK (1:1)
  
  // Personal
  totalEmployees: number;
  permanentStaff: number;
  temporaryStaff: number;
  managementStaff: number;
  administrativeStaff?: number;
  operationalStaff?: number;
  
  // Estructura organizacional
  positions: Position[];               // Posiciones por tipo
  skillLevels: SkillLevels;            // Distribución de habilidades
  
  // Capacitación
  trainingPrograms: TrainingProgram[];
  
  // Seguridad
  safetyMetrics: SafetyMetrics;
  
  // Costos
  laborCosts: LaborCosts;
  
  // Métricas
  turnoverRate?: number;               // porcentaje anual
  satisfactionScore?: number;          // 0-100
  absenteeismRate?: number;            // porcentaje
  productivityScore?: number;          // 0-100
  
  // Cumplimiento
  lastLaborAudit?: Date;
  nextLaborAudit?: Date;
  hasUnion: boolean;
  unionName?: string;
  collectiveBargainingAgreement?: Date;
  
  // Contratación
  activeRecruitment: boolean;
  openPositions: number;
  averageHiringTime?: number;           // días
  
  // Notas
  notes?: string;
  

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface RanchHRCreationAttributes
  extends Optional<RanchHRAttributes,
    'administrativeStaff' | 'operationalStaff' | 'turnoverRate' |
    'satisfactionScore' | 'absenteeismRate' | 'productivityScore' |
    'lastLaborAudit' | 'nextLaborAudit' | 'unionName' |
    'collectiveBargainingAgreement' | 'averageHiringTime' | 'notes' |
    'deletedAt'
  > {}

class RanchHR extends Model<RanchHRAttributes, RanchHRCreationAttributes>
  implements RanchHRAttributes {
  
  public ranchId!: string;
  
  public totalEmployees!: number;
  public permanentStaff!: number;
  public temporaryStaff!: number;
  public managementStaff!: number;
  public administrativeStaff?: number;
  public operationalStaff?: number;
  
  public positions!: Position[];
  public skillLevels!: SkillLevels;
  
  public trainingPrograms!: TrainingProgram[];
  
  public safetyMetrics!: SafetyMetrics;
  
  public laborCosts!: LaborCosts;
  
  public turnoverRate?: number;
  public satisfactionScore?: number;
  public absenteeismRate?: number;
  public productivityScore?: number;
  
  public lastLaborAudit?: Date;
  public nextLaborAudit?: Date;
  public hasUnion!: boolean;
  public unionName?: string;
  public collectiveBargainingAgreement?: Date;
  
  public activeRecruitment!: boolean;
  public openPositions!: number;
  public averageHiringTime?: number;
  
  public notes?: string;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

RanchHR.init(
  {
    ranchId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      references: { model: 'ranches', key: 'id' },
      comment: 'ID del rancho (PK y FK 1:1)'
    },
    totalEmployees: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
      comment: 'Total de empleados'
    },
    permanentStaff: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
      comment: 'Personal permanente'
    },
    temporaryStaff: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
      comment: 'Personal temporal'
    },
    managementStaff: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
      comment: 'Personal gerencial'
    },
    administrativeStaff: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
      comment: 'Personal administrativo'
    },
    operationalStaff: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
      comment: 'Personal operativo'
    },
    positions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidPositions(value: Position[]) {
          value.forEach((pos, index) => {
            if (!pos.title) {
              throw new Error(`Posición ${index} sin título`);
            }
            if (pos.filled + pos.vacant > pos.budgeted) {
              throw new Error(`Posición ${index}: personal excede presupuesto`);
            }
          });
        }
      },
      comment: 'Posiciones por tipo'
    },
    skillLevels: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidSkillLevels(value: SkillLevels) {
          const total = value.beginner + value.intermediate + 
                        value.advanced + value.expert;
          if (total !== (this as any).totalEmployees) {
            throw new Error('La suma de niveles de habilidad debe igualar total de empleados');
          }
        }
      },
      comment: 'Distribución de niveles de habilidad'
    },
    trainingPrograms: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Programas de capacitación'
    },
    safetyMetrics: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidSafety(value: SafetyMetrics) {
          if (value.safetyScore < 0 || value.safetyScore > 100) {
            throw new Error('El puntaje de seguridad debe estar entre 0 y 100');
          }
          if (value.safetyEquipmentUsage < 0 || value.safetyEquipmentUsage > 100) {
            throw new Error('El uso de equipo de seguridad debe estar entre 0 y 100');
          }
        }
      },
      comment: 'Métricas de seguridad'
    },
    laborCosts: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Costos laborales'
    },
    turnoverRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: { min: 0, max: 100 },
      comment: 'Tasa de rotación anual (%)'
    },
    satisfactionScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: { min: 0, max: 100 },
      comment: 'Puntuación de satisfacción (0-100)'
    },
    absenteeismRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: { min: 0, max: 100 },
      comment: 'Tasa de ausentismo (%)'
    },
    productivityScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: { min: 0, max: 100 },
      comment: 'Puntuación de productividad (0-100)'
    },
    lastLaborAudit: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Última auditoría laboral'
    },
    nextLaborAudit: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Próxima auditoría laboral'
    },
    hasUnion: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Tiene sindicato'
    },
    unionName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Nombre del sindicato'
    },
    collectiveBargainingAgreement: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de contrato colectivo'
    },
    activeRecruitment: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Reclutamiento activo'
    },
    openPositions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
      comment: 'Posiciones vacantes'
    },
    averageHiringTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
      comment: 'Tiempo promedio de contratación (días)'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'RanchHR',
    tableName: 'ranch_hr',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['total_employees'] },
      { fields: ['turnover_rate'] },
      { fields: ['satisfaction_score'] },
      { fields: ['has_union'] },
      { fields: ['last_labor_audit', 'next_labor_audit'] }
    ],
    hooks: {
      beforeSave: async (hr: RanchHR) => {
        // Validar suma de personal
        const total = hr.permanentStaff + hr.temporaryStaff;
        if (total !== hr.totalEmployees) {
          throw new Error('La suma de personal permanente y temporal debe igualar total de empleados');
        }
        
        // Validar fechas de auditoría
        if (hr.lastLaborAudit && hr.nextLaborAudit) {
          if (hr.nextLaborAudit <= hr.lastLaborAudit) {
            throw new Error('La próxima auditoría debe ser posterior a la última');
          }
        }
        
        // Calcular tasa de rotación si es posible
        // Nota: esto requeriría datos históricos, se calcula en servicio
      }
    },
    comment: 'Información de recursos humanos del rancho'
  }
);

export default RanchHR;