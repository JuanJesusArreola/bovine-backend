// models/CaseContact.ts
// ============================================================================
// CASE CONTACT MODEL — FASE 5
// ============================================================================
// Representa un enlace de contagio (posible o confirmado) entre dos casos
// clínicos. Puede ser creado de forma:
//   - AUTO: por `detectPotentialContacts()` basándose en co-localización.
//   - MANUAL: registrado explícitamente por un veterinario.
//
// Cardinalidad: un par (sourceCaseId, targetCaseId) es ÚNICO para evitar
// duplicados. El sentido es: source es el caso "fuente probable" y target
// es el caso "contagiado probable".
//
// paranoid: false — los enlaces de contacto son evidencia epidemiológica
// que no debe borrarse en soft-delete.
// underscored: true — columnas en snake_case.
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// ============================================================================
// ENUMs
// ============================================================================

export enum ContactType {
  SAME_LOCATION   = 'SAME_LOCATION',   // Detectado por co-localización en potrero/corral
  SHARED_PASTURE  = 'SHARED_PASTURE',  // Pastaban en el mismo potrero (sin GPS exacto)
  DIRECT_CONTACT  = 'DIRECT_CONTACT',  // Contacto físico documentado (ej. monta, peleas)
  SHARED_WATER    = 'SHARED_WATER',    // Bebedero o fuente de agua compartida
  AUTO_DETECTED   = 'AUTO_DETECTED',   // Detectado automáticamente (tipo no especificado)
}

export enum ContactDetectedBy {
  AUTO   = 'AUTO',   // Detectado por el sistema (detectPotentialContacts)
  MANUAL = 'MANUAL', // Registrado manualmente por el veterinario
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface CaseContact_Attributes {
  id: string;
  sourceCaseId: string;  // Caso "fuente probable" del contagio
  /**
   * Caso "posiblemente contagiado".
   * E-04: null cuando el contacto es una EXPOSICIÓN asintomática (el bovino
   * estuvo co-localizado pero no tiene caso). En ese caso se usa targetBovineId.
   */
  targetCaseId?: string | null;
  /** E-04: bovino expuesto sin caso (cuando targetCaseId es null). */
  targetBovineId?: string | null;
  contactType: ContactType;
  contactDate?: Date;    // Fecha estimada de contacto (puede ser null si no se sabe)
  detectedBy: ContactDetectedBy;
  confidence: number;    // 0.0 – 1.0 — confianza en el enlace de contagio
  distanceMeters?: number; // Distancia entre bovinos en el momento del contacto (si hay GPS)
  locationId?: string;   // Potrero / corral donde se detectó la co-localización
  notes?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CaseContact_CreationAttributes
  extends Optional<
    CaseContact_Attributes,
    | 'id'
    | 'targetCaseId'
    | 'targetBovineId'
    | 'contactDate'
    | 'distanceMeters'
    | 'locationId'
    | 'notes'
    | 'createdBy'
    | 'createdAt'
    | 'updatedAt'
  > {}

// ============================================================================
// CLASE DEL MODELO
// ============================================================================

class CaseContact
  extends Model<CaseContact_Attributes, CaseContact_CreationAttributes>
  implements CaseContact_Attributes
{
  public id!: string;
  public sourceCaseId!: string;
  public targetCaseId?: string | null;
  public targetBovineId?: string | null;
  public contactType!: ContactType;
  public contactDate?: Date;
  public detectedBy!: ContactDetectedBy;
  public confidence!: number;
  public distanceMeters?: number;
  public locationId?: string;
  public notes?: string;
  public createdBy?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// ============================================================================
// INIT
// ============================================================================

CaseContact.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del enlace de contacto',
    },
    sourceCaseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'bovine_disease_cases', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'Caso clínico fuente del posible contagio',
    },
    targetCaseId: {
      type: DataTypes.UUID,
      allowNull: true, // E-04: null en exposiciones asintomáticas (sin caso)
      references: { model: 'bovine_disease_cases', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'Caso clínico que pudo contagiarse (null si es exposición sin caso)',
    },
    targetBovineId: {
      type: DataTypes.UUID,
      allowNull: true,
      // FK lógica a bovines — sin constraints para no añadir riesgo de orden de sync
      comment: 'E-04: bovino expuesto sin caso (cuando targetCaseId es null)',
    },
    contactType: {
      type: DataTypes.ENUM(...Object.values(ContactType)),
      allowNull: false,
      //comment: 'Tipo de contacto detectado',
    },
    contactDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha/hora estimada del contacto de contagio',
    },
    detectedBy: {
      type: DataTypes.ENUM(...Object.values(ContactDetectedBy)),
      allowNull: false,
      defaultValue: ContactDetectedBy.AUTO,
      //comment: 'Si el enlace fue detectado automáticamente o registrado manualmente',
    },
    confidence: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 0.5,
      comment: 'Nivel de confianza en el enlace (0.00 – 1.00)',
    },
    distanceMeters: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Distancia entre animales en el momento del contacto (si hay GPS)',
    },
    locationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'locations', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Potrero o corral donde se detectó la co-localización',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas del veterinario sobre el enlace de contagio',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Usuario que registró el enlace (null = sistema automático)',
    },
  },
  {
    sequelize,
    tableName: 'case_contacts',
    paranoid: false,
    underscored: true,
    timestamps: true,
    indexes: [
      // Par único — evita duplicar el mismo enlace de contagio
      {
        name: 'uq_case_contact_pair',
        unique: true,
        fields: ['source_case_id', 'target_case_id'],
      },
      { fields: ['source_case_id'] },
      { fields: ['target_case_id'] },
      { fields: ['contact_type'] },
      { fields: ['detected_by'] },
      { fields: ['contact_date'] },
    ],
    comment: 'Tabla de enlaces de contagio entre casos clínicos bovinos',
  }
);

export default CaseContact;
