import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { tokenService } from '../services/auth';
import { permissionService } from '../services/permission';
import User, { UserRole } from '../models/User';
import logger from '../utils/logger';

/*
// Enums y tipos para usuarios
export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  VETERINARIAN = 'veterinarian',
  WORKER = 'worker',
  VIEWER = 'viewer'
}*/

// Interface para usuario básico
export interface User_Interface {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: Date;
  farm?: {
    id: string;
    name: string;
    type: string;
    subscriptionStatus: string;
  };
  permissions?: Permission[];
}

// Interface para permisos
export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
}

// Interface para límites de API
export interface ApiLimits {
  requestsPerHour: number;
}

// Clase personalizada para errores de API
export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(statusCode: number, message: string, code: string = 'GENERAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Extender el tipo Request para incluir información del usuario
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
      userRole?: UserRole;
      apiLimits?: ApiLimits;
    }
  }
}

// Configuración JWT desde variables de entorno
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-for-cattle-management';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Interface simple para el payload del JWT
interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  permissions?: Permission[];
  iat?: number;
  exp?: number;
  jti?: string;
}

/**
 * Función helper para buscar usuario por ID
 * En producción, esta sería reemplazada por el modelo de Sequelize
 */
const findUserById = async (userId: string): Promise<User | null> => {
  try {
    return await User.findByPk(userId, {
      attributes: [
        'id',
        'email',
        'username',
        'role',
        'status',
        'securityInfo',
        'personalInfo',
        'created_at',
        'updated_at',
        'isActive',
        'emailVerified',
        'subscriptionInfo'
      ]
    });
  } catch (error) {
    logger.error('Error buscando usuario en middleware', 'AuthMiddleware', { userId }, error as Error);
    return null;
  }
};

/**
 * Función helper para actualizar última actividad del usuario
 * En producción, esta sería reemplazada por el modelo de Sequelize
 */
const updateUserActivity = async (userId: string): Promise<void> => {
  await User.update(
    { lastLoginAt: new Date() },
    { where: { id: userId } }
  );
};

/**
 * Middleware principal de autenticación
 * Verifica que el usuario tenga un token JWT válido
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extraer el token del header Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new ApiError(401, 'Token de acceso requerido', 'MISSING_TOKEN');
    }

    // Verificar y decodificar el token
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

    // Verificar si el token está en la blacklist (revocado)
    // Esto previene que tokens revocados puedan seguir siendo usados
    const isBlacklisted = await tokenService.isTokenRevoked(token);
    if (isBlacklisted) {
      throw new ApiError(401, 'Token revocado', 'TOKEN_REVOKED');
    }

    // Buscar el usuario en la base de datos
    const user = await findUserById(decoded.userId);

    if (!user) {
      throw new ApiError(401, 'Usuario no encontrado', 'USER_NOT_FOUND');
    }

    if (user.securityInfo?.passwordLastChanged) {
      const tokenIssuedAt = decoded.iat ? new Date(decoded.iat * 1000) : null;
      const passwordChangedAt = new Date(user.securityInfo.passwordLastChanged);

      if (tokenIssuedAt && tokenIssuedAt < passwordChangedAt) {
        // El token fue emitido ANTES de que cambiara la contraseña
        // Por lo tanto, es inválido
        throw new ApiError(
          401,
          'Token inválido: la contraseña fue cambiada',
          'TOKEN_INVALIDATED_BY_PASSWORD_CHANGE'
        );
      }
    }


    // Verificar si el usuario está activo
    if (!user.isActive || user.status !== 'ACTIVE') {
      throw new ApiError(401, 'Cuenta de usuario desactivada', 'USER_INACTIVE');
    }

    const exemptPaths = ['/verify-email', '/resend-verification', '/logout'];
    const isExempt = exemptPaths.some(p => req.path.endsWith(p));

    // Verificar si la cuenta está verificada (para ciertos endpoints)
    if (!user.emailVerified && !isExempt) {
      throw new ApiError(401, 'Email no verificado', 'EMAIL_NOT_VERIFIED');
    }

    // Agregar información del usuario al request
    req.user = user;
    req.userId = user.id;
    req.userRole = user.role as UserRole;

    // Actualizar la última actividad del usuario
    await updateUserActivity(user.id);

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new ApiError(401, 'Token inválido', 'INVALID_TOKEN'));
    }

    if (error instanceof jwt.TokenExpiredError) {
      return next(new ApiError(401, 'Token expirado', 'EXPIRED_TOKEN'));
    }

    next(error);
  }
};

/**
 * Middleware para verificar roles específicos
 * @param allowedRoles Array de roles permitidos
 */
