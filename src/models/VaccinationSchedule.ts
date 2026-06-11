// src/models/VaccinationSchedule.ts
// ============================================================================
// VACCINATION SCHEDULE — CALENDARIO BASE DE VACUNACIÓN (Módulo 11)
// ============================================================================
// Define QUÉ vacuna le toca a un bovino según su edad/sexo/raza y cada cuánto
// debe revacunarse. Es el catálogo que permite a recompute() distinguir un
// PENDING real (le toca una vacuna y no la tiene) de una dosis única ya completa.
//
//   - frequencyMonths null/0 → dosis única (no requiere refuerzo periódico).
//   - genderFilter null       → aplica a ambos sexos.
//   - breedFilter null        → aplica a todas las razas.
//
// paranoid: false — catálogo de referencia. underscored: true.
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { VaccineType } from './Vaccination';
import { GenderType } from './Bovine';

export interface VaccinationSchedule_Attributes {
  id: string;
  vaccineType: VaccineType;
  /** Edad mínima (meses) a partir de la cual aplica esta vacuna */
  fromAgeMonths: number;
  /** Edad máxima (meses); null = sin tope */
  toAgeMonths?: number | null;
  /** Frecuencia de revacunación en meses; null/0 = dosis única */
  frequencyMonths?: number | null;
  /** Si es obligatoria (afecta PENDING) o solo recomendada */
  isRequired: boolean;
  /** Sexo al que aplica; null = ambos */
  genderFilter?: GenderType | null;
  /** Raza a la que aplica (texto); null = todas */
  breedFilter?: string | null;
  isActive: boolean;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface VaccinationSchedule_CreationAttributes
  extends Optional<
    VaccinationSchedule_Attributes,
    | 'id'
    | 'toAgeMonths'
    | 'frequencyMonths'
    | 'isRequired'
    | 'genderFilter'
    | 'breedFilter'
    | 'isActive'
    | 'notes'
    | 'metadata'
    | 'createdAt'
    | 'updatedAt'
  > {}

class VaccinationSchedule
  extends Model<VaccinationSchedule_Attributes, VaccinationSchedule_CreationAttributes>
  implements VaccinationSchedule_Attributes
{
  public id!: string;
  public vaccineType!: VaccineType;
  public fromAgeMonths!: number;
  public toAgeMonths?: number | null;
  public frequencyMonths?: number | null;
  public isRequired!: boolean;
  public genderFilter?: GenderType | null;
  public breedFilter?: string | null;
  public isActive!: boolean;
  public notes?: string | null;
  public metadata?: Record<string, unknown> | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

VaccinationSchedule.init(
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
      //comment: 'Tipo de vacuna del calendario',
    },
    fromAgeMonths: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
      comment: 'Edad mínima (meses) desde la que aplica',
    },
    toAgeMonths: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
      comment: 'Edad máxima (meses); null = sin tope',
    },
    frequencyMonths: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
      comment: 'Frecuencia de revacunación en meses; null/0 = dosis única',
    },
    isRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Obligatoria (afecta PENDING) vs solo recomendada',
    },
    genderFilter: {
      type: DataTypes.ENUM(...Object.values(GenderType)),
      allowNull: true,
      //comment: 'Sexo al que aplica; null = ambos',
    },
    breedFilter: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Raza a la que aplica; null = todas',
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
    modelName: 'VaccinationSchedule',
    tableName: 'vaccination_schedules',
    timestamps: true,
    paranoid: false,
    indexes: [
      { fields: ['vaccine_type'] },
      { fields: ['is_active'] },
    ],
    comment: 'Calendario base de vacunación por edad/sexo/raza',
  }
);

export default VaccinationSchedule;
