import { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback, MulterError } from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { UserRole } from '../models/User';
import { logMessage, LogLevel, logCattleEvent, CattleEventType } from './logging';

// Tipos de archivos permitidos por categoría
export enum FileCategory {
  CATTLE_PHOTOS = 'cattle_photos',        // Fotos de ganado
  VETERINARY_DOCS = 'veterinary_docs',    // Documentos veterinarios
  VACCINATION_RECORDS = 'vaccination_records', // Registros de vacunación
  HEALTH_REPORTS = 'health_reports',      // Reportes de salud
  BREEDING_DOCS = 'breeding_docs',        // Documentos de reproducción
  PRODUCTION_DATA = 'production_data',    // Datos de producción
  FEED_REPORTS = 'feed_reports',          // Reportes de alimentación
  FINANCIAL_DOCS = 'financial_docs',      // Documentos financieros
  GENERAL_DOCS = 'general_docs',          // Documentos generales
  SYSTEM_BACKUPS = 'system_backups',      // Respaldos del sistema
  LOCATION_IMAGES = 'location_images',    // Fotos de ubicaciones (potreros, corrales, etc.)
  LOCATION_DOCUMENTS = 'location_documents', // Documentos/contratos de ubicaciones
  LOCATION_VIDEOS = 'location_videos',    // Videos de ubicaciones
  LOCATION_MAPS = 'location_maps',         // Mapas/planos específicos
  BOVINE_IMAGES = 'bovine_images',        // Fotos de bovinos (galería del detalle)
  BOVINE_DOCUMENTS = 'bovine_documents',  // Documentos del bovino (papeles, registros)
  BOVINE_VIDEOS = 'bovine_videos',        // Videos del bovino
  DISEASE_MEDIA = 'disease_media',        // Imágenes/videos de referencia de enfermedades
}

