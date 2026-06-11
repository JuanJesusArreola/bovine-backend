// services/auth/UserService.ts
import { Op, Transaction } from 'sequelize';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import logger from '../../utils/logger';
import { ensureError } from '../../utils/errorUtils';
import { ValidationError } from '../../utils/errorUtils';
import User, {
    UserAttributes,
    UserCreationAttributes,
    UserRole,
    UserStatus,
    AccessLevel,
    VerificationStatus,
    UserPermissions,
    PersonalInfo,
    ContactInfo,
    ProfessionalInfo,
    SystemSettings,
    PushToken
} from '../../models/User';
import { tokenService } from './TokenService';
import { securityEventService } from './SecurityEventService';
import { EventType, EventSeverity } from '../../models/SecurityEvent';
import { RevocationReason } from '../../models/TokenBlacklist';
import sequelize from '../../config/database';

// ============================================================================
// INTERFACES
// ============================================================================

export interface CreateUserDTO {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role?: UserRole;
    ranchId?: string;
    createdBy?: string;
    ipAddress?: string;
    userAgent?: string;
}

export interface UpdateUserDTO {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    role?: UserRole;
    status?: UserStatus;
    personalInfo?: Partial<PersonalInfo>;
    contactInfo?: Partial<ContactInfo>;
    professionalInfo?: Partial<ProfessionalInfo>;
    systemSettings?: Partial<SystemSettings>;
    permissions?: Partial<UserPermissions>;
    isActive?: boolean;
}

