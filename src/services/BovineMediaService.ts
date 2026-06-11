// services/BovineMediaService.ts
// ============================================================================
// BOVINE MEDIA SERVICE
// ============================================================================
// Gestión unificada de archivos multimedia (imágenes, documentos, videos) por
// bovino. Reusa el modelo `RanchMedia` con el campo `bovineId` set, evitando
// crear una tabla nueva.
//
// Patrón de upload:
//   1. Validar tipo/tamaño según FileCategory.
//   2. Subir a Cloudflare R2 vía StorageService.
//   3. Crear registro en RanchMedia (con ranchId del bovino + bovineId).
//   4. Si la INSERT falla → eliminar de R2 (rollback best-effort).
//
// Decisión: el bovino DEBE tener `ranchId` para poder subir media (porque
// RanchMedia.ranchId es NOT NULL). Si no lo tiene, se rechaza con 400.
// ============================================================================

import { Op } from 'sequelize';
import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';
import {
  BovineError,
  BovineNotFoundError,
  BovineValidationError,
} from '../utils/BovineErrors';

import Bovine from '../models/Bovine';
import RanchMedia, {
  MediaType as RanchMediaType,
  MediaCategory,
  MediaVisibility,
} from '../models/RanchMedia';
import { StorageService, FileInput } from './StorageService';
import { FileCategory, FILE_CONFIGS } from '../middleware/upload';
import { bovineFullService } from './BovineFullService';

// ============================================================================
// TIPOS PÚBLICOS
// ============================================================================

/**
 * Tipos de media expuestos al frontend para bovinos.
 * Mapean 1:1 con FileCategory internos.
 */
export type BovineMediaType = 'images' | 'documents' | 'videos';

const MEDIA_TYPE_TO_CATEGORY: Record<BovineMediaType, FileCategory> = {
  images: FileCategory.BOVINE_IMAGES,
  documents: FileCategory.BOVINE_DOCUMENTS,
  videos: FileCategory.BOVINE_VIDEOS,
};

const MEDIA_TYPE_TO_RANCH_TYPE: Record<BovineMediaType, RanchMediaType> = {
  images: RanchMediaType.IMAGE,
  documents: RanchMediaType.DOCUMENT,
  videos: RanchMediaType.VIDEO,
};

const MEDIA_TYPE_TO_RANCH_CATEGORY: Record<BovineMediaType, MediaCategory> = {
  images: MediaCategory.LIVESTOCK_PHOTO,
  documents: MediaCategory.OTHER,
  videos: MediaCategory.OTHER,
};

const RANCH_TYPE_TO_MEDIA_TYPE: Record<string, BovineMediaType | null> = {
  [RanchMediaType.IMAGE]: 'images',
  [RanchMediaType.DOCUMENT]: 'documents',
  [RanchMediaType.VIDEO]: 'videos',
};

// ============================================================================
// INTERFACES
// ============================================================================

export interface MediaUploadInput {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface MediaUploadResult {
  id: string;
  bovineId: string;
  mediaType: BovineMediaType;
  url: string;
  storagePath: string;
  thumbnailUrl: string | null;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface MediaItem {
  id: string;
  url: string;
  storagePath: string | null;
  filename: string;
  mimeType: string;
  size: number;
  thumbnailUrl: string | null;
  uploadedAt: Date;
  uploadedBy: string;
  caption?: string | null;
}

export interface MediaListResult {
  bovineId: string;
  images: MediaItem[];
  documents: MediaItem[];
  videos: MediaItem[];
  totals: {
    images: number;
    documents: number;
    videos: number;
    all: number;
  };
}

// ============================================================================
// SERVICIO
// ============================================================================

export class BovineMediaService {
  private readonly context = 'BovineMediaService';
  private readonly storage = new StorageService();

  // ==========================================================================
  // LECTURA
  // ==========================================================================

