// validators/admin.validators.ts
/**
 * ============================================================================
 * VALIDADORES DEL MÓDULO DE ADMINISTRACIÓN
 * ============================================================================
 *
 * Valida la creación de usuarios desde el panel de admin.
 * Distinto al registro público (Auth.validation.ts) porque:
 * - Incluye campo `role` (el admin elige el rol, el registro público no)
 * - Incluye campo `ranchId` (asignar usuario a un rancho)
 * - La jerarquía de roles se valida en el controller, no aquí
 *   (porque depende del rol del solicitante, no del payload)
 *
 * ESTRUCTURA: misma que Auth.validation.ts y los demás validators.
 *
 * USO EN RUTAS:
 *   router.post('/users', validateAdmin('createUser'), adminController.createUser)
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { logMessage, LogLevel } from '../middleware/logging';
import { UserRole } from '../models/User';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

interface AdminValidationError {
    field: string;
    value: any;
    message: string;
    code: string;
}

interface FieldValidationResult {
    isValid: boolean;
    error?: AdminValidationError;
    sanitizedValue?: any;
}

type FieldValidator = (value: any, allData?: Record<string, any>) => FieldValidationResult;

interface FieldSchema {
    required: boolean;
    validators: FieldValidator[];
    source?: 'body' | 'query' | 'params';
}

type AdminSchema = Record<string, FieldSchema>;

// ============================================================================
// VALIDADORES PRIMITIVOS
// ============================================================================

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

const isValidEmail = (fieldName: string): FieldValidator => (value) => {
    if (!value) return { isValid: true };

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

const hasMinLength = (fieldName: string, min: number): FieldValidator => (value) => {
    if (!value) return { isValid: true };
    const str = String(value).trim();
    if (str.length < min) {
        return {
            isValid: false,
            error: {
                field: fieldName,
                value: fieldName.toLowerCase().includes('password') ? '[REDACTED]' : str,
                message: `${fieldName} debe tener al menos ${min} caracteres`,
                code: 'TOO_SHORT'
            }
        };
    }
    return { isValid: true, sanitizedValue: str };
};

const hasMaxLength = (fieldName: string, max: number): FieldValidator => (value) => {
    if (!value) return { isValid: true };
    const str = String(value).trim();
    if (str.length > max) {
        return {
            isValid: false,
            error: {
                field: fieldName,
                value: fieldName.toLowerCase().includes('password') ? '[REDACTED]' : str,
                message: `${fieldName} no puede exceder ${max} caracteres`,
                code: 'TOO_LONG'
            }
        };
    }
    return { isValid: true, sanitizedValue: str };
};

const hasPasswordStrength = (fieldName: string): FieldValidator => (value) => {
    if (!value) return { isValid: true };

    const password = String(value);
    const checks = {
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    const missing: string[] = [];
    if (!checks.uppercase) missing.push('una letra mayúscula');
    if (!checks.lowercase) missing.push('una letra minúscula');
    if (!checks.number) missing.push('un número');
    if (!checks.special) missing.push('un carácter especial (!@#$%...)');

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
    return { isValid: true };
};

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
 * Valida formato de nombre (letras latinas, acentos, ñ, espacios, guiones).
 * Auto-capitaliza: "juan josé" → "Juan José"
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

    const capitalized = sanitized
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());

    return { isValid: true, sanitizedValue: capitalized };
};

/**
 * Valida teléfono mexicano (10 dígitos, opcionalmente con +52).
 */
const isValidPhone = (fieldName: string): FieldValidator => (value) => {
    if (!value || String(value).trim() === '') return { isValid: true };

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

    const normalized = cleaned.startsWith('52') && cleaned.length === 12
        ? cleaned.slice(2)
        : cleaned;

    return { isValid: true, sanitizedValue: normalized };
};

/**
 * Valida que el rol sea uno de los valores válidos del enum UserRole.
 * La jerarquía (quién puede crear qué) se valida en el controller,
 * no aquí, porque depende del rol del SOLICITANTE.
 */
