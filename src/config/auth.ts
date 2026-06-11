// ============================================================================
// AUTH.TS - CONFIGURACIÓN DE JWT Y AUTENTICACIÓN
// ============================================================================
// Configuración para JSON Web Tokens, encriptación de passwords y autenticación
// Maneja generación de tokens, validación y configuraciones de seguridad

// Importaciones condicionales para evitar errores antes de instalar dependencias
let jwt: any;
let bcrypt: any;
let crypto: any;

try {
  jwt = require('jsonwebtoken');
  bcrypt = require('bcryptjs');
  crypto = require('crypto');
} catch (error) {
  console.warn('⚠️  Dependencias de auth no instaladas aún. Ejecuta: npm install jsonwebtoken bcryptjs @types/jsonwebtoken @types/bcryptjs');
}

// ============================================================================
// INTERFACES Y TIPOS
// ============================================================================

interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  ranchId?: string;
  iat?: number;
  exp?: number;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

interface AuthConfig {
  jwt: {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenExpiration: string;
    refreshTokenExpiration: string;
    issuer: string;
    audience: string;
    algorithm: string;
  };
  bcrypt: {
    saltRounds: number;
  };
  session: {
    maxAttempts: number;
    lockoutDuration: number;
    sessionTimeout: number;
  };
  password: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
  };
}

enum UserRole {
  SUPER_ADMIN = 'super_admin',
  RANCH_ADMIN = 'ranch_admin',
  RANCH_MANAGER = 'ranch_manager',
  VETERINARIAN = 'veterinarian',
  WORKER = 'worker',
  VIEWER = 'viewer'
}

// ============================================================================
// CONFIGURACIÓN DE AUTENTICACIÓN
// ============================================================================

// Configuración principal de autenticación
const authConfig: AuthConfig = {
  jwt: {
    // Secretos para firmar tokens (deben ser diferentes en producción)
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'cattle_management_access_secret_2025',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'cattle_management_refresh_secret_2025',
    
    // Duración de los tokens
    accessTokenExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',  // 15 minutos
    refreshTokenExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d', // 7 días
    
    // Metadatos del token
    issuer: process.env.JWT_ISSUER || 'CattleManagement',
    audience: process.env.JWT_AUDIENCE || 'cattle-users',
    algorithm: 'HS256' // Algoritmo de encriptación
  },
  
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12') // Rondas de encriptación
  },
  
  session: {
    maxAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),        // Intentos máximos de login
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000'), // 15 minutos en ms
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000')   // 1 hora en ms
  },
  
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true
  }
};

// ============================================================================
// FUNCIONES DE JWT
// ============================================================================

/**
 * Genera un token de acceso JWT
 * @param payload - Datos del usuario para incluir en el token
 * @returns string - Token JWT generado
 */
export const generateAccessToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  if (!jwt) {
    throw new Error('JWT library not available');
  }

  const tokenPayload: JWTPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000) // Issued at (timestamp)
  };

  return jwt.sign(tokenPayload, authConfig.jwt.accessTokenSecret, {
    expiresIn: authConfig.jwt.accessTokenExpiration,
    issuer: authConfig.jwt.issuer,
    audience: authConfig.jwt.audience,
    algorithm: authConfig.jwt.algorithm
  });
};

/**
 * Genera un token de actualización JWT
 * @param userId - ID del usuario
 * @returns string - Refresh token generado
 */
export const generateRefreshToken = (userId: string): string => {
  if (!jwt) {
    throw new Error('JWT library not available');
  }

  return jwt.sign(
    { userId, type: 'refresh' },
    authConfig.jwt.refreshTokenSecret,
    {
      expiresIn: authConfig.jwt.refreshTokenExpiration,
      issuer: authConfig.jwt.issuer,
      audience: authConfig.jwt.audience,
      algorithm: authConfig.jwt.algorithm
    }
  );
};

/**
 * Verifica y decodifica un token de acceso
 * @param token - Token JWT a verificar
 * @returns JWTPayload - Datos decodificados del token
 */
export const verifyAccessToken = (token: string): JWTPayload => {
  if (!jwt) {
    throw new Error('JWT library not available');
  }

  try {
    return jwt.verify(token, authConfig.jwt.accessTokenSecret, {
      issuer: authConfig.jwt.issuer,
      audience: authConfig.jwt.audience,
      algorithms: [authConfig.jwt.algorithm]
    }) as JWTPayload;
  } catch (error) {
    throw new Error('Token inválido o expirado');
  }
};

