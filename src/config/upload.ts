// ============================================================================
// UPLOAD.TS - CONFIGURACIÓN DE MULTER PARA MANEJO DE ARCHIVOS
// ============================================================================
// Configuración para subida de archivos, incluyendo imágenes de ganado,
// documentos veterinarios, reportes y archivos de geolocalización

import path from 'path';
import fs from 'fs';

// Tipos básicos para cuando Express no esté disponible
interface BasicRequest {
  body?: any;
  params?: any;
  query?: any;
  headers?: any;
  file?: any;
  files?: any;
}

interface BasicFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

// Importaciones condicionales para evitar errores antes de instalar dependencias
let multer: any;
let sharp: any;

try {
  multer = require('multer');
  sharp = require('sharp');
} catch (error) {
  console.warn('⚠️  Dependencias de upload no instaladas aún. Ejecuta: npm install multer sharp @types/multer');
}

// ============================================================================
// INTERFACES Y TIPOS
// ============================================================================

interface UploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  uploadPath: string;
  maxFiles: number;
}

interface FileTypeConfig {
  [key: string]: UploadConfig;
}

interface UploadedFileInfo {
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
  url: string;
  fieldname: string;
  uploadType: string;
}

interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  resize?: boolean;
}

// ============================================================================
// CONFIGURACIÓN DE TIPOS DE ARCHIVO
// ============================================================================

// Configuración por tipo de archivo
const fileTypeConfigs: FileTypeConfig = {
  // Imágenes de bovinos/ganado
  cattle_images: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    ],
    uploadPath: 'uploads/cattle/images',
    maxFiles: 10
  },

  // Documentos veterinarios
  veterinary_docs: {
    maxFileSize: 25 * 1024 * 1024, // 25MB
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    uploadPath: 'uploads/veterinary/documents',
    maxFiles: 5
  },

  // Reportes y certificados
  reports: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/json'
    ],
    uploadPath: 'uploads/reports',
    maxFiles: 3
  },

  // Archivos de importación de datos
  data_import: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedMimeTypes: [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json',
      'text/plain'
    ],
    uploadPath: 'uploads/imports',
    maxFiles: 1
  },

  // Imágenes de ubicaciones/mapas
  location_images: {
    maxFileSize: 15 * 1024 * 1024, // 15MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ],
    uploadPath: 'uploads/locations/images',
    maxFiles: 8
  },

  // Documentos legales y contratos
  legal_docs: {
    maxFileSize: 30 * 1024 * 1024, // 30MB
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ],
    uploadPath: 'uploads/legal/documents',
    maxFiles: 5
  },

  // Avatares de usuarios
  user_avatars: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ],
    uploadPath: 'uploads/users/avatars',
    maxFiles: 1
  }
};

// ============================================================================
// CONFIGURACIÓN DE MULTER
// ============================================================================

/**
 * Crea el directorio de subida si no existe
 * @param uploadPath - Ruta del directorio
 */
const ensureUploadDirectory = (uploadPath: string): void => {
  try {
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log(`📁 Directorio de subida creado: ${uploadPath}`);
    }
  } catch (error) {
    console.error(`❌ Error creando directorio ${uploadPath}:`, error);
  }
};

/**
 * Genera un nombre único para el archivo
 * @param originalName - Nombre original del archivo
 * @param uploadType - Tipo de subida
 * @returns string - Nombre único generado
 */
const generateUniqueFilename = (originalName: string, uploadType: string): string => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, extension).replace(/[^a-zA-Z0-9]/g, '_');
  
  return `${uploadType}_${timestamp}_${randomString}_${baseName}${extension}`;
};

/**
 * Crea configuración de storage para multer
 * @param uploadType - Tipo de archivo a subir
 * @returns multer.StorageEngine - Configuración de storage
 */
const createStorageConfig = (uploadType: string) => {
  if (!multer) {
    throw new Error('Multer not available');
  }

  const config = fileTypeConfigs[uploadType];
  if (!config) {
    throw new Error(`Configuración no encontrada para tipo: ${uploadType}`);
  }

  return multer.diskStorage({
    destination: (req: BasicRequest, file: BasicFile, cb: Function) => {
      ensureUploadDirectory(config.uploadPath);
      cb(null, config.uploadPath);
    },
    filename: (req: BasicRequest, file: BasicFile, cb: Function) => {
      const uniqueName = generateUniqueFilename(file.originalname, uploadType);
      cb(null, uniqueName);
    }
  });
};

