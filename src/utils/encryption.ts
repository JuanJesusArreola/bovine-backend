import * as crypto from 'crypto';
import { SERVER_CONFIG } from './constants';

// Interfaces para tipos de datos
interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

interface HashOptions {
  rounds?: number;
  pepper?: string;
}

interface JWTOptions {
  expiresIn?: string;
  audience?: string;
  issuer?: string;
}

// Configuración de encriptación
const ENCRYPTION_CONFIG = {
  ALGORITHM: 'aes-256-gcm',
  KEY_LENGTH: 32,
  IV_LENGTH: 16,
  TAG_LENGTH: 16,
  SALT_LENGTH: 16,
  DEFAULT_ENCODING: 'hex' as const,
  TEXT_ENCODING: 'utf8' as const,
  PBKDF2_ITERATIONS: 100000,
} as const;

// Clave de encriptación derivada del secreto JWT
const getEncryptionKey = (): Buffer => {
  const secret = SERVER_CONFIG.JWT_SECRET;
  return crypto.scryptSync(secret, 'salt', ENCRYPTION_CONFIG.KEY_LENGTH);
};

/**
 * Función para generar un hash seguro de contraseña usando Node.js crypto (similar a bcrypt)
 * @param password - Contraseña en texto plano
 * @param options - Opciones de hashing
 * @returns Promise<string> - Hash de la contraseña
 */
export const hashPassword = async (
  password: string,
  options: HashOptions = {}
): Promise<string> => {
  try {
    const { rounds = SERVER_CONFIG.BCRYPT_ROUNDS, pepper = '' } = options;
    
    // Agregar pepper si se proporciona
    const passwordWithPepper = password + pepper;
    
    // Generar salt aleatorio
    const salt = crypto.randomBytes(ENCRYPTION_CONFIG.SALT_LENGTH);
    
    // Crear hash usando PBKDF2 (más seguro que SHA)
    const iterations = Math.pow(2, rounds); // Simular el costo de bcrypt
    const hash = crypto.pbkdf2Sync(
      passwordWithPepper,
      salt,
      iterations,
      64, // longitud del hash
      'sha512'
    );
    
    // Combinar salt + hash en formato compatible
    const combined = Buffer.concat([salt, hash]);
    return `$pbkdf2$${iterations}$${combined.toString('base64')}`;
  } catch (error) {
    console.error('❌ Error generando hash de contraseña:', error);
    throw new Error('Error en el proceso de hashing');
  }
};

/**
 * Función para verificar una contraseña contra su hash
 * @param password - Contraseña en texto plano
 * @param hash - Hash almacenado
 * @param pepper - Pepper usado en el hash original (opcional)
 * @returns Promise<boolean> - True si la contraseña coincide
 */
export const verifyPassword = async (
  password: string,
  hash: string,
  pepper: string = ''
): Promise<boolean> => {
  try {
    const passwordWithPepper = password + pepper;
    
    // Parsear el hash almacenado
    const parts = hash.split('$');
    if (parts.length !== 4 || parts[1] !== 'pbkdf2') {
      return false;
    }
    
    const iterations = parseInt(parts[2]);
    const combined = Buffer.from(parts[3], 'base64');
    
    // Extraer salt y hash
    const salt = combined.subarray(0, ENCRYPTION_CONFIG.SALT_LENGTH);
    const storedHash = combined.subarray(ENCRYPTION_CONFIG.SALT_LENGTH);
    
    // Recalcular hash
    const calculatedHash = crypto.pbkdf2Sync(
      passwordWithPepper,
      salt,
      iterations,
      64,
      'sha512'
    );
    
    // Comparación segura
    return crypto.timingSafeEqual(storedHash, calculatedHash);
  } catch (error) {
    console.error('❌ Error verificando contraseña:', error);
    return false;
  }
};

/**
 * Función simple para crear JWT sin dependencias externas
 * @param payload - Datos a incluir en el token
 * @param secret - Clave secreta
 * @param expiresIn - Tiempo de expiración en segundos
 * @returns string - Token JWT
 */
const createSimpleJWT = (payload: any, secret: string, expiresIn: number = 86400): string => {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };
  
  // Codificar header y payload en base64
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  
  // Crear firma
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64url');
  
  return `${data}.${signature}`;
};

/**
 * Función simple para verificar JWT sin dependencias externas
 * @param token - Token a verificar
 * @param secret - Clave secreta
 * @returns any - Payload decodificado o null si es inválido
 */
const verifySimpleJWT = (token: string, secret: string): any => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const [encodedHeader, encodedPayload, signature] = parts;
    
    // Verificar firma
    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64url');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    // Decodificar payload
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
    
    // Verificar expiración
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }
    
    return payload;
  } catch (error) {
    return null;
  }
};

