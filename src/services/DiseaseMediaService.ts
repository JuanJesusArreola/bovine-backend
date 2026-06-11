// services/DiseaseMediaService.ts
// ============================================================================
// DISEASE MEDIA SERVICE
// ============================================================================
// CRUD de imágenes/videos asociados a enfermedades bovinas.
//
// Flujos de carga:
//   1. Upload R2 (multipart/form-data, memoryStorage) — el buffer se envía
//      a Cloudflare R2 via StorageService. Se genera thumbnail automático
//      para imágenes. storagePath se persiste en BD para eliminación futura.
//
//   2. URL externa — el cliente envía { externalUrl: "https://..." } y el
//      servicio lo guarda directamente sin interactuar con R2.
//
// Invalidación de cache: al crear/modificar/eliminar se invalidan las entradas
// del DiseaseService para que el catálogo refleje los cambios.
// ============================================================================

import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';

import DiseaseMedia, {
  DiseaseMedia_Attributes,
  DiseaseMediaType,
} from '../models/DiseaseMedia';
import Disease from '../models/Disease';
import Symptom from '../models/Symptom';
import { cacheService } from './CacheService';
import { storageService } from '../container';
import { FileCategory, FILE_CONFIGS } from '../middleware/upload';

// ============================================================================
// DTOs
// ============================================================================

export interface CreateMediaFromUploadDTO {
  diseaseId:     string;
  symptomId?:    string;
  title?:        string;
  description?:  string;
  isReference?:  boolean;
  source?:       string;
  displayOrder?: number;
  uploadedBy?:   string;
  // Proporcionados por multer memoryStorage:
  buffer:        Buffer;
  originalname:  string;
  mimeType:      string;
  sizeBytes:     number;
}

export interface CreateMediaFromUrlDTO {
  diseaseId:     string;
  symptomId?:    string;
  externalUrl:   string;
  thumbnailUrl?: string;
  title?:        string;
  description?:  string;
  mediaType?:    DiseaseMediaType;
  mimeType?:     string;
  isReference?:  boolean;
  source?:       string;
  displayOrder?: number;
  uploadedBy?:   string;
}

export interface UpdateMediaDTO {
  title?:        string;
  description?:  string;
  displayOrder?: number;
  isReference?:  boolean;
  source?:       string;
  symptomId?:    string | null;
}

export interface MediaItem {
  id:           string;
  diseaseId:    string;
  symptomId:    string | null;
  symptomName:  string | null;
  url:          string;
  storagePath:  string | null;
  thumbnailUrl: string | null;
  title:        string | null;
  description:  string | null;
  mediaType:    DiseaseMediaType;
  mimeType:     string | null;
  sizeBytes:    number | null;
  displayOrder: number;
  isReference:  boolean;
  source:       string | null;
  createdAt:    Date;
}

// ============================================================================
// CONSTANTES
// ============================================================================

const DISEASE_MEDIA_FOLDER = FileCategory.DISEASE_MEDIA; // 'disease_media'
const DISEASE_MEDIA_CONFIG = FILE_CONFIGS[FileCategory.DISEASE_MEDIA];

// ============================================================================
// SERVICIO
// ============================================================================

export class DiseaseMediaService {
  private readonly context = 'DiseaseMediaService';

  // --------------------------------------------------------------------------
  // createFromUpload  (buffer → Cloudflare R2)
  // --------------------------------------------------------------------------