export interface UserFilters {
    searchTerm?: string;
    role?: UserRole[];
    status?: UserStatus[];
    isActive?: boolean;
    ranchId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

export interface UserListResponse {
    users: User[];
    count: number;
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface UserProfileResponse {
    id: string;
    userCode: string;
    email: string;
    username: string;
    role: string;
    roleLabel: string;
    status: string;
    fullName: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    phone: string;
    verificationScore: number;
    isActive: boolean;
    isVerified: boolean;
    emailVerified: boolean;
    phoneVerified: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
    ranchAccess?: Array<{
        ranchId: string;
        ranchName: string;
        accessLevel: string;
        isActive: boolean;
    }>;
}

// ============================================================================
// CONSTANTES
// ============================================================================

const DEFAULT_PERMISSIONS_BY_ROLE: Record<UserRole, UserPermissions> = {
    [UserRole.SUPER_ADMIN]: {
        modules: {
            bovines: 'ADMIN',
            health: 'ADMIN',
            reproduction: 'ADMIN',
            finance: 'ADMIN',
            inventory: 'ADMIN',
            production: 'ADMIN',
            locations: 'ADMIN',
            reports: 'ADMIN',
            users: 'ADMIN',
            settings: 'ADMIN'
        },
        actions: {
            canCreateRanch: true,
            canDeleteRecords: true,
            canExportData: true,
            canImportData: true,
            canAccessAnalytics: true,
            canManageUsers: true,
            canApproveTransactions: true,
            canPrescribeMedications: true,
            canPerformSurgery: true,
            canAccessFinancials: true
        },
        restrictions: {}
    },
    [UserRole.OWNER]: {
        modules: {
            bovines: 'ADMIN',
            health: 'ADMIN',
            reproduction: 'ADMIN',
            finance: 'ADMIN',
            inventory: 'ADMIN',
            production: 'ADMIN',
            locations: 'ADMIN',
            reports: 'ADMIN',
            users: 'WRITE',
            settings: 'ADMIN'
        },
        actions: {
            canCreateRanch: true,
            canDeleteRecords: true,
            canExportData: true,
            canImportData: true,
            canAccessAnalytics: true,
            canManageUsers: true,
            canApproveTransactions: true,
            canPrescribeMedications: false,
            canPerformSurgery: false,
            canAccessFinancials: true
        },
        restrictions: {}
    },
    [UserRole.RANCH_MANAGER]: {
        modules: {
            bovines: 'ADMIN',
            health: 'WRITE',
            reproduction: 'ADMIN',
            finance: 'READ',
            inventory: 'ADMIN',
            production: 'ADMIN',
            locations: 'ADMIN',
            reports: 'ADMIN',
            users: 'READ',
            settings: 'WRITE'
        },
        actions: {
            canCreateRanch: false,
            canDeleteRecords: false,
            canExportData: true,
            canImportData: true,
            canAccessAnalytics: true,
            canManageUsers: false,
            canApproveTransactions: false,
            canPrescribeMedications: false,
            canPerformSurgery: false,
            canAccessFinancials: true
        },
        restrictions: {}
    },
    [UserRole.MANAGER]: {
        modules: {
            bovines: 'WRITE',
            health: 'READ',
            reproduction: 'WRITE',
            finance: 'READ',
            inventory: 'WRITE',
            production: 'WRITE',
            locations: 'WRITE',
            reports: 'WRITE',
            users: 'READ',
            settings: 'READ'
        },
        actions: {
            canCreateRanch: false,
            canDeleteRecords: false,
            canExportData: true,
            canImportData: true,
            canAccessAnalytics: true,
            canManageUsers: false,
            canApproveTransactions: false,
            canPrescribeMedications: false,
            canPerformSurgery: false,
            canAccessFinancials: false
        },
        restrictions: {}
    },
    [UserRole.VETERINARIAN]: {
        modules: {
            bovines: 'READ',
            health: 'ADMIN',
            reproduction: 'WRITE',
            finance: 'NONE',
            inventory: 'WRITE',
            production: 'READ',
            locations: 'READ',
            reports: 'WRITE',
            users: 'NONE',
            settings: 'NONE'
        },
        actions: {
            canCreateRanch: false,
            canDeleteRecords: false,
            canExportData: true,
            canImportData: false,
            canAccessAnalytics: true,
            canManageUsers: false,
            canApproveTransactions: false,
            canPrescribeMedications: true,
            canPerformSurgery: true,
            canAccessFinancials: false
        },
        restrictions: {}
    },
    [UserRole.WORKER]: {
        modules: {
            bovines: 'WRITE',
            health: 'READ',
            reproduction: 'READ',
            finance: 'NONE',
            inventory: 'READ',
            production: 'WRITE',
            locations: 'READ',
            reports: 'READ',
            users: 'NONE',
            settings: 'NONE'
        },
        actions: {
            canCreateRanch: false,
            canDeleteRecords: false,
            canExportData: false,
            canImportData: false,
            canAccessAnalytics: false,
            canManageUsers: false,
            canApproveTransactions: false,
            canPrescribeMedications: false,
            canPerformSurgery: false,
            canAccessFinancials: false
        },
        restrictions: {}
    },
    [UserRole.VIEWER]: {
        modules: {
            bovines: 'READ',
            health: 'READ',
            reproduction: 'READ',
            finance: 'NONE',
            inventory: 'READ',
            production: 'READ',
            locations: 'READ',
            reports: 'READ',
            users: 'NONE',
            settings: 'NONE'
        },
        actions: {
            canCreateRanch: false,
            canDeleteRecords: false,
            canExportData: false,
            canImportData: false,
            canAccessAnalytics: false,
            canManageUsers: false,
            canApproveTransactions: false,
            canPrescribeMedications: false,
            canPerformSurgery: false,
            canAccessFinancials: false
        },
        restrictions: {}
    }
};

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class UserService {
    private readonly context = 'UserService';

    // ==========================================================================
    // CRUD PRINCIPAL
    // ==========================================================================

    /**
     * Crea un nuevo usuario
     */
    async createUser(data: CreateUserDTO, transaction?: Transaction): Promise<User> {
        const t = transaction || await sequelize.transaction();
        const isOwnTransaction = !transaction;
        const startTime = Date.now();

        try {
            // Validar contraseñas
            if (data.password !== data.confirmPassword) {
                throw new ValidationError('Las contraseñas no coinciden');
            }

            // Validar fortaleza de contraseña
            this.validatePasswordStrength(data.password);

            // Generar username único
            let baseUsername = `${data.firstName.toLowerCase()}.${data.lastName.toLowerCase()}`.replace(/[^a-z0-9.]/g, '');
            if (baseUsername === '.' || baseUsername === '') {
                baseUsername = `user${Date.now().toString().slice(-4)}`;
            }
            let username = baseUsername;
            let counter = 0;
            while (await User.findOne({ where: { username }, transaction: t })) {
                counter++;
                username = `${baseUsername}${counter}`;
            }

            // Verificar si el usuario ya existe
            const existingUser = await User.findOne({
                where: {
                    [Op.or]: [
                        { email: data.email.toLowerCase() },
                        { username: this.generateUsername(data.firstName, data.lastName) }
                    ]
                },
                transaction: t
            });

            if (existingUser) {
                throw new ValidationError('El usuario ya existe con este email');
            }

            // Hash de contraseña
            const hashedPassword = await bcrypt.hash(data.password, 12);

            // Obtener permisos por defecto según rol
            const role = data.role || UserRole.VIEWER;
            const defaultPermissions = this.getDefaultPermissionsByRole(role);

            // 🔥 GENERAR userCode EXPLÍCITAMENTE (evitar problemas con hook)
            const timestamp = Date.now().toString().slice(-6);
            const rolePrefix = role.substring(0, 2).toUpperCase();
            let userCode = `${rolePrefix}${timestamp}`;
            let codeCounter = 0;
            while (await User.findOne({ where: { userCode }, transaction: t })) {
                codeCounter++;
                userCode = `${rolePrefix}${timestamp}${codeCounter}`;
            }

            // 🔥 CREAR systemSettings EXPLÍCITAMENTE
            const systemSettings = {
                theme: 'LIGHT',
                language: 'es',
                timezone: 'America/Mexico_City',
                dateFormat: 'DD/MM/YYYY',
                timeFormat: '24H',
                currency: 'MXN',
                units: 'METRIC',
                notifications: {
                    email: 'ALL',
                    sms: 'IMPORTANT_ONLY',
                    push: 'ALL',
                    whatsapp: 'IMPORTANT_ONLY'
                },
                privacy: {
                    profileVisibility: 'PRIVATE',
                    showOnlineStatus: true,
                    allowMessages: 'CONTACTS_ONLY',
                    shareLocation: false
                },
                dashboard: {
                    widgets: [],
                    layout: 'GRID',
                    refreshInterval: 30
                },
                security: {
                    twoFactorEnabled: false,
                    sessionTimeout: 480,
                    loginNotifications: true,
                    deviceTracking: true
                }
            };

            // 🔥 CREAR securityInfo EXPLÍCITAMENTE
            const securityInfo = {
                passwordLastChanged: new Date()
            };

            // 🔥 CREAR complianceInfo EXPLÍCITAMENTE
            const complianceInfo = {
                dataProcessingConsent: true,
                marketingConsent: false,
                consentDate: new Date(),
                gdprCompliant: true,
                dataRetentionPeriod: 365 * 7
            };

            // Crear usuario con TODOS los campos requeridos
            const user = await User.create({
                userCode,  // ← PASADO EXPLÍCITAMENTE
                email: data.email.toLowerCase(),
                password: hashedPassword,
                username,
                role,
                status: UserStatus.PENDING_VERIFICATION,
                accessLevel: AccessLevel.BASIC,
                verificationStatus: VerificationStatus.UNVERIFIED,
                personalInfo: {
                    firstName: data.firstName,
                    lastName: data.lastName
                },
                contactInfo: {
                    primaryEmail: data.email.toLowerCase(),
                    primaryPhone: data.phone || '0000000000',
                    address: {
                        street: '',
                        city: '',
                        state: '',
                        country: 'México'
                    }
                },
                systemSettings,      // ← PASADO EXPLÍCITAMENTE
                securityInfo,        // ← PASADO EXPLÍCITAMENTE
                complianceInfo,      // ← PASADO EXPLÍCITAMENTE
                permissions: defaultPermissions,
                termsAccepted: true,
                privacyPolicyAccepted: true,
                isActive: true,
                isVerified: false,
                emailVerified: false,
                phoneVerified: false,
                createdBy: data.createdBy || null,
                pushTokens: []       // ← PASADO EXPLÍCITAMENTE
            } as UserCreationAttributes, { transaction: t });



            if (isOwnTransaction) await t.commit();

            // Registrar evento de seguridad
            await securityEventService.logEvent({
                userId: user.id,
                eventType: EventType.ADMIN_ACTION,
                severity: EventSeverity.MEDIUM,
                description: `Usuario creado: ${user.email} con rol ${role}`,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                additionalData: { createdBy: data.createdBy, role }
            });

            const duration = Date.now() - startTime;

            logger.info(`Usuario creado: ${user.email}`, this.context, {
                userId: user.id,
                role,
                durationMs: duration
            });

            return user;

        } catch (error) {
            if (isOwnTransaction) await t.rollback();
            // 🔥 LOG DETALLADO DEL ERROR
            console.error('❌ ERROR DETALLADO en createUser:');
            console.error('  - Nombre del error:', (error as Error).name);
            console.error('  - Mensaje:', (error as Error).message);

            if ((error as any).errors) {
                console.error('  - Errores de validación:');
                (error as any).errors.forEach((err: any, idx: number) => {
                    console.error(`    ${idx + 1}. Campo: ${err.path}, Mensaje: ${err.message}, Valor: ${err.value}`);
                });
            }

            logger.error('Error creando usuario', this.context, { data }, error as Error);
            throw error;
        }
    }

    /**
     * Obtiene usuario por ID
     */
    async getUserById(id: string): Promise<User | null> {
        try {
            return await User.findByPk(id);
        } catch (error) {
            logger.error(`Error obteniendo usuario ${id}`, this.context, { id }, error as Error);
            throw error;
        }
    }

    /**
     * Obtiene usuario por email
     */
    async getUserByEmail(email: string): Promise<User | null> {
        try {
            return await User.findOne({
                where: { email: email.toLowerCase() }
            });
        } catch (error) {
            logger.error(`Error obteniendo usuario por email ${email}`, this.context, { email }, error as Error);
            throw error;
        }
    }

    /**
     * Obtiene usuario por username
     */
    async getUserByUsername(username: string): Promise<User | null> {
        try {
            return await User.findOne({
                where: { username }
            });
        } catch (error) {
            logger.error(`Error obteniendo usuario por username ${username}`, this.context, { username }, error as Error);
            throw error;
        }
    }

    /**
     * Lista usuarios con filtros
     */
    async listUsers(
        filters: UserFilters = {},
        page: number = 1,
        limit: number = 20
    ): Promise<UserListResponse> {
        try {
            const where: any = {};

            if (filters.searchTerm) {
                where[Op.or] = [
                    { email: { [Op.iLike]: `%${filters.searchTerm}%` } },
                    { username: { [Op.iLike]: `%${filters.searchTerm}%` } },
                    { personalInfo: { [Op.contains]: { firstName: filters.searchTerm } } },
                    { personalInfo: { [Op.contains]: { lastName: filters.searchTerm } } }
                ];
            }

            if (filters.role?.length) where.role = { [Op.in]: filters.role };
            if (filters.status?.length) where.status = { [Op.in]: filters.status };
            if (filters.isActive !== undefined) where.isActive = filters.isActive;

            if (filters.ranchId) {
                where.ranchAccess = { [Op.contains]: [{ ranchId: filters.ranchId, isActive: true }] };
            }

            if (filters.startDate || filters.endDate) {
                where.createdAt = {};
                if (filters.startDate) where.createdAt[Op.gte] = filters.startDate;
                if (filters.endDate) where.createdAt[Op.lte] = filters.endDate;
            }

            const offset = (page - 1) * limit;

            const sortMap: Record<string, string> = {
                createdAt: 'created_at',
                updatedAt: 'updated_at',
                email: 'email',
                username: 'username',
                role: 'role',
                status: 'status'
            };

            const sortBy = sortMap[filters.sortBy || 'createdAt'] || 'created_at';
            const sortOrder = filters.sortOrder || 'DESC';

            const { rows, count } = await User.findAndCountAll({
                where,
                limit,
                offset,
                order: [[sortBy, sortOrder]]
            });

            const totalPages = Math.ceil(count / limit);

            return {
                users: rows,
                count,
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            };

        } catch (error) {
            logger.error('Error listando usuarios', this.context, { filters }, error as Error);
            throw error;
        }
    }

    /**
     * Actualiza un usuario
     */
    async updateUser(
        userId: string,
        data: UpdateUserDTO,
        updatedBy?: string,
        transaction?: Transaction
    ): Promise<User> {
        const t = transaction || await sequelize.transaction();
        const isOwnTransaction = !transaction;
        const startTime = Date.now();

        try {
            const user = await User.findByPk(userId, { transaction: t });
            if (!user) {
                throw new ValidationError(`Usuario con ID ${userId} no encontrado`);
            }

            const updateData: any = {};

            if (data.firstName || data.lastName) {
                updateData.personalInfo = {
                    ...user.personalInfo,
                    firstName: data.firstName ?? user.personalInfo.firstName,
                    lastName: data.lastName ?? user.personalInfo.lastName
                };
            }

            if (data.phone) {
                updateData.contactInfo = {
                    ...user.contactInfo,
                    primaryPhone: data.phone
                };
            }

            if (data.email && data.email !== user.email) {
                const existing = await User.findOne({
                    where: { email: data.email.toLowerCase() },
                    transaction: t
                });
                if (existing) {
                    throw new ValidationError(`El email ${data.email} ya está en uso`);
                }
                updateData.email = data.email.toLowerCase();
                updateData.emailVerified = false;
                updateData.contactInfo = {
                    ...user.contactInfo,
                    primaryEmail: data.email.toLowerCase()
                };
            }

            if (data.role && data.role !== user.role) {
                updateData.role = data.role;
                updateData.permissions = this.getDefaultPermissionsByRole(data.role);
            }

            if (data.status) updateData.status = data.status;
            if (data.isActive !== undefined) updateData.isActive = data.isActive;

            if (data.personalInfo) {
                updateData.personalInfo = { ...user.personalInfo, ...data.personalInfo };
            }

            if (data.contactInfo) {
                updateData.contactInfo = { ...user.contactInfo, ...data.contactInfo };
            }

            if (data.professionalInfo) {
                updateData.professionalInfo = { ...user.professionalInfo, ...data.professionalInfo };
            }

            if (data.systemSettings) {
                updateData.systemSettings = { ...user.systemSettings, ...data.systemSettings };
            }

            if (data.permissions) {
                updateData.permissions = { ...user.permissions, ...data.permissions };
            }

            updateData.updatedBy = updatedBy;

            await user.update(updateData, { transaction: t });

            if (isOwnTransaction) await t.commit();

            const duration = Date.now() - startTime;

            logger.info(`Usuario actualizado: ${user.email}`, this.context, {
                userId,
                updatedBy,
                durationMs: duration
            });

            return user;

        } catch (error) {
            if (isOwnTransaction) await t.rollback();
            logger.error(`Error actualizando usuario ${userId}`, this.context, { data }, error as Error);
            throw error;
        }
    }

    /**
     * Desactiva un usuario (soft delete)
     */
    async deactivateUser(userId: string, deactivatedBy: string, reason?: string): Promise<void> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            const user = await User.findByPk(userId, { transaction });
            if (!user) {
                throw new ValidationError(`Usuario con ID ${userId} no encontrado`);
            }

            await user.update({
                isActive: false,
                status: UserStatus.INACTIVE,
                updatedBy: deactivatedBy
            }, { transaction });

            // Revocar todos los tokens del usuario
            await tokenService.revokeAllUserTokens(userId, RevocationReason.ACCOUNT_LOCKED);

            // Registrar evento de seguridad
            await securityEventService.logEvent({
                userId,
                eventType: EventType.ACCOUNT_LOCKED,
                severity: EventSeverity.HIGH,
                description: `Usuario desactivado: ${user.email}${reason ? ` - Motivo: ${reason}` : ''}`,
                additionalData: { deactivatedBy, reason }
            });

            await transaction.commit();

            const duration = Date.now() - startTime;

            logger.info(`Usuario desactivado: ${user.email}`, this.context, {
                userId,
                deactivatedBy,
                durationMs: duration
            });

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error desactivando usuario ${userId}`, this.context, { userId }, error as Error);
            throw error;
        }
    }

    /**
     * Activa un usuario
     */
    async activateUser(userId: string, activatedBy: string): Promise<void> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            const user = await User.findByPk(userId, { transaction });
            if (!user) {
                throw new ValidationError(`Usuario con ID ${userId} no encontrado`);
            }

            await user.update({
                isActive: true,
                status: UserStatus.ACTIVE,
                updatedBy: activatedBy
            }, { transaction });

            // Registrar evento de seguridad
            await securityEventService.logEvent({
                userId,
                eventType: EventType.ACCOUNT_UNLOCKED,
                severity: EventSeverity.MEDIUM,
                description: `Usuario activado: ${user.email}`,
                additionalData: { activatedBy }
            });

            await transaction.commit();

            const duration = Date.now() - startTime;

            logger.info(`Usuario activado: ${user.email}`, this.context, {
                userId,
                activatedBy,
                durationMs: duration
            });

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error activando usuario ${userId}`, this.context, { userId }, error as Error);
            throw error;
        }
    }

    // ==========================================================================
    // PERFIL DE USUARIO
    // ==========================================================================

    /**
     * Obtiene perfil de usuario formateado
     */
    async getUserProfile(userId: string): Promise<UserProfileResponse | null> {
        try {
            const user = await User.findByPk(userId);
            if (!user) return null;

            return {
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
                avatar: user.personalInfo.profilePhoto,
                phone: user.contactInfo.primaryPhone,
                verificationScore: user.getVerificationScore(),
                isActive: user.isActive,
                isVerified: user.isVerified,
                emailVerified: user.emailVerified,
                phoneVerified: user.phoneVerified,
                lastLoginAt: user.lastLoginAt,
                createdAt: user.createdAt,
                ranchAccess: user.ranchAccess?.filter(access => access.isActive).map(access => ({
                    ranchId: access.ranchId,
                    ranchName: access.ranchName,
                    accessLevel: access.accessLevel,
                    isActive: access.isActive
                }))
            };

        } catch (error) {
            logger.error(`Error obteniendo perfil de usuario ${userId}`, this.context, { userId }, error as Error);
            throw error;
        }
    }

    /**
     * Actualiza perfil de usuario (solo campos permitidos)
     */
    async updateProfile(
        userId: string,
        data: {
            firstName?: string;
            lastName?: string;
            phone?: string;
            avatar?: string;
        }
    ): Promise<User> {
        const startTime = Date.now();

        try {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new ValidationError(`Usuario con ID ${userId} no encontrado`);
            }

            const updateData: any = {
                personalInfo: {
                    ...user.personalInfo,
                    firstName: data.firstName ?? user.personalInfo.firstName,
                    lastName: data.lastName ?? user.personalInfo.lastName,
                    profilePhoto: data.avatar ?? user.personalInfo.profilePhoto
                },
                contactInfo: {
                    ...user.contactInfo,
                    primaryPhone: data.phone ?? user.contactInfo.primaryPhone
                }
            };

            await user.update(updateData);

            const duration = Date.now() - startTime;

            logger.info(`Perfil actualizado para usuario ${userId}`, this.context, {
                userId,
                updatedFields: Object.keys(data),
                durationMs: duration
            });

            return user;

        } catch (error) {
            logger.error(`Error actualizando perfil de usuario ${userId}`, this.context, { data }, error as Error);
            throw error;
        }
    }

    // ==========================================================================
    // VERIFICACIÓN
    // ==========================================================================

    /**
     * Verifica email de usuario
     */
    async verifyUserEmail(userId: string, ipAddress?: string, userAgent?: string): Promise<boolean> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            const user = await User.findByPk(userId, { transaction });
            if (!user) return false;

            if (user.emailVerified) return true;

            await user.update({
                emailVerified: true,
                verificationStatus: user.phoneVerified
                    ? VerificationStatus.FULLY_VERIFIED
                    : VerificationStatus.EMAIL_VERIFIED,
                status: UserStatus.ACTIVE,
                updatedBy: userId
            }, { transaction });

            await transaction.commit();

            await securityEventService.logEmailVerification(userId, user.email, ipAddress, userAgent);

            const duration = Date.now() - startTime;

            logger.info(`Email verificado para usuario ${userId}`, this.context, {
                userId,
                email: user.email,
                durationMs: duration
            });

            return true;

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error verificando email de usuario ${userId}`, this.context, { userId }, error as Error);
            return false;
        }
    }

    /**
     * Verifica teléfono de usuario
     */
    async verifyUserPhone(userId: string, code: string): Promise<boolean> {
        // TODO: Implementar verificación de teléfono con código SMS
        // Por ahora simulamos éxito
        const user = await User.findByPk(userId);
        if (!user) return false;

        if (user.phoneVerified) return true;

        await user.update({
            phoneVerified: true,
            verificationStatus: user.emailVerified
                ? VerificationStatus.FULLY_VERIFIED
                : VerificationStatus.PHONE_VERIFIED
        });

        logger.info(`Teléfono verificado para usuario ${userId}`, this.context, { userId });

        return true;
    }

    // ==========================================================================
    // UTILIDADES
    // ==========================================================================

    /**
     * Valida fortaleza de contraseña
     */
    private validatePasswordStrength(password: string): void {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (password.length < minLength) {
            throw new ValidationError(`La contraseña debe tener al menos ${minLength} caracteres`);
        }
        if (!hasUpperCase) {
            throw new ValidationError('La contraseña debe contener al menos una letra mayúscula');
        }
        if (!hasLowerCase) {
            throw new ValidationError('La contraseña debe contener al menos una letra minúscula');
        }
        if (!hasNumbers) {
            throw new ValidationError('La contraseña debe contener al menos un número');
        }
        if (!hasSpecialChar) {
            throw new ValidationError('La contraseña debe contener al menos un carácter especial');
        }
    }

    /**
     * Genera nombre de usuario único
     */
    private generateUsername(firstName: string, lastName: string): string {
        const base = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/[^a-z0-9.]/g, '');
        const timestamp = Date.now().toString().slice(-4);
        return `${base}${timestamp}`;
    }

    /**
     * Obtiene permisos por defecto según rol
     */
    private getDefaultPermissionsByRole(role: UserRole): UserPermissions {
        return DEFAULT_PERMISSIONS_BY_ROLE[role] || DEFAULT_PERMISSIONS_BY_ROLE[UserRole.VIEWER];
    }

    /**
     * Verifica si un usuario tiene acceso a un rancho
     */
    hasRanchAccess(user: User, ranchId: string): boolean {
        return user.hasRanchAccess(ranchId);
    }

    /**
     * Obtiene nivel de acceso a un rancho
     */
    getRanchAccessLevel(user: User, ranchId: string): string | null {
        return user.getRanchAccessLevel(ranchId);
    }

    /**
     * Verifica si es profesional de salud animal
     */
    isAnimalHealthProfessional(user: User): boolean {
        return user.isAnimalHealthProfessional();
    }

    /**
     * Obtiene certificaciones vigentes
     */
    getValidCertifications(user: User) {
        return user.getValidCertifications();
    }

    /**
     * Verifica si necesita renovar certificaciones
     */
    needsCertificationRenewal(user: User, days: number = 30): boolean {
        return user.needsCertificationRenewal(days);
    }

    /**
     * Obtiene alertas del usuario
     */
    getUserAlerts(user: User) {
        return user.getUserAlerts();
    }

    /**
     * Obtiene resumen de perfil
     */
    getProfileSummary(user: User) {
        return user.getProfileSummary();
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const userService = new UserService();