const isValidRole = (fieldName: string): FieldValidator => (value) => {
    if (!value) return { isValid: true }; // Si no viene, el controller asigna VIEWER

    const validRoles = Object.values(UserRole);
    const sanitized = String(value).toUpperCase().trim();

    if (!validRoles.includes(sanitized as UserRole)) {
        return {
            isValid: false,
            error: {
                field: fieldName,
                value,
                message: `Rol inválido. Roles válidos: ${validRoles.join(', ')}`,
                code: 'INVALID_ROLE'
            }
        };
    }
    return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Valida formato UUID para ranchId.
 */
const isValidUUID = (fieldName: string): FieldValidator => (value) => {
    if (!value) return { isValid: true };

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const sanitized = String(value).trim().toLowerCase();

    if (!uuidRegex.test(sanitized)) {
        return {
            isValid: false,
            error: {
                field: fieldName,
                value,
                message: `${fieldName} debe ser un UUID válido`,
                code: 'INVALID_UUID'
            }
        };
    }
    return { isValid: true, sanitizedValue: sanitized };
};

// ============================================================================
// ESQUEMAS DE VALIDACIÓN
// ============================================================================

export const AdminSchemas = {

    /**
     * POST /api/admin/users
     * Creación de usuario por un admin (SUPER_ADMIN u OWNER).
     *
     * Diferencias con el registro público:
     * - `role` es un campo explícito (en registro público siempre es VIEWER)
     * - `ranchId` permite asignar al usuario directamente a un rancho
     * - No tiene captcha ni rate-limit agresivo (el admin ya está autenticado)
     */
    createUser: {
        email: {
            required: true,
            source: 'body' as const,
            validators: [
                isRequired('email'),
                isValidEmail('email'),
                hasMaxLength('email', 255),
            ]
        },
        password: {
            required: true,
            source: 'body' as const,
            validators: [
                isRequired('password'),
                hasMinLength('password', 8),
                hasMaxLength('password', 72),
                hasPasswordStrength('password'),
            ]
        },
        confirmPassword: {
            required: true,
            source: 'body' as const,
            validators: [
                isRequired('confirmPassword'),
                matchesField('confirmPassword', 'password', 'La confirmación de contraseña'),
            ]
        },
        firstName: {
            required: true,
            source: 'body' as const,
            validators: [
                isRequired('firstName'),
                isValidName('firstName'),
            ]
        },
        lastName: {
            required: true,
            source: 'body' as const,
            validators: [
                isRequired('lastName'),
                isValidName('lastName'),
            ]
        },
        phone: {
            required: false,
            source: 'body' as const,
            validators: [
                isValidPhone('phone'),
            ]
        },
        role: {
            required: false,
            source: 'body' as const,
            validators: [
                isValidRole('role'),
            ]
        },
        ranchId: {
            required: false,
            source: 'body' as const,
            validators: [
                isValidUUID('ranchId'),
            ]
        }
    } satisfies AdminSchema,

} as const;

export type AdminSchemaName = keyof typeof AdminSchemas;

// ============================================================================
// MOTOR DE VALIDACIÓN
// ============================================================================

function runFieldValidators(
    value: any,
    validators: FieldValidator[],
    allData: Record<string, any>
): { error?: AdminValidationError; sanitizedValue?: any } {
    let currentValue = value;

    for (const validator of validators) {
        const result = validator(currentValue, allData);

        if (!result.isValid) {
            return { error: result.error };
        }

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
 * validateAdmin - Middleware de validación para rutas de administración.
 *
 * USO:
 *   router.post('/users', validateAdmin('createUser'), adminController.createUser)
 */
export const validateAdmin = (schemaName: AdminSchemaName) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const schema = AdminSchemas[schemaName];
            const errors: AdminValidationError[] = [];
            const sanitizedData: Record<string, any> = {};

            const allData: Record<string, any> = {
                ...req.body,
                ...req.query,
                ...req.params
            };

            for (const [fieldName, fieldSchema] of Object.entries(schema) as [string, FieldSchema][]) {
                const source = fieldSchema.source || 'body';
                const sourceMap = {
                    body: req.body,
                    query: req.query,
                    params: req.params
                };
                const rawValue = sourceMap[source]?.[fieldName];

                const isEmpty =
                    rawValue === undefined ||
                    rawValue === null ||
                    (typeof rawValue === 'string' && rawValue.trim() === '');

                if (!fieldSchema.required && isEmpty) {
                    continue;
                }

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

            if (errors.length > 0) {
                logMessage(
                    LogLevel.WARN,
                    'admin_validation_failed',
                    `Validación de admin fallida [${schemaName}]`,
                    {
                        schema: schemaName,
                        path: req.originalUrl,
                        method: req.method,
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

            req.body = { ...req.body, ...sanitizedData };
            (req as any).validatedData = sanitizedData;

            next();

        } catch (error) {
            logMessage(
                LogLevel.ERROR,
                'admin_validation_error',
                `Error interno en validateAdmin [${schemaName}]: ${error}`,
                {
                    schema: schemaName,
                    path: req.originalUrl,
                    error: error instanceof Error ? error.stack : String(error)
                }
            );

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
