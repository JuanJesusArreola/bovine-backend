// src/models/ranch/RanchMedia.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Ranch from './Ranch';

// Enums
export enum MediaType {
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  VIDEO = 'VIDEO',
  MAP = 'MAP',
  AUDIO = 'AUDIO',
  OTHER = 'OTHER'
}

export enum MediaCategory {
  LOGO = 'LOGO',
  AERIAL_PHOTO = 'AERIAL_PHOTO',
  SATELLITE_IMAGE = 'SATELLITE_IMAGE',
  PROPERTY_MAP = 'PROPERTY_MAP',
  FACILITY_PHOTO = 'FACILITY_PHOTO',
  LIVESTOCK_PHOTO = 'LIVESTOCK_PHOTO',
  CERTIFICATE = 'CERTIFICATE',
  LICENSE = 'LICENSE',
  CONTRACT = 'CONTRACT',
  REPORT = 'REPORT',
  PLAN = 'PLAN',
  LEGAL_DOCUMENT = 'LEGAL_DOCUMENT',
  FINANCIAL_DOCUMENT = 'FINANCIAL_DOCUMENT',
  OTHER = 'OTHER'
}

export enum MediaVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  SHARED = 'SHARED',
  ARCHIVED = 'ARCHIVED'
}

// Atributos del modelo
export interface RanchMediaAttributes {
  id: string;
  ranchId: string;

  type: MediaType;
  category: MediaCategory;
  title: string;
  description?: string;

  // Archivo
  url: string;
  storagePath?: string;         // Key en R2 (para eliminar/referenciar)
  filename: string;
  filesize: number;           // en bytes
  mimeType: string;

  // Metadata
  width?: number;              // para imágenes
  height?: number;             // para imágenes
  duration?: number;            // para videos/audio (segundos)
  thumbnailUrl?: string;

  // Fechas
  uploadDate: Date;
  takenDate?: Date;             // fecha de captura original

  // Geolocalización (si aplica)
  latitude?: number;
  longitude?: number;

  // Tags y categorización
  tags?: string[];

  // Visibilidad
  visibility: MediaVisibility;

  // Asociación con otras entidades (opcional)
  locationId?: string;          // FK a Location (si es específico de una ubicación)
  bovineId?: string;            // FK a Bovine (si es de un animal específico)

  // Metadatos adicionales
  metadata?: Record<string, any>;

  // Auditoría
  uploadedBy: string;
  updatedBy?: string;

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface RanchMediaCreationAttributes
  extends Optional<RanchMediaAttributes,
    'id' | 'description' | 'storagePath' | 'width' | 'height' | 'duration' |
    'thumbnailUrl' | 'takenDate' | 'latitude' | 'longitude' | 'tags' |
    'locationId' | 'bovineId' | 'metadata' | 'updatedBy' |
    'deletedAt'
  > { }

class RanchMedia extends Model<RanchMediaAttributes, RanchMediaCreationAttributes>
  implements RanchMediaAttributes {

  public id!: string;
  public ranchId!: string;

  public type!: MediaType;
  public category!: MediaCategory;
  public title!: string;
  public description?: string;

  public url!: string;
  public storagePath?: string;
  public filename!: string;
  public filesize!: number;
  public mimeType!: string;

  public width?: number;
  public height?: number;
  public duration?: number;
  public thumbnailUrl?: string;

  public uploadDate!: Date;
  public takenDate?: Date;

  public latitude?: number;
  public longitude?: number;

  public tags?: string[];

  public visibility!: MediaVisibility;

  public locationId?: string;
  public bovineId?: string;

  public metadata?: Record<string, any>;

  public uploadedBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

RanchMedia.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del archivo multimedia'
    },
    ranchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'ranches', key: 'id' },
      comment: 'ID del rancho'
    },
    type: {
      type: DataTypes.ENUM(...Object.values(MediaType)),
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM(...Object.values(MediaCategory)),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Título del archivo'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción'
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: { isUrl: true },
      comment: 'URL del archivo'
    },
    storagePath: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Key en Cloudflare R2 (para operaciones de storage)'
    },
    filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Nombre del archivo'
    },
    filesize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0 },
      comment: 'Tamaño en bytes'
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Tipo MIME'
    },
    width: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
      comment: 'Ancho en píxeles (para imágenes)'
    },
    height: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
      comment: 'Alto en píxeles (para imágenes)'
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
      comment: 'Duración en segundos (para video/audio)'
    },
    thumbnailUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: { isUrl: true },
      comment: 'URL de la miniatura'
    },
    uploadDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de subida'
    },
    takenDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de captura original'
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      validate: { min: -90, max: 90 },
      comment: 'Latitud de captura'
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      validate: { min: -180, max: 180 },
      comment: 'Longitud de captura'
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'Etiquetas'
    },
    visibility: {
      type: DataTypes.ENUM(...Object.values(MediaVisibility)),
      allowNull: false,
      defaultValue: MediaVisibility.PRIVATE,
    },
    locationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'locations', key: 'id' },
      comment: 'ID de ubicación asociada (opcional)'
    },
    bovineId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'bovines', key: 'id' },
      comment: 'ID de bovino asociado (opcional)'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Metadatos adicionales'
    },
    uploadedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que subió'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que actualizó'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'RanchMedia',
    tableName: 'ranch_media',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['ranch_id'] },
      { fields: ['type'] },
      { fields: ['category'] },
      { fields: ['visibility'] },
      { fields: ['location_id'] },
      { fields: ['bovine_id'] },
      { fields: ['upload_date'] },
      { fields: ['taken_date'] },
      {
        name: "ranch_media_search",
        fields: ["title", "tags"]
      }
    ],
    comment: 'Archivos multimedia del rancho'
  }
);

export default RanchMedia;