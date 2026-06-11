// models/CaseSymptom.ts
// ============================================================================
// CASE SYMPTOM MODEL
// ============================================================================
// Síntomas observados en un caso clínico específico.
// Diferente a DiseaseSymptom (catálogo esperado): aquí se registra lo que
// el veterinario/ganadero observó realmente durante este caso.
//
// Relaciones:
//   N:1  BovineDiseaseCase
//   N:1  Symptom (catálogo)
//
// UNIQUE(caseId, symptomId) — un síntoma no se repite en el mismo caso.
// paranoid: false — sin soft delete
// underscored: true
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// ============================================================================
// ENUMs
// ============================================================================

export enum SymptomIntensity {
  MILD     = 'MILD',
  MODERATE = 'MODERATE',
  SEVERE   = 'SEVERE',
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface CaseSymptomAttributes {
  id: string;
  caseId: string;
  symptomId: string;
  intensity: SymptomIntensity;
  observedAt: Date;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CaseSymptomCreationAttributes
  extends Optional<
    CaseSymptomAttributes,
    'id' | 'intensity' | 'observedAt' | 'notes' | 'createdAt' | 'updatedAt'
  > {}

// ============================================================================
// CLASE DEL MODELO
// ============================================================================

class CaseSymptom
  extends Model<CaseSymptomAttributes, CaseSymptomCreationAttributes>
  implements CaseSymptomAttributes
{
  public id!: string;
  public caseId!: string;
  public symptomId!: string;
  public intensity!: SymptomIntensity;
  public observedAt!: Date;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// ============================================================================
// INIT
// ============================================================================

CaseSymptom.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del síntoma observado',
    },
    caseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'bovine_disease_cases', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'FK al caso clínico',
    },
    symptomId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'symptoms', key: 'id' },
      onDelete: 'RESTRICT',
      comment: 'FK al síntoma del catálogo',
    },
    intensity: {
      type: DataTypes.ENUM(...Object.values(SymptomIntensity)),
      allowNull: false,
      defaultValue: SymptomIntensity.MODERATE,
      //comment: 'Intensidad del síntoma observado',
    },
    observedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha y hora de la observación',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Observaciones sobre este síntoma en particular',
    },
  },
  {
    sequelize,
    tableName: 'case_symptoms',
    paranoid: false,
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['case_id', 'symptom_id'],
        name: 'case_symptoms_unique_pair',
      },
      { fields: ['case_id'] },
      { fields: ['symptom_id'] },
    ],
    comment: 'Síntomas observados en un caso clínico bovino',
  }
);

export default CaseSymptom;