/**
 * Verifica un refresh token
 * @param token - Refresh token a verificar
 * @returns object - Datos decodificados del refresh token
 */
export const verifyRefreshToken = (token: string): { userId: string; type: string } => {
  if (!jwt) {
    throw new Error('JWT library not available');
  }

  try {
    return jwt.verify(token, authConfig.jwt.refreshTokenSecret, {
      issuer: authConfig.jwt.issuer,
      audience: authConfig.jwt.audience,
      algorithms: [authConfig.jwt.algorithm]
    });
  } catch (error) {
    throw new Error('Refresh token inválido o expirado');
  }
};

// ============================================================================
// FUNCIONES DE ENCRIPTACIÓN
// ============================================================================

/**
 * Encripta una contraseña usando bcrypt
 * @param password - Contraseña en texto plano
 * @returns Promise<string> - Contraseña encriptada
 */
export const hashPassword = async (password: string): Promise<string> => {
  if (!bcrypt) {
    throw new Error('Bcrypt library not available');
  }

  try {
    return await bcrypt.hash(password, authConfig.bcrypt.saltRounds);
  } catch (error) {
    throw new Error('Error al encriptar la contraseña');
  }
};

/**
 * Compara una contraseña con su hash
 * @param password - Contraseña en texto plano
 * @param hashedPassword - Contraseña encriptada
 * @returns Promise<boolean> - true si coinciden, false si no
 */
export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  if (!bcrypt) {
    throw new Error('Bcrypt library not available');
  }

  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    throw new Error('Error al verificar la contraseña');
  }
};

// ============================================================================
// FUNCIONES DE VALIDACIÓN
// ============================================================================

/**
 * Valida la fortaleza de una contraseña
 * @param password - Contraseña a validar
 * @returns object - Resultado de la validación
 */
export const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const config = authConfig.password;

  // Verificar longitud mínima
  if (password.length < config.minLength) {
    errors.push(`La contraseña debe tener al menos ${config.minLength} caracteres`);
  }

  // Verificar mayúsculas
  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra mayúscula');
  }

  // Verificar minúsculas
  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra minúscula');
  }

  // Verificar números
  if (config.requireNumbers && !/\d/.test(password)) {
    errors.push('La contraseña debe contener al menos un número');
  }

  // Verificar símbolos
  if (config.requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('La contraseña debe contener al menos un símbolo especial');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Valida el formato de un email
 * @param email - Email a validar
 * @returns boolean - true si es válido, false si no
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

/**
 * Genera un string aleatorio para tokens
 * @param length - Longitud del string
 * @returns string - String aleatorio generado
 */
export const generateRandomString = (length: number = 32): string => {
  if (!crypto) {
    // Fallback si crypto no está disponible
    return Math.random().toString(36).substring(2, length + 2);
  }
  
  return crypto.randomBytes(length).toString('hex').slice(0, length);
};

/**
 * Genera una respuesta completa de tokens
 * @param user - Datos del usuario
 * @returns TokenResponse - Objeto con tokens y metadata
 */
export const generateTokenResponse = (user: { id: string; email: string; role: UserRole; ranchId?: string }): TokenResponse => {
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    ranchId: user.ranchId
  });

  const refreshToken = generateRefreshToken(user.id);

  // Calcular tiempo de expiración en segundos
  const expiresIn = getTokenExpirationTime(authConfig.jwt.accessTokenExpiration);

  return {
    accessToken,
    refreshToken,
    expiresIn,
    tokenType: 'Bearer'
  };
};

/**
 * Convierte tiempo de expiración a segundos
 * @param expiration - String de tiempo (ej: '15m', '1h', '7d')
 * @returns number - Tiempo en segundos
 */
const getTokenExpirationTime = (expiration: string): number => {
  const unit = expiration.slice(-1);
  const value = parseInt(expiration.slice(0, -1));

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: return 900; // 15 minutos por defecto
  }
};

// ============================================================================
// EXPORTACIONES
// ============================================================================

// Exportar configuración como default
export default authConfig;

// Exportar enums y tipos
export { UserRole };
export type { JWTPayload, TokenResponse, AuthConfig };