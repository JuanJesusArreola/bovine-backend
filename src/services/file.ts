// src/services/file/FileService.ts
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { 
  FileCategory, 
  FILE_CONFIGS, 
  calculateChecksums 
} from '../middleware/upload';
import logger from '../utils/logger';

// Interfaces locales necesarias (sin duplicar las del middleware)
interface FileThumbnail {
  size: string;
  width: number;
  height: number;
  url: string;
  filePath: string;
}

interface FileMetadata {
  width?: number;
  height?: number;
  format?: string;
  colorSpace?: string;
  // Otros campos opcionales según necesidad
}

/**
 * Servicio para manejar el almacenamiento físico de archivos,
 * generación de thumbnails, cálculos de checksums y URLs públicas.
 * No guarda metadatos en base de datos – esa responsabilidad es de los servicios
 * que lo invocan (ej. RanchManagementService).
 */
export class FileService {
  private uploadPath: string;
  private baseUrl: string;

  constructor(uploadPath?: string, baseUrl?: string) {
    this.uploadPath = uploadPath || process.env.UPLOAD_PATH || './uploads';
    this.baseUrl = baseUrl || process.env.API_BASE_URL || 'http://localhost:3001';
  }

  /**
   * Asegura que un directorio existe (crea recursivamente si no existe).
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      logger.error(`Error creando directorio ${dirPath}`, 'FileService', { dirPath, error });
      throw new Error(`No se pudo crear el directorio: ${dirPath}`);
    }
  }

  /**
   * Formatea el tamaño en bytes a una cadena legible (ej. "2.5 MB").
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  }

  /**
   * Procesa un archivo que ya ha sido guardado en disco (por Multer).
   * Calcula checksums, genera thumbnails (si es imagen y se solicita),
   * extrae metadatos básicos y devuelve la información necesaria para
   * crear el registro en la base de datos.
   *
   * @param filePath - Ruta absoluta del archivo en disco
   * @param originalName - Nombre original del archivo
   * @param mimeType - Tipo MIME del archivo
   * @param category - Categoría del archivo (según FILE_CONFIGS)
   * @param userId - ID del usuario que sube el archivo
   * @param options - Opciones adicionales (generar thumbnails)
   * @returns Metadatos procesados y URLs
   */
  async processUploadedFile(
    filePath: string,
    originalName: string,
    mimeType: string,
    category: FileCategory,
    userId: string,
    options?: { generateThumbnails?: boolean }
  ): Promise<{
    fileId: string;
    url: string;
    thumbnails?: FileThumbnail[];
    size: number;
    mimeType: string;
    originalName: string;
    filename: string;
    checksums: { md5: string; sha256: string };
    metadata?: FileMetadata;
  }> {
    // 1. Validar que la categoría existe
    const config = FILE_CONFIGS[category];
    if (!config) {
      throw new Error(`Categoría inválida: ${category}`);
    }

    // 2. Validar tamaño del archivo
    const stats = await fs.stat(filePath);
    if (stats.size > config.maxSize) {
      throw new Error(
        `Archivo demasiado grande. Máximo permitido: ${this.formatFileSize(config.maxSize)}`
      );
    }

    // 3. Calcular checksums usando la función del middleware
    const checksums = await calculateChecksums(filePath);

    // 4. Generar thumbnails si es imagen y se solicita
    let thumbnails: FileThumbnail[] = [];
    if (options?.generateThumbnails && mimeType.startsWith('image/') && config.thumbnailSizes) {
      const thumbnailsDir = path.join(this.uploadPath, 'thumbnails', category);
      await this.ensureDirectoryExists(thumbnailsDir);

      const filename = path.basename(filePath);
      const baseName = path.parse(filename).name;

      for (const size of config.thumbnailSizes) {
        const thumbFileName = `${baseName}_${size.name}.jpg`;
        const thumbPath = path.join(thumbnailsDir, thumbFileName);
        await sharp(filePath)
          .resize(size.width, size.height, { fit: 'inside' })
          .toFile(thumbPath);

        thumbnails.push({
          size: size.name,
          width: size.width,
          height: size.height,
          url: `${this.baseUrl}/files/thumbnails/${category}/${thumbFileName}`,
          filePath: thumbPath,
        });
      }
    }

    // 5. Extraer metadatos básicos (solo para imágenes)
    let metadata: FileMetadata | undefined;
    if (mimeType.startsWith('image/')) {
      const image = sharp(filePath);
      const meta = await image.metadata();
      metadata = {
        width: meta.width,
        height: meta.height,
        format: meta.format,
        colorSpace: meta.space,
      };
    }

    // 6. Generar URL pública del archivo original
    const filename = path.basename(filePath);
    const url = `${this.baseUrl}/files/${category}/${filename}`;

    // 7. Devolver la información necesaria
    return {
      fileId: filename, // Podría ser un UUID si se prefiere
      url,
      thumbnails,
      size: stats.size,
      mimeType,
      originalName,
      filename,
      checksums,
      metadata,
    };
  }

  /**
   * Elimina un archivo físico del sistema de archivos, junto con sus thumbnails.
   * @param filePath - Ruta absoluta del archivo a eliminar
   * @param category - Categoría del archivo (necesaria para localizar thumbnails)
   */
  async deleteFile(filePath: string, category?: FileCategory): Promise<void> {
    try {
      // Eliminar archivo principal
      await fs.unlink(filePath);
      logger.info(`Archivo eliminado: ${filePath}`, 'FileService');

      // Si se proporcionó categoría, eliminar thumbnails asociados
      if (category) {
        const thumbnailsDir = path.join(this.uploadPath, 'thumbnails', category);
        const baseName = path.parse(filePath).name;
        try {
          const files = await fs.readdir(thumbnailsDir);
          for (const file of files) {
            if (file.startsWith(baseName)) {
              await fs.unlink(path.join(thumbnailsDir, file));
            }
          }
        } catch (err) {
          // Si el directorio no existe, ignoramos
          logger.debug(`No se encontraron thumbnails para eliminar en ${thumbnailsDir}`, 'FileService');
        }
      }
    } catch (error) {
      logger.warn(`Error eliminando archivo ${filePath}: ${error}`, 'FileService', { error });
    }
  }
}