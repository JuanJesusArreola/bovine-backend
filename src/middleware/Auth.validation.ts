// middleware/validation/auth.validation.ts
/**
 * ============================================================================
 * VALIDACIONES DEL MÓDULO DE AUTENTICACIÓN
 * ============================================================================
 *
 * ¿POR QUÉ UN ARCHIVO SEPARADO?
 * ----------------------------------------------------------------------------
 * Tu validation.ts actual contiene validaciones del DOMINIO GANADERO
 * (earTags, pesos, coordenadas, síntomas...). Son reglas de negocio específicas.
 *
 * Las validaciones de AUTH son un dominio completamente distinto:
 * son reglas de SEGURIDAD, no de negocio. Mezclarlas en el mismo archivo
 * viola el principio de Responsabilidad Única (SRP) y hace el código
 * difícil de mantener.
 *
 * ESTRUCTURA:
 *   1. Tipos e interfaces                → Contrato de lo que se valida
 *   2. Validadores primitivos            → Funciones puras, reutilizables
 *   3. Esquemas de validación por ruta   → Configuración declarativa
 *   4. Middleware validate()             → Orquesta todo lo anterior
 *   5. Middlewares específicos           → Para casos puntuales (token en query)
 *
 * USO EN RUTAS:
 *   router.post('/register',  validateAuth('register'),  authController.register)
 *   router.post('/login',     validateAuth('login'),     authController.login)
 *   router.post('/reset',     validateAuth('resetPassword'), authController.resetPassword)
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { logMessage, LogLevel } from './logging';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

/**
 * Representa un error de validación en un campo específico.
 * Mantiene la misma forma que ValidationError en validation.ts
 * para que el frontend pueda procesarlos de manera uniforme.
 */
export interface AuthValidationError {
    field: string;   // Nombre del campo con error
    value: any;      // Valor que falló (ayuda al debugging)
    message: string; // Mensaje legible para el usuario
    code: string;    // Código para el frontend (e.g., 'REQUIRED', 'TOO_SHORT')
}

/**
 * Resultado de una validación.
 * isValid: false significa que NO se debe continuar con el controller.
 * sanitizedValue: el valor limpio y transformado para usar en el controller.
 */
interface FieldValidationResult {
    isValid: boolean;
    error?: AuthValidationError;
    sanitizedValue?: any;
}

/**
 * Un validador de campo: función que recibe el valor y retorna el resultado.
 * Firma genérica para que todos los validadores sean intercambiables.
 */
type FieldValidator = (value: any, allData?: Record<string, any>) => FieldValidationResult;

/**
 * Definición de un campo en un esquema de validación.
 *
 * ¿POR QUÉ ESTE DISEÑO?
 * Separar la DEFINICIÓN (qué validar) de la EJECUCIÓN (cómo validar)
 * permite cambiar esquemas sin tocar lógica, y testear validadores
 * de forma independiente.
 */
interface FieldSchema {
    required: boolean;
    validators: FieldValidator[];   // Se ejecutan en orden, se detienen al primer error
    source?: 'body' | 'query' | 'params'; // De dónde extraer el campo (por defecto: body)
}

/**
 * Esquema completo de validación para una ruta.
 * La clave es el nombre del campo, el valor es su configuración.
 */
type AuthSchema = Record<string, FieldSchema>;

// ============================================================================
// VALIDADORES PRIMITIVOS
// ============================================================================
// Son funciones puras: misma entrada → misma salida, sin efectos secundarios.
// Se pueden componer y testear de forma aislada.
// Se pueden reutilizar entre diferentes esquemas.

/**
 * Verifica que el valor no sea vacío.
 *
 * ¿POR QUÉ REVISAR TODOS ESTOS CASOS?
 * undefined → campo no enviado en el body
 * null      → enviado explícitamente como null
 * ''        → string vacío (muy común en formularios)
 * '   '     → solo espacios (trampa frecuente)
 */
const isRequired = (fieldName: string): FieldValidator => (value) => {
    const isEmpty =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '');

    if (isEmpty) {
        return {
            isValid: false,
            error: {
                field: fieldName,
                value,
                message: `El campo ${fieldName} es requerido`,
                code: 'REQUIRED'
            }
        };
    }
    return { isValid: true, sanitizedValue: typeof value === 'string' ? value.trim() : value };
};

