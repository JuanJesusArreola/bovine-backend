// models/Disease.ts
// ============================================================================
// DISEASE MODEL
// ============================================================================
// Catálogo canónico de enfermedades bovinas. Tabla global (no por rancho).
// Usado como referencia en casos clínicos, snapshots epidemiológicos y filtros.
//
// paranoid: true  — soft delete via deletedAt
// underscored: true — columnas en snake_case en la BD
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// ============================================================================
// ENUMs
// ============================================================================

export enum DiseaseCategory {
  BACTERIAL = 'BACTERIAL',
  VIRAL     = 'VIRAL',
  PARASITIC = 'PARASITIC',
  FUNGAL    = 'FUNGAL',
  METABOLIC = 'METABOLIC',
  GENETIC   = 'GENETIC',
  OTHER     = 'OTHER',
}

export enum DiseaseSeverity {
  LOW      = 'LOW',
  MODERATE = 'MODERATE',
  HIGH     = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface DiseaseAttributes {
  id: string;
  name: string;
  normalizedName: string;
  slug: string;
  description?: string;
  category: DiseaseCategory;
  severity: DiseaseSeverity;
  isContagious: boolean;
  isZoonotic: boolean;
  defaultQuarantineDays?: number;
  incubationDaysMin?: number;
  incubationDaysMax?: number;
  recommendedAction?: string;
  affectedSystems?: string[];
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface DiseaseCreationAttributes
  extends Optional<
    DiseaseAttributes,
    | 'id'
    | 'description'
    | 'defaultQuarantineDays'
    | 'incubationDaysMin'
    | 'incubationDaysMax'
    | 'recommendedAction'
    | 'affectedSystems'
    | 'isActive'
    | 'metadata'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'
  > {}

// ============================================================================
// CLASE DEL MODELO
// ============================================================================

class Disease
  extends Model<DiseaseAttributes, DiseaseCreationAttributes>
  implements DiseaseAttributes
{
  public id!: string;
  public name!: string;
  public normalizedName!: string;
  public slug!: string;
  public description?: string;
  public category!: DiseaseCategory;
  public severity!: DiseaseSeverity;
  public isContagious!: boolean;
  public isZoonotic!: boolean;
  public defaultQuarantineDays?: number;
  public incubationDaysMin?: number;
  public incubationDaysMax?: number;
  public recommendedAction?: string;
  public affectedSystems?: string[];
  public isActive!: boolean;
  public metadata?: Record<string, any>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

// ============================================================================
// INIT
// ============================================================================

Disease.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único de la enfermedad',
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: 'Nombre canónico de la enfermedad',
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
      comment: 'Slug URL-friendly único (ej: fiebre-aftosa)',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción clínica de la enfermedad',
    },
    category: {
      type: DataTypes.ENUM(...Object.values(DiseaseCategory)),
      allowNull: false,
      //comment: 'Categoría etiológica',
    },
    severity: {
      type: DataTypes.ENUM(...Object.values(DiseaseSeverity)),
      allowNull: false,
      //comment: 'Severidad clínica general',
    },
    isContagious: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si es contagiosa entre animales',
    },
    isZoonotic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si puede transmitirse a humanos',
    },
    defaultQuarantineDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Días de cuarentena recomendados (null = no aplica cuarentena)',
    },
    incubationDaysMin: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Mínimo de días del período de incubación',
    },
    incubationDaysMax: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Máximo de días del período de incubación',
    },
    recommendedAction: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Acción veterinaria recomendada al detectar la enfermedad',
    },
    affectedSystems: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      comment: 'Sistemas orgánicos afectados (ej: RESPIRATORY, DIGESTIVE)',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si la enfermedad está activa en el catálogo',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Datos adicionales no estructurados',
    },
  },
  {
    sequelize,
    tableName: 'diseases',
    paranoid: true,
    underscored: true,
    timestamps: true,
    indexes: [
      { unique: true, fields: ['slug'] },
      { unique: true, fields: ['normalized_name'] },
      { fields: ['category'] },
      { fields: ['severity'] },
      { fields: ['is_contagious'] },
      { fields: ['is_zoonotic'] },
      { fields: ['is_active'] },
    ],
    comment: 'Catálogo canónico de enfermedades bovinas',
  }
);

export default Disease;
