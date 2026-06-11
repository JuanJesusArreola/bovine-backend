// src/models/BovineVaccinationStatus.ts
// ============================================================================
// BOVINE VACCINATION STATUS — cache denormalizado 1:1 con Bovine
// ============================================================================
// Existe para soportar el filtro `vaccinationStatus` en el listado de bovinos
// SIN tener que recalcular on-the-fly por cada bovino. La tabla es la fuente
// de verdad para queries SQL (`WHERE status = ?`); el cálculo se actualiza
// vía hooks de `Vaccination` (afterCreate/afterUpdate/afterDestroy) o por
// llamada explícita desde el service.
//
// Reusa el enum `VaccinationStatus` ya definido en `Bovine.ts` (UP_TO_DATE |
// PENDING | OVERDUE | NONE) para mantener consistencia con el código existente.
// ============================================================================

import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { VaccinationStatus } from './Bovine';

export { VaccinationStatus };

// ============================================================================
// INTERFACES
// ============================================================================

export interface BovineVaccinationStatusAttributes {
  bovineId: string;                  // PK + FK 1:1 con Bovine
  status: VaccinationStatus;          // UP_TO_DATE | PENDING | OVERDUE | NONE
  lastVaccinationAt?: Date | null;
  lastVaccineType?: string | null;    // string para no acoplar al enum de Vaccination
  nextDueAt?: Date | null;            // próxima dosis pendiente más cercana
  overdueCount: number;               // # de tipos vencidos
  totalApplied: number;               // # total histórico de vacunas
  computedAt: Date;                   // cuándo se calculó este snapshot
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BovineVaccinationStatusCreationAttributes
  extends Optional<
    BovineVaccinationStatusAttributes,
    | 'lastVaccinationAt'
    | 'lastVaccineType'
    | 'nextDueAt'
    | 'overdueCount'
    | 'totalApplied'
    | 'computedAt'
  > {}

// ============================================================================
// CLASE
// ============================================================================

class BovineVaccinationStatus extends Model<
  BovineVaccinationStatusAttributes,
  BovineVaccinationStatusCreationAttributes
> implements BovineVaccinationStatusAttributes {
  public bovineId!: string;
  public status!: VaccinationStatus;
  public lastVaccinationAt?: Date | null;
  public lastVaccineType?: string | null;
  public nextDueAt?: Date | null;
  public overdueCount!: number;
  public totalApplied!: number;
  public computedAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// ============================================================================
// INIT
// ============================================================================

BovineVaccinationStatus.init(
  {
    bovineId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: 'bovines', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'PK + FK 1:1 con Bovine',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(VaccinationStatus)),
      allowNull: false,
      defaultValue: VaccinationStatus.NONE,
      //comment: 'Estado actual derivado: UP_TO_DATE | PENDING | OVERDUE | NONE'//,
    },
    lastVaccinationAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de la última vacuna aplicada (cualquier tipo)',
    },
    lastVaccineType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Tipo de la última vacuna aplicada',
    },
    nextDueAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Próxima dosis programada más cercana (cualquier tipo)',
    },
    overdueCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
      comment: 'Número de tipos de vacuna actualmente vencidos',
    },
    totalApplied: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
      comment: 'Total histórico de vacunas aplicadas a este bovino',
    },
    computedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Última vez que se recalculó este snapshot',
    },
  },
  {
    sequelize,
    modelName: 'BovineVaccinationStatus',
    tableName: 'bovine_vaccination_status',
    timestamps: true,
    paranoid: false, // 1:1 con Bovine; si el bovino se borra (cascade), este también
    indexes: [
      { fields: ['status'] },
      { fields: ['next_due_at'] },
      { fields: ['last_vaccination_at'] },
    ],
    comment: 'Cache denormalizado del estado de vacunación de cada bovino. Sincronizado por hooks de Vaccination.',
  }
);

export default BovineVaccinationStatus;