  async createFromUpload(dto: CreateMediaFromUploadDTO): Promise<MediaItem> {
    await this.assertDiseaseExists(dto.diseaseId);

    // Validar MIME y tamaño contra la config del FileCategory
    this.validateFile(dto.mimeType, dto.sizeBytes);

    const isImage = dto.mimeType.startsWith('image/');
    const mediaType = isImage ? DiseaseMediaType.IMAGE : DiseaseMediaType.VIDEO;

    // Thumbnail solo para imágenes
    const thumbConfig = DISEASE_MEDIA_CONFIG.thumbnailSizes?.[0];
    const thumbnail = isImage && thumbConfig
      ? { width: thumbConfig.width, height: thumbConfig.height, suffix: thumbConfig.name }
      : undefined;

    // Subir a R2
    const uploadResult = await storageService.upload(
      {
        buffer:       dto.buffer,
        originalname: dto.originalname,
        mimetype:     dto.mimeType,
        size:         dto.sizeBytes,
      },
      DISEASE_MEDIA_FOLDER,
      thumbnail
    );

    let record: DiseaseMedia;
    try {
      record = await DiseaseMedia.create({
        diseaseId:    dto.diseaseId,
        symptomId:    dto.symptomId,
        url:          uploadResult.url,
        storagePath:  uploadResult.storagePath,
        thumbnailUrl: uploadResult.thumbnailUrl ?? undefined,
        mediaType,
        mimeType:     dto.mimeType,
        sizeBytes:    dto.sizeBytes,
        title:        dto.title,
        description:  dto.description,
        isReference:  dto.isReference ?? false,
        source:       dto.source,
        displayOrder: dto.displayOrder ?? 0,
        uploadedBy:   dto.uploadedBy,
      });
    } catch (dbError) {
      // Rollback best-effort: eliminar de R2 si la BD falla
      try {
        await storageService.delete(uploadResult.storagePath);
      } catch (r2Error) {
        logger.warn('No se pudo eliminar el archivo de R2 tras fallo de BD', this.context, {
          storagePath: uploadResult.storagePath,
        });
      }
      logger.error('Error creando media desde upload', this.context, { diseaseId: dto.diseaseId }, ensureError(dbError));
      throw dbError;
    }

    await this.invalidateDiseaseCache(dto.diseaseId);

    logger.info(`Media creado en R2: ${record.id}`, this.context, {
      diseaseId: dto.diseaseId,
      storagePath: uploadResult.storagePath,
    });

    return this.toItem(record, null);
  }

  // --------------------------------------------------------------------------
  // createFromUrl  (URL externa, sin R2)
  // --------------------------------------------------------------------------