/**
 * Filtro para validar tipos de archivo
 * @param uploadType - Tipo de archivo permitido
 * @returns Function - Función de filtro
 */
const createFileFilter = (uploadType: string) => {
  const config = fileTypeConfigs[uploadType];
  
  return (req: BasicRequest, file: BasicFile, cb: Function) => {
    // Validar tipo MIME
    if (config.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error(`Tipo de archivo no permitido: ${file.mimetype}. Tipos permitidos: ${config.allowedMimeTypes.join(', ')}`);
      error.name = 'INVALID_FILE_TYPE';
      cb(error, false);
    }
  };
};

/**
 * Crea middleware de multer para un tipo específico
 * @param uploadType - Tipo de archivo
 * @param fieldName - Nombre del campo en el formulario
 * @param multiple - Si permite múltiples archivos
 * @returns Function - Middleware de multer
 */
export const createUploadMiddleware = (uploadType: string, fieldName: string = 'file', multiple: boolean = false) => {
  if (!multer) {
    // Mock middleware si multer no está disponible
    return (req: any, res: any, next: any) => {
      console.warn('⚠️  Upload middleware not available - dependencies not installed');
      next();
    };
  }

  const config = fileTypeConfigs[uploadType];
  if (!config) {
    throw new Error(`Configuración no encontrada para tipo: ${uploadType}`);
  }

  const upload = multer({
    storage: createStorageConfig(uploadType),
    fileFilter: createFileFilter(uploadType),
    limits: {
      fileSize: config.maxFileSize,
      files: config.maxFiles
    }
  });

  return multiple ? upload.array(fieldName, config.maxFiles) : upload.single(fieldName);
};

// ============================================================================
// FUNCIONES DE PROCESAMIENTO DE IMÁGENES
// ============================================================================

/**
 * Procesa y optimiza imágenes subidas
 * @param filePath - Ruta del archivo
 * @param options - Opciones de procesamiento
 * @returns Promise<string> - Ruta del archivo procesado
 */
