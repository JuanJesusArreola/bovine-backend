// models/LabTest.ts
// ============================================================================
// LAB TEST MODEL
// ============================================================================
// Pruebas de laboratorio solicitadas y resultadas en un caso clínico.
// Un caso puede tener múltiples pruebas (hemograma, cultivo, PCR, etc.).
//
// Ciclo de vida: PENDING → POSITIVE | NEGATIVE | INCONCLUSIVE
//
// paranoid: false — sin soft delete
// underscored: true
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// ============================================================================
// ENUMs
// ============================================================================

export enum LabTestStatus {
  PENDING       = 'PENDING',
  POSITIVE      = 'POSITIVE',
  NEGATIVE      = 'NEGATIVE',
  INCONCLUSIVE  = 'INCONCLUSIVE',
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface LabTestAttributes {
  id: string;
  caseId: string;
  testName: string;
  requestedAt: Date;
  resultAt?: Date;
  resultStatus: LabTestStatus;
  resultDetail?: string;
  labName?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LabTestCreationAttributes
  extends Optional<
    LabTestAttributes,
    | 'id'
    | 'requestedAt'
    | 'resultAt'
    | 'resultDetail'
    | 'labName'
    | 'notes'
    | 'createdAt'
    | 'updatedAt'
  > {}

// ============================================================================
// CLASE DEL MODELO
// ============================================================================

class LabTest
  extends Model<LabTestAttributes, LabTestCreationAttributes>
  implements LabTestAttributes
{
  public id!: string;
  public caseId!: string;
  public testName!: string;
  public requestedAt!: Date;
  public resultAt?: Date;
  public resultStatus!: LabTestStatus;
  public resultDetail?: string;
  public labName?: string;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// ============================================================================
// INIT
// ============================================================================

LabTest.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único de la prueba de laboratorio',
    },
    caseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'bovine_disease_cases', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'FK al caso clínico',
    },
    testName: {
      type: DataTypes.STRING(300),
      allowNull: false,
      comment: 'Nombre de la prueba (ej: "Rosa de Bengala", "PCR Brucelosis")',
    },
    requestedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de solicitud de la prueba',
    },
    resultAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de recepción del resultado',
    },
    resultStatus: {
      type: DataTypes.ENUM(...Object.values(LabTestStatus)),
      allowNull: false,
      defaultValue: LabTestStatus.PENDING,
      //comment: 'Estado / resultado de la prueba',
    },
    resultDetail: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Detalle del resultado en texto libre',
    },
    labName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Nombre del laboratorio que realizó la prueba',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales sobre la prueba',
    },
  },
  {
    sequelize,
    tableName: 'lab_tests',
    paranoid: false,
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['case_id'] },
      { fields: ['result_status'] },
      { fields: ['requested_at'] },
    ],
    comment: 'Pruebas de laboratorio en casos clínicos bovinos',
  }
);

export default LabTest;
