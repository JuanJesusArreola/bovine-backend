// dtos/auth/index.ts

// Request DTOs
export type {
    RegisterRequestDTO,
    LoginRequestDTO,
    RefreshTokenRequestDTO,
    ForgotPasswordRequestDTO,
    ResetPasswordRequestDTO,
    ChangePasswordRequestDTO,
    ResendVerificationRequestDTO
} from './auth-request.dto';

// Response DTOs
export type {
    UserAuthResponseDTO,
    AuthResponseDTO,
    RefreshTokenResponseDTO,
    VerifyEmailResponseDTO
} from './auth-response.dto';

// User Request DTOs
export type {
    CreateUserRequestDTO,
    UpdateProfileRequestDTO,
    UpdateUserRequestDTO,
    UserListFiltersDTO
} from './user-request.dto';

// User Response DTOs
export type {
    UserProfileResponseDTO,
    UserListItemResponseDTO,
    UserDetailResponseDTO,
    UserListResponseDTO
} from './user-response.dto';

// Security Event DTOs
export type {
    SecurityEventResponseDTO,
    SecurityEventDetailResponseDTO,
    SecurityEventFiltersDTO,
    SecurityEventStatsResponseDTO,
    ResolveEventRequestDTO,
    ResolveEventsRequestDTO
} from './security-event.dto';