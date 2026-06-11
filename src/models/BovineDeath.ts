// src/models/BovineDeath.ts
// ============================================================================
// BOVINE DEATH — REGISTRO DE MUERTE / BAJA POR FALLECIMIENTO (Módulo 8)
// ============================================================================
// Una fila por muerte de un bovino. Es la fuente de verdad de la mortalidad:
//   - Distingue causa (enfermedad vs externa) con el enum DeathCause.
//   - Liga opcionalmente al caso clínico (diseaseCaseId) y a la enfermedad.
//   - Guarda datos para reportes: peso al morir, valor de sacrificio, necropsia.
//
// FKs con constraints:false (FK lógica) para no romper el orden de sync,
// mismo patrón que disease_sources / vaccine_disease_protections.
//
// paranoid: false — el registro de muerte es permanente (auditoría/trazabilidad).
// underscored: true — columnas en snake_case.
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// ============================================================================
// ENUM
// ============================================================================

export enum DeathCause {
  DISEASE = 'DISEASE',                   // Muerte por enfermedad (liga a caso clínico)
  ACCIDENT = 'ACCIDENT',                 // Accidente
  PREDATOR_ATTACK = 'PREDATOR_ATTACK',   // Ataque de depredador
  DROWNING = 'DROWNING',                 // Ahogamiento
  OLD_AGE = 'OLD_AGE',                   // Vejez
  SLAUGHTER = 'SLAUGHTER',               // Sacrificio (faena)
  NATURAL_DISASTER = 'NATURAL_DISASTER', // Desastre natural
  UNKNOWN = 'UNKNOWN',                   // Causa desconocida
  OTHER = 'OTHER',                       // Otra
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface BovineDeath_Attributes {
  id: string;
  bovineId: string;
  /** Fecha de la muerte */
  deathDate: Date;
  /** Causa de la muerte */
  cause: DeathCause;
  /** Caso clínico asociado (solo si cause = DISEASE) */
  diseaseCaseId?: string | null;
  /** Enfermedad asociada (denormalizado para reportes) */
  diseaseId?: string | null;
  /** Potrero donde ocurrió / se constató la muerte */
  locationId?: string | null;
  /** Peso del animal al morir (kg) */
  weightAtDeath?: number | null;
  /** Valor recuperado por sacrificio/faena (solo SLAUGHTER) */
  slaughterValue?: number | null;
  /** ¿Se realizó necropsia? */
  necropsyPerformed: boolean;
  /** Hallazgos de la necropsia (texto libre) */
  necropsyResults?: string | null;
  notes?: string | null;
  /** Usuario que registró la baja */
  recordedBy?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BovineDeath_CreationAttributes
  extends Optional<
    BovineDeath_Attributes,
    | 'id'
    | 'diseaseCaseId'
    | 'diseaseId'
    | 'locationId'
    | 'weightAtDeath'
    | 'slaughterValue'
    | 'necropsyPerformed'
    | 'necropsyResults'
    | 'notes'
    | 'recordedBy'
    | 'metadata'
    | 'createdAt'
    | 'updatedAt'
  > {}

// ============================================================================
// CLASE
// ============================================================================

class BovineDeath
  extends Model<BovineDeath_Attributes, BovineDeath_CreationAttributes>
  implements BovineDeath_Attributes
{
  public id!: string;
  public bovineId!: string;
  public deathDate!: Date;
  public cause!: DeathCause;
  public diseaseCaseId?: string | null;
  public diseaseId?: string | null;
  public locationId?: string | null;
  public weightAtDeath?: number | null;
  public slaughterValue?: number | null;
  public necropsyPerformed!: boolean;
  public necropsyResults?: string | null;
  public notes?: string | null;
  public recordedBy?: string | null;
  public metadata?: Record<string, unknown> | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// ============================================================================
// INIT
// ============================================================================

BovineDeath.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    bovineId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'FK al bovino fallecido (bovines.id)',
    },
    deathDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha de la muerte',
    },
    cause: {
      type: DataTypes.ENUM(...Object.values(DeathCause)),
      allowNull: false,
      //comment: 'Causa de la muerte',
    },
    diseaseCaseId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK lógica al caso clínico (solo si cause = DISEASE)',
    },
    diseaseId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK lógica a la enfermedad (denormalizado para reportes)',
    },
    locationId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK lógica al potrero donde ocurrió la muerte',
    },
    weightAtDeath: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Peso del animal al morir (kg)',
    },
    slaughterValue: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Valor recuperado por sacrificio (solo SLAUGHTER)',
    },
    necropsyPerformed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: '¿Se realizó necropsia?',
    },
    necropsyResults: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Hallazgos de la necropsia',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    recordedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK lógica al usuario que registró la baja',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'BovineDeath',
    tableName: 'bovine_deaths',
    timestamps: true,
    paranoid: false,
    indexes: [
      { unique: true, name: 'unique_death_per_bovine', fields: ['bovine_id'] },
      { fields: ['cause'] },
      { fields: ['death_date'] },
      { fields: ['disease_id'] },
      { fields: ['location_id'] },
    ],
    comment: 'Registro de muertes/bajas por fallecimiento de bovinos (mortalidad)',
  }
);

export default BovineDeath;