export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.userRole) {
      return next(new ApiError(401, 'Usuario no autenticado', 'NOT_AUTHENTICATED'));
    }

    if (!allowedRoles.includes(req.userRole)) {
      return next(new ApiError(403, 'Sin permisos para realizar esta acción', 'INSUFFICIENT_PERMISSIONS'));
    }

    next();
  };
};

/**
 * ============================================================================
 * MIDDLEWARE: checkPermission
 * ============================================================================
 * 
 * PROPÓSITO:
 * Verifica si el usuario autenticado tiene permiso para realizar una acción
 * en un recurso específico.
 * 
 * ¿CÓMO FUNCIONA?
 * 1. Verifica que el usuario esté autenticado
 * 2. Delega la verificación de permisos al PermissionService
 * 3. El PermissionService unifica ambos sistemas de permisos:
 *    - UserPermissions (permisos individuales)
 *    - DEFAULT_ROLE_PERMISSIONS (permisos por rol)
 * 4. Si tiene permiso → continúa
 * 5. Si no tiene permiso → retorna error 403
 * 
 * USO:
 *   router.get('/bovines', checkPermission('bovines', 'read'), ...)
 *   router.post('/health', checkPermission('health', 'create'), ...)
 *   router.delete('/finance', checkPermission('finance', 'delete'), ...)
 * 
 * @param resource - Recurso HTTP (ej: 'bovines', 'cattle', 'health')
 * @param action - Acción HTTP (ej: 'read', 'write', 'delete')
 */
export const checkPermission = (resource: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // ============================================================
    // PASO 1: Verificar autenticación
    // ============================================================
    // ¿POR QUÉ?
    // Si no hay usuario autenticado, no podemos verificar permisos.
    if (!req.user) {
      return next(new ApiError(401, 'Usuario no autenticado', 'NOT_AUTHENTICATED'));
    }

    // ============================================================
    // PASO 2: Delegar verificación al PermissionService
    // ============================================================
    // ¿POR QUÉ?
    // El PermissionService contiene toda la lógica de permisos:
    // - Mapeo de recursos/acciones
    // - Verificación de permisos individuales
    // - Verificación de permisos por rol
    // - Manejo de errores
    // 
    // El middleware solo se encarga de:
    // - Validar que el usuario esté autenticado
    // - Llamar al servicio
    // - Manejar la respuesta (permitir o denegar)
    const hasPermission = permissionService.hasPermission(
      req.user,
      resource,
      action
    );

    // ============================================================
    // PASO 3: Permitir o denegar acceso
    // ============================================================
    if (!hasPermission) {
      logger.warn(
        `Acceso denegado: ${req.user.email} intentó ${action} en ${resource}`,
        'AuthMiddleware',
        {
          userId: req.user.id,
          userRole: req.userRole,
          resource,
          action
        }
      );
      return next(new ApiError(
        403,
        `Sin permisos para ${action} en ${resource}`,
        'INSUFFICIENT_PERMISSIONS'
      ));
    }

    // ============================================================
    // PASO 4: Continuar con la siguiente función middleware
    // ============================================================
    // Si llegamos aquí, el usuario tiene permiso.
    next();
  };
};

/**
 * Middleware para verificar propiedad de recursos
 * Verifica que el usuario sea propietario del recurso o tenga permisos administrativos
 */