  async createFromUrl(dto: CreateMediaFromUrlDTO): Promise<MediaItem> {
    try {
      await this.assertDiseaseExists(dto.diseaseId);

      const isVideo = dto.mimeType?.startsWith('video/');
      const mediaType = dto.mediaType
        ?? (isVideo ? DiseaseMediaType.VIDEO : DiseaseMediaType.IMAGE);

      const record = await DiseaseMedia.create({
        diseaseId:    dto.diseaseId,
        symptomId:    dto.symptomId,
        url:          dto.externalUrl,
        storagePath:  undefined,  // null — URL externa, no tiene key en R2
        thumbnailUrl: dto.thumbnailUrl,
        mediaType,
        mimeType:     dto.mimeType,
        title:        dto.title,
        description:  dto.description,
        isReference:  dto.isReference ?? false,
        source:       dto.source,
        displayOrder: dto.displayOrder ?? 0,
        uploadedBy:   dto.uploadedBy,
      });

      await this.invalidateDiseaseCache(dto.diseaseId);

      logger.info(`Media creado por URL: ${record.id}`, this.context, {
        diseaseId: dto.diseaseId,
        url: dto.externalUrl,
      });

      return this.toItem(record, null);
    } catch (error) {
      logger.error('Error creando media desde URL', this.context, { diseaseId: dto.diseaseId }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // getByDisease
  // --------------------------------------------------------------------------

  async getByDisease(diseaseId: string): Promise<MediaItem[]> {
    try {
      const rows = await DiseaseMedia.findAll({
        where: { diseaseId },
        include: [
          {
            model: Symptom,
            as: 'symptom',
            attributes: ['id', 'name'],
            required: false,
          },
        ],
        order: [
          ['displayOrder', 'ASC'],
          ['created_at',   'ASC'],
        ],
      });

      return rows.map((r) => {
        const sym = (r as any).symptom ?? null;
        return this.toItem(r, sym?.name ?? null);
      });
    } catch (error) {
      logger.error('Error obteniendo media de enfermedad', this.context, { diseaseId }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // update  (solo metadatos — para reemplazar el archivo hay que borrar y subir)
  // --------------------------------------------------------------------------

  async update(mediaId: string, dto: UpdateMediaDTO): Promise<MediaItem> {
    try {
      const record = await DiseaseMedia.findByPk(mediaId, {
        include: [{ model: Symptom, as: 'symptom', attributes: ['id', 'name'], required: false }],
      });
      if (!record) throw new Error(`Media no encontrado: ${mediaId}`);

      const updateData: Partial<DiseaseMedia_Attributes> = {};
      if (dto.title        !== undefined) updateData.title        = dto.title;
      if (dto.description  !== undefined) updateData.description  = dto.description;
      if (dto.displayOrder !== undefined) updateData.displayOrder = dto.displayOrder;
      if (dto.isReference  !== undefined) updateData.isReference  = dto.isReference;
      if (dto.source       !== undefined) updateData.source       = dto.source ?? undefined;
      if (dto.symptomId    !== undefined) updateData.symptomId    = dto.symptomId ?? undefined;

      await record.update(updateData);
      await this.invalidateDiseaseCache(record.diseaseId);

      const sym = (record as any).symptom ?? null;
      return this.toItem(record, sym?.name ?? null);
    } catch (error) {
      logger.error('Error actualizando media', this.context, { mediaId }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // remove  (soft delete + eliminar de R2 si aplica)
  // --------------------------------------------------------------------------

  async remove(mediaId: string): Promise<void> {
    try {
      const record = await DiseaseMedia.findByPk(mediaId);
      if (!record) throw new Error(`Media no encontrado: ${mediaId}`);

      const { diseaseId, storagePath } = record;

      // Eliminar de R2 solo si tiene storagePath (uploads, no URLs externas)
      if (storagePath) {
        try {
          await storageService.delete(storagePath);
          logger.debug(`Archivo eliminado de R2: ${storagePath}`, this.context);
        } catch (r2Error) {
          // No bloquear la eliminación del registro si R2 falla
          logger.warn(`No se pudo eliminar de R2: ${storagePath}`, this.context, { storagePath });
        }
      }

      await record.destroy();
      await this.invalidateDiseaseCache(diseaseId);

      logger.info(`Media eliminado: ${mediaId}`, this.context, { diseaseId });
    } catch (error) {
      logger.error('Error eliminando media', this.context, { mediaId }, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // HELPERS PRIVADOS
  // ==========================================================================

  private validateFile(mimeType: string, sizeBytes: number): void {
    if (!DISEASE_MEDIA_CONFIG.allowedTypes.includes(mimeType)) {
      throw new Error(
        `Tipo de archivo no permitido: ${mimeType}. Permitidos: ${DISEASE_MEDIA_CONFIG.allowedTypes.join(', ')}`
      );
    }
    if (sizeBytes > DISEASE_MEDIA_CONFIG.maxSize) {
      const maxMB = (DISEASE_MEDIA_CONFIG.maxSize / (1024 * 1024)).toFixed(0);
      throw new Error(`El archivo supera el tamaño máximo de ${maxMB} MB`);
    }
  }

  private async assertDiseaseExists(diseaseId: string): Promise<void> {
    const exists = await Disease.findByPk(diseaseId, { attributes: ['id'] });
    if (!exists) throw new Error(`Enfermedad no encontrada: ${diseaseId}`);
  }

  private async invalidateDiseaseCache(diseaseId: string): Promise<void> {
    await Promise.all([
      cacheService.del('disease:catalog:all'),
      cacheService.del('disease:catalog:with-symptoms-v2'),
      cacheService.del(`disease:detail:${diseaseId}`),
    ]);
  }

  private toItem(record: DiseaseMedia, symptomName: string | null): MediaItem {
    return {
      id:           record.id,
      diseaseId:    record.diseaseId,
      symptomId:    record.symptomId   ?? null,
      symptomName,
      url:          record.url,
      storagePath:  record.storagePath ?? null,
      thumbnailUrl: record.thumbnailUrl ?? null,
      title:        record.title        ?? null,
      description:  record.description  ?? null,
      mediaType:    record.mediaType,
      mimeType:     record.mimeType     ?? null,
      sizeBytes:    record.sizeBytes    ?? null,
      displayOrder: record.displayOrder,
      isReference:  record.isReference,
      source:       record.source       ?? null,
      createdAt:    record.createdAt,
    };
  }
}

export const diseaseMediaService = new DiseaseMediaService();
