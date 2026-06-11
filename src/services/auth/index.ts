// services/auth/index.ts
/**
 * ============================================================================
 * DOMINIO DE AUTENTICACIÓN - EXPORTACIONES CENTRALIZADAS
 * ============================================================================
 */

// ============================================================================
// IMPORTAR SERVICIOS
// ============================================================================

import { authService } from './AuthService';
import { userService } from './UserService';
import { tokenService } from './TokenService';
import { securityEventService } from './SecurityEventService';

// ============================================================================
// EXPORTACIONES NOMBRADAS
// ============================================================================

export { authService, userService, tokenService, securityEventService };

// ============================================================================
// EXPORTAR TIPOS
// ============================================================================

export type {
    LoginCredentials,
    RegisterData,
    AuthResponse,
    RefreshTokenData,
    ResetPasswordData,
    UpdatePasswordData
} from './AuthService';

export type {
    CreateUserDTO,
    UpdateUserDTO,
    UserFilters,
    UserListResponse,
    UserProfileResponse
} from './UserService';

export type {
    TokenPayload,
    TokenResult,
    EmailVerificationResult
} from './TokenService';

export type {
    EventData,
    EventStats,
    EventFilters
} from './SecurityEventService';

// ============================================================================
// EXPORTACIÓN POR DEFECTO
// ============================================================================

export default {
    authService,
    userService,
    tokenService,
    securityEventService
};