export const processImage = async (filePath: string, options: ImageProcessingOptions = {}): Promise<string> => {
  if (!sharp) {
    console.warn('⚠️  Sharp not available - returning original file');
    return filePath;
  }

  try {
    const {
      width = 1920,
      height = 1080,
      quality = 85,
      format = 'jpeg',
      resize = true
    } = options;

    const parsedPath = path.parse(filePath);
    const outputPath = path.join(parsedPath.dir, `${parsedPath.name}_processed.${format}`);

    let sharpInstance = sharp(filePath);

    // Redimensionar si es necesario
    if (resize) {
      sharpInstance = sharpInstance.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convertir formato y optimizar
    switch (format) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality, progressive: true });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ quality, progressive: true });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality });
        break;
    }

    await sharpInstance.toFile(outputPath);

    // Eliminar archivo original si el procesamiento fue exitoso
    fs.unlinkSync(filePath);

    console.log(`✅ Imagen procesada: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('❌ Error procesando imagen:', error);
    return filePath; // Devolver archivo original si hay error
  }
};

/**
 * Crea thumbnails para imágenes
 * @param filePath - Ruta del archivo original
 * @param sizes - Tamaños de thumbnails a generar
 * @returns Promise<string[]> - Rutas de los thumbnails generados
 */
export const createThumbnails = async (filePath: string, sizes: number[] = [150, 300, 600]): Promise<string[]> => {
  if (!sharp) {
    console.warn('⚠️  Sharp not available - cannot create thumbnails');
    return [];
  }

  const thumbnails: string[] = [];
  const parsedPath = path.parse(filePath);

  try {
    for (const size of sizes) {
      const thumbnailPath = path.join(parsedPath.dir, `${parsedPath.name}_thumb_${size}x${size}.jpeg`);
      
      await sharp(filePath)
        .resize(size, size, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      thumbnails.push(thumbnailPath);
    }

    console.log(`✅ Thumbnails creados: ${thumbnails.length}`);
    return thumbnails;
  } catch (error) {
    console.error('❌ Error creando thumbnails:', error);
    return [];
  }
};

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

/**
 * Obtiene información de configuración para un tipo de archivo
 * @param uploadType - Tipo de archivo
 * @returns UploadConfig - Configuración del tipo
 */
export const getUploadConfig = (uploadType: string): UploadConfig => {
  const config = fileTypeConfigs[uploadType];
  if (!config) {
    throw new Error(`Configuración no encontrada para tipo: ${uploadType}`);
  }
  return config;
};

/**
 * Valida si un archivo cumple con los requisitos
 * @param file - Información del archivo
 * @param uploadType - Tipo de subida
 * @returns object - Resultado de la validación
 */
export const validateFile = (file: BasicFile, uploadType: string): { isValid: boolean; errors: string[] } => {
  const config = fileTypeConfigs[uploadType];
  const errors: string[] = [];

  if (!config) {
    errors.push(`Tipo de subida no válido: ${uploadType}`);
    return { isValid: false, errors };
  }

  // Validar tamaño
  if (file.size > config.maxFileSize) {
    errors.push(`Archivo demasiado grande. Máximo: ${(config.maxFileSize / 1024 / 1024).toFixed(1)}MB`);
  }

  // Validar tipo MIME
  if (!config.allowedMimeTypes.includes(file.mimetype)) {
    errors.push(`Tipo de archivo no permitido: ${file.mimetype}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Elimina un archivo del sistema
 * @param filePath - Ruta del archivo a eliminar
 * @returns boolean - true si se eliminó exitosamente
 */
export const deleteFile = (filePath: string): boolean => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Archivo eliminado: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error eliminando archivo ${filePath}:`, error);
    return false;
  }
};

/**
 * Obtiene la URL pública de un archivo
 * @param filePath - Ruta del archivo
 * @returns string - URL pública del archivo
 */
export const getFileUrl = (filePath: string): string => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:8000';
  const relativePath = filePath.replace(/^uploads\//, '');
  return `${baseUrl}/uploads/${relativePath}`;
};

/**
 * Obtiene estadísticas de uso de almacenamiento
 * @returns object - Estadísticas de almacenamiento
 */
export const getStorageStats = (): { totalSize: number; fileCount: number; byType: { [key: string]: { size: number; count: number } } } => {
  const stats = {
    totalSize: 0,
    fileCount: 0,
    byType: {} as { [key: string]: { size: number; count: number } }
  };

  try {
    Object.keys(fileTypeConfigs).forEach(uploadType => {
      const config = fileTypeConfigs[uploadType];
      const uploadPath = config.uploadPath;
      
      if (fs.existsSync(uploadPath)) {
        const files = fs.readdirSync(uploadPath);
        let typeSize = 0;
        let typeCount = 0;

        files.forEach(file => {
          const filePath = path.join(uploadPath, file);
          const fileStat = fs.statSync(filePath);
          if (fileStat.isFile()) {
            typeSize += fileStat.size;
            typeCount++;
          }
        });

        stats.byType[uploadType] = { size: typeSize, count: typeCount };
        stats.totalSize += typeSize;
        stats.fileCount += typeCount;
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de almacenamiento:', error);
  }

  return stats;
};

// ============================================================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ============================================================================

/**
 * Middleware para manejar errores de subida
 * @param error - Error de multer
 * @param req - Request object
 * @param res - Response object
 * @param next - Next function
 */
export const uploadErrorHandler = (error: any, req: any, res: any, next: any) => {
  if (error instanceof multer?.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          error: 'Archivo demasiado grande',
          message: 'El tamaño del archivo excede el límite permitido'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: 'Demasiados archivos',
          message: 'Se excedió el número máximo de archivos permitidos'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: 'Campo de archivo inesperado',
          message: 'El campo de archivo no es válido'
        });
      default:
        return res.status(400).json({
          error: 'Error de subida',
          message: error.message
        });
    }
  }

  if (error.name === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      error: 'Tipo de archivo no válido',
      message: error.message
    });
  }

  next(error);
};

// ============================================================================
// EXPORTACIONES
// ============================================================================

// Exportar configuraciones específicas
export const uploadConfigs = fileTypeConfigs;

// Exportar tipos
export type { UploadConfig, FileTypeConfig, UploadedFileInfo, ImageProcessingOptions, BasicFile, BasicRequest };