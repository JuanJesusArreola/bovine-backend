// models/EpidemiologicalSnapshot.ts
// ============================================================================
// EPIDEMIOLOGICAL SNAPSHOT (Fase 4)
// ============================================================================
// Resumen epidemiológico diario por rancho × enfermedad.
// Generado por EpidemiologicalService.computeSnapshots() (job diario).
//
// Cada fila = un rancho + una enfermedad + una fecha de cómputo.
// Restricción UNIQUE (ranch_id, disease_id, snapshot_date) → upsert seguro.
// diseaseId = NULL → snapshot global del rancho (todas las enfermedades).
//
// Relaciones:
//   N:1  Ranch    (rancho evaluado)
//   N:1  Disease  (enfermedad; NULL = global)
//
// paranoid: false  — no soft delete (son datos históricos de serie de tiempo)
// underscored: true — columnas en snake_case
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// ============================================================================
// INTERFACES
// ============================================================================

export interface EpidemiologicalSnapshot_Attributes {
  id: string;
  ranchId: string;
  /** UUID de Disease. null = snapshot global del rancho (todas las enfermedades) */
  diseaseId: string | null;
  /** Fecha del snapshot (sólo fecha, sin hora) — clave natural junto a ranchId/diseaseId */
  snapshotDate: string;   // DATEONLY → string en Sequelize

  // ── Casos activos ────────────────────────────────────────────────────────
  /** Casos con status ∈ {SUSPECTED, CONFIRMED, RECOVERING} */
  activeCases: number;
  /** Bovinos únicos con al menos un caso activo */
  affectedBovines: number;

  // ── Nuevos casos (ventanas deslizantes) ──────────────────────────────────
  /** Casos abiertos en los últimos 7 días desde snapshotDate */
  newCases7d: number;
  /** Casos abiertos en los últimos 30 días desde snapshotDate */
  newCases30d: number;

  // ── Cierre de casos ──────────────────────────────────────────────────────
  /** Casos cerrados en los últimos 30 días */
  closedCases30d: number;
  /** De los cerrados en 30d, cuántos con outcome RECOVERED */
  recoveredCount: number;
  /** De los cerrados en 30d, cuántos con outcome DECEASED */
  deceasedCount: number;

  // ── Métricas derivadas ───────────────────────────────────────────────────
  /** Total bovinos activos en el rancho al momento del cómputo */
  totalBovinesInRanch: number;
  /**
   * Tasa de incidencia = affectedBovines / totalBovinesInRanch × 100.
   * NULL si totalBovinesInRanch = 0.
   */
  incidenceRate: number | null;
  /**
   * Tasa de mortalidad = deceasedCount / closedCases30d × 100.
   * NULL si closedCases30d = 0.
   */
  mortalityRate: number | null;
  /**
   * Promedio de días entre diagnosedAt y resolvedAt para los casos cerrados en 30d.
   * NULL si no hay casos cerrados con ambas fechas.
   */
  avgResolutionDays: number | null;

  // ── Cobertura de vacunación (puente vacunación↔epidemiología) ─────────────
  /** Bovinos del rancho con protección vacunal activa contra esta enfermedad */
  vaccinatedBovines: number;
  /** Bovinos sin protección activa = total − vaccinated */
  susceptibleBovines: number;
  /**
   * Cobertura = vaccinatedBovines / totalBovinesInRanch × 100.
   * NULL en snapshots globales (diseaseId = null) o si total = 0.
   */
  vaccinationCoverage: number | null;

  /** Metadata libre (ej. top síntomas, top tratamientos) */
  metadata: Record<string, unknown> | null;

  /** Timestamp exacto del cómputo */
  computedAt: Date;
}

export interface EpidemiologicalSnapshot_CreationAttributes
  extends Optional<
    EpidemiologicalSnapshot_Attributes,
    | 'id'
    | 'diseaseId'
    | 'incidenceRate'
    | 'mortalityRate'
    | 'avgResolutionDays'
    | 'vaccinatedBovines'
    | 'susceptibleBovines'
    | 'vaccinationCoverage'
    | 'metadata'
    | 'computedAt'
  > {}

// ============================================================================
// CLASE DEL MODELO
// ============================================================================

class EpidemiologicalSnapshot
  extends Model<
    EpidemiologicalSnapshot_Attributes,
    EpidemiologicalSnapshot_CreationAttributes
  >
  implements EpidemiologicalSnapshot_Attributes
{
  public id!: string;
  public ranchId!: string;
  public diseaseId!: string | null;
  public snapshotDate!: string;

  public activeCases!: number;
  public affectedBovines!: number;
  public newCases7d!: number;
  public newCases30d!: number;
  public closedCases30d!: number;
  public recoveredCount!: number;
  public deceasedCount!: number;
  public totalBovinesInRanch!: number;
  public incidenceRate!: number | null;
  public mortalityRate!: number | null;
  public avgResolutionDays!: number | null;
  public vaccinatedBovines!: number;
  public susceptibleBovines!: number;
  public vaccinationCoverage!: number | null;
  public metadata!: Record<string, unknown> | null;
  public computedAt!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

EpidemiologicalSnapshot.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ranchId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'FK al rancho',
    },
    diseaseId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK a la enfermedad. NULL = resumen global del rancho',
    },
    snapshotDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Fecha del snapshot (solo fecha, sin hora)',
    },
    activeCases: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Casos activos: SUSPECTED | CONFIRMED | RECOVERING',
    },
    affectedBovines: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Bovinos únicos con al menos un caso activo',
    },
    newCases7d: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Nuevos casos en los últimos 7 días desde snapshotDate',
    },
    newCases30d: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Nuevos casos en los últimos 30 días desde snapshotDate',
    },
    closedCases30d: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Casos cerrados en los últimos 30 días',
    },
    recoveredCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Casos cerrados con outcome RECOVERED en los últimos 30 días',
    },
    deceasedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Casos cerrados con outcome DECEASED en los últimos 30 días',
    },
    totalBovinesInRanch: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Total bovinos activos en el rancho al momento del cómputo',
    },
    incidenceRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'affectedBovines / totalBovinesInRanch × 100. NULL si denom = 0',
    },
    mortalityRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'deceasedCount / closedCases30d × 100. NULL si denom = 0',
    },
    avgResolutionDays: {
      type: DataTypes.DECIMAL(6, 1),
      allowNull: true,
      comment: 'Promedio días diagnosis→resolución para casos cerrados en 30d',
    },
    vaccinatedBovines: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Bovinos del rancho con protección vacunal activa contra la enfermedad',
    },
    susceptibleBovines: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Bovinos sin protección activa = total − vaccinated',
    },
    vaccinationCoverage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'vaccinatedBovines / totalBovinesInRanch × 100. NULL en globales o si total = 0',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Metadata extendida: top síntomas, top tratamientos, etc.',
    },
    computedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Timestamp exacto del cómputo',
    },
  },
  {
    sequelize,
    tableName: 'epidemiological_snapshots',
    underscored: true,
    paranoid: false,
    indexes: [
      {
        // Clave natural del snapshot → garantiza upsert idempotente
        unique: true,
        name: 'epidemiological_snapshots_ranch_disease_date',
        fields: ['ranch_id', 'disease_id', 'snapshot_date'],
      },
      {
        name: 'epidemiological_snapshots_ranch_date',
        fields: ['ranch_id', 'snapshot_date'],
      },
      {
        name: 'epidemiological_snapshots_disease_date',
        fields: ['disease_id', 'snapshot_date'],
      },
    ],
    comment: 'Resumen epidemiológico diario por rancho × enfermedad',
  }
);

export default EpidemiologicalSnapshot;
