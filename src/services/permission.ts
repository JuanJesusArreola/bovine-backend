import  User, {UserRole, UserPermissions } from '../models/User';
import { ModulePermissions, hasModulePermission, getRolePermissions as getRolePermissionsHelper } from '../middleware/role';
import logger from '../utils/logger';

/**
 * ============================================================================
 * MAPEO DE RECURSOS HTTP A MÓDULOS DEL SISTEMA
 * ============================================================================
 * 
 * ¿POR QUÉ ESTE MAPEO?
 * - Las rutas HTTP usan nombres variados ('bovines', 'cattle', 'animals')
 * - El sistema de permisos usa nombres específicos ('bovines')
 * - Necesitamos convertir recursos HTTP → módulos del sistema
 * 
 * EJEMPLO:
 *   Route: GET /api/cattle → resource = 'cattle'
 *   Mapeo: 'cattle' → 'bovines' (módulo del sistema)
 */
const RESOURCE_TO_MODULE_MAP: Record<string, keyof UserPermissions['modules']> = {
  // Módulo de Bovinos (múltiples nombres para el mismo módulo)
  'bovines': 'bovines',
  'cattle': 'bovines',
  'animals': 'bovines',
  
  // Módulo de Salud (incluye vacunaciones y medicamentos)
  'health': 'health',
  'vaccinations': 'health',
  'medications': 'health',
  'veterinary': 'health',
  
  // Módulo de Reproducción
  'reproduction': 'reproduction',
  'breeding': 'reproduction',
  
  // Módulo de Finanzas
  'finance': 'finance',
  'financials': 'finance',
  'finances': 'finance',
  
  // Módulo de Inventario
  'inventory': 'inventory',
  'stock': 'inventory',
  
  // Módulo de Producción
  'production': 'production',
  'milk': 'production',
  
  // Módulo de Ubicaciones
  'locations': 'locations',
  'maps': 'locations',
  
  // Módulo de Reportes
  'reports': 'reports',
  'analytics': 'reports',
  
  // Módulo de Usuarios
  'users': 'users',
  
  // Módulo de Configuración
  'settings': 'settings',
  'config': 'settings',
  'ranch': 'settings'
};

/**
 * ============================================================================
 * MAPEO DE ACCIONES HTTP A NIVELES DE PERMISO
 * ============================================================================
 * 
 * ¿POR QUÉ ESTE MAPEO?
 * - Las rutas HTTP usan verbos variados ('read', 'view', 'get')
 * - UserPermissions usa niveles jerárquicos ('READ', 'WRITE', 'ADMIN')
 * - Necesitamos convertir acciones HTTP → niveles de permiso
 * 
 * JERARQUÍA:
 *   READ  → Solo lectura (view, get, list, search, export)
 *   WRITE → Lectura + escritura (create, update, edit, modify)
 *   ADMIN → Control total (delete, manage, configure, approve)
 * 
 * EJEMPLO:
 *   Route: DELETE /api/bovines/:id → action = 'delete'
 *   Mapeo: 'delete' → 'ADMIN' (nivel de permiso)
 */
const ACTION_TO_PERMISSION_LEVEL: Record<string, 'READ' | 'WRITE' | 'ADMIN'> = {
  // Acciones de LECTURA (READ)
  'read': 'READ',
  'view': 'READ',
  'get': 'READ',
  'list': 'READ',
  'search': 'READ',
  'export': 'READ',
  
  // Acciones de ESCRITURA (WRITE)
  'write': 'WRITE',
  'create': 'WRITE',
  'add': 'WRITE',
  'update': 'WRITE',
  'edit': 'WRITE',
  'modify': 'WRITE',
  'post': 'WRITE',
  'put': 'WRITE',
  'patch': 'WRITE',
  
  // Acciones de ADMINISTRACIÓN (ADMIN)
  'admin': 'ADMIN',
  'delete': 'ADMIN',
  'remove': 'ADMIN',
  'manage': 'ADMIN',
  'configure': 'ADMIN',
  'approve': 'ADMIN',
  'diagnose': 'ADMIN',
  'prescribe': 'ADMIN',
  'schedule': 'ADMIN',
  'administer': 'ADMIN',
  'track': 'ADMIN',
  'plan': 'ADMIN',
  'analyze': 'ADMIN',
  'order': 'ADMIN',
  'audit': 'ADMIN',
  'budget': 'ADMIN',
  'share': 'ADMIN',
  'invite': 'ADMIN',
  'suspend': 'ADMIN',
  'import': 'ADMIN'
};