  /**
   * Lista todos los archivos del bovino agrupados por tipo.
   */
  async listMedia(bovineId: string): Promise<MediaListResult> {
    try {
      // Verificar bovino existe (404 si no)
      const bovine = await Bovine.findByPk(bovineId, { attributes: ['id'] });
      if (!bovine) throw new BovineNotFoundError(bovineId);

      const rows = await RanchMedia.findAll({
        where: { bovineId },
        order: [['uploadDate', 'DESC']],
      });

      const images: MediaItem[] = [];
      const documents: MediaItem[] = [];
      const videos: MediaItem[] = [];

      for (const r of rows) {
        const mediaType = RANCH_TYPE_TO_MEDIA_TYPE[r.type];
        if (!mediaType) continue; // ignora MAP / AUDIO / OTHER

        const item: MediaItem = {
          id: r.id,
          url: r.url,
          storagePath: r.storagePath ?? null,
          filename: r.filename,
          mimeType: r.mimeType,
          size: r.filesize,
          thumbnailUrl: r.thumbnailUrl ?? null,
          uploadedAt: r.uploadDate,
          uploadedBy: r.uploadedBy,
          caption: r.description ?? null,
        };

        if (mediaType === 'images') images.push(item);
        else if (mediaType === 'documents') documents.push(item);
        else if (mediaType === 'videos') videos.push(item);
      }

      return {
        bovineId,
        images,
        documents,
        videos,
        totals: {
          images: images.length,
          documents: documents.length,
          videos: videos.length,
          all: images.length + documents.length + videos.length,
        },
      };
    } catch (error) {
      logger.error(
        `Error listando media del bovino ${bovineId}`,
        this.context,
        { bovineId },
        ensureError(error)
      );
      throw error;
    }
  }

  // ==========================================================================
  // UPLOAD
  // ==========================================================================

  /**
   * Sube un archivo a R2 y crea el registro en RanchMedia.
   * Rollback de R2 si la INSERT falla.
   */
  async uploadMedia(
    bovineId: string,
    file: MediaUploadInput,
    mediaType: BovineMediaType,
    userId: string,
    options?: { caption?: string }
  ): Promise<MediaUploadResult> {
    // Verificar bovino existe + obtener ranchId
    const bovine = await Bovine.findByPk(bovineId, {
      attributes: ['id', 'ranchId', 'earTag'],
    });
    if (!bovine) throw new BovineNotFoundError(bovineId);

    const ranchId = (bovine as any).ranchId;
    if (!ranchId) {
      throw new BovineValidationError(
        `El bovino ${bovineId} no tiene rancho asignado. Asigne un rancho antes de subir media.`
      );
    }

    // Validar contra FileCategory
    const category = MEDIA_TYPE_TO_CATEGORY[mediaType];
    if (!category) {
      throw new BovineValidationError(
        `mediaType inválido: ${mediaType}. Permitidos: images, documents, videos`
      );
    }

    const config = FILE_CONFIGS[category];
    if (file.size > config.maxSize) {
      throw new BovineError(
        `Archivo demasiado grande: ${file.size} bytes (máx ${config.maxSize} bytes para ${mediaType})`,
        'FILE_TOO_LARGE',
        413
      );
    }
    if (!config.allowedTypes.includes(file.mimetype)) {
      throw new BovineError(
        `Tipo MIME no permitido para ${mediaType}: ${file.mimetype}. Permitidos: ${config.allowedTypes.join(', ')}`,
        'INVALID_MIME_TYPE',
        400
      );
    }

    // Subir a R2
    const folder = `${category}/${bovineId}`;
    const fileInput: FileInput = {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };

    // Decidir si generar thumbnail (solo imágenes con config)
    const thumbnail = config.thumbnailSizes?.[0]
      ? {
          width: config.thumbnailSizes[0].width,
          height: config.thumbnailSizes[0].height,
          suffix: config.thumbnailSizes[0].name,
        }
      : undefined;

    const uploadResult = await this.storage.upload(fileInput, folder, thumbnail);

    // Crear registro en RanchMedia (con rollback si falla)
    try {
      const created = await RanchMedia.create({
        ranchId,
        type: MEDIA_TYPE_TO_RANCH_TYPE[mediaType],
        category: MEDIA_TYPE_TO_RANCH_CATEGORY[mediaType],
        title: options?.caption || file.originalname,
        description: options?.caption,
        url: uploadResult.url,
        storagePath: uploadResult.storagePath,
        filename: uploadResult.originalName,
        filesize: uploadResult.size,
        mimeType: uploadResult.mimeType,
        thumbnailUrl: uploadResult.thumbnailUrl,
        uploadDate: new Date(),
        visibility: MediaVisibility.PRIVATE,
        bovineId,
        uploadedBy: userId,
      } as any);

      logger.info(
        `Media subida: ${created.id} (${mediaType}) para bovino ${bovineId}`,
        this.context,
        { mediaId: created.id, bovineId, mediaType, size: file.size }
      );

      // Invalidar cache compuesto del bovino
      bovineFullService.invalidate(bovineId);

      return {
        id: created.id,
        bovineId,
        mediaType,
        url: created.url,
        storagePath: created.storagePath || uploadResult.storagePath,
        thumbnailUrl: created.thumbnailUrl ?? null,
        filename: created.filename,
        mimeType: created.mimeType,
        size: created.filesize,
        uploadedAt: created.uploadDate,
        uploadedBy: created.uploadedBy,
      };
    } catch (dbError) {
      // Rollback: eliminar de R2 best-effort
      logger.warn(
        `Rollback de R2 tras fallo en INSERT: ${uploadResult.storagePath}`,
        this.context,
        { bovineId, error: ensureError(dbError).message }
      );
      try {
        await this.storage.delete(uploadResult.storagePath);
      } catch (cleanupError) {
        logger.error(
          `Falló rollback de R2 — archivo huérfano: ${uploadResult.storagePath}`,
          this.context,
          { bovineId, storagePath: uploadResult.storagePath },
          ensureError(cleanupError)
        );
      }
      throw dbError;
    }
  }