/**
 * Función para convertir tiempo de expiración a segundos
 * @param expiresIn - Tiempo en formato string (ej: '24h', '7d', '30m')
 * @returns number - Segundos
 */
const parseExpirationTime = (expiresIn: string): number => {
  const units: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 86400; // Default: 24 horas
  }
  
  const [, value, unit] = match;
  return parseInt(value) * (units[unit] || 1);
};

/**
 * Función para generar un token JWT
 * @param payload - Datos a incluir en el token
 * @param options - Opciones del JWT
 * @returns string - Token JWT firmado
 */
export const generateJWT = (
  payload: Omit<TokenPayload, 'iat' | 'exp'>,
  options: JWTOptions = {}
): string => {
  try {
    const {
      expiresIn = SERVER_CONFIG.JWT_EXPIRES_IN,
      audience = 'cattle-tracking-app',
      issuer = 'cattle-tracking-server'
    } = options;

    const expirationSeconds = parseExpirationTime(expiresIn);
    const enhancedPayload = {
      ...payload,
      aud: audience,
      iss: issuer
    };

    return createSimpleJWT(enhancedPayload, SERVER_CONFIG.JWT_SECRET, expirationSeconds);
  } catch (error) {
    console.error('❌ Error generando JWT:', error);
    throw new Error('Error generando token de autenticación');
  }
};

/**
 * Función para verificar y decodificar un token JWT
 * @param token - Token JWT a verificar
 * @returns TokenPayload | null - Payload decodificado o null si es inválido
 */
export const verifyJWT = (token: string): TokenPayload | null => {
  try {
    return verifySimpleJWT(token, SERVER_CONFIG.JWT_SECRET);
  } catch (error) {
    console.error('❌ Error verificando JWT:', error);
    return null;
  }
};

/**
 * Función para decodificar un JWT sin verificar (útil para debugging)
 * @param token - Token JWT
 * @returns any - Payload decodificado (sin verificar)
 */
export const decodeJWT = (token: string): any => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload;
  } catch (error) {
    console.error('❌ Error decodificando JWT:', error);
    return null;
  }
};

/**
 * Función para encriptar datos sensibles usando AES-256-GCM
 * @param data - Datos a encriptar
 * @returns EncryptedData - Objeto con datos encriptados, IV y tag
 */
export const encryptData = (data: string): EncryptedData => {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.IV_LENGTH);
    const cipher = crypto.createCipher(ENCRYPTION_CONFIG.ALGORITHM, key);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag ? cipher.getAuthTag() : Buffer.alloc(16);
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  } catch (error) {
    console.error('❌ Error encriptando datos:', error);
    throw new Error('Error en el proceso de encriptación');
  }
};

/**
 * Función para desencriptar datos usando AES-256-GCM
 * @param encryptedData - Objeto con datos encriptados
 * @returns string - Datos desencriptados
 */
export const decryptData = (encryptedData: EncryptedData): string => {
  try {
    const { encrypted, iv, tag } = encryptedData;
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipher(ENCRYPTION_CONFIG.ALGORITHM, key);
    
    if (decipher.setAuthTag) {
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
    }
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('❌ Error desencriptando datos:', error);
    throw new Error('Error en el proceso de desencriptación');
  }
};

/**
 * Función para generar un salt aleatorio
 * @param length - Longitud del salt (opcional)
 * @returns string - Salt en formato hexadecimal
 */
export const generateSalt = (length: number = ENCRYPTION_CONFIG.SALT_LENGTH): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Función para generar un ID único seguro
 * @param length - Longitud del ID (opcional)
 * @returns string - ID único en formato hexadecimal
 */
export const generateSecureId = (length: number = 16): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Función para generar un código de verificación numérico
 * @param length - Longitud del código (opcional)
 * @returns string - Código numérico
 */
export const generateVerificationCode = (length: number = 6): string => {
  const digits = '0123456789';
  let code = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, digits.length);
    code += digits[randomIndex];
  }
  
  return code;
};

/**
 * Función para generar una contraseña temporal segura
 * @param length - Longitud de la contraseña (opcional)
 * @returns string - Contraseña temporal
 */
export const generateTemporaryPassword = (length: number = 12): string => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }
  
  return password;
};

/**
 * Función para crear un hash de datos usando SHA-256
 * @param data - Datos a hashear
 * @param salt - Salt opcional
 * @returns string - Hash en formato hexadecimal
 */
export const createHash = (data: string, salt: string = ''): string => {
  try {
    const hash = crypto.createHash('sha256');
    hash.update(data + salt);
    return hash.digest('hex');
  } catch (error) {
    console.error('❌ Error creando hash:', error);
    throw new Error('Error en el proceso de hashing');
  }
};