/**
 * ============================================================================
 * MAPEO DE MÓDULOS UserPermissions → ModulePermissions
 * ============================================================================
 * 
 * ¿POR QUÉ ESTE MAPEO?
 * - UserPermissions usa: 'bovines', 'health', 'finance', etc.
 * - ModulePermissions usa: 'cattle', 'health', 'finances', etc.
 * - Necesitamos convertir entre ambos sistemas
 * 
 * EJEMPLO:
 *   UserPermissions: 'bovines' → ModulePermissions: 'cattle'
 */
const MODULE_TO_ROLE_SYSTEM_MAP: Record<keyof UserPermissions['modules'], keyof ModulePermissions> = {
  'bovines': 'cattle',
  'health': 'health',
  'reproduction': 'reproduction',
  'finance': 'finances',
  'inventory': 'inventory',
  'production': 'production',
  'locations': 'maps',
  'reports': 'reports',
  'users': 'users',
  'settings': 'ranch'
};

/**
 * ============================================================================
 * SERVICIO CENTRALIZADO DE PERMISOS
 * ============================================================================
 * 
 * PROPÓSITO:
 * Unifica ambos sistemas de permisos:
 *   1. UserPermissions (permisos individuales por usuario)
 *   2. DEFAULT_ROLE_PERMISSIONS (permisos por defecto por rol)
 * 
 * FLUJO DE VERIFICACIÓN:
 *   1. OWNER/SUPER_ADMIN → Acceso completo (bypass)
 *   2. Mapear recurso HTTP → módulo del sistema
 *   3. Mapear acción HTTP → nivel de permiso
 *   4. Verificar permiso individual (UserPermissions) → Si tiene, permitir
 *   5. Si no tiene permiso individual → Verificar por rol (DEFAULT_ROLE_PERMISSIONS)
 *   6. Si no tiene ninguno → Denegar
 */
