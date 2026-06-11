// models/DiseaseSymptom.ts
// ============================================================================
// DISEASE SYMPTOM MODEL (Pivote M:N)
// ============================================================================
// Relaciona enfermedades con sus síntomas clínicos esperados.
// Cada fila indica qué tan frecuente/relevante es un síntoma para una
// enfermedad determinada.
//
// relevance: nivel de asociación clínica
//   PATHOGNOMONIC — síntoma exclusivo/diagnóstico de esta enfermedad
//   COMMON        — aparece en la mayoría de los casos
//   OCCASIONAL    — aparece solo en algunos casos
//   RARE          — infrecuente pero documentado
//
// isCommon: shortcut booleano para filtrar síntomas principales
//   true  → PATHOGNOMONIC o COMMON
//   false → OCCASIONAL o RARE
//
// Unique constraint en (disease_id, symptom_id) — no duplicados.
// paranoid: false — pivote sin soft delete
// underscored: true — columnas en snake_case en la BD
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// ============================================================================
// ENUMs
// ============================================================================

export enum SymptomRelevance {
  PATHOGNOMONIC = 'PATHOGNOMONIC',
  COMMON        = 'COMMON',
  OCCASIONAL    = 'OCCASIONAL',
  RARE          = 'RARE',
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface DiseaseSymptomAttributes {
  id: string;
  diseaseId: string;
  symptomId: string;
  relevance: SymptomRelevance;
  isCommon: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DiseaseSymptomCreationAttributes
  extends Optional<
    DiseaseSymptomAttributes,
    'id' | 'isCommon' | 'createdAt' | 'updatedAt'
  > {}

// ============================================================================
// CLASE DEL MODELO
// ============================================================================

class DiseaseSymptom
  extends Model<DiseaseSymptomAttributes, DiseaseSymptomCreationAttributes>
  implements DiseaseSymptomAttributes
{
  public id!: string;
  public diseaseId!: string;
  public symptomId!: string;
  public relevance!: SymptomRelevance;
  public isCommon!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// ============================================================================
// INIT
// ============================================================================

DiseaseSymptom.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único de la relación enfermedad-síntoma',
    },
    diseaseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'diseases',
        key: 'id',
      },
      onDelete: 'CASCADE',
      comment: 'FK a la enfermedad',
    },
    symptomId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'symptoms',
        key: 'id',
      },
      onDelete: 'CASCADE',
      comment: 'FK al síntoma',
    },
    relevance: {
      type: DataTypes.ENUM(...Object.values(SymptomRelevance)),
      allowNull: false,
      //comment: 'Nivel de asociación clínica del síntoma con la enfermedad',
    },
    isCommon: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'true si relevance es PATHOGNOMONIC o COMMON',
    },
  },
  {
    sequelize,
    tableName: 'disease_symptoms',
    paranoid: false,
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['disease_id', 'symptom_id'],
        name: 'disease_symptoms_unique_pair',
      },
      { fields: ['disease_id'] },
      { fields: ['symptom_id'] },
      { fields: ['relevance'] },
      { fields: ['is_common'] },
    ],
    comment: 'Pivote M:N entre enfermedades y síntomas clínicos esperados',
  }
);

export default DiseaseSymptom;
