// src/models/Vaccination.ts
// ============================================================================
// VACCINATION MODEL
// ============================================================================
// Registro de cada vacuna aplicada a un bovino.
//
// Separado de `Health` porque:
//  - Lifecycle propio (nextDueDate, doseNumber, withdrawalPeriod, batchNumber).
//  - Filtros por estado de vacunación se resuelven mejor sobre tabla pequeña.
//  - El cache `BovineVaccinationStatus` se sincroniza con hooks aquí, no en Health.
//  - Auditoría regulatoria suele requerir reporte separado.
// ============================================================================

import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

// ============================================================================
// ENUMS
// ============================================================================

export enum VaccineType {
  BRUCELLOSIS = 'BRUCELLOSIS',
  FOOT_AND_MOUTH = 'FOOT_AND_MOUTH',          // Fiebre aftosa
  ANTHRAX = 'ANTHRAX',                          // Carbunco
  RABIES = 'RABIES',
  BLACKLEG = 'BLACKLEG',                        // Pierna negra (clostridial)
  IBR = 'IBR',                                  // Rinotraqueítis Bovina Infecciosa
  BVD = 'BVD',                                  // Diarrea Viral Bovina
  LEPTOSPIROSIS = 'LEPTOSPIROSIS',
  CLOSTRIDIAL = 'CLOSTRIDIAL',                  // Polivalente clostridial (7/8 vías)
  PASTEURELLA = 'PASTEURELLA',
  TUBERCULOSIS = 'TUBERCULOSIS',                // (test, no vacuna en muchos países, se incluye por trazabilidad)
  TETANUS = 'TETANUS',
  VIRAL_DIARRHEA = 'VIRAL_DIARRHEA',
  PARAINFLUENZA = 'PARAINFLUENZA',
  RSV = 'RSV',                                  // Respiratorio Sincicial
  // ── Tipos añadidos (Fase: puente vacunación↔enfermedad) ──────────────────
  RESPIRATORY_COMPLEX = 'RESPIRATORY_COMPLEX', // Polivalente IBR-BVD-PI3-BRSV
  CAMPYLOBACTER = 'CAMPYLOBACTER',             // Vibriosis / campilobacteriosis genital
  TRICHOMONIASIS = 'TRICHOMONIASIS',           // Tricomoniasis bovina
  PINKEYE = 'PINKEYE',                          // Queratoconjuntivitis (Moraxella bovis)
  NEONATAL_DIARRHEA = 'NEONATAL_DIARRHEA',     // Rotavirus-Coronavirus-E.coli-K99
  SALMONELLA = 'SALMONELLA',                    // Salmonelosis (bacterina)
  FUSOBACTERIUM = 'FUSOBACTERIUM',             // Foot rot / abscesos hepáticos
  LUMPY_SKIN = 'LUMPY_SKIN',                    // Dermatosis nodular contagiosa
  BLUETONGUE = 'BLUETONGUE',                    // Lengua azul
  THEILERIA = 'THEILERIA',                      // Teileriosis
  BABESIA_ANAPLASMA = 'BABESIA_ANAPLASMA',     // Babesiosis + anaplasmosis (viva atenuada)
  PARATUBERCULOSIS = 'PARATUBERCULOSIS',       // Enfermedad de Johne
  OTHER = 'OTHER',
}

