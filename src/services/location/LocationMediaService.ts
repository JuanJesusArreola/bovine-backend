// services/location/LocationMediaService.ts
// ============================================================================
// LOCATION MEDIA SERVICE
// ============================================================================
// Gestión unificada de archivos multimedia para ubicaciones.
// Sube a Cloudflare R2 y persiste la URL en LocationInfo (arrays JSONB).
// ============================================================================

import { Transaction } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import { ensureError } from '../../utils/errorUtils';
import { LocationNotFoundError, LocationError } from '../../utils/LocationErrors';

import Location from '../../models/Location';
import LocationInfo, { CurrentCondition } from '../../models/LocationInfo';
import { storageService } from '../../container';
import { FileCategory, FILE_CONFIGS } from '../../middleware/upload';
import { UserRole } from '../../models/User';

// ============================================================================
// TIPOS
// ============================================================================

/**
 * Tipos de media que persisten en LocationInfo.
 * Mapean 1:1 con los arrays del modelo.
 */
export type MediaType = 'images' | 'documents' | 'videos' | 'maps';

const MEDIA_TYPE_TO_CATEGORY: Record<MediaType, FileCategory> = {
  images: FileCategory.LOCATION_IMAGES,
  documents: FileCategory.LOCATION_DOCUMENTS,
  videos: FileCategory.LOCATION_VIDEOS,
  maps: FileCategory.LOCATION_MAPS,
};

export interface MediaUploadInput {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface MediaUploadResult {
  locationId: string;
  mediaType: MediaType;
  url: string;
  storagePath: string;
  thumbnailUrl?: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface MediaListResult {
  locationId: string;
  images: string[];
  documents: string[];
  videos: string[];
  maps: string[];
  totals: {
    images: number;
    documents: number;
    videos: number;
    maps: number;
    all: number;
  };
}

// ============================================================================
// SERVICIO
// ============================================================================

export class LocationMediaService {
  private readonly context = 'LocationMediaService';

  /**
   * Sube un archivo a R2 y añade la URL al array correspondiente de LocationInfo.
   * Si LocationInfo no existe, lo crea con valores por defecto.
   */
  async uploadMedia(
    locationId: string,
    mediaType: MediaType,
    file: MediaUploadInput,
    userId: string,
    userRole: UserRole
  ): Promise<MediaUploadResult> {
    // Validar ubicación
    const location = await Location.findByPk(locationId);
    if (!location) {
      throw new LocationNotFoundError(locationId);
    }

    // Validar categoría
    const category = MEDIA_TYPE_TO_CATEGORY[mediaType];
    if (!category) {
      throw new LocationError(
        `Tipo de media inválido: "${mediaType}". Permitidos: images, documents, videos, maps`,
        'INVALID_MEDIA_TYPE',
        400
      );
    }

    const config = FILE_CONFIGS[category];

    // Validar rol contra la categoría
    if (!config.allowedRoles.includes(userRole)) {
      throw new LocationError(
        `Rol "${userRole}" no autorizado para subir ${mediaType} de ubicaciones`,
        'ROLE_NOT_ALLOWED',
        403
      );
    }

    // Validar MIME type
    if (!config.allowedTypes.includes(file.mimetype)) {
      throw new LocationError(
        `Tipo de archivo no permitido: ${file.mimetype}. Permitidos: ${config.allowedTypes.join(', ')}`,
        'INVALID_MIME_TYPE',
        400
      );
    }

    // Validar tamaño
    if (file.size > config.maxSize) {
      const maxMB = (config.maxSize / (1024 * 1024)).toFixed(0);
      const fileMB = (file.size / (1024 * 1024)).toFixed(1);
      throw new LocationError(
        `Archivo demasiado grande (${fileMB} MB). Máximo para ${mediaType}: ${maxMB} MB`,
        'FILE_TOO_LARGE',
        400
      );
    }

    const transaction = await sequelize.transaction();
    let uploadedStoragePath: string | null = null;

    try {
      // Subir a R2 (fuera de la transacción de BD en cuanto a disponibilidad,
      // pero trackeamos storagePath para rollback manual si falla la BD)
      const thumbnailConfig = config.thumbnailSizes?.[0];
      const thumbnail = thumbnailConfig
        ? { width: thumbnailConfig.width, height: thumbnailConfig.height, suffix: thumbnailConfig.name }
        : undefined;

      const uploadResult = await storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        category,
        thumbnail
      );

      uploadedStoragePath = uploadResult.storagePath;

      // Obtener o crear LocationInfo
      let info = await LocationInfo.findOne({
        where: { locationId },
        transaction,
      });

      if (!info) {
        info = await LocationInfo.create(
          {
            locationId,
            currentCondition: CurrentCondition.GOOD,
            notes: '',
            tags: [],
            images: [],
            documents: [],
            videos: [],
            maps: [],
            lastUpdated: new Date(),
            updatedBy: userId,
          } as any,
          { transaction }
        );
      }

      // Añadir URL al array correspondiente (evita duplicados)
      const currentUrls: string[] = (info as any)[mediaType] || [];
      if (!currentUrls.includes(uploadResult.url)) {
        (info as any)[mediaType] = [...currentUrls, uploadResult.url];
      }
      info.updatedBy = userId;
      info.lastUpdated = new Date();

      await info.save({ transaction });
      await transaction.commit();

      logger.info(
        `Media subida a ubicación ${locationId} (${mediaType}): ${uploadResult.storagePath}`,
        this.context,
        { locationId, mediaType, userId }
      );

      return {
        locationId,
        mediaType,
        url: uploadResult.url,
        storagePath: uploadResult.storagePath,
        thumbnailUrl: uploadResult.thumbnailUrl,
        originalName: uploadResult.originalName,
        mimeType: uploadResult.mimeType,
        size: uploadResult.size,
      };
    } catch (error) {
      await transaction.rollback();

      // Rollback manual: si el archivo ya se subió a R2 pero falló la BD, bórralo
      if (uploadedStoragePath) {
        try {
          await storageService.delete(uploadedStoragePath);
          logger.warn(
            `Rollback: archivo eliminado de R2 tras error en BD: ${uploadedStoragePath}`,
            this.context
          );
        } catch (cleanupError) {
          logger.error(
            `Rollback fallido: archivo huérfano en R2: ${uploadedStoragePath}`,
            this.context,
            { error: cleanupError }
          );
        }
      }

      logger.error(
        `Error subiendo media a ubicación ${locationId}`,
        this.context,
        { locationId, mediaType, userId },
        ensureError(error)
      );
      throw error;
    }
  }

