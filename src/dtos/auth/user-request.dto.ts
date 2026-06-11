// dtos/auth/user-request.dto.ts
import { UserRole, UserStatus } from '../../models/User';

/**
 * DTO para creación de usuario (admin)
 */
export interface CreateUserRequestDTO {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role?: UserRole;
    ranchId?: string;
}

/**
 * DTO para actualización de perfil (usuario propio)
 */
export interface UpdateProfileRequestDTO {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatar?: string;
}

/**
 * DTO para actualización de usuario (admin)
 */
export interface UpdateUserRequestDTO {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    role?: UserRole;
    status?: UserStatus;
    isActive?: boolean;
    permissions?: {
        modules?: {
            bovines?: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
            health?: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
            reproduction?: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
            finance?: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
            inventory?: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
            production?: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
            locations?: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
            reports?: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
            users?: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
            settings?: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
        };
        actions?: {
            canCreateRanch?: boolean;
            canDeleteRecords?: boolean;
            canExportData?: boolean;
            canImportData?: boolean;
            canAccessAnalytics?: boolean;
            canManageUsers?: boolean;
            canApproveTransactions?: boolean;
            canPrescribeMedications?: boolean;
            canPerformSurgery?: boolean;
            canAccessFinancials?: boolean;
        };
    };
}

/**
 * DTO para filtros de listado de usuarios
 */
export interface UserListFiltersDTO {
    search?: string;
    role?: UserRole[];
    status?: UserStatus[];
    isActive?: boolean;
    ranchId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}