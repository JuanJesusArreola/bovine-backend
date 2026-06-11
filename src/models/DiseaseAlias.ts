// models/DiseaseAlias.ts
// ============================================================================
// DISEASE ALIAS MODEL
// ============================================================================
// Nombres alternativos de cada enfermedad: nombres regionales, acrónimos,
// variantes ortográficas, nombres científicos, etc.
//
// Tabla separada (no JSONB) para poder indexar normalizedAlias y hacer
// búsquedas eficientes desde el buscador de enfermedades.
//
// Relación: N aliases → 1 Disease (FK diseaseId)
// paranoid: false — los aliases no necesitan soft delete
// underscored: true — columnas en snake_case en la BD
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// ============================================================================
// INTERFACES
// ============================================================================

export interface DiseaseAliasAttributes {
  id: string;
  diseaseId: string;
  alias: string;
  normalizedAlias: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DiseaseAliasCreationAttributes
  extends Optional<
    DiseaseAliasAttributes,
    'id' | 'createdAt' | 'updatedAt'
  > {}

// ============================================================================
// CLASE DEL MODELO
// ============================================================================

class DiseaseAlias
  extends Model<DiseaseAliasAttributes, DiseaseAliasCreationAttributes>
  implements DiseaseAliasAttributes
{
  public id!: string;
  public diseaseId!: string;
  public alias!: string;
  public normalizedAlias!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// ============================================================================
// INIT
// ============================================================================

DiseaseAlias.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del alias',
    },
    diseaseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'diseases',
        key: 'id',
      },
      onDelete: 'CASCADE',
      comment: 'FK a la enfermedad canónica',
    },
    alias: {
      type: DataTypes.STRING(300),
      allowNull: false,
      comment: 'Nombre alternativo tal como se usa (con tildes, mayúsculas, etc.)',
    },
    normalizedAlias: {
      type: DataTypes.STRING(300),
      allowNull: false,
      //unique: true,
      comment: 'Alias normalizado (minúsculas, sin tildes) — único para evitar duplicados',
    },
  },
  {
    sequelize,
    tableName: 'disease_aliases',
    paranoid: false,
    underscored: true,
    timestamps: true,
    indexes: [
      { unique: true, fields: ['normalized_alias'] },
      { fields: ['disease_id'] },
    ],
    comment: 'Aliases y nombres alternativos de enfermedades bovinas',
  }
);

export default DiseaseAlias;
