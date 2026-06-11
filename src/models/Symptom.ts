// models/Symptom.ts
// ============================================================================
// SYMPTOM MODEL
// ============================================================================
// Catálogo canónico de síntomas clínicos bovinos. Tabla global (no por rancho).
// Usado como referencia en la tabla pivote disease_symptoms y en los síntomas
// observados por caso clínico (case_symptoms — Fase 2).
//
// severityWeight: valor 0.0 – 1.0 que indica la gravedad intrínseca del
// síntoma. Se usa para calcular un score clínico al abrir un caso.
// Ej: Muerte súbita = 1.00 | Fiebre leve = 0.50 | Alopecia = 0.30
//
// paranoid: true  — soft delete via deletedAt
// underscored: true — columnas en snake_case en la BD
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// ============================================================================
// ENUMs
// ============================================================================

export enum SymptomCategory {
  SYSTEMIC        = 'SYSTEMIC',
  RESPIRATORY     = 'RESPIRATORY',
  DIGESTIVE       = 'DIGESTIVE',
  REPRODUCTIVE    = 'REPRODUCTIVE',
  LOCOMOTOR       = 'LOCOMOTOR',
  NEUROLOGICAL    = 'NEUROLOGICAL',
  DERMATOLOGICAL  = 'DERMATOLOGICAL',
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface SymptomAttributes {
  id: string;
  name: string;
  normalizedName: string;
  slug: string;
  category: SymptomCategory;
  severityWeight: number;
  description?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface SymptomCreationAttributes
  extends Optional<
    SymptomAttributes,
    | 'id'
    | 'description'
    | 'isActive'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'
  > {}

// ============================================================================
// CLASE DEL MODELO
// ============================================================================

class Symptom
  extends Model<SymptomAttributes, SymptomCreationAttributes>
  implements SymptomAttributes
{
  public id!: string;
  public name!: string;
  public normalizedName!: string;
  public slug!: string;
  public category!: SymptomCategory;
  public severityWeight!: number;
  public description?: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

// ============================================================================
// INIT
// ============================================================================

Symptom.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del síntoma',
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: 'Nombre canónico del síntoma',
    },
    normalizedName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      //unique: true,
      comment: 'Nombre normalizado (minúsculas, sin tildes) para búsquedas',
    },
    slug: {
      type: DataTypes.STRING(200),
      allowNull: false,
      //unique: true,
      comment: 'Slug URL-friendly único (ej: fiebre-alta)',
    },
    category: {
      type: DataTypes.ENUM(...Object.values(SymptomCategory)),
      allowNull: false,
      //comment: 'Sistema orgánico al que pertenece el síntoma',
    },
    severityWeight: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      comment: 'Peso de gravedad intrínseco del síntoma (0.00 – 1.00)',
      validate: {
        min: 0,
        max: 1,
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción clínica del síntoma',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el síntoma está activo en el catálogo',
    },
  },
  {
    sequelize,
    tableName: 'symptoms',
    paranoid: true,
    underscored: true,
    timestamps: true,
    indexes: [
      { unique: true, fields: ['slug'] },
      { unique: true, fields: ['normalized_name'] },
      { fields: ['category'] },
      { fields: ['is_active'] },
    ],
    comment: 'Catálogo canónico de síntomas clínicos bovinos',
  }
);

export default Symptom;
