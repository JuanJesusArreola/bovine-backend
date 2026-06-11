// models/TransmissionMethod.ts
// ============================================================================
// TRANSMISSION METHOD MODEL
// ============================================================================
// Catálogo de vías/mecanismos de transmisión de enfermedades bovinas.
// Ejemplos: Contacto directo, Aerosol, Vectores (insectos), Agua contaminada,
// Suelo, Vertical (madre→cría), Fómites, Alimentación, etc.
//
// Tabla global (no por rancho).
// paranoid: true  — soft delete via deletedAt
// underscored: true — columnas en snake_case en la BD
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// ============================================================================
// INTERFACES
// ============================================================================

export interface TransmissionMethodAttributes {
  id: string;
  name: string;
  normalizedName: string;
  slug: string;
  description?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface TransmissionMethodCreationAttributes
  extends Optional<
    TransmissionMethodAttributes,
    'id' | 'description' | 'isActive' | 'createdAt' | 'updatedAt' | 'deletedAt'
  > {}

// ============================================================================
// CLASE DEL MODELO
// ============================================================================

class TransmissionMethod
  extends Model<TransmissionMethodAttributes, TransmissionMethodCreationAttributes>
  implements TransmissionMethodAttributes
{
  public id!: string;
  public name!: string;
  public normalizedName!: string;
  public slug!: string;
  public description?: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

// ============================================================================
// INIT
// ============================================================================

TransmissionMethod.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del método de transmisión',
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: 'Nombre del mecanismo de transmisión',
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
      comment: 'Slug URL-friendly único (ej: contacto-directo)',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción del mecanismo de transmisión',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el método está activo en el catálogo',
    },
  },
  {
    sequelize,
    tableName: 'transmission_methods',
    paranoid: true,
    underscored: true,
    timestamps: true,
    indexes: [
      { unique: true, fields: ['slug'] },
      { unique: true, fields: ['normalized_name'] },
      { fields: ['is_active'] },
    ],
    comment: 'Catálogo de vías de transmisión de enfermedades bovinas',
  }
);

export default TransmissionMethod;
