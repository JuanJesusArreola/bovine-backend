// models/DiseaseMedia.ts
// ============================================================================
// DISEASE MEDIA MODEL
// ============================================================================
// Imágenes y videos de referencia asociados a una enfermedad bovina.
// Permiten mostrar en el frontend cómo se ven los síntomas físicos de cada
// enfermedad (lesiones, vesículas, signos clínicos, etc.).
//
// Un registro puede estar vinculado opcionalmente a un síntoma concreto
// (symptomId) para mostrar la imagen exactamente en el contexto correcto.
//
// Almacenamiento:
//   - Upload R2    → url = URL pública de Cloudflare R2
//                    storagePath = key en R2 (para eliminar)
//                    thumbnailUrl = URL del thumbnail generado en R2
//   - URL externa  → url apunta directamente al recurso externo, storagePath = null
//
// paranoid: true  — soft delete
// underscored: true — columnas en snake_case
// ============================================================================

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// ============================================================================
// ENUMs
// ============================================================================

export enum DiseaseMediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface DiseaseMedia_Attributes {
  id: string;
  diseaseId: string;
  symptomId?: string;       // FK opcional → symptoms (imagen de un síntoma específico)
  url: string;              // URL pública de R2 o URL externa
  storagePath?: string;     // Key en Cloudflare R2 (null para URLs externas)
  thumbnailUrl?: string;    // Versión miniatura generada en R2 o proporcionada
  title?: string;           // Ej: "Vesículas en encías", "Lesión en pezuña"
  description?: string;     // Descripción de qué muestra la imagen/video
  mediaType: DiseaseMediaType;
  mimeType?: string;        // image/jpeg, image/png, video/mp4...
  sizeBytes?: number;       // Tamaño del archivo en bytes
  displayOrder: number;     // Orden de aparición en la galería (default 0)
  isReference: boolean;     // true = imagen oficial/académica de referencia
  source?: string;          // Origen: "SENASICA", "IICA", "Dr. Ramírez", etc.
  uploadedBy?: string;      // FK → users (null = sistema o seeder)
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface DiseaseMedia_CreationAttributes
  extends Optional<
    DiseaseMedia_Attributes,
    | 'id'
    | 'symptomId'
    | 'storagePath'
    | 'thumbnailUrl'
    | 'title'
    | 'description'
    | 'mimeType'
    | 'sizeBytes'
    | 'displayOrder'
    | 'isReference'
    | 'source'
    | 'uploadedBy'
    | 'createdAt'
    | 'updatedAt'
    | 'deletedAt'
  > {}

// ============================================================================
// CLASE DEL MODELO
// ============================================================================

class DiseaseMedia
  extends Model<DiseaseMedia_Attributes, DiseaseMedia_CreationAttributes>
  implements DiseaseMedia_Attributes
{
  public id!: string;
  public diseaseId!: string;
  public symptomId?: string;
  public url!: string;
  public storagePath?: string;
  public thumbnailUrl?: string;
  public title?: string;
  public description?: string;
  public mediaType!: DiseaseMediaType;
  public mimeType?: string;
  public sizeBytes?: number;
  public displayOrder!: number;
  public isReference!: boolean;
  public source?: string;
  public uploadedBy?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

// ============================================================================
// INIT
// ============================================================================

DiseaseMedia.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del recurso multimedia',
    },
    diseaseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'diseases', key: 'id' },
      onDelete: 'CASCADE',
      comment: 'FK a la enfermedad a la que pertenece la imagen',
    },
    symptomId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'symptoms', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'FK opcional al síntoma que muestra la imagen',
    },
    url: {
      type: DataTypes.STRING(1000),
      allowNull: false,
      comment: 'URL pública del recurso (R2 o externa)',
    },
    storagePath: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Key en Cloudflare R2. Null para URLs externas.',
    },
    thumbnailUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      comment: 'URL de la miniatura del recurso',
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Título descriptivo de la imagen (ej: Vesículas en encías)',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción de qué muestra la imagen o video',
    },
    mediaType: {
      type: DataTypes.ENUM(...Object.values(DiseaseMediaType)),
      allowNull: false,
      defaultValue: DiseaseMediaType.IMAGE,
      //comment: 'Tipo de recurso: IMAGE o VIDEO',
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'MIME type del archivo (image/jpeg, image/png, video/mp4...)',
    },
    sizeBytes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Tamaño del archivo en bytes',
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Orden de aparición en la galería (menor = primero)',
    },
    isReference: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'true = imagen oficial/académica de referencia (SENASICA, IICA, etc.)',
    },
    source: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Origen de la imagen: institución, veterinario, publicación, etc.',
    },
    uploadedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Usuario que subió el archivo (null = sistema o seed)',
    },
  },
  {
    sequelize,
    tableName: 'disease_media',
    paranoid: true,
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['disease_id'] },
      { fields: ['symptom_id'] },
      { fields: ['disease_id', 'display_order'] },
      { fields: ['media_type'] },
      { fields: ['is_reference'] },
    ],
    comment: 'Imágenes y videos de referencia de enfermedades bovinas',
  }
);

export default DiseaseMedia;