// Configuración de tipos de archivo por categoría
const FILE_CONFIGS: Record<FileCategory, {
  allowedTypes: string[];
  allowedExtensions: string[];
  maxSize: number; // en bytes
  maxFiles: number;
  requiresAuth: boolean;
  allowedRoles: UserRole[];
  virusScanRequired: boolean;
  thumbnailSizes?: { name: string; width: number; height: number }[];
}> = {
  [FileCategory.CATTLE_PHOTOS]: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.heic'],
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    requiresAuth: true,
    allowedRoles: [UserRole.WORKER, UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: false,
    thumbnailSizes: [                                         // <-- NUEVO
      { name: 'small', width: 150, height: 150 },
      { name: 'medium', width: 400, height: 400 },
      { name: 'large', width: 800, height: 600 }
    ]
  },
  [FileCategory.VETERINARY_DOCS]: {
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'],
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.txt'],
    maxSize: 25 * 1024 * 1024,
    maxFiles: 5,
    requiresAuth: true,
    allowedRoles: [UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: true,
    thumbnailSizes: [                                         // <-- NUEVO (opcional, para imágenes dentro de documentos)
      { name: 'small', width: 150, height: 150 }
    ]
  },
  [FileCategory.VACCINATION_RECORDS]: {
    allowedTypes: ['application/pdf', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    allowedExtensions: ['.pdf', '.csv', '.xls', '.xlsx'],
    maxSize: 15 * 1024 * 1024,
    maxFiles: 3,
    requiresAuth: true,
    allowedRoles: [UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: true
    // Sin thumbnailSizes (no es necesario para documentos de vacunación)
  },
  [FileCategory.HEALTH_REPORTS]: {
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    allowedExtensions: ['.pdf', '.doc', '.docx'],
    maxSize: 20 * 1024 * 1024,
    maxFiles: 5,
    requiresAuth: true,
    allowedRoles: [UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: true
    // Sin thumbnailSizes
  },
  [FileCategory.BREEDING_DOCS]: {
    allowedTypes: ['application/pdf', 'text/csv', 'image/jpeg', 'image/png'],
    allowedExtensions: ['.pdf', '.csv', '.jpg', '.jpeg', '.png'],
    maxSize: 15 * 1024 * 1024,
    maxFiles: 8,
    requiresAuth: true,
    allowedRoles: [UserRole.WORKER, UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: false,
    thumbnailSizes: [                                         // <-- NUEVO
      { name: 'small', width: 150, height: 150 },
      { name: 'medium', width: 400, height: 400 }
    ]
  },
  [FileCategory.PRODUCTION_DATA]: {
    allowedTypes: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json'],
    allowedExtensions: ['.csv', '.xls', '.xlsx', '.json'],
    maxSize: 50 * 1024 * 1024,
    maxFiles: 1,
    requiresAuth: true,
    allowedRoles: [UserRole.WORKER, UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: true
    // Sin thumbnailSizes
  },
  [FileCategory.FEED_REPORTS]: {
    allowedTypes: ['application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    allowedExtensions: ['.pdf', '.csv', '.xlsx'],
    maxSize: 10 * 1024 * 1024,
    maxFiles: 3,
    requiresAuth: true,
    allowedRoles: [UserRole.WORKER, UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: false
    // Sin thumbnailSizes
  },
  [FileCategory.FINANCIAL_DOCS]: {
    allowedTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    allowedExtensions: ['.pdf', '.xlsx'],
    maxSize: 30 * 1024 * 1024,
    maxFiles: 2,
    requiresAuth: true,
    allowedRoles: [UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: true
    // Sin thumbnailSizes
  },
  [FileCategory.GENERAL_DOCS]: {
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'],
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.txt'],
    maxSize: 20 * 1024 * 1024,
    maxFiles: 5,
    requiresAuth: true,
    allowedRoles: [UserRole.WORKER, UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: false,
    thumbnailSizes: [                                         // <-- NUEVO
      { name: 'small', width: 150, height: 150 },
      { name: 'medium', width: 400, height: 400 }
    ]
  },
  [FileCategory.SYSTEM_BACKUPS]: {
    allowedTypes: ['application/zip', 'application/x-gzip', 'application/x-tar'],
    allowedExtensions: ['.zip', '.gz', '.tar', '.tar.gz'],
    maxSize: 500 * 1024 * 1024,
    maxFiles: 1,
    requiresAuth: true,
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: true
    // Sin thumbnailSizes
  },
  [FileCategory.LOCATION_IMAGES]: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.heic'],
    maxSize: 15 * 1024 * 1024, // 15MB
    maxFiles: 10,
    requiresAuth: true,
    allowedRoles: [UserRole.WORKER, UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: false,
    thumbnailSizes: [
      { name: 'small', width: 200, height: 200 },
      { name: 'medium', width: 600, height: 600 }
    ]
  },
  [FileCategory.LOCATION_DOCUMENTS]: {
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'],
    allowedExtensions: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'],
    maxSize: 25 * 1024 * 1024, // 25MB
    maxFiles: 5,
    requiresAuth: true,
    allowedRoles: [UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: true
  },
  [FileCategory.LOCATION_VIDEOS]: {
    allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    allowedExtensions: ['.mp4', '.webm', '.mov'],
    maxSize: 100 * 1024 * 1024, // 100MB
    maxFiles: 3,
    requiresAuth: true,
    allowedRoles: [UserRole.WORKER, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: false
  },
  [FileCategory.LOCATION_MAPS]: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf'],
    maxSize: 20 * 1024 * 1024, // 20MB
    maxFiles: 5,
    requiresAuth: true,
    allowedRoles: [UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: false,
    thumbnailSizes: [
      { name: 'small', width: 300, height: 300 }
    ]
  },
  [FileCategory.BOVINE_IMAGES]: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.heic'],
    maxSize: 15 * 1024 * 1024, // 15MB
    maxFiles: 10,
    requiresAuth: true,
    allowedRoles: [UserRole.WORKER, UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: false,
    thumbnailSizes: [
      { name: 'small', width: 200, height: 200 },
      { name: 'medium', width: 600, height: 600 }
    ]
  },
  [FileCategory.BOVINE_DOCUMENTS]: {
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'],
    allowedExtensions: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'],
    maxSize: 25 * 1024 * 1024, // 25MB
    maxFiles: 5,
    requiresAuth: true,
    allowedRoles: [UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: true
  },
  [FileCategory.BOVINE_VIDEOS]: {
    allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    allowedExtensions: ['.mp4', '.webm', '.mov'],
    maxSize: 100 * 1024 * 1024, // 100MB
    maxFiles: 3,
    requiresAuth: true,
    allowedRoles: [UserRole.WORKER, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: false
  },
  [FileCategory.DISEASE_MEDIA]: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm'],
    maxSize: 50 * 1024 * 1024, // 50MB (videos pueden ser grandes)
    maxFiles: 10,
    requiresAuth: true,
    allowedRoles: [UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
    virusScanRequired: false,
    thumbnailSizes: [
      { name: 'small', width: 300, height: 300 },
    ],
  },
};

// Interface para metadatos de archivo
export interface FileMetadata {
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  category: FileCategory;
  uploadedBy: string;
  uploadedAt: Date;
  cattleId?: string;
  cattleEarTag?: string;
  description?: string;
  isPublic: boolean;
  checksumMD5: string;
  checksumSHA256: string;
  virusScanStatus: 'pending' | 'clean' | 'infected' | 'error';
  virusScanDate?: Date;
}

// Interface extendida para archivos de Multer
export interface CattleFile extends Express.Multer.File {
  category: FileCategory;
  metadata: FileMetadata;
}

/**
 * Generar nombre único para archivo
 */
function generateUniqueFileName(originalName: string, category: FileCategory, userId: string): string {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalName).toLowerCase();
  const sanitizedName = path.basename(originalName, extension).replace(/[^a-zA-Z0-9-_]/g, '');

  return `${category}_${userId}_${timestamp}_${randomString}_${sanitizedName}${extension}`;
}

/**
 * Calcular checksums del archivo para integridad
 */
async function calculateChecksums(filePath: string): Promise<{ md5: string; sha256: string }> {
  return new Promise((resolve, reject) => {
    const md5Hash = crypto.createHash('md5');
    const sha256Hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => {
      md5Hash.update(data);
      sha256Hash.update(data);
    });

    stream.on('end', () => {
      resolve({
        md5: md5Hash.digest('hex'),
        sha256: sha256Hash.digest('hex')
      });
    });

    stream.on('error', reject);
  });
}

/**
 * Simulación de escaneo de virus (en producción usar ClamAV o similar)
 */
async function scanForVirus(filePath: string): Promise<'clean' | 'infected' | 'error'> {
  try {
    // TODO: Implementar escaneo real de virus
    // const result = await clamAV.scan(filePath);

    // Simulación: archivos con nombres sospechosos se marcan como infectados
    const suspiciousPatterns = ['virus', 'malware', 'trojan', 'backdoor'];
    const fileName = path.basename(filePath).toLowerCase();

    for (const pattern of suspiciousPatterns) {
      if (fileName.includes(pattern)) {
        return 'infected';
      }
    }

    return 'clean';
  } catch (error) {
    logMessage(LogLevel.ERROR, 'virus_scan_error', `Error en escaneo de virus: ${error}`, { filePath });
    return 'error';
  }
}

/**
 * Crear directorio si no existe
 */
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Configuración de almacenamiento de Multer
 */
const createStorage = (category: FileCategory) => {
  return multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', category);
      ensureDirectoryExists(uploadDir);
      cb(null, uploadDir);
    },
    filename: (req: Request, file: Express.Multer.File, cb) => {
      const userId = req.userId || 'anonymous';
      const uniqueName = generateUniqueFileName(file.originalname, category, userId);
      cb(null, uniqueName);
    }
  });
};

/**
 * Filtro de archivos personalizado
 */
const createFileFilter = (category: FileCategory) => {
  return (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const config = FILE_CONFIGS[category];

    // Verificar autenticación
    if (config.requiresAuth && !req.user) {
      return cb(new Error('Autenticación requerida para subir archivos'));
    }

    // Verificar permisos de rol
    if (req.userRole && !config.allowedRoles.includes(req.userRole)) {
      return cb(new Error(`Rol ${req.userRole} no autorizado para subir ${category}`));
    }

    // Verificar tipo MIME
    if (!config.allowedTypes.includes(file.mimetype)) {
      return cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Tipos permitidos: ${config.allowedTypes.join(', ')}`));
    }

    // Verificar extensión
    const extension = path.extname(file.originalname).toLowerCase();
    if (!config.allowedExtensions.includes(extension)) {
      return cb(new Error(`Extensión no permitida: ${extension}. Extensiones permitidas: ${config.allowedExtensions.join(', ')}`));
    }

    cb(null, true);
  };
};

/**
 * Crear middleware de upload para una categoría específica
 */
export const createUploadMiddleware = (category: FileCategory) => {
  const config = FILE_CONFIGS[category];

  const upload = multer({
    storage: createStorage(category),
    fileFilter: createFileFilter(category),
    limits: {
      fileSize: config.maxSize,
      files: config.maxFiles
    }
  });

  return {
    single: (fieldName: string) => upload.single(fieldName),
    multiple: (fieldName: string, maxCount?: number) => upload.array(fieldName, maxCount || config.maxFiles),
    fields: (fields: { name: string; maxCount?: number }[]) => upload.fields(fields)
  };
};

/**
 * Middleware de post-procesamiento de archivos
 */
export const processUploadedFiles = (category: FileCategory) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[] || (req.file ? [req.file] : []);
      const config = FILE_CONFIGS[category];

      if (files.length === 0) {
        return next();
      }

      const processedFiles: CattleFile[] = [];

      for (const file of files) {
        try {
          // Calcular checksums
          const checksums = await calculateChecksums(file.path);

          // Escanear virus si es necesario
          let virusScanStatus: 'pending' | 'clean' | 'infected' | 'error' = 'pending';
          if (config.virusScanRequired) {
            virusScanStatus = await scanForVirus(file.path);

            // Si está infectado, eliminar archivo inmediatamente
            if (virusScanStatus === 'infected') {
              fs.unlinkSync(file.path);

              logMessage(
                LogLevel.ERROR,
                'virus_detected',
                `Archivo infectado detectado y eliminado: ${file.originalname}`,
                {
                  userId: req.userId,
                  userEmail: req.user?.email,
                  filename: file.filename,
                  originalName: file.originalname,
                  category: category
                }
              );

              return next(new Error(`Archivo infectado detectado: ${file.originalname}`));
            }
          } else {
            virusScanStatus = 'clean';
          }

          // Crear metadatos del archivo
          const metadata: FileMetadata = {
            originalName: file.originalname,
            filename: file.filename,
            mimetype: file.mimetype,
            size: file.size,
            category: category,
            uploadedBy: req.userId || 'anonymous',
            uploadedAt: new Date(),
            cattleId: req.body.cattleId,
            cattleEarTag: req.body.cattleEarTag,
            description: req.body.description,
            isPublic: req.body.isPublic === 'true',
            checksumMD5: checksums.md5,
            checksumSHA256: checksums.sha256,
            virusScanStatus: virusScanStatus,
            virusScanDate: config.virusScanRequired ? new Date() : undefined
          };

          // Crear archivo extendido
          const cattleFile: CattleFile = {
            ...file,
            category: category,
            metadata: metadata
          };

          processedFiles.push(cattleFile);

          // Log del archivo subido
          logCattleEvent(
            CattleEventType.DATA_IMPORTED,
            `Archivo ${category} subido: ${file.originalname}`,
            req,
            {
              filename: file.filename,
              originalName: file.originalname,
              size: file.size,
              mimetype: file.mimetype,
              category: category,
              cattleEarTag: req.body.cattleEarTag
            }
          );

        } catch (fileError) {
          // Eliminar archivo si hay error en el procesamiento
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }

          logMessage(
            LogLevel.ERROR,
            'file_processing_error',
            `Error procesando archivo ${file.originalname}: ${fileError}`,
            {
              userId: req.userId,
              filename: file.filename,
              category: category,
              error: fileError instanceof Error ? fileError.stack : fileError
            }
          );

          return next(new Error(`Error procesando archivo ${file.originalname}: ${fileError instanceof Error ? fileError.message : fileError}`));
        }
      }

      // Agregar archivos procesados al request
      (req as any).processedFiles = processedFiles;

      next();

    } catch (error) {
      logMessage(
        LogLevel.ERROR,
        'upload_processing_error',
        `Error en post-procesamiento de uploads: ${error}`,
        {
          userId: req.userId,
          category: category,
          error: error instanceof Error ? error.stack : error
        }
      );

      next(error);
    }
  };
};

/**
 * Middleware para manejo de errores de Multer
 */
export const handleUploadErrors = (error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof MulterError) {
    let message = 'Error en la carga de archivo';
    let code = 'UPLOAD_ERROR';

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'Archivo demasiado grande';
        code = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Demasiados archivos';
        code = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Campo de archivo inesperado';
        code = 'UNEXPECTED_FILE_FIELD';
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Demasiadas partes en el formulario';
        code = 'TOO_MANY_PARTS';
        break;
    }

    logMessage(
      LogLevel.WARN,
      'upload_error',
      `Error de upload: ${message}`,
      {
        userId: req.userId,
        userEmail: req.user?.email,
        errorCode: error.code,
        path: req.originalUrl
      }
    );

    res.status(400).json({
      success: false,
      error: {
        code: code,
        message: message,
        details: error.message,
        timestamp: new Date().toISOString(),
        path: req.originalUrl
      }
    });

    return;
  }

  // Error personalizado de filtro de archivos
  if (error.message) {
    logMessage(
      LogLevel.WARN,
      'file_validation_error',
      `Error de validación de archivo: ${error.message}`,
      {
        userId: req.userId,
        userEmail: req.user?.email,
        path: req.originalUrl
      }
    );

    res.status(400).json({
      success: false,
      error: {
        code: 'FILE_VALIDATION_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
        path: req.originalUrl
      }
    });

    return;
  }

  next(error);
};

/**
 * Función para eliminar archivo del sistema
 */
export const deleteFile = async (filename: string, category: FileCategory): Promise<boolean> => {
  try {
    const filePath = path.join(process.cwd(), 'uploads', category, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);

      logMessage(
        LogLevel.INFO,
        'file_deleted',
        `Archivo eliminado: ${filename}`,
        { filename, category, filePath }
      );

      return true;
    }

    return false;
  } catch (error) {
    logMessage(
      LogLevel.ERROR,
      'file_deletion_error',
      `Error eliminando archivo ${filename}: ${error}`,
      { filename, category, error: error instanceof Error ? error.stack : error }
    );

    return false;
  }
};

/**
 * Función para obtener información de archivo
 */
export const getFileInfo = (filename: string, category: FileCategory): FileMetadata | null => {
  try {
    const filePath = path.join(process.cwd(), 'uploads', category, filename);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);

    // En un sistema real, los metadatos se almacenarían en base de datos
    // Aquí retornamos información básica del sistema de archivos
    return {
      originalName: filename,
      filename: filename,
      mimetype: 'application/octet-stream', // Se determinaría del BD
      size: stats.size,
      category: category,
      uploadedBy: 'unknown', // Se obtendría del BD
      uploadedAt: stats.birthtime,
      isPublic: false,
      checksumMD5: 'unknown', // Se obtendría del BD
      checksumSHA256: 'unknown', // Se obtendría del BD
      virusScanStatus: 'pending' // Se obtendría del BD
    };
  } catch (error) {
    logMessage(
      LogLevel.ERROR,
      'file_info_error',
      `Error obteniendo información de archivo ${filename}: ${error}`,
      { filename, category }
    );

    return null;
  }
};

/**
 * Función para limpiar archivos antiguos
 */
export const cleanupOldFiles = (category: FileCategory, daysOld: number = 30): number => {
  try {
    const uploadDir = path.join(process.cwd(), 'uploads', category);

    if (!fs.existsSync(uploadDir)) {
      return 0;
    }

    const files = fs.readdirSync(uploadDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);

      if (stats.birthtime < cutoffDate) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    logMessage(
      LogLevel.INFO,
      'file_cleanup',
      `Limpieza de archivos completada: ${deletedCount} archivos eliminados`,
      { category, daysOld, deletedCount }
    );

    return deletedCount;
  } catch (error) {
    logMessage(
      LogLevel.ERROR,
      'file_cleanup_error',
      `Error en limpieza de archivos: ${error}`,
      { category, daysOld }
    );

    return 0;
  }
};

export { calculateChecksums, FILE_CONFIGS };