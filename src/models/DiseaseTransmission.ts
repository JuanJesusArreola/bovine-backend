// models/DiseaseTransmission.ts
// ============================================================================
// DISEASE TRANSMISSION MODEL (Pivote M:N)
// ============================================================================
// Relaciona enfermedades con sus vías de transmisión conocidas.
// Una enfermedad puede tener múltiples vías, y una vía puede aplicar
// a múltiples enfermedades.
//
// Unique constraint en (disease_id, transmission_method_id).
// paranoid: false — pivote sin soft delete
// underscored: true — columnas en snake_case en la BD
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// ============================================================================
// INTERFACES
// ============================================================================

export interface DiseaseTransmissionAttributes {
  id: string;
  diseaseId: string;
  transmissionMethodId: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DiseaseTransmissionCreationAttributes
  extends Optional<
    DiseaseTransmissionAttributes,
    'id' | 'notes' | 'createdAt' | 'updatedAt'
  > {}

// ============================================================================
// CLASE DEL MODELO
// ============================================================================

class DiseaseTransmission
  extends Model<DiseaseTransmissionAttributes, DiseaseTransmissionCreationAttributes>
  implements DiseaseTransmissionAttributes
{
  public id!: string;
  public diseaseId!: string;
  public transmissionMethodId!: string;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// ============================================================================
// INIT
// ============================================================================

DiseaseTransmission.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único de la relación enfermedad-transmisión',
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
    transmissionMethodId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'transmission_methods',
        key: 'id',
      },
      onDelete: 'CASCADE',
      comment: 'FK al método de transmisión',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas específicas sobre esta vía de transmisión para esta enfermedad',
    },
  },
  {
    sequelize,
    tableName: 'disease_transmissions',
    paranoid: false,
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['disease_id', 'transmission_method_id'],
        name: 'disease_transmissions_unique_pair',
      },
      { fields: ['disease_id'] },
      { fields: ['transmission_method_id'] },
    ],
    comment: 'Pivote M:N entre enfermedades y vías de transmisión',
  }
);

export default DiseaseTransmission;