  /**
   * Elimina un archivo de R2 y quita la URL del array correspondiente.
   * Si no se especifica mediaType, busca en todos los arrays.
   */
  async deleteMedia(
    locationId: string,
    storagePath: string,
    userId: string,
    mediaType?: MediaType
  ): Promise<{ removed: boolean; mediaType: MediaType | null }> {
    if (!storagePath) {
      throw new LocationError('storagePath es requerido', 'STORAGE_PATH_REQUIRED', 400);
    }

    const location = await Location.findByPk(locationId);
    if (!location) {
      throw new LocationNotFoundError(locationId);
    }

    const info = await LocationInfo.findOne({ where: { locationId } });
    if (!info) {
      throw new LocationError(
        `LocationInfo no encontrado para la ubicación ${locationId}`,
        'LOCATION_INFO_NOT_FOUND',
        404
      );
    }

    // Determinar en qué array está la URL
    const candidates: MediaType[] = mediaType
      ? [mediaType]
      : ['images', 'documents', 'videos', 'maps'];

    let foundType: MediaType | null = null;
    let foundUrl: string | null = null;

    for (const type of candidates) {
      const urls: string[] = (info as any)[type] || [];
      const match = urls.find((u) => u.endsWith(`/${storagePath}`) || u.includes(storagePath));
      if (match) {
        foundType = type;
        foundUrl = match;
        break;
      }
    }

    if (!foundType || !foundUrl) {
      throw new LocationError(
        `Archivo "${storagePath}" no está registrado en la ubicación ${locationId}`,
        'MEDIA_NOT_FOUND',
        404
      );
    }

    const transaction = await sequelize.transaction();
    try {
      // Quitar URL del array
      const currentUrls: string[] = (info as any)[foundType] || [];
      (info as any)[foundType] = currentUrls.filter((u) => u !== foundUrl);
      info.updatedBy = userId;
      info.lastUpdated = new Date();

      await info.save({ transaction });

      // Borrar de R2 (best-effort: si falla, la BD ya quitó la URL)
      try {
        await storageService.delete(storagePath);
      } catch (r2Error) {
        logger.warn(
          `URL removida de BD pero no se pudo eliminar de R2: ${storagePath}`,
          this.context,
          { error: r2Error }
        );
      }

      await transaction.commit();

      logger.info(
        `Media eliminada de ubicación ${locationId} (${foundType}): ${storagePath}`,
        this.context,
        { locationId, mediaType: foundType, userId }
      );

      return { removed: true, mediaType: foundType };
    } catch (error) {
      await transaction.rollback();
      logger.error(
        `Error eliminando media de ubicación ${locationId}`,
        this.context,
        { locationId, storagePath, userId },
        ensureError(error)
      );
      throw error;
    }
  }

  /**
   * Lista todos los archivos multimedia asociados a una ubicación.
   */
  async listMedia(locationId: string): Promise<MediaListResult> {
    const location = await Location.findByPk(locationId);
    if (!location) {
      throw new LocationNotFoundError(locationId);
    }

    const info = await LocationInfo.findOne({ where: { locationId } });

    const images = info?.images || [];
    const documents = info?.documents || [];
    const videos = info?.videos || [];
    const maps = info?.maps || [];

    return {
      locationId,
      images,
      documents,
      videos,
      maps,
      totals: {
        images: images.length,
        documents: documents.length,
        videos: videos.length,
        maps: maps.length,
        all: images.length + documents.length + videos.length + maps.length,
      },
    };
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const locationMediaService = new LocationMediaService();
