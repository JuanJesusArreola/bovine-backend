import { Request, Response, NextFunction } from 'express';
import  { UserRole } from '../models/User';

// Clase personalizada para errores de autorización
export class AuthorizationError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, code: string = 'AUTHORIZATION_FAILED') {
    super(message);
    this.statusCode = 403;
    this.code = code;
  }
}

// Jerarquía de roles de mayor a menor privilegio
const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.OWNER]: 6,        // Máximo privilegio
  [UserRole.SUPER_ADMIN]: 5,        // Administrador completo
  [UserRole.RANCH_MANAGER]: 4,  // Administador de rancho
  [UserRole.MANAGER]: 3,      // Gerente de operaciones
  [UserRole.VETERINARIAN]: 2, // Veterinario especializado
  [UserRole.WORKER]: 1,       // Trabajador de campo
  [UserRole.VIEWER]: 0        // Solo lectura
};

// Definición de permisos por módulo del sistema ganadero
export interface ModulePermissions {
  cattle: string[];           // Gestión de ganado
  health: string[];          // Salud veterinaria
  vaccinations: string[];    // Vacunaciones
  reproduction: string[];    // Reproducción
  production: string[];      // Producción
  inventory: string[];       // Inventario de medicamentos
  finances: string[];        // Finanzas
  reports: string[];         // Reportes
  maps: string[];           // Geolocalización
  users: string[];          // Gestión de usuarios
  ranch: string[];          // Configuración del rancho
}

// Permisos por defecto según el rol
const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, ModulePermissions> = {
  [UserRole.OWNER]: {
    cattle: ['create', 'read', 'update', 'delete', 'export', 'import'],
    health: ['create', 'read', 'update', 'delete', 'diagnose', 'prescribe'],
    vaccinations: ['create', 'read', 'update', 'delete', 'schedule', 'administer'],
    reproduction: ['create', 'read', 'update', 'delete', 'track', 'plan'],
    production: ['create', 'read', 'update', 'delete', 'analyze'],
    inventory: ['create', 'read', 'update', 'delete', 'order', 'audit'],
    finances: ['create', 'read', 'update', 'delete', 'budget', 'approve'],
    reports: ['create', 'read', 'update', 'delete', 'export', 'share'],
    maps: ['create', 'read', 'update', 'delete', 'track'],
    users: ['create', 'read', 'update', 'delete', 'invite', 'suspend'],
    ranch: ['create', 'read', 'update', 'delete', 'configure']
  },
  [UserRole.SUPER_ADMIN]: {
    cattle: ['create', 'read', 'update', 'delete', 'export'],
    health: ['create', 'read', 'update', 'delete', 'diagnose', 'prescribe'],
    vaccinations: ['create', 'read', 'update', 'delete', 'schedule', 'administer'],
    reproduction: ['create', 'read', 'update', 'delete', 'track', 'plan'],
    production: ['create', 'read', 'update', 'delete', 'analyze'],
    inventory: ['create', 'read', 'update', 'delete', 'order', 'audit'],
    finances: ['create', 'read', 'update', 'delete', 'budget', 'approve'],
    reports: ['create', 'read', 'update', 'delete', 'export', 'share'],
    maps: ['create', 'read', 'update', 'track'],
    users: ['create', 'read', 'update', 'delete', 'invite', 'suspend'],
    ranch: ['read', 'update', 'delete', 'configure']
  },
  [UserRole.RANCH_MANAGER]: {
    cattle: ['create', 'read', 'update', 'delete', 'export'],
    health: ['create', 'read', 'update'],
    vaccinations: ['create', 'read', 'update', 'delete', 'schedule'],
    reproduction: ['create', 'read', 'update', 'track', 'plan'],
    production: ['create', 'read', 'update', 'analyze'],
    inventory: ['create', 'read', 'update', 'order'],
    finances: ['read', 'budget'],
    reports: ['create', 'read', 'update', 'export'],
    maps: ['create', 'read', 'update', 'delete', 'track'],
    users: ['read'],
    ranch: ['read', 'update']
  },
  [UserRole.MANAGER]: {
    cattle: ['create', 'read', 'update', 'export'],
    health: ['create', 'read', 'update'],
    vaccinations: ['create', 'read', 'update', 'schedule'],
    reproduction: ['create', 'read', 'update', 'track'],
    production: ['create', 'read', 'update', 'analyze'],
    inventory: ['create', 'read', 'update'],
    finances: ['read', 'budget'],
    reports: ['create', 'read', 'export'],
    maps: ['read', 'update', 'track'],
    users: ['read'],
    ranch: ['read', 'update']
  },
  [UserRole.VETERINARIAN]: {
    cattle: ['read', 'update'],
    health: ['create', 'read', 'update', 'diagnose', 'prescribe'],
    vaccinations: ['create', 'read', 'update', 'administer'],
    reproduction: ['read', 'update'],
    production: ['read'],
    inventory: ['read', 'update'],
    finances: ['read'],
    reports: ['create', 'read'],
    maps: ['read', 'track'],
    users: ['read'],
    ranch: ['read']
  },
  [UserRole.WORKER]: {
    cattle: ['read', 'update'],
    health: ['read', 'update'],
    vaccinations: ['read', 'administer'],
    reproduction: ['read', 'update'],
    production: ['read', 'update'],
    inventory: ['read'],
    finances: [],
    reports: ['read'],
    maps: ['read', 'track'],
    users: [],
    ranch: ['read']
  },
  [UserRole.VIEWER]: {
    cattle: ['read'],
    health: ['read'],
    vaccinations: ['read'],
    reproduction: ['read', 'track'],
    production: ['read'],
    inventory: ['read'],
    finances: [],
    reports: ['read'],
    maps: ['read'],
    users: [],
    ranch: ['read']
  }
};

