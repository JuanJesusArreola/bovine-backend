// dtos/auth/user-response.dto.ts
import { UserPermissions, UserRole, UserStatus } from '../../models/User';

/**
 * DTO para respuesta de perfil de usuario
 */
export interface UserProfileResponseDTO {
    id: string;
    userCode: string;
    email: string;
    username: string;
    role: UserRole;
    roleLabel: string;
    status: UserStatus;
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

/**
 * DTO para respuesta de usuario en listados
 */
export interface UserListItemResponseDTO {
    id: string;
    userCode: string;
    email: string;
    username: string;
    role: UserRole;
    roleLabel: string;
    status: UserStatus;
    fullName: string;
    isActive: boolean;
    emailVerified: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
}

/**
 * DTO para respuesta detallada de usuario (admin)
 */
export interface UserDetailResponseDTO extends UserProfileResponseDTO {
    permissions: UserPermissions;
    professionalInfo?: {
        title?: string;
        organization?: string;
        position?: string;
        specializations: string[];
        experience?: number;
        certifications?: Array<{
            name: string;
            issuingOrganization: string;
            issueDate: Date;
            expirationDate?: Date;
            status: string;
        }>;
    };
    systemSettings?: {
        theme?: string;
        language?: string;
        timezone?: string;
        notifications?: {
            email: string;
            sms: string;
            push: string;
            whatsapp: string;
        };
    };
}

/**
 * DTO para respuesta de listado de usuarios con paginación
 */
export interface UserListResponseDTO {
    users: UserListItemResponseDTO[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}