// controllers/auth/user.controller.ts
import { Request, Response } from 'express';
import { userService } from '../../services/auth';
import { ValidationError } from '../../utils/errorUtils';
import { UserRole } from '../../models/User';
import { canAssignRole, ROLE_CREATION_HIERARCHY } from '../../utils/roleHierarchy';
import logger from '../../utils/logger';

export class UserController {
    private readonly context = 'UserController';

    constructor() {
        this.getProfile = this.getProfile.bind(this);
        this.updateProfile = this.updateProfile.bind(this);
        this.listUsers = this.listUsers.bind(this);
        this.getUserById = this.getUserById.bind(this);
        this.updateUser = this.updateUser.bind(this);
        this.deactivateUser = this.deactivateUser.bind(this);
        this.activateUser = this.activateUser.bind(this);
    }

    /**
     * GET /api/users/profile
     * Obtiene el perfil del usuario autenticado
     */
    async getProfile(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'No autenticado'
                });
                return;
            }

            const profile = await userService.getUserProfile(userId);

            if (!profile) {
                res.status(404).json({
                    success: false,
                    error: 'Usuario no encontrado'
                });
                return;
            }

            res.json({
                success: true,
                data: profile
            });

        } catch (error) {
            logger.error('Error en getProfile', this.context, { userId: req.user?.id }, error as Error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * PUT /api/users/profile
     * Actualiza el perfil del usuario autenticado
     */
    async updateProfile(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const { firstName, lastName, phone, avatar } = req.body;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'No autenticado'
                });
                return;
            }

            const user = await userService.updateProfile(userId, {
                firstName,
                lastName,
                phone,
                avatar
            });

            res.json({
                success: true,
                data: {
                    id: user.id,
                    firstName: user.personalInfo.firstName,
                    lastName: user.personalInfo.lastName,
                    email: user.email,
                    phone: user.contactInfo.primaryPhone,
                    avatar: user.personalInfo.profilePhoto
                },
                message: 'Perfil actualizado exitosamente'
            });

        } catch (error) {
            logger.error('Error en updateProfile', this.context, { userId: req.user?.id, body: req.body }, error as Error);

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
     * GET /api/users
     * Lista usuarios (solo admin).
     *
     * Scoping por rancho:
     * - SUPER_ADMIN: ve todos los usuarios (puede filtrar por ranchId opcionalmente)
     * - OWNER: forzado a ver solo usuarios de su(s) rancho(s)
     * - MANAGER: forzado a ver solo usuarios de su rancho (con datos limitados)
     */
    async listUsers(req: Request, res: Response): Promise<void> {
        try {
            const requestingUser = req.user;
            const {
                search,
                role,
                status,
                isActive,
                ranchId,
                startDate,
                endDate,
                page = 1,
                limit = 20,
                sortBy = 'createdAt',
                sortOrder = 'DESC'
            } = req.query;

            // ── Determinar ranchId según rol del solicitante ─────────
            let effectiveRanchId = ranchId as string;

            if (req.userRole === UserRole.OWNER && requestingUser) {
                // OWNER: forzar filtro por sus ranchos
                const ownerRanchIds = requestingUser.ranchAccess
                    ?.filter(a => a.isActive)
                    .map(a => a.ranchId) || [];

                // Si pidió un ranchId específico, verificar que sea suyo
                if (effectiveRanchId) {
                    if (!ownerRanchIds.includes(effectiveRanchId)) {
                        res.status(403).json({
                            success: false,
                            error: 'Solo puedes ver usuarios de tus ranchos',
                            code: 'RANCH_ACCESS_DENIED'
                        });
                        return;
                    }
                } else {
                    // Si no pidió ranchId, usar el primero de sus ranchos
                    effectiveRanchId = ownerRanchIds[0];
                }
            } else if (
                (req.userRole === UserRole.MANAGER || req.userRole === UserRole.RANCH_MANAGER)
                && requestingUser
            ) {
                // MANAGER / RANCH_MANAGER: solo pueden VER usuarios de su rancho
                // (no gestionarlos). Forzamos el filtro a su rancho activo.
                const scopedRanchId = requestingUser.ranchAccess
                    ?.find(a => a.isActive)?.ranchId;
                effectiveRanchId = scopedRanchId || '';
            }

            const filters = {
                searchTerm: search as string,
                role: role ? (role as string).split(',') as UserRole[] : undefined,
                status: status ? (status as string).split(',') as any[] : undefined,
                isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
                ranchId: effectiveRanchId,
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                sortBy: sortBy as string,
                sortOrder: sortOrder as 'ASC' | 'DESC'
            };

            const result = await userService.listUsers(
                filters,
                parseInt(page as string),
                parseInt(limit as string)
            );

            res.json({
                success: true,
                data: result.users.map(user => ({
                    id: user.id,
                    userCode: user.userCode,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                    roleLabel: user.getRoleLabel(),
                    status: user.status,
                    fullName: user.getFullName(),
                    // Campos individuales para que la lista muestre nombre/iniciales
                    // y el modal de edición pueda precargar sin pedir el detalle.
                    firstName: user.personalInfo?.firstName,
                    lastName: user.personalInfo?.lastName,
                    phone: user.contactInfo?.primaryPhone,
                    isActive: user.isActive,
                    emailVerified: user.emailVerified,
                    lastLoginAt: user.lastLoginAt,
                    createdAt: user.createdAt ?? (user as any).get('created_at')
                })),
                pagination: result.pagination
            });

        } catch (error) {
            logger.error('Error en listUsers', this.context, { query: req.query }, error as Error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * GET /api/users/:id
     * Obtiene un usuario por ID (solo admin)
     */
    async getUserById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const user = await userService.getUserById(id);

            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'Usuario no encontrado'
                });
                return;
            }

            res.json({
                success: true,
                data: {
                    id: user.id,
                    userCode: user.userCode,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                    roleLabel: user.getRoleLabel(),
                    status: user.status,
                    fullName: user.getFullName(),
                    firstName: user.personalInfo.firstName,
                    lastName: user.personalInfo.lastName,
                    phone: user.contactInfo.primaryPhone,
                    isActive: user.isActive,
                    isVerified: user.isVerified,
                    emailVerified: user.emailVerified,
                    phoneVerified: user.phoneVerified,
                    verificationScore: user.getVerificationScore(),
                    lastLoginAt: user.lastLoginAt,
                    createdAt: user.createdAt,
                    professionalInfo: user.professionalInfo,
                    ranchAccess: user.ranchAccess,
                    permissions: user.permissions
                }
            });

        } catch (error) {
            logger.error('Error en getUserById', this.context, { id: req.params.id }, error as Error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * PUT /api/users/:id
     * Actualiza un usuario (solo admin)
     */
    async updateUser(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            const requestingRole = req.userRole;
            const {
                firstName,
                lastName,
                phone,
                email,
                role,
                status,
                isActive,
                emailVerified,
                permissions,
                ranchId,
                replaceRanchAccess,
                professionalInfo
            } = req.body;

            // Ámbito de ranchos del OWNER (para acotar el modo "mover"). Para
            // SUPER_ADMIN queda undefined → sin límite. Se rellena abajo.
            let ownerRanchScope: string[] | undefined = undefined;

            // ── Fix C: anti-escalada de rol en la edición ────────────────
            // Misma jerarquía que la creación (POST /api/admin/users). Sin
            // esto, un OWNER podía promover a un usuario a SUPER_ADMIN vía PUT.
            if (role) {
                // 1) Nadie puede cambiar su propio rol (evita auto-escalada).
                if (id === userId) {
                    res.status(403).json({
                        success: false,
                        error: 'No puedes cambiar tu propio rol',
                        code: 'SELF_ROLE_CHANGE_FORBIDDEN'
                    });
                    return;
                }
                // 2) El rol asignado debe estar permitido por la jerarquía.
                if (!canAssignRole(requestingRole, role as UserRole)) {
                    const allowed = ROLE_CREATION_HIERARCHY[requestingRole as string] || [];
                    res.status(403).json({
                        success: false,
                        error: `No puedes asignar el rol ${role}. Roles permitidos: ${allowed.join(', ')}`,
                        code: 'ROLE_HIERARCHY_VIOLATION'
                    });
                    return;
                }
            }

            // ── Scoping por rancho: OWNER solo edita usuarios de su rancho ─
            // (mismo criterio que deactivate/activate). SUPER_ADMIN sin límite.
            if (req.userRole === UserRole.OWNER && req.user) {
                const ownerRanchIds = req.user.ranchAccess
                    ?.filter(a => a.isActive)
                    .map(a => a.ranchId) || [];
                ownerRanchScope = ownerRanchIds;

                const targetUser = await userService.getUserById(id);
                if (targetUser) {
                    const targetInOwnerRanch = targetUser.ranchAccess?.some(
                        a => a.isActive && ownerRanchIds.includes(a.ranchId)
                    );
                    if (!targetInOwnerRanch) {
                        res.status(403).json({
                            success: false,
                            error: 'Solo puedes gestionar usuarios de tu rancho',
                            code: 'RANCH_ACCESS_DENIED'
                        });
                        return;
                    }
                }

                // Si asigna un rancho, debe ser uno de los suyos.
                if (ranchId && !ownerRanchIds.includes(ranchId)) {
                    res.status(403).json({
                        success: false,
                        error: 'Solo puedes asignar usuarios a tus propios ranchos',
                        code: 'RANCH_ACCESS_DENIED'
                    });
                    return;
                }
            }

            const user = await userService.updateUser(
                id,
                {
                    firstName,
                    lastName,
                    phone,
                    email,
                    role,
                    status,
                    isActive,
                    emailVerified,
                    permissions,
                    ranchId,
                    replaceRanchAccess,
                    professionalInfo,
                    ownerRanchScope
                },
                userId
            );

            res.json({
                success: true,
                data: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    isActive: user.isActive,
                    emailVerified: user.emailVerified,
                    ranchAccess: user.ranchAccess?.filter(a => a.isActive).map(a => ({
                        ranchId: a.ranchId,
                        ranchName: a.ranchName,
                        accessLevel: a.accessLevel
                    }))
                },
                message: 'Usuario actualizado exitosamente'
            });

        } catch (error) {
            logger.error('Error en updateUser', this.context, { id: req.params.id, body: req.body }, error as Error);

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
     * DELETE /api/users/:id
     * Desactiva un usuario (solo admin).
     *
     * Protecciones:
     * 1. No puedes desactivarte a ti mismo
     * 2. OWNER solo puede desactivar usuarios de su rancho
     */
    async deactivateUser(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const requestingUser = req.user;
            const userId = requestingUser?.id;
            const { reason } = req.body;

            // ── Protección anti-auto-desactivación ──────────────────
            if (id === userId) {
                res.status(403).json({
                    success: false,
                    error: 'No puedes desactivar tu propia cuenta',
                    code: 'SELF_DEACTIVATION_DENIED'
                });
                return;
            }

            // ── OWNER: solo puede desactivar usuarios de su rancho ──
            if (req.userRole === UserRole.OWNER && requestingUser) {
                const ownerRanchIds = requestingUser.ranchAccess
                    ?.filter(a => a.isActive)
                    .map(a => a.ranchId) || [];

                const targetUser = await userService.getUserById(id);
                if (targetUser) {
                    const targetInOwnerRanch = targetUser.ranchAccess?.some(
                        a => a.isActive && ownerRanchIds.includes(a.ranchId)
                    );
                    if (!targetInOwnerRanch) {
                        res.status(403).json({
                            success: false,
                            error: 'Solo puedes gestionar usuarios de tu rancho',
                            code: 'RANCH_ACCESS_DENIED'
                        });
                        return;
                    }
                }
            }

            await userService.deactivateUser(id, userId || 'system', reason);

            res.json({
                success: true,
                message: 'Usuario desactivado exitosamente'
            });

        } catch (error) {
            logger.error('Error en deactivateUser', this.context, { id: req.params.id }, error as Error);

            if (error instanceof ValidationError) {
                res.status(404).json({
                    success: false,
                    error: error.message,
                    code: 'USER_NOT_FOUND'
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
     * POST /api/users/:id/activate
     * Activa un usuario (solo admin).
     *
     * Protección: OWNER solo puede activar usuarios de su rancho.
     */
    async activateUser(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const requestingUser = req.user;
            const userId = requestingUser?.id;

            // ── OWNER: solo puede activar usuarios de su rancho ─────
            if (req.userRole === UserRole.OWNER && requestingUser) {
                const ownerRanchIds = requestingUser.ranchAccess
                    ?.filter(a => a.isActive)
                    .map(a => a.ranchId) || [];

                const targetUser = await userService.getUserById(id);
                if (targetUser) {
                    const targetInOwnerRanch = targetUser.ranchAccess?.some(
                        a => a.isActive && ownerRanchIds.includes(a.ranchId)
                    );
                    if (!targetInOwnerRanch) {
                        res.status(403).json({
                            success: false,
                            error: 'Solo puedes gestionar usuarios de tu rancho',
                            code: 'RANCH_ACCESS_DENIED'
                        });
                        return;
                    }
                }
            }

            await userService.activateUser(id, userId || 'system');

            res.json({
                success: true,
                message: 'Usuario activado exitosamente'
            });

        } catch (error) {
            logger.error('Error en activateUser', this.context, { id: req.params.id }, error as Error);

            if (error instanceof ValidationError) {
                res.status(404).json({
                    success: false,
                    error: error.message,
                    code: 'USER_NOT_FOUND'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }
}

export const userController = new UserController();