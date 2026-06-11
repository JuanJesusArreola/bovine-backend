// dtos/auth/auth-response.dto.ts
import { UserPermissions } from '../../models/User';

/**
 * DTO para respuesta de usuario autenticado
 */
export interface UserAuthResponseDTO {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    roleLabel: string;
    avatar?: string;
    phone?: string;
    permissions: UserPermissions;
    lastLogin?: Date;
    isActive: boolean;
}

/**
 * DTO para respuesta de autenticación
 */
export interface AuthResponseDTO {
    user: UserAuthResponseDTO;
    token: string;
    refreshToken: string;
    expiresIn: number;
}

/**
 * DTO para respuesta de refresh token
 */
export interface RefreshTokenResponseDTO {
    token: string;
    refreshToken: string;
    expiresIn: number;
}

/**
 * DTO para respuesta de verificación de email
 */
export interface VerifyEmailResponseDTO {
    success: boolean;
    message: string;
}