export const checkResourceOwnership = (userIdField: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ApiError(401, 'Usuario no autenticado', 'NOT_AUTHENTICATED'));
    }

    // Los administradores y propietarios pueden acceder a todos los recursos
    if (req.userRole === UserRole.OWNER || req.userRole === UserRole.SUPER_ADMIN) {
      return next();
    }

    // Verificar propiedad del recurso
    const resourceUserId = req.params[userIdField] || req.body[userIdField];

    if (resourceUserId && resourceUserId !== req.userId) {
      return next(new ApiError(403, 'Sin acceso a este recurso', 'RESOURCE_ACCESS_DENIED'));
    }

    next();
  };
};

/**
 * Middleware para verificar suscripción activa
 * Algunos features requieren suscripción premium
 */
export const requireActiveSubscription = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(new ApiError(401, 'Usuario no autenticado', 'NOT_AUTHENTICATED'));
  }

  const subscriptionStatus = req.user.subscriptionInfo?.status;

  // Verificar si la suscripción está activa
  if (subscriptionStatus !== 'ACTIVE' && subscriptionStatus !== 'TRIAL') {
    return next(new ApiError(403, 'Suscripción requerida para esta función', 'SUBSCRIPTION_REQUIRED'));
  }

  next();
};

/**
 * Middleware opcional de autenticación
 * No falla si no hay token, pero si lo hay, lo valida
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      const user = await findUserById(decoded.userId);

      if (user && user.isActive) {
        req.user = user;
        req.userId = user.id;
        req.userRole = user.role;
      }
    }

    next();
  } catch (error) {
    // En autenticación opcional, continuamos sin usuario si hay error
    next();
  }
};

/**
 * Middleware para verificar límites de API basados en el rol del usuario
 */
export const checkApiLimits = (req: Request, res: Response, next: NextFunction): void => {

  if (!req.user) {
    return next(new ApiError(401, 'Usuario no autenticado', 'NOT_AUTHENTICATED'));
  }

  if (!req.userRole) {
    return next(new ApiError(500, 'userRole no está definido', 'MISSING_USER_ROLE'));
  }


  // Definir límites por rol
  const roleLimits: Record<UserRole, { requestsPerHour: number }> = {
    [UserRole.VIEWER]: { requestsPerHour: 100 },
    [UserRole.WORKER]: { requestsPerHour: 500 },
    [UserRole.VETERINARIAN]: { requestsPerHour: 1000 },
    [UserRole.RANCH_MANAGER]: { requestsPerHour: 2000 },
    [UserRole.MANAGER]: { requestsPerHour: 2000 },
    [UserRole.SUPER_ADMIN]: { requestsPerHour: 5000 },
    [UserRole.OWNER]: { requestsPerHour: 10000 }
  };

  const userLimit = roleLimits[req.userRole];

  // Aquí se implementaría la lógica de rate limiting
  // Por ahora solo añadimos la información al request
  req.apiLimits = userLimit;

  next();
};

/**
 * Utilidad para generar tokens JWT
 
export const generateToken = (userId: string, email: string, role: UserRole): string => {
  const payload = {
    userId,
    email,
    role
  };
  
  // Usar jwt.sign de forma síncrona sin opciones complejas
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};*/

/**
 * Utilidad para verificar tokens JWT sin middleware
 */
export const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    throw new ApiError(401, 'Token inválido', 'INVALID_TOKEN');
  }
};

/**
 * Middleware para logging de actividades del usuario
 */
export const logUserActivity = (action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user) {
      // Aquí se registraría la actividad del usuario
      console.log(`Usuario ${req.user.email} realizó acción: ${action} en ${new Date().toISOString()}`);

      // En un entorno real, esto se guardaría en base de datos
      // await UserActivity.create({
      //   userId: req.userId,
      //   action,
      //   endpoint: req.originalUrl,
      //   method: req.method,
      //   ipAddress: req.ip,
      //   userAgent: req.get('User-Agent'),
      //   timestamp: new Date()
      // });
    }
    next();
  };
};