/**
 * Función para crear un HMAC (Hash-based Message Authentication Code)
 * @param data - Datos a autenticar
 * @param secret - Clave secreta
 * @returns string - HMAC en formato hexadecimal
 */
export const createHMAC = (data: string, secret: string = SERVER_CONFIG.JWT_SECRET): string => {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    return hmac.digest('hex');
  } catch (error) {
    console.error('❌ Error creando HMAC:', error);
    throw new Error('Error en el proceso de autenticación de mensaje');
  }
};

/**
 * Función para verificar un HMAC
 * @param data - Datos originales
 * @param signature - HMAC a verificar
 * @param secret - Clave secreta
 * @returns boolean - True si el HMAC es válido
 */
export const verifyHMAC = (
  data: string,
  signature: string,
  secret: string = SERVER_CONFIG.JWT_SECRET
): boolean => {
  try {
    const expectedSignature = createHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('❌ Error verificando HMAC:', error);
    return false;
  }
};

/**
 * Función para encriptar información personal identificable (PII)
 * @param data - Datos PII a encriptar
 * @returns string - Datos encriptados en formato base64
 */
export const encryptPII = (data: string): string => {
  try {
    const encryptedData = encryptData(data);
    const combined = {
      e: encryptedData.encrypted,
      i: encryptedData.iv,
      t: encryptedData.tag
    };
    
    return Buffer.from(JSON.stringify(combined)).toString('base64');
  } catch (error) {
    console.error('❌ Error encriptando PII:', error);
    throw new Error('Error encriptando información personal');
  }
};

/**
 * Función para desencriptar información personal identificable (PII)
 * @param encryptedPII - Datos PII encriptados
 * @returns string - Datos desencriptados
 */
export const decryptPII = (encryptedPII: string): string => {
  try {
    const combined = JSON.parse(Buffer.from(encryptedPII, 'base64').toString());
    const encryptedData: EncryptedData = {
      encrypted: combined.e,
      iv: combined.i,
      tag: combined.t
    };
    
    return decryptData(encryptedData);
  } catch (error) {
    console.error('❌ Error desencriptando PII:', error);
    throw new Error('Error desencriptando información personal');
  }
};

/**
 * Función para crear un token de sesión seguro
 * @param userId - ID del usuario
 * @param sessionData - Datos adicionales de la sesión
 * @returns string - Token de sesión
 */
export const createSessionToken = (userId: number, sessionData: Record<string, any> = {}): string => {
  const sessionInfo = {
    userId,
    timestamp: Date.now(),
    randomData: generateSecureId(),
    ...sessionData
  };
  
  const tokenData = JSON.stringify(sessionInfo);
  return encryptPII(tokenData);
};

/**
 * Función para validar un token de sesión
 * @param sessionToken - Token de sesión a validar
 * @param maxAge - Edad máxima del token en millisegundos (opcional)
 * @returns object | null - Datos de sesión o null si es inválido
 */
export const validateSessionToken = (
  sessionToken: string,
  maxAge: number = 24 * 60 * 60 * 1000 // 24 horas por defecto
): any | null => {
  try {
    const decryptedData = decryptPII(sessionToken);
    const sessionInfo = JSON.parse(decryptedData);
    
    // Verificar edad del token
    const tokenAge = Date.now() - sessionInfo.timestamp;
    if (tokenAge > maxAge) {
      console.warn('⚠️ Token de sesión expirado');
      return null;
    }
    
    return sessionInfo;
  } catch (error) {
    console.error('❌ Error validando token de sesión:', error);
    return null;
  }
};

/**
 * Función para sanitizar datos de entrada
 * @param input - Datos de entrada
 * @returns string - Datos sanitizados
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remover caracteres peligrosos y etiquetas HTML
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>'"&]/g, (char) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entities[char] || char;
    });
};

/**
 * Función para generar un checksum de integridad de datos
 * @param data - Datos para generar checksum
 * @returns string - Checksum SHA-256
 */
export const generateChecksum = (data: any): string => {
  const serializedData = typeof data === 'string' ? data : JSON.stringify(data);
  return createHash(serializedData);
};

/**
 * Función para verificar la integridad de datos usando checksum
 * @param data - Datos a verificar
 * @param expectedChecksum - Checksum esperado
 * @returns boolean - True si los datos son íntegros
 */
export const verifyDataIntegrity = (data: any, expectedChecksum: string): boolean => {
  try {
    const actualChecksum = generateChecksum(data);
    return crypto.timingSafeEqual(
      Buffer.from(actualChecksum),
      Buffer.from(expectedChecksum)
    );
  } catch (error) {
    console.error('❌ Error verificando integridad de datos:', error);
    return false;
  }
};

// Exportar tipos para uso en otros módulos
export type {
  TokenPayload,
  EncryptedData,
  HashOptions,
  JWTOptions
};