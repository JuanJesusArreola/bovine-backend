// src/models/VaccineDiseaseProtection.ts
// ============================================================================
// VACCINE DISEASE PROTECTION — CATÁLOGO DE PROTECCIÓN (puente vacuna↔enfermedad)
// ============================================================================
// Define qué enfermedades del catálogo `diseases` previene cada tipo de vacuna
// (`VaccineType`) y por cuántos días dura la inmunidad estimada.
//
// Una vacuna polivalente (ej. CLOSTRIDIAL 7/8 vías) se modela con VARIAS filas:
// un (vaccineType, diseaseId) por cada enfermedad que cubre.
//
// Es un CATÁLOGO de referencia (estático, sembrado). El cómputo de protección
// real de cada bovino se hace on-the-fly en VaccinationService cruzando las
// vacunas aplicadas contra este catálogo.
//
// FK `diseaseId` con constraints:false para evitar conflictos de orden de sync
// (mismo patrón usado en disease_sources / bovine_disease_cases).
//
// paranoid: false — catálogo de referencia, no requiere soft delete.
// underscored: true — columnas en snake_case.
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { VaccineType } from './Vaccination';

// ============================================================================
// INTERFACES
// ============================================================================

export interface VaccineDiseaseProtection_Attributes {
  id: string;
  /** Tipo de vacuna (enum) que confiere la protección */
  vaccineType: VaccineType;
  /** Enfermedad del catálogo que esta vacuna previene */
  diseaseId: string;
  /** Duración estimada de inmunidad en días (≈ intervalo de revacunación) */
  immunityDurationDays: number;
  /** Dosis necesarias para alcanzar inmunidad (esquema inicial) */
  dosesForImmunity: number;
  /** Permite desactivar una entrada sin borrarla */
  isActive: boolean;
  /** Notas clínicas / de campaña (ej. "refuerzo anual en zonas endémicas") */
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface VaccineDiseaseProtection_CreationAttributes
  extends Optional<
    VaccineDiseaseProtection_Attributes,
    | 'id'
    | 'dosesForImmunity'
    | 'isActive'
    | 'notes'
    | 'metadata'
    | 'createdAt'
    | 'updatedAt'
  > {}

// ============================================================================
// CLASE
// ============================================================================

class VaccineDiseaseProtection
  extends Model<
    VaccineDiseaseProtection_Attributes,
    VaccineDiseaseProtection_CreationAttributes
  >
  implements VaccineDiseaseProtection_Attributes
{
  public id!: string;
  public vaccineType!: VaccineType;
  public diseaseId!: string;
  public immunityDurationDays!: number;
  public dosesForImmunity!: number;
  public isActive!: boolean;
  public notes?: string | null;
  public metadata?: Record<string, unknown> | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// ============================================================================
// INIT
// ============================================================================

VaccineDiseaseProtection.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    vaccineType: {
      type: DataTypes.ENUM(...Object.values(VaccineType)),
      allowNull: false,
      //comment: 'Tipo de vacuna que confiere la protección',
    },
    diseaseId: {
      type: DataTypes.UUID,
      allowNull: false,
      // FK lógica a diseases.id — sin constraints para no romper el orden de sync
      comment: 'FK al catálogo de enfermedades (diseases.id)',
    },
    immunityDurationDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0 },
      comment: 'Duración estimada de inmunidad en días (≈ intervalo de revacunación)',
    },
    dosesForImmunity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: { min: 1 },
      comment: 'Número de dosis del esquema inicial para alcanzar inmunidad',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'VaccineDiseaseProtection',
    tableName: 'vaccine_disease_protections',
    timestamps: true,
    paranoid: false,
    indexes: [
      // Una sola fila por par (tipo de vacuna, enfermedad)
      {
        unique: true,
        name: 'unique_vaccine_disease',
        fields: ['vaccine_type', 'disease_id'],
      },
      { fields: ['vaccine_type'] },
      { fields: ['disease_id'] },
    ],
    comment: 'Catálogo: qué enfermedades previene cada tipo de vacuna y por cuánto tiempo',
  }
);

export default VaccineDiseaseProtection;