/**
 * Middleware para verificar si el usuario tiene un rol específico o superior
 * @param minimumRole Rol mínimo requerido
 */
export const requireMinimumRole = (minimumRole: UserRole) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.userRole) {
      return next(new AuthorizationError('Usuario no autenticado', 'NOT_AUTHENTICATED'));
    }

    const userRoleLevel = ROLE_HIERARCHY[req.userRole];
    const requiredRoleLevel = ROLE_HIERARCHY[minimumRole];

    if (userRoleLevel < requiredRoleLevel) {
      return next(new AuthorizationError(
        `Se requiere rol de ${minimumRole} o superior`,
        'INSUFFICIENT_ROLE'
      ));
    }

    next();
  };
};

/**
 * Middleware para verificar roles exactos (sin jerarquía)
 * @param allowedRoles Lista de roles permitidos
 */
export const requireExactRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.userRole) {
      return next(new AuthorizationError('Usuario no autenticado', 'NOT_AUTHENTICATED'));
    }

    if (!allowedRoles.includes(req.userRole)) {
      return next(new AuthorizationError(
        `Acceso restringido a roles: ${allowedRoles.join(', ')}`,
        'ROLE_NOT_ALLOWED'
      ));
    }

    next();
  };
};

/**
 * Middleware para verificar permisos específicos en un módulo
 * @param module Módulo del sistema (ej: 'cattle', 'health')
 * @param action Acción requerida (ej: 'create', 'read', 'update', 'delete')
 */
export const requireModulePermission = (module: keyof ModulePermissions, action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.userRole) {
      return next(new AuthorizationError('Usuario no autenticado', 'NOT_AUTHENTICATED'));
    }

    // Obtener permisos del rol del usuario
    const rolePermissions = DEFAULT_ROLE_PERMISSIONS[req.userRole];
    const modulePermissions = rolePermissions[module];

    // Verificar si el usuario tiene el permiso específico
    if (!modulePermissions || !modulePermissions.includes(action)) {
      return next(new AuthorizationError(
        `Sin permisos para realizar '${action}' en módulo '${module}'`,
        'MODULE_PERMISSION_DENIED'
      ));
    }

    next();
  };
};

/**
 * Middleware especializado para operaciones veterinarias
 * Solo veterinarios y roles superiores pueden realizar ciertas acciones médicas
 */
export const requireVeterinaryAccess = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || !req.userRole) {
    return next(new AuthorizationError('Usuario no autenticado', 'NOT_AUTHENTICATED'));
  }

  const veterinaryRoles: UserRole[] = [
    UserRole.VETERINARIAN,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
    UserRole.OWNER
  ];

  if (!veterinaryRoles.includes(req.userRole)) {
    return next(new AuthorizationError(
      'Se requiere acceso veterinario para esta operación',
      'VETERINARY_ACCESS_REQUIRED'
    ));
  }

  next();
};

/**
 * Middleware para verificar acceso a finanzas
 * Solo roles de gestión pueden acceder a información financiera
 */
export const requireFinancialAccess = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || !req.userRole) {
    return next(new AuthorizationError('Usuario no autenticado', 'NOT_AUTHENTICATED'));
  }

  const financialRoles: UserRole[] = [
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
    UserRole.OWNER
  ];

  if (!financialRoles.includes(req.userRole)) {
    return next(new AuthorizationError(
      'Se requiere acceso de gestión para información financiera',
      'FINANCIAL_ACCESS_REQUIRED'
    ));
  }

  next();
};

