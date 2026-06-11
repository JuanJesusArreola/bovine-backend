// models/BovineDiseaseCase.ts
// ============================================================================
// BOVINE DISEASE CASE MODEL — TABLA OPERACIONAL CENTRAL (Fase 2)
// ============================================================================
// Un registro por evento de enfermedad activo en un bovino.
// Ciclo de vida: SUSPECTED → CONFIRMED → RECOVERING → RECOVERED | DECEASED
//
// Relaciones:
//   N:1  Bovine         (el animal afectado)
//   N:1  Disease        (enfermedad del catálogo)
//   N:1  Ranch          (rancho donde ocurre el caso)
//   N:1  User           (quién abrió el caso)
//   1:N  CaseSymptom    (síntomas observados)
//   1:N  CaseTreatment  (tratamientos aplicados)
//   1:N  LabTest        (pruebas de laboratorio)
//
// paranoid: true  — soft delete vía deletedAt
// underscored: true — columnas en snake_case
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// ============================================================================
// ENUMs
// ============================================================================

export enum CaseStatus {
  SUSPECTED  = 'SUSPECTED',   // Sospecha clínica
  CONFIRMED  = 'CONFIRMED',   // Diagnóstico confirmado
  RECOVERING = 'RECOVERING',  // En tratamiento / recuperación activa
  RECOVERED  = 'RECOVERED',   // Caso cerrado — curación
  DECEASED   = 'DECEASED',    // Caso cerrado — muerte del animal
  DISCARDED  = 'DISCARDED',   // Caso cerrado — diagnóstico descartado
}

export enum CaseOutcome {
  RECOVERED   = 'RECOVERED',
  DECEASED    = 'DECEASED',
  TRANSFERRED = 'TRANSFERRED',
  UNKNOWN     = 'UNKNOWN',
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface BovineDiseaseCase_Attributes {
  id: string;
  bovineId: string;
  diseaseId: string;
  ranchId: string;
  createdBy?: string;

  status: CaseStatus;
  severity: string;            // LOW | MODERATE | HIGH | CRITICAL (hereda de Disease)
  diagnosedAt: Date;
  resolvedAt?: Date;
  diagnosedBy?: string;        // Nombre del veterinario (texto libre)
  outcome?: CaseOutcome;

  quarantineStartDate?: Date;
  quarantineEndDate?: Date;
  estimatedQuarantineEndDate?: Date;

  notes?: string;

  // Fuente de infección
  sourceId?: string;          // FK → disease_sources (nullable)
  suspectedSource?: string;   // Texto libre cuando la fuente no está en el catálogo

  // Fallo vacunal (breakthrough): el bovino tenía protección vacunal activa
  // contra esta enfermedad al momento del diagnóstico.
  isBreakthrough?: boolean;

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface BovineDiseaseCase_CreationAttributes
  extends Optional<
    BovineDiseaseCase_Attributes,
    | 'id'
    | 'createdBy'
    | 'resolvedAt'
    | 'diagnosedBy'
    | 'outcome'
    | 'quarantineStartDate'
    | 'quarantineEndDate'
    | 'estimatedQuarantineEndDate'
    | 'notes'
    | 'sourceId'
    | 'suspectedSource'
    | 'isBreakthrough'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'
  > {}

// ============================================================================
// CLASE DEL MODELO
// ============================================================================

class BovineDiseaseCase
  extends Model<BovineDiseaseCase_Attributes, BovineDiseaseCase_CreationAttributes>
  implements BovineDiseaseCase_Attributes
{
  public id!: string;
  public bovineId!: string;
  public diseaseId!: string;
  public ranchId!: string;
  public createdBy?: string;

  public status!: CaseStatus;
  public severity!: string;
  public diagnosedAt!: Date;
  public resolvedAt?: Date;
  public diagnosedBy?: string;
  public outcome?: CaseOutcome;

  public quarantineStartDate?: Date;
  public quarantineEndDate?: Date;
  public estimatedQuarantineEndDate?: Date;

  public notes?: string;

  public sourceId?: string;
  public suspectedSource?: string;

  public isBreakthrough?: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;

  /** true si el caso sigue abierto (no cerrado) */
  get isOpen(): boolean {
    return ![CaseStatus.RECOVERED, CaseStatus.DECEASED, CaseStatus.DISCARDED].includes(this.status);
  }
}

// ============================================================================
// INIT
// ============================================================================

BovineDiseaseCase.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del caso clínico',
    },
    bovineId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'bovines', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'FK al bovino afectado',
    },
    diseaseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'diseases', key: 'id' },
      onDelete: 'RESTRICT',
      comment: 'FK a la enfermedad del catálogo',
    },
    ranchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'ranches', key: 'id' },
      onDelete: 'RESTRICT',
      comment: 'FK al rancho donde ocurre el caso',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'FK al usuario que abrió el caso',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(CaseStatus)),
      allowNull: false,
      defaultValue: CaseStatus.SUSPECTED,
      //comment: 'Estado actual del caso clínico',
    },
    severity: {
      type: DataTypes.ENUM('LOW', 'MODERATE', 'HIGH', 'CRITICAL'),
      allowNull: false,
      //comment: 'Severidad del caso (puede diferir del default de la enfermedad)',
    },
    diagnosedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha y hora en que se abrió / diagnosticó el caso',
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de cierre del caso (null = abierto)',
    },
    diagnosedBy: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Nombre del veterinario o responsable del diagnóstico',
    },
    outcome: {
      type: DataTypes.ENUM(...Object.values(CaseOutcome)),
      allowNull: true,
      //comment: 'Resultado final del caso (se establece al cerrar)',
    },
    quarantineStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Inicio de cuarentena',
    },
    quarantineEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fin efectivo de cuarentena',
    },
    estimatedQuarantineEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fin estimado de cuarentena (calculado al abrir el caso)',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas clínicas adicionales',
    },
    sourceId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK al catálogo de fuentes de infección (nullable)',
    },
    suspectedSource: {
      type: DataTypes.STRING(300),
      allowNull: true,
      comment: 'Fuente sospechada en texto libre (fallback cuando no está en el catálogo)',
    },
    isBreakthrough: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'true = fallo vacunal: el bovino tenía protección activa al diagnosticarse',
    },
  },
  {
    sequelize,
    tableName: 'bovine_disease_cases',
    paranoid: true,
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['bovine_id'] },
      { fields: ['disease_id'] },
      { fields: ['ranch_id'] },
      { fields: ['status'] },
      { fields: ['diagnosed_at'] },
      { fields: ['bovine_id', 'status'] },
      { fields: ['ranch_id',  'status'] },
      { fields: ['source_id'] },
    ],
    comment: 'Tabla operacional de casos clínicos de enfermedades bovinas',
  }
);

export default BovineDiseaseCase;
