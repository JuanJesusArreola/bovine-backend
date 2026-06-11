// services/StorageService.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import path from 'path';
import sharp from 'sharp';
import logger from '../utils/logger';

/**
 * ============================================================================
 * STORAGE SERVICE — Cloudflare R2
 * ============================================================================
 *
 * Servicio de almacenamiento de archivos usando Cloudflare R2 (API compatible con S3).
 * Maneja la subida, eliminación y generación de thumbnails de archivos.
 *
 * Configuración requerida en .env:
 *   R2_ACCOUNT_ID        — ID de cuenta de Cloudflare
 *   R2_ACCESS_KEY_ID     — Access Key del token R2
 *   R2_SECRET_ACCESS_KEY — Secret Key del token R2
 *   R2_BUCKET_NAME       — Nombre del bucket (ej: bovino-media)
 *   R2_PUBLIC_URL        — URL pública del bucket (ej: https://pub-xxxx.r2.dev)
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface UploadResult {
  url: string;              // URL pública completa del archivo
  storagePath: string;      // Key dentro del bucket (para operaciones futuras)
  originalName: string;     // Nombre original del archivo
  mimeType: string;         // Tipo MIME
  size: number;             // Tamaño en bytes
  thumbnailUrl?: string;    // URL del thumbnail (si es imagen y se generó)
}

export interface FileInput {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface ThumbnailOptions {
  width: number;
  height: number;
  suffix: string;           // ej: "small", "medium", "large"
}

// ============================================================================
// SERVICIO
// ============================================================================

export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly context = 'StorageService';

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      logger.warn(
        'Variables de R2 no configuradas. El servicio de storage no funcionará hasta que se configuren.',
        this.context
      );
    }

    this.client = new S3Client({
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });

    this.bucket = process.env.R2_BUCKET_NAME || 'bovino-media';
    this.publicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, ''); // sin trailing slash
  }

  // ==========================================================================
  // UPLOAD
  // ==========================================================================

  /**
   * Sube un archivo a Cloudflare R2.
   *
   * @param file       - Objeto con buffer, originalname, mimetype y size (de multer memoryStorage)
   * @param folder     - Carpeta/categoría dentro del bucket (ej: "cattle_photos", "health_reports")
   * @param thumbnail  - Opciones de thumbnail (solo para imágenes). Si se omite, no genera thumbnail.
   * @returns          - UploadResult con URL pública, storagePath, y metadata
   */
  async upload(file: FileInput, folder: string, thumbnail?: ThumbnailOptions): Promise<UploadResult> {
    const key = this.generateKey(file.originalname, folder);

    // Subir archivo original
    await this.putObject(key, file.buffer, file.mimetype);

    const url = `${this.publicUrl}/${key}`;

    logger.info(`Archivo subido: ${key} (${this.formatSize(file.size)})`, this.context);

    // Generar y subir thumbnail si se solicita y es imagen
    let thumbnailUrl: string | undefined;
    if (thumbnail && this.isImage(file.mimetype)) {
      thumbnailUrl = await this.generateAndUploadThumbnail(file.buffer, key, thumbnail);
    }

    return {
      url,
      storagePath: key,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      thumbnailUrl,
    };
  }

  // ==========================================================================
  // DELETE
  // ==========================================================================

  /**
   * Elimina un archivo de R2 por su storagePath (key).
   * También intenta eliminar el thumbnail asociado si existe.
   */
  async delete(storagePath: string): Promise<void> {
    try {
      // Eliminar archivo original
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      }));

      // Intentar eliminar thumbnail (puede no existir)
      const thumbnailKey = this.getThumbnailKey(storagePath, 'small');
      try {
        await this.client.send(new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: thumbnailKey,
        }));
      } catch {
        // Thumbnail no existía, no es error
      }

      logger.info(`Archivo eliminado: ${storagePath}`, this.context);
    } catch (error) {
      logger.error(`Error eliminando archivo: ${storagePath}`, this.context, { error });
      throw new Error(`No se pudo eliminar el archivo: ${storagePath}`);
    }
  }

  // ==========================================================================
  // EXISTS
  // ==========================================================================

  /**
   * Verifica si un archivo existe en R2.
   */
  async exists(storagePath: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      }));
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // THUMBNAIL
  // ==========================================================================

  /**
   * Genera un thumbnail con Sharp y lo sube a R2.
   * Retorna la URL pública del thumbnail.
   */
  private async generateAndUploadThumbnail(
    originalBuffer: Buffer,
    originalKey: string,
    options: ThumbnailOptions
  ): Promise<string> {
    try {
      const thumbnailBuffer = await sharp(originalBuffer)
        .resize(options.width, options.height, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbnailKey = this.getThumbnailKey(originalKey, options.suffix);

      await this.putObject(thumbnailKey, thumbnailBuffer, 'image/jpeg');

      logger.info(`Thumbnail generado: ${thumbnailKey}`, this.context);

      return `${this.publicUrl}/${thumbnailKey}`;
    } catch (error) {
      logger.warn(`No se pudo generar thumbnail para ${originalKey}`, this.context, { error });
      return '';
    }
  }

  // ==========================================================================
  // HELPERS PRIVADOS
  // ==========================================================================

  /**
   * Ejecuta PutObjectCommand contra R2.
   */
  private async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
  }

  /**
   * Genera un key único organizado por carpeta/año/mes/uuid.ext
   * Ejemplo: "cattle_photos/2026/04/a1b2c3d4e5f6.jpg"
   */
  private generateKey(originalName: string, folder: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uuid = crypto.randomUUID();
    const ext = path.extname(originalName).toLowerCase() || '.bin';

    return `${folder}/${year}/${month}/${uuid}${ext}`;
  }

  /**
   * Genera el key del thumbnail a partir del key original.
   * Ejemplo: "cattle_photos/2026/04/uuid.jpg" → "cattle_photos/2026/04/uuid-small.jpg"
   */
  private getThumbnailKey(originalKey: string, suffix: string): string {
    const ext = path.extname(originalKey);
    const base = originalKey.slice(0, -ext.length);
    return `${base}-${suffix}.jpg`;
  }

  /**
   * Verifica si un MIME type corresponde a una imagen.
   */
  private isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Formatea bytes a string legible (ej: "2.5 MB").
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