class PermissionService {
  /**
   * ========================================================================
   * MÉTODO PRINCIPAL: hasPermission
   * ========================================================================
   * 
   * ¿QUÉ HACE?
   * Verifica si un usuario tiene permiso para realizar una acción en un recurso.
   * 
   * ¿CÓMO FUNCIONA?
   * 1. Verifica si es OWNER/SUPER_ADMIN → Acceso completo
   * 2. Mapea recurso HTTP → módulo del sistema
   * 3. Mapea acción HTTP → nivel de permiso
   * 4. Verifica permiso individual (UserPermissions)
   * 5. Si no tiene, verifica permiso por rol (DEFAULT_ROLE_PERMISSIONS)
   * 
   * @param user - Usuario a verificar
   * @param resource - Recurso HTTP (ej: 'bovines', 'cattle', 'health')
   * @param action - Acción HTTP (ej: 'read', 'write', 'delete')
   * @returns true si tiene permiso, false si no
   */
  public hasPermission(
    user: User,
    resource: string,
    action: string
  ): boolean {
    try {
      // ============================================================
      // PASO 1: Verificar roles con acceso completo
      // ============================================================
      // ¿POR QUÉ?
      // OWNER y SUPER_ADMIN tienen acceso total al sistema.
      // No necesitamos verificar permisos específicos para ellos.
      if (user.role === UserRole.OWNER || user.role === UserRole.SUPER_ADMIN) {
        logger.debug(
          `Acceso completo otorgado a ${user.role}`,
          'PermissionService',
          { userId: user.id, resource, action }
        );
        return true;
      }

      // ============================================================
      // PASO 2: Mapear recurso HTTP → módulo del sistema
      // ============================================================
      // ¿POR QUÉ?
      // Las rutas pueden usar nombres variados ('cattle', 'bovines', 'animals')
      // pero el sistema de permisos usa nombres específicos ('bovines').
      // Necesitamos normalizar el nombre del recurso.
      const module = this.mapResourceToModule(resource);
      if (!module) {
        logger.warn(
          `Recurso no válido: ${resource}`,
          'PermissionService',
          { userId: user.id, resource, action }
        );
        return false; // Recurso no válido = sin permiso
      }

      // ============================================================
      // PASO 3: Mapear acción HTTP → nivel de permiso
      // ============================================================
      // ¿POR QUÉ?
      // Las rutas usan verbos variados ('read', 'view', 'get')
      // pero UserPermissions usa niveles jerárquicos ('READ', 'WRITE', 'ADMIN').
      // Necesitamos convertir la acción a un nivel de permiso.
      const permissionLevel = this.mapActionToPermissionLevel(action);
      if (!permissionLevel) {
        logger.warn(
          `Acción no válida: ${action}`,
          'PermissionService',
          { userId: user.id, resource, action, module }
        );
        return false; // Acción no válida = sin permiso
      }

      // ============================================================
      // PASO 4: Verificar permiso individual (UserPermissions)
      // ============================================================
      // ¿POR QUÉ?
      // Los usuarios pueden tener permisos personalizados en la BD.
      // Estos permisos tienen prioridad sobre los permisos por defecto del rol.
      // 
      // EJEMPLO:
      //   Usuario Juan (MANAGER) tiene:
      //     - Permiso por defecto: finance: ['read', 'budget']
      //     - Permiso personalizado: finance: 'NONE' (sin acceso)
      //   → El permiso personalizado tiene prioridad
      if (user.permissions) {
        const hasUserPermission = user.hasPermission(module, permissionLevel);
        if (hasUserPermission) {
          logger.debug(
            `Permiso individual otorgado`,
            'PermissionService',
            { userId: user.id, resource, action, module, permissionLevel }
          );
          return true; // ✅ Tiene permiso individual
        }
      }

      // ============================================================
      // PASO 5: Verificar permiso por rol (DEFAULT_ROLE_PERMISSIONS)
      // ============================================================
      // ¿POR QUÉ?
      // Si el usuario no tiene permiso personalizado, verificamos
      // los permisos por defecto de su rol.
      // 
      // EJEMPLO:
      //   Usuario Juan (MANAGER) no tiene permiso personalizado para 'bovines'.
      //   Verificamos DEFAULT_ROLE_PERMISSIONS[MANAGER].cattle
      //   → Si incluye 'read', tiene permiso
      const hasRolePermission = this.checkRoleBasedPermission(
        user.role,
        module,
        action
      );

      if (hasRolePermission) {
        logger.debug(
          `Permiso por rol otorgado`,
          'PermissionService',
          { userId: user.id, role: user.role, resource, action, module }
        );
        return true; // ✅ Tiene permiso por rol
      }

      // ============================================================
      // PASO 6: Sin permiso
      // ============================================================
      // Si llegamos aquí, el usuario no tiene permiso ni individual ni por rol.
      logger.debug(
        `Permiso denegado`,
        'PermissionService',
        { userId: user.id, role: user.role, resource, action, module, permissionLevel }
      );
      return false; // ❌ Sin permiso

    } catch (error) {
      // ============================================================
      // MANEJO DE ERRORES
      // ============================================================
      // Si hay un error, por seguridad denegamos el acceso.
      logger.error(
        'Error verificando permisos',
        'PermissionService',
        { userId: user.id, resource, action },
        error as Error
      );
      return false; // Por seguridad, denegar en caso de error
    }
  }

  /**
   * ========================================================================
   * MÉTODO HELPER: mapResourceToModule
   * ========================================================================
   * 
   * ¿QUÉ HACE?
   * Convierte un recurso HTTP (ej: 'cattle') a un módulo del sistema (ej: 'bovines').
   * 
   * ¿POR QUÉ?
   * Las rutas pueden usar nombres variados, pero el sistema de permisos
   * usa nombres específicos. Necesitamos normalizar.
   * 
   * @param resource - Recurso HTTP (ej: 'cattle', 'bovines', 'animals')
   * @returns Módulo del sistema o null si no es válido
   */
  private mapResourceToModule(
    resource: string
  ): keyof UserPermissions['modules'] | null {
    const normalizedResource = resource.toLowerCase().trim();
    return RESOURCE_TO_MODULE_MAP[normalizedResource] || null;
  }

