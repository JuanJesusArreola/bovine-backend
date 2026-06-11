// src/models/EpidemiologyAlert.ts
// ============================================================================
// EPIDEMIOLOGY ALERT — ALERTAS EPIDEMIOLÓGICAS (E-03)
// ============================================================================
// Alertas generadas por el evaluador (tras el cómputo de snapshots) cuando se
// disparan triggers: brote emergente, caso zoonótico, cobertura crítica,
// letalidad anormal, etc. Se gestionan (acknowledge / resolve).
//
// FKs lógicas (constraints:false). paranoid:false. underscored:true.
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export enum AlertType {
  OUTBREAK_EMERGING = 'OUTBREAK_EMERGING',   // Brote emergente (nuevos casos en 7d)
  ZOONOTIC_CASE = 'ZOONOTIC_CASE',           // Caso activo de enfermedad zoonótica
  LOW_COVERAGE = 'LOW_COVERAGE',             // Cobertura vacunal crítica con casos activos
  HIGH_LETHALITY = 'HIGH_LETHALITY',         // Tasa de mortalidad anormal
  FULMINANT_COURSE = 'FULMINANT_COURSE',     // Curso fulminante (muertes rápidas)
  GEOGRAPHIC_SPREAD = 'GEOGRAPHIC_SPREAD',   // Expansión geográfica
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

export interface EpidemiologyAlert_Attributes {
  id: string;
  ranchId: string;
  diseaseId?: string | null;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  status: AlertStatus;
  metadata?: Record<string, unknown> | null;
  acknowledgedBy?: string | null;
  acknowledgedAt?: Date | null;
  resolvedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EpidemiologyAlert_CreationAttributes
  extends Optional<
    EpidemiologyAlert_Attributes,
    | 'id'
    | 'diseaseId'
    | 'status'
    | 'metadata'
    | 'acknowledgedBy'
    | 'acknowledgedAt'
    | 'resolvedAt'
    | 'createdAt'
    | 'updatedAt'
  > {}

class EpidemiologyAlert
  extends Model<EpidemiologyAlert_Attributes, EpidemiologyAlert_CreationAttributes>
  implements EpidemiologyAlert_Attributes
{
  public id!: string;
  public ranchId!: string;
  public diseaseId?: string | null;
  public type!: AlertType;
  public severity!: AlertSeverity;
  public title!: string;
  public message!: string;
  public status!: AlertStatus;
  public metadata?: Record<string, unknown> | null;
  public acknowledgedBy?: string | null;
  public acknowledgedAt?: Date | null;
  public resolvedAt?: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EpidemiologyAlert.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    ranchId: { type: DataTypes.UUID, allowNull: false, comment: 'FK lógica al rancho' },
    diseaseId: { type: DataTypes.UUID, allowNull: true, comment: 'FK lógica a la enfermedad (null = global)' },
    type: { type: DataTypes.ENUM(...Object.values(AlertType)), allowNull: false },
    severity: { type: DataTypes.ENUM(...Object.values(AlertSeverity)), allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM(...Object.values(AlertStatus)), allowNull: false, defaultValue: AlertStatus.OPEN },
    metadata: { type: DataTypes.JSONB, allowNull: true },
    acknowledgedBy: { type: DataTypes.UUID, allowNull: true },
    acknowledgedAt: { type: DataTypes.DATE, allowNull: true },
    resolvedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'EpidemiologyAlert',
    tableName: 'epidemiology_alerts',
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [
      { fields: ['ranch_id', 'status'] },
      { fields: ['disease_id'] },
      { fields: ['type'] },
      { fields: ['status'] },
    ],
    comment: 'Alertas epidemiológicas generadas por triggers (E-03)',
  }
);

export default EpidemiologyAlert;