/**
 * Middleware para verificar acceso a gestión de usuarios
 * Solo administradores y propietarios pueden gestionar usuarios
 */
export const requireUserManagementAccess = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || !req.userRole) {
    return next(new AuthorizationError('Usuario no autenticado', 'NOT_AUTHENTICATED'));
  }

  const managementRoles: UserRole[] = [
    UserRole.SUPER_ADMIN,
    UserRole.OWNER
  ];

  if (!managementRoles.includes(req.userRole)) {
    return next(new AuthorizationError(
      'Se requiere acceso de administración para gestión de usuarios',
      'USER_MANAGEMENT_ACCESS_REQUIRED'
    ));
  }

  next();
};

/**
 * Middleware dinámico que verifica múltiples condiciones de rol
 * @param conditions Objeto con las condiciones a verificar
 */
export const requireComplexRole = (conditions: {
  minimumRole?: UserRole;
  exactRoles?: UserRole[];
  modulePermissions?: { module: keyof ModulePermissions; action: string }[];
  veterinaryAccess?: boolean;
  financialAccess?: boolean;
  userManagementAccess?: boolean;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.userRole) {
      return next(new AuthorizationError('Usuario no autenticado', 'NOT_AUTHENTICATED'));
    }

    // Verificar rol mínimo
    if (conditions.minimumRole) {
      const userRoleLevel = ROLE_HIERARCHY[req.userRole];
      const requiredRoleLevel = ROLE_HIERARCHY[conditions.minimumRole];
      
      if (userRoleLevel < requiredRoleLevel) {
        return next(new AuthorizationError(
          `Se requiere rol de ${conditions.minimumRole} o superior`,
          'INSUFFICIENT_ROLE'
        ));
      }
    }

    // Verificar roles exactos
    if (conditions.exactRoles && !conditions.exactRoles.includes(req.userRole)) {
      return next(new AuthorizationError(
        `Acceso restringido a roles: ${conditions.exactRoles.join(', ')}`,
        'ROLE_NOT_ALLOWED'
      ));
    }

    // Verificar permisos de módulo
    if (conditions.modulePermissions) {
      const rolePermissions = DEFAULT_ROLE_PERMISSIONS[req.userRole];
      
      for (const permission of conditions.modulePermissions) {
        const modulePermissions = rolePermissions[permission.module];
        
        if (!modulePermissions || !modulePermissions.includes(permission.action)) {
          return next(new AuthorizationError(
            `Sin permisos para realizar '${permission.action}' en módulo '${permission.module}'`,
            'MODULE_PERMISSION_DENIED'
          ));
        }
      }
    }

    // Verificar acceso veterinario
    if (conditions.veterinaryAccess) {
      const veterinaryRoles: UserRole[] = [
        UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER
      ];
      
      if (!veterinaryRoles.includes(req.userRole)) {
        return next(new AuthorizationError(
          'Se requiere acceso veterinario',
          'VETERINARY_ACCESS_REQUIRED'
        ));
      }
    }

    // Verificar acceso financiero
    if (conditions.financialAccess) {
      const financialRoles: UserRole[] = [UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER];
      
      if (!financialRoles.includes(req.userRole)) {
        return next(new AuthorizationError(
          'Se requiere acceso financiero',
          'FINANCIAL_ACCESS_REQUIRED'
        ));
      }
    }

    // Verificar gestión de usuarios
    if (conditions.userManagementAccess) {
      const managementRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.OWNER];
      
      if (!managementRoles.includes(req.userRole)) {
        return next(new AuthorizationError(
          'Se requiere acceso de administración',
          'USER_MANAGEMENT_ACCESS_REQUIRED'
        ));
      }
    }

    next();
  };
};

/**
 * Función helper para verificar si un usuario tiene un permiso específico
 * @param userRole Rol del usuario
 * @param module Módulo del sistema
 * @param action Acción requerida
 */
export const hasModulePermission = (
  userRole: UserRole,
  module: keyof ModulePermissions,
  action: string
): boolean => {
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[userRole];
  const modulePermissions = rolePermissions[module];
  
  return modulePermissions && modulePermissions.includes(action);
};

/**
 * Función helper para obtener todos los permisos de un rol
 * @param userRole Rol del usuario
 */
export const getRolePermissions = (userRole: UserRole): ModulePermissions => {
  return DEFAULT_ROLE_PERMISSIONS[userRole];
};

/**
 * Función helper para verificar jerarquía de roles
 * @param userRole Rol del usuario
 * @param requiredRole Rol requerido
 */
export const hasMinimumRole = (userRole: UserRole, requiredRole: UserRole): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};