  // ==========================================================================
  // DELETE
  // ==========================================================================

  /**
   * Elimina un archivo. Recibe `storagePath` (puede contener `/`) y borra
   * tanto de R2 como de RanchMedia. Verifica que el archivo pertenezca al
   * bovino (defensa contra IDOR — Insecure Direct Object Reference).
   */
  async deleteMedia(bovineId: string, storagePath: string): Promise<void> {
    try {
      // Buscar el registro: storagePath debe coincidir Y debe ser del bovino dado
      const row = await RanchMedia.findOne({
        where: {
          bovineId,
          storagePath,
        },
      });

      if (!row) {
        throw new BovineError(
          `Archivo no encontrado o no pertenece al bovino ${bovineId}`,
          'MEDIA_NOT_FOUND',
          404
        );
      }

      // Eliminar de R2 primero (best effort — si falla, NO borramos DB)
      try {
        await this.storage.delete(storagePath);
      } catch (storageError) {
        logger.error(
          `Error eliminando archivo de R2 — abortando delete de DB`,
          this.context,
          { bovineId, storagePath },
          ensureError(storageError)
        );
        throw new BovineError(
          'No se pudo eliminar el archivo del almacenamiento',
          'STORAGE_DELETE_FAILED',
          500
        );
      }

      // Eliminar de DB (soft delete por paranoid)
      await row.destroy();

      // Invalidar cache compuesto del bovino
      bovineFullService.invalidate(bovineId);

      logger.info(
        `Media eliminada: ${row.id} (${storagePath}) del bovino ${bovineId}`,
        this.context,
        { mediaId: row.id, bovineId, storagePath }
      );
    } catch (error) {
      logger.error(
        `Error eliminando media del bovino ${bovineId}`,
        this.context,
        { bovineId, storagePath },
        ensureError(error)
      );
      throw error;
    }
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const bovineMediaService = new BovineMediaService();