  /**
   * ========================================================================
   * MÉTODO HELPER: mapActionToPermissionLevel
   * ========================================================================
   * 
   * ¿QUÉ HACE?
   * Convierte una acción HTTP (ej: 'read') a un nivel de permiso (ej: 'READ').
   * 
   * ¿POR QUÉ?
   * Las rutas usan verbos variados, pero UserPermissions usa niveles jerárquicos.
   * Necesitamos convertir la acción a un nivel de permiso.
   * 
   * @param action - Acción HTTP (ej: 'read', 'view', 'get', 'delete')
   * @returns Nivel de permiso o null si no es válido
   */
  private mapActionToPermissionLevel(
    action: string
  ): 'READ' | 'WRITE' | 'ADMIN' | null {
    const normalizedAction = action.toLowerCase().trim();
    return ACTION_TO_PERMISSION_LEVEL[normalizedAction] || null;
  }

  /**
   * ========================================================================
   * MÉTODO HELPER: checkRoleBasedPermission
   * ========================================================================
   * 
   * ¿QUÉ HACE?
   * Verifica si un rol tiene permiso para realizar una acción en un módulo,
   * usando el sistema DEFAULT_ROLE_PERMISSIONS.
   * 
   * ¿POR QUÉ?
   * Si el usuario no tiene permiso personalizado, verificamos los permisos
   * por defecto de su rol.
   * 
   * @param role - Rol del usuario
   * @param module - Módulo del sistema (de UserPermissions)
   * @param action - Acción HTTP original (ej: 'read', 'delete')
   * @returns true si el rol tiene permiso
   */
  private checkRoleBasedPermission(
    role: UserRole,
    module: keyof UserPermissions['modules'],
    action: string
  ): boolean {
    // Mapear módulo de UserPermissions → ModulePermissions
    const moduleKey = MODULE_TO_ROLE_SYSTEM_MAP[module];
    if (!moduleKey) {
      logger.warn(
        `No se pudo mapear módulo a sistema de roles`,
        'PermissionService',
        { role, module, action }
      );
      return false;
    }

    // Usar la función helper existente de role.ts
    // Esta función ya verifica DEFAULT_ROLE_PERMISSIONS[role][moduleKey]
    return hasModulePermission(role, moduleKey, action.toLowerCase());
  }

  /**
   * ========================================================================
   * MÉTODO: canPerformAction
   * ========================================================================
   * 
   * ¿QUÉ HACE?
   * Verifica si un usuario puede realizar una acción específica
   * (usando UserPermissions.actions).
   * 
   * ¿POR QUÉ?
   * Algunas acciones no son por módulo, sino acciones específicas
   * como 'canCreateRanch', 'canDeleteRecords', etc.
   * 
   * @param user - Usuario a verificar
   * @param action - Acción específica (ej: 'canCreateRanch')
   * @returns true si puede realizar la acción
   */
  public canPerformAction(
    user: User,
    action: keyof UserPermissions['actions']
  ): boolean {
    // OWNER y SUPER_ADMIN pueden realizar todas las acciones
    if (user.role === UserRole.OWNER || user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Usar el método del modelo User
    return user.canPerformAction(action);
  }

  /**
   * ========================================================================
   * MÉTODO: getUserPermissions
   * ========================================================================
   * 
   * ¿QUÉ HACE?
   * Obtiene todos los permisos de un usuario, combinando ambos sistemas.
   * 
   * ¿POR QUÉ?
   * Útil para mostrar al usuario qué permisos tiene, o para debugging.
   * 
   * @param user - Usuario
   * @returns Objeto con permisos individuales, acciones y permisos por rol
   */
  public getUserPermissions(user: User): {
    modules: UserPermissions['modules'];
    actions: UserPermissions['actions'];
    restrictions: UserPermissions['restrictions'];
    roleBased: ModulePermissions;
  } {
    return {
      modules: user.permissions.modules,
      actions: user.permissions.actions,
      restrictions: user.permissions.restrictions,
      roleBased: this.getRolePermissions(user.role)
    };
  }

  /**
   * ========================================================================
   * MÉTODO HELPER: getRolePermissions
   * ========================================================================
   * 
   * ¿QUÉ HACE?
   * Obtiene los permisos por defecto de un rol.
   * 
   * @param role - Rol del usuario
   * @returns Permisos por defecto del rol
   */
  private getRolePermissions(role: UserRole): ModulePermissions {
    return getRolePermissionsHelper(role);
  }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA (SINGLETON)
// ============================================================================
// ¿POR QUÉ SINGLETON?
// - No necesitamos múltiples instancias del servicio
// - Ahorra memoria y mejora rendimiento
// - Facilita el uso: import { permissionService } from './services/permission'
export const permissionService = new PermissionService();

