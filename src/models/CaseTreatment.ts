// models/CaseTreatment.ts
// ============================================================================
// CASE TREATMENT MODEL
// ============================================================================
// Registro de cada tratamiento (fármaco o procedimiento) aplicado en un caso.
// Puede haber múltiples tratamientos por caso (antibiótico + antiinflamatorio,
// por ejemplo).
//
// withdrawalPeriodDays: días de retiro para inocuidad alimentaria.
//
// paranoid: false — sin soft delete
// underscored: true
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { ApplicationRoute } from './Vaccination';

// ============================================================================
// INTERFACES
// ============================================================================

export interface CaseTreatmentAttributes {
  id: string;
  caseId: string;
  treatmentName: string;
  dosage?: string;
  applicationRoute?: ApplicationRoute;
  administeredAt: Date;
  administeredBy?: string;
  durationDays?: number;
  withdrawalPeriodDays?: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CaseTreatmentCreationAttributes
  extends Optional<
    CaseTreatmentAttributes,
    | 'id'
    | 'dosage'
    | 'applicationRoute'
    | 'administeredBy'
    | 'durationDays'
    | 'withdrawalPeriodDays'
    | 'notes'
    | 'createdAt'
    | 'updatedAt'
  > {}

// ============================================================================
// CLASE DEL MODELO
// ============================================================================

class CaseTreatment
  extends Model<CaseTreatmentAttributes, CaseTreatmentCreationAttributes>
  implements CaseTreatmentAttributes
{
  public id!: string;
  public caseId!: string;
  public treatmentName!: string;
  public dosage?: string;
  public applicationRoute?: ApplicationRoute;
  public administeredAt!: Date;
  public administeredBy?: string;
  public durationDays?: number;
  public withdrawalPeriodDays?: number;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// ============================================================================
// INIT
// ============================================================================

CaseTreatment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del tratamiento',
    },
    caseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'bovine_disease_cases', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'FK al caso clínico',
    },
    treatmentName: {
      type: DataTypes.STRING(300),
      allowNull: false,
      comment: 'Nombre del fármaco o procedimiento aplicado',
    },
    dosage: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Dosis aplicada (ej: "10 mg/kg", "5 mL IM")',
    },
    applicationRoute: {
      type: DataTypes.ENUM(...Object.values(ApplicationRoute)),
      allowNull: true,
      //comment: 'Vía de administración',
    },
    administeredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha y hora de administración',
    },
    administeredBy: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Nombre del veterinario o responsable',
    },
    durationDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Duración del tratamiento en días',
    },
    withdrawalPeriodDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Días de retiro para inocuidad alimentaria (leche / carne)',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas sobre este tratamiento',
    },
  },
  {
    sequelize,
    tableName: 'case_treatments',
    paranoid: false,
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['case_id'] },
      { fields: ['administered_at'] },
    ],
    comment: 'Tratamientos aplicados en casos clínicos bovinos',
  }
);

export default CaseTreatment;
