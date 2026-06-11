// src/controllers/admin.controller.ts
import { Request, Response } from 'express';
import { updateRanchProductionJob } from '../jobs/updateRanchProduction';
import { userService } from '../services/auth';
import { ValidationError } from '../utils/errorUtils';
import { UserRole } from '../models/User';
import logger from '../utils/logger';

// ============================================================================
// JERARQUÍA DE ROLES
// ============================================================================
// Define qué roles puede crear cada rol.
// La clave es el rol del solicitante, el valor es la lista de roles que puede crear.
// SUPER_ADMIN puede crear cualquier rol incluyendo otro SUPER_ADMIN.
// OWNER puede crear todos los roles debajo del suyo.

const ROLE_CREATION_HIERARCHY: Record<string, UserRole[]> = {
    [UserRole.SUPER_ADMIN]: [
        UserRole.SUPER_ADMIN,
        UserRole.OWNER,
        UserRole.RANCH_MANAGER,
        UserRole.MANAGER,
        UserRole.VETERINARIAN,
        UserRole.WORKER,
        UserRole.VIEWER
    ],
    [UserRole.OWNER]: [
        UserRole.RANCH_MANAGER,
        UserRole.MANAGER,
        UserRole.VETERINARIAN,
        UserRole.WORKER,
        UserRole.VIEWER
    ]
};

export class AdminController {
    private readonly context = 'AdminController';

    constructor() {
        this.createUser = this.createUser.bind(this);
        this.getAssignableRoles = this.getAssignableRoles.bind(this);
        this.triggerProductionUpdate = this.triggerProductionUpdate.bind(this);
    }

    // ========================================================================
    // GESTIÓN DE USUARIOS
    // ========================================================================

    /**
     * POST /api/admin/users
     * Crea un nuevo usuario.
     *
     * Validaciones de negocio:
     * 1. Solo SUPER_ADMIN y OWNER pueden crear usuarios
     * 2. El rol asignado debe estar permitido por la jerarquía
     * 3. OWNER solo puede asignar usuarios a sus propios ranchos
     */
    async createUser(req: Request, res: Response): Promise<void> {
        try {
            const requestingUser = req.user;
            const requestingRole = req.userRole;

            if (!requestingUser || !requestingRole) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            const { email, password, confirmPassword, firstName, lastName, phone, role, ranchId } = req.body;

            // ── Validar que el solicitante puede crear usuarios ──────────
            const allowedRoles = ROLE_CREATION_HIERARCHY[requestingRole];
            if (!allowedRoles) {
                res.status(403).json({
                    success: false,
                    error: 'No tienes permisos para crear usuarios',
                    code: 'INSUFFICIENT_PERMISSIONS'
                });
                return;
            }

            // ── Validar jerarquía de roles ───────────────────────────────
            const targetRole = role || UserRole.VIEWER;
            if (!allowedRoles.includes(targetRole)) {
                res.status(403).json({
                    success: false,
                    error: `No puedes crear usuarios con el rol ${targetRole}. Roles permitidos: ${allowedRoles.join(', ')}`,
                    code: 'ROLE_HIERARCHY_VIOLATION'
                });
                return;
            }

            // ── OWNER: solo puede asignar a sus propios ranchos ─────────
            if (requestingRole === UserRole.OWNER && ranchId) {
                const ownerRanchIds = requestingUser.ranchAccess
                    ?.filter(a => a.isActive)
                    .map(a => a.ranchId) || [];

                if (!ownerRanchIds.includes(ranchId)) {
                    res.status(403).json({
                        success: false,
                        error: 'Solo puedes asignar usuarios a tus propios ranchos',
                        code: 'RANCH_ACCESS_DENIED'
                    });
                    return;
                }
            }

            // ── Crear usuario ────────────────────────────────────────────
            const user = await userService.createUser({
                email,
                password,
                confirmPassword,
                firstName,
                lastName,
                phone,
                role: targetRole,
                ranchId,
                createdBy: requestingUser.id,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Usuario creado por admin: ${email}`, this.context, {
                createdBy: requestingUser.id,
                createdRole: targetRole,
                newUserId: user.id
            });

            res.status(201).json({
                success: true,
                data: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                    status: user.status,
                    userCode: user.userCode,
                    fullName: user.getFullName(),
                    isActive: user.isActive,
                    createdAt: user.createdAt
                },
                message: `Usuario ${email} creado exitosamente con rol ${targetRole}`
            });

        } catch (error) {
            logger.error('Error en createUser (admin)', this.context, {
                body: { ...req.body, password: '[REDACTED]', confirmPassword: '[REDACTED]' }
            }, error as Error);

            if (error instanceof ValidationError) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    code: 'VALIDATION_ERROR'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * GET /api/admin/roles
     * Retorna los roles que el usuario actual puede asignar.
     * Útil para que el frontend sepa qué opciones mostrar en el select de roles.
     */
    async getAssignableRoles(req: Request, res: Response): Promise<void> {
        try {
            const requestingRole = req.userRole;

            if (!requestingRole) {
                res.status(401).json({ success: false, error: 'No autenticado' });
                return;
            }

            const allowedRoles = ROLE_CREATION_HIERARCHY[requestingRole] || [];

            const roleLabels: Record<string, string> = {
                [UserRole.SUPER_ADMIN]: 'Super Administrador',
                [UserRole.OWNER]: 'Propietario',
                [UserRole.RANCH_MANAGER]: 'Gerente de Rancho',
                [UserRole.MANAGER]: 'Administrador',
                [UserRole.VETERINARIAN]: 'Veterinario',
                [UserRole.WORKER]: 'Trabajador',
                [UserRole.VIEWER]: 'Visitante'
            };

            res.json({
                success: true,
                data: allowedRoles.map(role => ({
                    value: role,
                    label: roleLabels[role] || role
                }))
            });

        } catch (error) {
            logger.error('Error en getAssignableRoles', this.context, {}, error as Error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    // ========================================================================
    // JOBS DEL SISTEMA
    // ========================================================================

    /**
     * POST /api/admin/jobs/update-production
     * Dispara manualmente el job de actualización de producción.
     * Se ejecuta en segundo plano sin bloquear la respuesta.
     */
    async triggerProductionUpdate(req: Request, res: Response): Promise<void> {
        try {
            updateRanchProductionJob().catch(err => {
                logger.error('Error en job ejecutado manualmente', this.context, { error: err });
            });

            res.status(202).json({
                success: true,
                message: 'Job de actualización de producción iniciado en segundo plano',
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            logger.error('Error al iniciar job manual', this.context, { error });
            res.status(500).json({
                success: false,
                error: 'Error interno al iniciar el job',
            });
        }
    }
}

export const adminController = new AdminController();