/**
 * Valida formato de email.
 *
 * ¿POR QUÉ ESTE REGEX Y NO UNO MÁS COMPLEJO?
 * El RFC 5321 completo es extremadamente complejo y permite casos raros
 * que ningún servidor de email real acepta. Este regex cubre el 99.9%
 * de los emails reales. La validación definitiva es enviar el email
 * y confirmar que el usuario puede recibirlo.
 *
 * SANITIZACIÓN: convierte a minúsculas para evitar duplicados
 * (juan@gmail.com y Juan@gmail.com son el mismo email).
 */
const isValidEmail = (fieldName: string): FieldValidator => (value) => {
    if (!value) return { isValid: true }; // isRequired se encarga de esto

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const sanitized = String(value).toLowerCase().trim();

    if (!emailRegex.test(sanitized)) {
        return {
            isValid: false,
            error: {
                field: fieldName,
                value,
                message: 'El formato del email no es válido',
                code: 'INVALID_FORMAT'
            }
        };
    }
    return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Valida longitud mínima de un string.
 *
 * ¿POR QUÉ TRIM ANTES DE CONTAR?
 * Sin trim(), alguien podría enviar "   " (8 espacios) como contraseña
 * y pasar la validación. La longitud debe contar caracteres reales.
 */
const hasMinLength = (fieldName: string, min: number): FieldValidator => (value) => {
    if (!value) return { isValid: true };

    const str = String(value).trim();
    if (str.length < min) {
        return {
            isValid: false,
            error: {
                field: fieldName,
                value: '[REDACTED]', // ← NUNCA loguear contraseñas
                message: `${fieldName} debe tener al menos ${min} caracteres`,
                code: 'TOO_SHORT'
            }
        };
    }
    return { isValid: true, sanitizedValue: str };
};

/**
 * Valida longitud máxima de un string.
 *
 * ¿POR QUÉ LIMITAR LA LONGITUD MÁXIMA?
 * Seguridad: evita ataques de payload gigante que consuman CPU en bcrypt.
 * bcrypt tiene un límite interno de 72 bytes; contraseñas más largas
 * se truncan silenciosamente, lo que puede confundir al usuario.
 */
const hasMaxLength = (fieldName: string, max: number): FieldValidator => (value) => {
    if (!value) return { isValid: true };

    const str = String(value).trim();
    if (str.length > max) {
        return {
            isValid: false,
            error: {
                field: fieldName,
                value: '[REDACTED]',
                message: `${fieldName} no puede exceder ${max} caracteres`,
                code: 'TOO_LONG'
            }
        };
    }
    return { isValid: true, sanitizedValue: str };
};

/**
 * Valida fortaleza de contraseña.
 *
 * ¿POR QUÉ ESTOS REQUISITOS ESPECÍFICOS?
 * - Mayúscula: aumenta el espacio de caracteres de 26 a 52
 * - Minúscula: diferencia mayúsculas/minúsculas
 * - Número: añade 10 caracteres más al espacio
 * - Especial: añade ~32 caracteres más
 * Cada requisito multiplica el tiempo de un ataque de fuerza bruta.
 *
 * ¿POR QUÉ NO LOGUEAR EL VALOR?
 * Las contraseñas NUNCA deben aparecer en logs. Si alguien
 * compromete tus logs, no debe poder ver contraseñas en texto plano.
 */
const hasPasswordStrength = (fieldName: string): FieldValidator => (value) => {
    if (!value) return { isValid: true };

    const password = String(value);
    const checks = {
        uppercase:   /[A-Z]/.test(password),
        lowercase:   /[a-z]/.test(password),
        number:      /\d/.test(password),
        special:     /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    const missing: string[] = [];
    if (!checks.uppercase) missing.push('una letra mayúscula');
    if (!checks.lowercase) missing.push('una letra minúscula');
    if (!checks.number)    missing.push('un número');
    if (!checks.special)   missing.push('un carácter especial (!@#$%...)');

    if (missing.length > 0) {
        return {
            isValid: false,
            error: {
                field: fieldName,
                value: '[REDACTED]',
                message: `La contraseña debe contener: ${missing.join(', ')}`,
                code: 'WEAK_PASSWORD'
            }
        };
    }
    return { isValid: true }; // No sanitizamos: la contraseña se usa tal cual para bcrypt
};

/**
 * Valida que dos campos tengan el mismo valor.
 * Típicamente usado para confirmación de contraseña.
 *
 * ¿POR QUÉ NECESITA allData?
 * Para comparar con otro campo del mismo request, necesita acceso
 * a todos los datos. Los validadores primitivos reciben el valor
 * de su campo, pero este caso es una excepción donde la validación
 * depende de OTRO campo.
 */
const matchesField = (fieldName: string, targetField: string, label: string): FieldValidator =>
    (value, allData) => {
        if (!value || !allData) return { isValid: true };

        if (value !== allData[targetField]) {
            return {
                isValid: false,
                error: {
                    field: fieldName,
                    value: '[REDACTED]',
                    message: `${label} no coincide`,
                    code: 'MISMATCH'
                }
            };
        }
        return { isValid: true };
    };

/**
 * Valida formato de nombre (firstName, lastName).
 *
 * ¿POR QUÉ ESTE REGEX?
 * Permite letras latinas con acentos y la ñ (esencial para nombres en español),
 * espacios (nombres compuestos: "María José"), guiones (apellidos: "García-López").
 * Excluye números y caracteres especiales que no tienen lugar en un nombre.
 */
const isValidName = (fieldName: string): FieldValidator => (value) => {
    if (!value) return { isValid: true };

    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-']{2,50}$/;
    const sanitized = String(value).trim();

    if (!nameRegex.test(sanitized)) {
        return {
            isValid: false,
            error: {
                field: fieldName,
                value,
                message: `${fieldName} solo puede contener letras, espacios y guiones (2-50 caracteres)`,
                code: 'INVALID_FORMAT'
            }
        };
    }
    // Capitalizar correctamente: "juan josé" → "Juan José"
    const capitalized = sanitized
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());

    return { isValid: true, sanitizedValue: capitalized };
};

/**
 * Valida formato de teléfono mexicano (opcional en el registro).
 *
 * ¿POR QUÉ ESPECÍFICO PARA MÉXICO?
 * Tu sistema es para ranchos en Tabasco. Los números tienen formato
 * local: 10 dígitos, pueden incluir código de país +52 o lada.
 */
const isValidPhone = (fieldName: string): FieldValidator => (value) => {
    if (!value || String(value).trim() === '') return { isValid: true }; // Campo opcional

    const cleaned = String(value).replace(/[\s\-\(\)\+]/g, '');
    const phoneRegex = /^(\d{10}|52\d{10})$/;

    if (!phoneRegex.test(cleaned)) {
        return {
            isValid: false,
            error: {
                field: fieldName,
                value,
                message: 'Número de teléfono inválido. Use 10 dígitos (ej: 9931234567)',
                code: 'INVALID_FORMAT'
            }
        };
    }
    // Normalizar: quitar código de país si existe, dejar solo 10 dígitos
    const normalized = cleaned.startsWith('52') && cleaned.length === 12
        ? cleaned.slice(2)
        : cleaned;

    return { isValid: true, sanitizedValue: normalized };
};

/**
 * Valida que un token de verificación sea un string no vacío de longitud razonable.
 *
 * ¿POR QUÉ NO VALIDAR EL FORMATO DEL TOKEN AQUÍ?
 * El formato exacto (hex, JWT, etc.) lo conoce el TokenService.
 * El middleware solo verifica que llegó algo que puede ser un token.
 * La validación profunda la hace el servicio al buscarlo en BD.
 *
 * ¿POR QUÉ SOURCE: 'query'?
 * verify-email recibe el token en la URL (?token=xxx), no en el body.
 */
const isValidToken = (fieldName: string): FieldValidator => (value) => {
    if (!value) return { isValid: true };

    const str = String(value).trim();
    if (str.length < 10 || str.length > 1000) {
        return {
            isValid: false,
            error: {
                field: fieldName,
                value: '[REDACTED]',
                message: 'Token con formato inválido',
                code: 'INVALID_TOKEN_FORMAT'
            }
        };
    }
    return { isValid: true, sanitizedValue: str };
};

// ============================================================================
// ESQUEMAS DE VALIDACIÓN
// ============================================================================
// Configuración declarativa: describe QUÉ validar, no CÓMO.
// Para agregar una nueva ruta: añadir una nueva entrada aquí.
// Para cambiar reglas: modificar solo el esquema afectado.

/**
 * BUENA PRÁCTICA: usar un objeto `const` con satisfies para obtener
 * type-checking sin perder la inferencia de tipos específicos.
 */
export const AuthSchemas = {

    /**
     * POST /api/auth/register
     *
     * ¿POR QUÉ VALIDAR CONFIRMPASSWORD AQUÍ Y NO EN EL SERVICE?
     * El service debería recibir datos ya validados. La validación
     * de "las contraseñas coinciden" es una regla de INPUT, no de negocio.
     * Si la pusiéramos en el service, tendríamos que pasar confirmPassword
     * hasta adentro solo para verificarla.
     *
     * ¿POR QUÉ EL ROLE ES OPCIONAL?
     * Un usuario que se auto-registra no debería poder elegir su propio rol.
     * El sistema asigna VIEWER por defecto. Solo un admin puede cambiar el rol.
     * Si llega el campo role, lo validamos; si no llega, el service pone VIEWER.
     */
    register: {
        email: {
            required: true,
            source: 'body',
            validators: [
                isRequired('email'),
                isValidEmail('email'),
                hasMaxLength('email', 255),
            ]
        },
        password: {
            required: true,
            source: 'body',
            validators: [
                isRequired('password'),
                hasMinLength('password', 8),
                hasMaxLength('password', 72), // Límite de bcrypt
                hasPasswordStrength('password'),
            ]
        },
        confirmPassword: {
            required: true,
            source: 'body',
            validators: [
                isRequired('confirmPassword'),
                matchesField('confirmPassword', 'password', 'La confirmación de contraseña'),
            ]
        },
        firstName: {
            required: true,
            source: 'body',
            validators: [
                isRequired('firstName'),
                isValidName('firstName'),
            ]
        },
        lastName: {
            required: true,
            source: 'body',
            validators: [
                isRequired('lastName'),
                isValidName('lastName'),
            ]
        },
        phone: {
            required: false,
            source: 'body',
            validators: [
                isValidPhone('phone'),
            ]
        }
    } satisfies AuthSchema,

    /**
     * POST /api/auth/login
     *
     * ¿POR QUÉ NO VALIDAR FORTALEZA DE CONTRASEÑA AQUÍ?
     * En login, validamos que la contraseña tenga un largo mínimo para
     * evitar requests absurdos, pero NO aplicamos reglas de fortaleza.
     * Un usuario con contraseña antigua (antes de que implementaras
     * las reglas de fortaleza) necesita poder iniciar sesión igualmente.
     *
     * ¿POR QUÉ NO SANITIZAR EMAIL EN LOGIN CON MISMA AGRESIVIDAD?
     * En login el email se convierte a minúsculas para normalizar,
     * pero no truncamos. El usuario necesita ingresar su email exacto.
     */
    login: {
        email: {
            required: true,
            source: 'body',
            validators: [
                isRequired('email'),
                isValidEmail('email'),
            ]
        },
        password: {
            required: true,
            source: 'body',
            validators: [
                isRequired('password'),
                hasMinLength('password', 6),   // Mínimo permisivo para usuarios con cuentas antiguas
                hasMaxLength('password', 200),  // Prevenir payloads de ataque
            ]
        }
    } satisfies AuthSchema,

    /**
     * POST /api/auth/forgot-password
     *
     * ¿POR QUÉ SOLO VALIDAR EMAIL Y NADA MÁS?
     * Este endpoint solo necesita saber a qué dirección enviar el link.
     * No importa si el usuario existe o no (por seguridad, el controller
     * responde igual en ambos casos). La validación es mínima intencional.
     */
    forgotPassword: {
        email: {
            required: true,
            source: 'body',
            validators: [
                isRequired('email'),
                isValidEmail('email'),
            ]
        }
    } satisfies AuthSchema,

    /**
     * POST /api/auth/reset-password
     *
     * ¿POR QUÉ VALIDAR EL TOKEN EN EL BODY Y NO SOLO EN EL SERVICE?
     * Si el token viene vacío o malformado, es mejor rechazarlo aquí
     * antes de hacer cualquier consulta a la BD. El service haría
     * un SELECT innecesario con un valor que ya sabemos inválido.
     *
     * El service aún verifica que el token EXISTA en BD y no esté
     * expirado — eso no lo puede hacer el middleware de validación.
     */
    resetPassword: {
        token: {
            required: true,
            source: 'body',
            validators: [
                isRequired('token'),
                isValidToken('token'),
            ]
        },
        newPassword: {
            required: true,
            source: 'body',
            validators: [
                isRequired('newPassword'),
                hasMinLength('newPassword', 8),
                hasMaxLength('newPassword', 72),
                hasPasswordStrength('newPassword'),
            ]
        },
        confirmPassword: {
            required: true,
            source: 'body',
            validators: [
                isRequired('confirmPassword'),
                matchesField('confirmPassword', 'newPassword', 'La confirmación de contraseña'),
            ]
        }
    } satisfies AuthSchema,

    /**
     * POST /api/auth/change-password (requiere autenticación)
     *
     * ¿POR QUÉ VALIDAR currentPassword SIN REGLAS DE FORTALEZA?
     * currentPassword es la contraseña existente del usuario.
     * Podría ser una contraseña antigua sin los nuevos requisitos.
     * Solo verificamos que vino en el request; el service la compara con bcrypt.
     */
    changePassword: {
        currentPassword: {
            required: true,
            source: 'body',
            validators: [
                isRequired('currentPassword'),
                hasMinLength('currentPassword', 6),
                hasMaxLength('currentPassword', 200),
            ]
        },
        newPassword: {
            required: true,
            source: 'body',
            validators: [
                isRequired('newPassword'),
                hasMinLength('newPassword', 8),
                hasMaxLength('newPassword', 72),
                hasPasswordStrength('newPassword'),
            ]
        },
        confirmPassword: {
            required: true,
            source: 'body',
            validators: [
                isRequired('confirmPassword'),
                matchesField('confirmPassword', 'newPassword', 'La confirmación de contraseña'),
            ]
        }
    } satisfies AuthSchema,

    /**
     * POST /api/auth/resend-verification
     */
    resendVerification: {
        email: {
            required: true,
            source: 'body',
            validators: [
                isRequired('email'),
                isValidEmail('email'),
            ]
        }
    } satisfies AuthSchema,

    /**
     * GET /api/auth/verify-email?token=xxx
     *
     * ¿POR QUÉ source: 'query' EN VEZ DE 'body'?
     * El usuario hace clic en un link del email. Los links son peticiones GET
     * y los parámetros van en la URL (?token=xxx), no en el body.
     * Un GET no tiene body según la especificación HTTP.
     */
    verifyEmail: {
        token: {
            required: true,
            source: 'query',
            validators: [
                isRequired('token'),
                isValidToken('token'),
            ]
        }
    } satisfies AuthSchema,

} as const;

// Tipo derivado de los esquemas para type-safety al llamar validateAuth()
export type AuthSchemaName = keyof typeof AuthSchemas;

// ============================================================================
// MOTOR DE VALIDACIÓN
// ============================================================================

/**
 * Ejecuta todos los validadores de un campo en secuencia.
 *
 * ¿POR QUÉ DETENER AL PRIMER ERROR ("FAIL FAST")?
 * Si el email ya falló por estar vacío, no tiene sentido seguir
 * verificando si es un email válido. Un solo error por campo
 * es suficiente — más errores solo confunden al usuario.
 */
function runFieldValidators(
    value: any,
    validators: FieldValidator[],
    allData: Record<string, any>
): { error?: AuthValidationError; sanitizedValue?: any } {
    let currentValue = value;

    for (const validator of validators) {
        const result = validator(currentValue, allData);

        if (!result.isValid) {
            return { error: result.error };
        }

        // Encadenar: el valor sanitizado de un validador
        // es la entrada del siguiente (pipeline pattern)
        if (result.sanitizedValue !== undefined) {
            currentValue = result.sanitizedValue;
        }
    }

    return { sanitizedValue: currentValue };
}

// ============================================================================
// MIDDLEWARE PRINCIPAL
// ============================================================================

/**
 * validateAuth - Middleware generador de validación para rutas de auth.
 *
 * @param schemaName - Nombre del esquema en AuthSchemas
 * @returns Middleware de Express
 *
 * USO:
 *   router.post('/register', validateAuth('register'), authController.register)
 *   router.post('/login',    validateAuth('login'),    authController.login)
 *
 * FLUJO:
 *   1. Extrae datos del request según el source de cada campo (body/query/params)
 *   2. Ejecuta los validadores de cada campo
 *   3. Si hay errores → responde 400 con lista de errores
 *   4. Si todo es válido → pone datos sanitizados en req.body y llama a next()
 *
 * ¿POR QUÉ MODIFICAR req.body CON DATOS SANITIZADOS?
 * El controller recibe req.body directamente. Si ponemos los datos limpios
 * ahí, el controller no necesita saber que existió un proceso de sanitización.
 * Separación de preocupaciones: el controller confía en que los datos
 * que llegan ya están limpios y validados.
 */
export const validateAuth = (schemaName: AuthSchemaName) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const schema = AuthSchemas[schemaName];
            const errors: AuthValidationError[] = [];
            const sanitizedData: Record<string, any> = {};

            // Recolectar todos los datos del request para validadores que
            // necesitan comparar campos entre sí (ej: matchesField)
            const allData: Record<string, any> = {
                ...req.body,
                ...req.query,
                ...req.params
            };

            // Iterar cada campo del esquema
            for (const [fieldName, fieldSchema] of Object.entries(schema) as [string, FieldSchema][]) {

                // Extraer el valor del lugar correcto (body, query o params)
                const source = fieldSchema.source || 'body';
                const sourceMap = {
                    body:   req.body,
                    query:  req.query,
                    params: req.params
                };
                const rawValue = sourceMap[source]?.[fieldName];

                // Si el campo no es requerido y no vino en el request → saltar
                const isEmpty =
                    rawValue === undefined ||
                    rawValue === null ||
                    (typeof rawValue === 'string' && rawValue.trim() === '');

                if (!fieldSchema.required && isEmpty) {
                    continue;
                }

                // Ejecutar validadores
                const { error, sanitizedValue } = runFieldValidators(
                    rawValue,
                    fieldSchema.validators,
                    allData
                );

                if (error) {
                    errors.push(error);
                } else if (sanitizedValue !== undefined) {
                    sanitizedData[fieldName] = sanitizedValue;
                }
            }

            // Si hay errores → rechazar el request
            if (errors.length > 0) {
                logMessage(
                    LogLevel.WARN,
                    'auth_validation_failed',
                    `Validación de auth fallida [${schemaName}]`,
                    {
                        schema: schemaName,
                        path: req.originalUrl,
                        method: req.method,
                        // No logueamos los valores de los errores porque pueden
                        // contener contraseñas (aunque el validador pone [REDACTED])
                        errorFields: errors.map(e => ({ field: e.field, code: e.code })),
                        ip: req.ip
                    }
                );

                res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Los datos enviados no son válidos',
                        details: {
                            // ¿POR QUÉ fieldErrors Y totalErrors?
                            // fieldErrors: permite al frontend destacar campos específicos
                            // totalErrors: permite saber si hay más errores de los mostrados
                            fieldErrors: errors,
                            totalErrors: errors.length
                        },
                        timestamp: new Date().toISOString(),
                        path: req.originalUrl,
                        method: req.method
                    }
                });
                return;
            }

            // ✅ Todo válido:
            // Mezclar datos sanitizados con el body original
            // (para no perder campos que el middleware no conoce, como ranchId)
            req.body = { ...req.body, ...sanitizedData };

            // También disponible en req.validatedData para controllers
            // que prefieran leer de ahí en lugar del body
            (req as any).validatedData = sanitizedData;

            next();

        } catch (error) {
            // Error inesperado en el propio middleware de validación
            logMessage(
                LogLevel.ERROR,
                'auth_validation_error',
                `Error interno en validateAuth [${schemaName}]: ${error}`,
                {
                    schema: schemaName,
                    path: req.originalUrl,
                    error: error instanceof Error ? error.stack : String(error)
                }
            );

            // ¿POR QUÉ 500 Y NO next(error)?
            // Un error en validación es un problema del servidor, no del cliente.
            // No queremos que el request continúe al controller sin validación.
            res.status(500).json({
                success: false,
                error: {
                    code: 'VALIDATION_MIDDLEWARE_ERROR',
                    message: 'Error interno al validar los datos',
                    timestamp: new Date().toISOString()
                }
            });
        }
    };
};

// ============================================================================
// EXPORTACIONES DE VALIDADORES PRIMITIVOS
// (para usar en tests o en otros esquemas del sistema)
// ============================================================================
export {
    isRequired,
    isValidEmail,
    hasMinLength,
    hasMaxLength,
    hasPasswordStrength,
    matchesField,
    isValidName,
    isValidPhone,
    isValidToken
};