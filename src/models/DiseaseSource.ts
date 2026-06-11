// models/DiseaseSource.ts
// ============================================================================
// DISEASE SOURCE MODEL — Catálogo de fuentes de infección
// ============================================================================
// Catálogo global de tipos de fuente/origen de infección de enfermedades
// bovinas. Ejemplos: "Animal importado sin cuarentena", "Agua contaminada",
// "Vector biológico (garrapatas)", "Fómites (equipos sin desinfectar)", etc.
//
// Tabla global (no por rancho).
// paranoid: false — una fuente no se elimina, se desactiva con isActive.
//                   Eliminar físicamente rompería los casos que la referencian.
// underscored: true — columnas en snake_case en la BD
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// ============================================================================
// ENUMs
// ============================================================================

export enum DiseaseSourceType {
  ANIMAL      = 'ANIMAL',       // Animal externo infectado
  ENVIRONMENT = 'ENVIRONMENT',  // Ambiente contaminado (suelo, pasto, instalaciones)
  HUMAN       = 'HUMAN',        // Persona sin equipo de protección
  VECTOR      = 'VECTOR',       // Vector biológico o mecánico (garrapatas, moscas)
  FOOD        = 'FOOD',         // Alimento contaminado
  WATER       = 'WATER',        // Agua de bebida contaminada
  FOMITE      = 'FOMITE',       // Objeto inanimado contaminado (agujas, equipos)
  UNKNOWN     = 'UNKNOWN',      // Fuente no identificada
}

export enum DiseaseSourceRiskLevel {
  LOW      = 'LOW',
  MEDIUM   = 'MEDIUM',
  HIGH     = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface DiseaseSourceAttributes {
  id: string;
  name: string;
  normalizedName: string;
  type: DiseaseSourceType;
  description?: string;
  riskLevel: DiseaseSourceRiskLevel;
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DiseaseSourceCreationAttributes
  extends Optional<
    DiseaseSourceAttributes,
    'id' | 'description' | 'isActive' | 'metadata' | 'createdAt' | 'updatedAt'
  > {}

// ============================================================================
// CLASE DEL MODELO
// ============================================================================

class DiseaseSource
  extends Model<DiseaseSourceAttributes, DiseaseSourceCreationAttributes>
  implements DiseaseSourceAttributes
{
  public id!: string;
  public name!: string;
  public normalizedName!: string;
  public type!: DiseaseSourceType;
  public description?: string;
  public riskLevel!: DiseaseSourceRiskLevel;
  public isActive!: boolean;
  public metadata?: Record<string, any>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// ============================================================================
// INIT
// ============================================================================

DiseaseSource.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único de la fuente de infección',
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      comment: 'Nombre descriptivo de la fuente. Ej: "Animal importado sin cuarentena"',
    },
    normalizedName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      comment: 'Nombre normalizado (minúsculas, sin tildes) para búsquedas y unicidad',
    },
    type: {
      type: DataTypes.ENUM(...Object.values(DiseaseSourceType)),
      allowNull: false,
      //comment: 'Categoría de la fuente: ANIMAL, WATER, VECTOR, FOMITE, etc.',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción extendida para el veterinario sobre cómo identificar esta fuente',
    },
    riskLevel: {
      type: DataTypes.ENUM(...Object.values(DiseaseSourceRiskLevel)),
      allowNull: false,
      //comment: 'Nivel de riesgo relativo de esta fuente: LOW, MEDIUM, HIGH, CRITICAL',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si la fuente está activa en el catálogo. Desactivar en lugar de eliminar.',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Datos adicionales: referencias, códigos externos, notas técnicas',
    },
  },
  {
    sequelize,
    modelName: 'DiseaseSource',
    tableName: 'disease_sources',
    paranoid: false,
    underscored: true,
    timestamps: true,
    indexes: [
      { unique: true, fields: ['normalized_name'] },
      { fields: ['type'] },
      { fields: ['risk_level'] },
      { fields: ['is_active'] },
    ],
    comment: 'Catálogo global de fuentes/orígenes de infección de enfermedades bovinas',
  }
);

export default DiseaseSource;
