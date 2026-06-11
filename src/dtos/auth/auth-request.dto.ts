// dtos/auth/auth-request.dto.ts
import { UserRole } from '../../models/User';

/**
 * DTO para solicitud de registro
 */
export interface RegisterRequestDTO {
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
 * DTO para solicitud de login
 */
export interface LoginRequestDTO {
    email: string;
    password: string;
    rememberMe?: boolean;
}

/**
 * DTO para solicitud de refresh token
 */
export interface RefreshTokenRequestDTO {
    refreshToken: string;
}

/**
 * DTO para solicitud de forgot password
 */
export interface ForgotPasswordRequestDTO {
    email: string;
}

/**
 * DTO para solicitud de reset password
 */
export interface ResetPasswordRequestDTO {
    token: string;
    newPassword: string;
    confirmPassword: string;
}

/**
 * DTO para solicitud de cambio de contraseña
 */
export interface ChangePasswordRequestDTO {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

/**
 * DTO para solicitud de resend verification
 */
export interface ResendVerificationRequestDTO {
    email: string;
}