export enum ApplicationRoute {
  INTRAMUSCULAR = 'INTRAMUSCULAR',
  SUBCUTANEOUS = 'SUBCUTANEOUS',
  INTRANASAL = 'INTRANASAL',
  ORAL = 'ORAL',
  INTRADERMAL = 'INTRADERMAL',
  OTHER = 'OTHER',
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface VaccinationAttributes {
  id: string;
  bovineId: string;
  vaccineType: VaccineType;
  vaccineName?: string;             // nombre comercial
  manufacturer?: string;
  batchNumber?: string;
  doseNumber: number;               // 1, 2, 3 (para esquemas multidosis)
  doseAmountMl?: number;             // dosis en mililitros
  applicationRoute?: ApplicationRoute;
  applicationDate: Date;
  nextDueDate?: Date;                // null si es dosis única
  applicatorId: string;              // FK User (veterinario)
  withdrawalPeriodDays?: number;     // periodo de retiro carne/leche
  immunityDurationDays?: number;     // override de la duración de inmunidad (si null, usa el catálogo)
  notes?: string;
  metadata?: Record<string, any>;    // ruta, sitio, reacciones adversas, etc.
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface VaccinationCreationAttributes
  extends Optional<
    VaccinationAttributes,
    | 'id'
    | 'vaccineName'
    | 'manufacturer'
    | 'batchNumber'
    | 'doseAmountMl'
    | 'applicationRoute'
    | 'nextDueDate'
    | 'withdrawalPeriodDays'
    | 'immunityDurationDays'
    | 'notes'
    | 'metadata'
    | 'deletedAt'
  > {}

// ============================================================================
// CLASE
// ============================================================================

class Vaccination extends Model<VaccinationAttributes, VaccinationCreationAttributes>
  implements VaccinationAttributes {
  public id!: string;
  public bovineId!: string;
  public vaccineType!: VaccineType;
  public vaccineName?: string;
  public manufacturer?: string;
  public batchNumber?: string;
  public doseNumber!: number;
  public doseAmountMl?: number;
  public applicationRoute?: ApplicationRoute;
  public applicationDate!: Date;
  public nextDueDate?: Date;
  public applicatorId!: string;
  public withdrawalPeriodDays?: number;
  public immunityDurationDays?: number;
  public notes?: string;
  public metadata?: Record<string, any>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

// ============================================================================
// INIT
// ============================================================================

Vaccination.init(
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
      references: { model: 'bovines', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'Bovino al que se aplicó la vacuna',
    },
    vaccineType: {
      type: DataTypes.ENUM(...Object.values(VaccineType)),
      allowNull: false,
      //comment: 'Tipo de vacuna (catálogo)',
    },
    vaccineName: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: 'Nombre comercial del producto',
    },
    manufacturer: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: 'Laboratorio fabricante',
    },
    batchNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Número de lote (trazabilidad regulatoria)',
    },
    doseNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: { min: 1 },
      comment: 'Número de dosis (1, 2, 3...) para esquemas multidosis',
    },
    doseAmountMl: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Cantidad aplicada en ml',
    },
    applicationRoute: {
      type: DataTypes.ENUM(...Object.values(ApplicationRoute)),
      allowNull: true,
      //comment: 'Vía de aplicación',
    },
    applicationDate: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        notFuture(value: Date) {
          if (value > new Date()) {
            throw new Error('applicationDate no puede ser futura');
          }
        },
      },
      comment: 'Fecha de aplicación',
    },
    nextDueDate: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        afterApplicationDate(this: any, value: Date) {
          if (value && this.applicationDate && value <= this.applicationDate) {
            throw new Error('nextDueDate debe ser posterior a applicationDate');
          }
        },
      },
      comment: 'Próxima dosis programada (null si es dosis única)',
    },
    applicatorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      comment: 'ID del veterinario/usuario que aplicó',
    },
    withdrawalPeriodDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
      comment: 'Días de retiro (carne/leche) antes de poder consumir productos del animal',
    },
    immunityDurationDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
      comment: 'Override de la duración de inmunidad en días. Si null, se usa el valor del catálogo VaccineDiseaseProtection.',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Datos extra: sitio anatómico, reacciones, condiciones, etc.',
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Vaccination',
    tableName: 'vaccinations',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['bovine_id', 'application_date'] },
      { fields: ['vaccine_type'] },
      { fields: ['next_due_date'] },
      { fields: ['applicator_id'] },
      { fields: ['batch_number'] }, // trazabilidad de lote
    ],
    comment: 'Registro histórico de vacunas aplicadas por bovino',
  }
);

export default Vaccination;
