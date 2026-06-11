import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcryptjs';
import LocationData from './Bovine'; // Se habilitará cuando exista el modelo Bovine

/*// Interface temporal para LocationData - Se moverá al modelo Bovine cuando exista
interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
}*/

// Enums para usuarios
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',                 // Super administrador
  RANCH_MANAGER = 'RANCH_MANAGER',             // Gerente de rancho
  VETERINARIAN = 'VETERINARIAN',               // Veterinario
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  WORKER = 'WORKER',
  VIEWER = 'VIEWER'
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',                           // Activo
  INACTIVE = 'INACTIVE',                       // Inactivo
  SUSPENDED = 'SUSPENDED',                     // Suspendido
  PENDING_VERIFICATION = 'PENDING_VERIFICATION', // Pendiente verificación
  BLOCKED = 'BLOCKED',                         // Bloqueado
  PENDING_APPROVAL = 'PENDING_APPROVAL'        // Pendiente aprobación
}

export enum AccessLevel {
  BASIC = 'BASIC',                             // Básico
  STANDARD = 'STANDARD',                       // Estándar
  PREMIUM = 'PREMIUM',                         // Premium
  ENTERPRISE = 'ENTERPRISE',                   // Empresarial
  CUSTOM = 'CUSTOM'                            // Personalizado
}

export enum VerificationStatus {
  UNVERIFIED = 'UNVERIFIED',                   // No verificado
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',           // Email verificado
  PHONE_VERIFIED = 'PHONE_VERIFIED',           // Teléfono verificado
  IDENTITY_VERIFIED = 'IDENTITY_VERIFIED',     // Identidad verificada
  PROFESSIONAL_VERIFIED = 'PROFESSIONAL_VERIFIED', // Profesional verificado
  FULLY_VERIFIED = 'FULLY_VERIFIED'            // Completamente verificado
}

export enum Specialization {
  DAIRY_CATTLE = 'DAIRY_CATTLE',               // Ganado lechero
  BEEF_CATTLE = 'BEEF_CATTLE',                 // Ganado de carne
  REPRODUCTION = 'REPRODUCTION',               // Reproducción
  NUTRITION = 'NUTRITION',                     // Nutrición
  HERD_HEALTH = 'HERD_HEALTH',                 // Salud del hato
  GENETICS = 'GENETICS',                       // Genética
  SURGERY = 'SURGERY',                         // Cirugía
  PATHOLOGY = 'PATHOLOGY',                     // Patología
  EPIDEMIOLOGY = 'EPIDEMIOLOGY',               // Epidemiología
  FARM_MANAGEMENT = 'FARM_MANAGEMENT',         // Manejo de fincas
  QUALITY_ASSURANCE = 'QUALITY_ASSURANCE',     // Aseguramiento de calidad
  SUSTAINABLE_PRACTICES = 'SUSTAINABLE_PRACTICES', // Prácticas sostenibles
  TECHNOLOGY = 'TECHNOLOGY',                   // Tecnología
  ECONOMICS = 'ECONOMICS',                     // Economía
  RESEARCH = 'RESEARCH'                        // Investigación
}

export enum NotificationPreference {
  ALL = 'ALL',                                 // Todas
  IMPORTANT_ONLY = 'IMPORTANT_ONLY',           // Solo importantes
  EMERGENCY_ONLY = 'EMERGENCY_ONLY',           // Solo emergencias
  NONE = 'NONE'                                // Ninguna
}

// Interface para información personal
export interface PersonalInfo {
  firstName: string;                           // Nombre
  lastName: string;                            // Apellido
  middleName?: string;                         // Segundo nombre
  dateOfBirth?: Date;                          // Fecha de nacimiento
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'; // Género
  nationality?: string;                        // Nacionalidad
  idType?: 'PASSPORT' | 'DRIVERS_LICENSE' | 'NATIONAL_ID' | 'PROFESSIONAL_ID'; // Tipo de ID
  idNumber?: string;                           // Número de identificación
  taxId?: string;                              // RFC o ID fiscal
  maritalStatus?: 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' | 'OTHER'; // Estado civil
  emergencyContact?: {                         // Contacto de emergencia
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  };
  languages?: Array<{                          // Idiomas
    language: string;
    proficiency: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'NATIVE';
  }>;
  profilePhoto?: string;                       // URL de foto de perfil
  biography?: string;                          // Biografía
}

// Interface para información de contacto
export interface ContactInfo {
  primaryEmail: string;                        // Email principal
  secondaryEmail?: string;                     // Email secundario
  primaryPhone: string;                        // Teléfono principal
  secondaryPhone?: string;                     // Teléfono secundario
  whatsapp?: string;                           // WhatsApp
  address?: {                                  // Dirección
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string;
    coordinates?: LocationData;
  };
  socialMedia?: {                              // Redes sociales
    linkedin?: string;
    facebook?: string;
    twitter?: string;
    instagram?: string;
    website?: string;
  };
  preferredContactMethod?: 'EMAIL' | 'PHONE' | 'WHATSAPP' | 'SMS'; // Método preferido
  availability?: {                             // Disponibilidad
    workingHours: {
      monday?: { start: string; end: string; };
      tuesday?: { start: string; end: string; };
      wednesday?: { start: string; end: string; };
      thursday?: { start: string; end: string; };
      friday?: { start: string; end: string; };
      saturday?: { start: string; end: string; };
      sunday?: { start: string; end: string; };
    };
    timezone: string;
    emergencyAvailable: boolean;               // Disponible para emergencias
    emergencyHours?: string;                   // Horarios de emergencia
  };
}

// Interface para información profesional
export interface ProfessionalInfo {
  title?: string;                              // Título profesional
  organization?: string;                       // Organización
  position?: string;                           // Cargo
  department?: string;                         // Departamento
  specializations: Specialization[];           // Especializaciones
  experience?: number;                         // Años de experiencia
  education?: Array<{                          // Educación
    degree: string;
    institution: string;
    year: number;
    country?: string;
    major?: string;
  }>;
  certifications?: Array<{                     // Certificaciones
    name: string;
    issuingOrganization: string;
    issueDate: Date;
    expirationDate?: Date;
    certificateNumber?: string;
    status: 'VALID' | 'EXPIRED' | 'SUSPENDED' | 'PENDING';
  }>;
  licenses?: Array<{                           // Licencias profesionales
    type: string;
    licenseNumber: string;
    issuingAuthority: string;
    issueDate: Date;
    expirationDate: Date;
    status: 'VALID' | 'EXPIRED' | 'SUSPENDED';
  }>;
  memberships?: Array<{                        // Membresías profesionales
    organization: string;
    membershipType: string;
    memberNumber?: string;
    joinDate: Date;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  }>;
  skills?: string[];                           // Habilidades
  publications?: Array<{                       // Publicaciones
    title: string;
    journal?: string;
    year: number;
    type: 'ARTICLE' | 'BOOK' | 'CONFERENCE' | 'THESIS' | 'OTHER';
    url?: string;
  }>;
  awards?: Array<{                             // Premios y reconocimientos
    name: string;
    organization: string;
    year: number;
    description?: string;
  }>;
  services?: Array<{                           // Servicios que ofrece
    service: string;
    description: string;
    rate?: number;
    currency?: string;
    availability: boolean;
  }>;
}

// Interface para configuraciones del sistema
export interface SystemSettings {
  theme?: 'LIGHT' | 'DARK' | 'AUTO';           // Tema
  language?: string;                           // Idioma
  timezone?: string;                           // Zona horaria
  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'; // Formato de fecha
  timeFormat?: '12H' | '24H';                  // Formato de hora
  currency?: string;                           // Moneda preferida
  units?: 'METRIC' | 'IMPERIAL';               // Sistema de unidades
  notifications?: {                            // Configuración de notificaciones
    email: NotificationPreference;
    sms: NotificationPreference;
    push: NotificationPreference;
    whatsapp: NotificationPreference;
  };
  privacy?: {                                  // Configuración de privacidad
    profileVisibility: 'PUBLIC' | 'PRIVATE' | 'CONTACTS_ONLY';
    showOnlineStatus: boolean;
    allowMessages: 'EVERYONE' | 'CONTACTS_ONLY' | 'NONE';
    shareLocation: boolean;
  };
  dashboard?: {                                // Configuración del dashboard
    widgets: string[];                         // Widgets activos
    layout: 'GRID' | 'LIST';                   // Diseño
    refreshInterval: number;                   // Intervalo de actualización (segundos)
  };
  security?: {                                 // Configuración de seguridad
    twoFactorEnabled: boolean;                 // Autenticación de dos factores
    sessionTimeout: number;                    // Tiempo de sesión (minutos)
    loginNotifications: boolean;               // Notificaciones de login
    deviceTracking: boolean;                   // Seguimiento de dispositivos
  };
}

// Interface para permisos específicos
export interface UserPermissions {
  modules: {                                   // Permisos por módulo
    bovines: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
    health: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
    reproduction: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
    finance: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
    inventory: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
    production: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
    locations: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
    reports: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
    users: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
    settings: 'NONE' | 'READ' | 'WRITE' | 'ADMIN';
  };
  actions: {                                   // Acciones específicas
    canCreateRanch: boolean;
    canDeleteRecords: boolean;
    canExportData: boolean;
    canImportData: boolean;
    canAccessAnalytics: boolean;
    canManageUsers: boolean;
    canApproveTransactions: boolean;
    canPrescribeMedications: boolean;
    canPerformSurgery: boolean;
    canAccessFinancials: boolean;
  };
  restrictions: {                              // Restricciones
    maxRanches?: number;                       // Máximo número de ranchos
    maxAnimals?: number;                       // Máximo número de animales
    dataRetentionDays?: number;                // Días de retención de datos
    apiCallsPerDay?: number;                   // Llamadas API por día
    storageLimit?: number;                     // Límite de almacenamiento (GB)
  };
}

// Interface para actividad del usuario
export interface UserActivity {
  lastLogin?: Date;                            // Último login
  lastActivity?: Date;                         // Última actividad
  loginCount?: number;                         // Número de logins
  sessionsActive?: number;                     // Sesiones activas
  totalTimeSpent?: number;                     // Tiempo total en sistema (horas)
  mostUsedFeatures?: Array<{                   // Características más usadas
    feature: string;
    usage_count: number;
    last_used: Date;
  }>;
  deviceInfo?: Array<{                         // Información de dispositivos
    deviceId: string;
    deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET';
    browser?: string;
    os?: string;
    lastUsed: Date;
    trusted: boolean;
  }>;
  loginHistory?: Array<{                       // Historial de logins
    timestamp: Date;
    ipAddress: string;
    location?: string;
    device: string;
    success: boolean;
    failureReason?: string;
  }>;
}

// Interface para métricas de desempeño
export interface PerformanceMetrics {
  efficiency?: number;                         // Eficiencia general (%)
  accuracy?: number;                          // Precisión (%)
  responseTime?: number;                      // Tiempo de respuesta promedio (horas)
  completionRate?: number;                    // Tasa de completación (%)
  qualityScore?: number;                      // Puntuación de calidad (0-100)
  clientSatisfaction?: number;                // Satisfacción del cliente (%)
  productivity?: {                            // Productividad
    tasksCompleted: number;
    averageTaskTime: number;
    deadlinesMet: number;
    totalTasks: number;
  };
  specialtyMetrics?: {                        // Métricas por especialidad
    [key: string]: {
      cases: number;
      successRate: number;
      averageCost: number;
      clientFeedback: number;
    };
  };
  monthlyStats?: Array<{                      // Estadísticas mensuales
    month: string;
    casesHandled: number;
    revenue?: number;
    satisfaction: number;
    efficiency: number;
  }>;
}

// Interface para información de seguridad
export interface SecurityInfo {
  passwordLastChanged: Date;
  twoFactorSecret?: string;
  recoveryQuestions?: Array<{
    question: string;
    answerHash: string;
  }>;
  trustedDevices?: string[];
  blockedIPs?: string[];
  securityEvents?: Array<{
    type: string;
    timestamp: Date;
    details: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
}

export interface PushToken {
  token: string;                                // Token FCM/APNs
  deviceType: 'android' | 'ios' | 'web';        // Tipo de dispositivo
  deviceName?: string;                          // Nombre del dispositivo (ej: "iPhone de Juan")
  deviceId?: string;                             // ID único del dispositivo
  platform?: string;                             // Plataforma específica (ej: "Expo", "React Native")
  appVersion?: string;                           // Versión de la app
  lastUsed: Date;                                // Última vez que se usó
  createdAt: Date;                               // Fecha de registro
  active: boolean;                               // Si el token está activo
  preferences?: {                                 // Preferencias específicas para este dispositivo
    sound: boolean;
    vibrate: boolean;
    badge: boolean;
    priority?: 'high' | 'normal' | 'low';
  };
}
// Atributos del modelo User
export interface UserAttributes {
  id: string;
  userCode: string;                            // Código único del usuario
  username: string;                            // Nombre de usuario
  email: string;                               // Email único
  password: string;                            // Contraseña hasheada
  role: UserRole;                              // Rol del usuario
  status: UserStatus;                          // Estado del usuario
  accessLevel: AccessLevel;                    // Nivel de acceso
  verificationStatus: VerificationStatus;      // Estado de verificación
  personalInfo: PersonalInfo;                  // Información personal
  contactInfo: ContactInfo;                    // Información de contacto
  professionalInfo?: ProfessionalInfo;         // Información profesional
  systemSettings?: SystemSettings;             // Configuraciones del sistema
  permissions: UserPermissions;                // Permisos específicos
  activity?: UserActivity;                     // Actividad del usuario
  performanceMetrics?: PerformanceMetrics;     // Métricas de desempeño
  ranchAccess?: Array<{                        // Acceso a ranchos
    ranchId: string;
    ranchName: string;
    accessLevel: 'OWNER' | 'MANAGER' | 'EMPLOYEE' | 'CONSULTANT' | 'VIEWER';
    permissions: string[];
    grantedBy: string;
    grantedDate: Date;
    expirationDate?: Date;
    isActive: boolean;
  }>;
  subscriptionInfo?: {                         // Información de suscripción
    plan: string;
    startDate: Date;
    endDate?: Date;
    status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED' | 'TRIAL';
    features: string[];
    billingCycle: 'MONTHLY' | 'YEARLY';
    autoRenew: boolean;
  };
  apiAccess?: {                                // Acceso a API
    apiKey?: string;
    apiKeyExpiration?: Date;
    rateLimit: number;
    webhookUrl?: string;
    allowedIPs?: string[];
  };
  securityInfo?: SecurityInfo;                 // Información de seguridad
  complianceInfo?: {                           // Información de cumplimiento
    dataProcessingConsent: boolean;
    marketingConsent: boolean;
    consentDate: Date;
    gdprCompliant: boolean;
    dataRetentionPeriod: number;
    auditTrail?: Array<{
      action: string;
      timestamp: Date;
      data: string;
      ipAddress: string;
    }>;
  };
  integrations?: Array<{                       // Integraciones externas
    service: string;
    status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
    credentials?: Object;
    lastSync?: Date;
    settings?: Object;
  }>;
  tags?: string[];                             // Etiquetas
  notes?: string;                              // Notas administrativas
  isActive: boolean;                           // Si el usuario está activo
  isVerified: boolean;                         // Si está verificado
  emailVerified: boolean;                      // Si el email está verificado
  phoneVerified: boolean;                      // Si el teléfono está verificado
  termsAccepted: boolean;                      // Si aceptó términos
  termsAcceptedDate?: Date;                    // Fecha de aceptación de términos
  privacyPolicyAccepted: boolean;              // Si aceptó política de privacidad
  privacyPolicyAcceptedDate?: Date;            // Fecha de aceptación de privacidad
  lastLoginAt?: Date;                          // Última vez que se conectó
  lastActiveAt?: Date;                         // Última actividad
  createdBy?: string;                          // ID del usuario que lo creó
  updatedBy?: string;                          // ID del usuario que lo actualizó
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  pushTokens?: PushToken[];
}



// Atributos opcionales al crear un nuevo usuario
export interface UserCreationAttributes
  extends Optional<UserAttributes,
    'id' | 'userCode' | 'professionalInfo' | 'systemSettings' | 'activity' |
    'performanceMetrics' | 'ranchAccess' | 'subscriptionInfo' | 'apiAccess' |
    'securityInfo' | 'complianceInfo' | 'integrations' | 'tags' | 'notes' |
    'termsAcceptedDate' | 'privacyPolicyAcceptedDate' | 'lastLoginAt' |
    'lastActiveAt' | 'createdBy' | 'updatedBy' /*| 'createdAt' | 'updatedAt'*/ | 
    'deletedAt'
  > { }

// Clase del modelo User
class User extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes {
  public id!: string;
  public userCode!: string;
  public username!: string;
  public email!: string;
  public password!: string;
  public role!: UserRole;
  public status!: UserStatus;
  public accessLevel!: AccessLevel;
  public verificationStatus!: VerificationStatus;
  public personalInfo!: PersonalInfo;
  public contactInfo!: ContactInfo;
  public professionalInfo?: ProfessionalInfo;
  public systemSettings?: SystemSettings;
  public permissions!: UserPermissions;
  public activity?: UserActivity;
  public performanceMetrics?: PerformanceMetrics;
  public ranchAccess?: Array<{
    ranchId: string;
    ranchName: string;
    accessLevel: 'OWNER' | 'MANAGER' | 'EMPLOYEE' | 'CONSULTANT' | 'VIEWER';
    permissions: string[];
    grantedBy: string;
    grantedDate: Date;
    expirationDate?: Date;
    isActive: boolean;
  }>;
  public subscriptionInfo?: {
    plan: string;
    startDate: Date;
    endDate?: Date;
    status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED' | 'TRIAL';
    features: string[];
    billingCycle: 'MONTHLY' | 'YEARLY';
    autoRenew: boolean;
  };
  public apiAccess?: {
    apiKey?: string;
    apiKeyExpiration?: Date;
    rateLimit: number;
    webhookUrl?: string;
    allowedIPs?: string[];
  };
  public securityInfo?: SecurityInfo;
  public complianceInfo?: {
    dataProcessingConsent: boolean;
    marketingConsent: boolean;
    consentDate: Date;
    gdprCompliant: boolean;
    dataRetentionPeriod: number;
    auditTrail?: Array<{
      action: string;
      timestamp: Date;
      data: string;
      ipAddress: string;
    }>;
  };
  public integrations?: Array<{
    service: string;
    status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
    credentials?: Object;
    lastSync?: Date;
    settings?: Object;
  }>;
  public tags?: string[];
  public notes?: string;
  public isActive!: boolean;
  public isVerified!: boolean;
  public emailVerified!: boolean;
  public phoneVerified!: boolean;
  public termsAccepted!: boolean;
  public termsAcceptedDate?: Date;
  public privacyPolicyAccepted!: boolean;
  public privacyPolicyAcceptedDate?: Date;
  public lastLoginAt?: Date;
  public lastActiveAt?: Date;
  public createdBy?: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
  public pushTokens?: PushToken[];
  name: string | undefined;

  // Métodos de instancia

  /**
   * Obtiene el rol del usuario en español
   * @returns Rol traducido
   */
  public getRoleLabel(): string {
    const labels = {
      [UserRole.SUPER_ADMIN]: 'Super Administrador',
      [UserRole.RANCH_MANAGER]: 'Gerente de Rancho',
      [UserRole.VETERINARIAN]: 'Veterinario',
      [UserRole.OWNER]: 'Propietario',
      [UserRole.MANAGER]: 'Gerente',
      [UserRole.WORKER]: 'Trabajador',
      [UserRole.VIEWER]: 'Observador',
    };
    return labels[this.role];
  }

  /**
   * Obtiene el nombre completo del usuario
   * @returns Nombre completo
   */
  public getFullName(): string {
    const { firstName, lastName, middleName } = this.personalInfo;
    return [firstName, middleName, lastName].filter(Boolean).join(' ');
  }

  /**
   * Verifica la contraseña
   * @param password Contraseña a verificar
   * @returns True si la contraseña es correcta
   */
  public async verifyPassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  /**
   * Hashea una nueva contraseña
   * @param password Nueva contraseña
   * @returns Contraseña hasheada
   */
  public static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verifica si un string es un hash de bcrypt
   * Los hashes de bcrypt tienen un formato específico:
   * - Empiezan con $2a$, $2b$, $2x$, $2y$ (versiones del algoritmo)
   * - Tienen una longitud mínima de 60 caracteres
   * - Siguen el formato: $version$cost$salt+hash
   * 
   * @param value String a verificar
   * @returns True si el string es un hash de bcrypt
   * 
   * @example
   * isBcryptHash('$2a$12$KIX5w9...') // true
   * isBcryptHash('password123') // false
   */
  public static isBcryptHash(value: string): boolean {
    // Validación básica: debe ser string y tener al menos longitud mínima
    if (typeof value !== 'string' || value.length < 60) {
      return false;
    }

    // Verificar formato de hash bcrypt
    // Los hashes bcrypt empiezan con: $2a$, $2b$, $2x$, $2y$, o $2$ (versiones antiguas)
    const bcryptHashPattern = /^\$2[abyx]?\$\d{1,2}\$[./A-Za-z0-9]{53}$/;

    return bcryptHashPattern.test(value);
  }

  /**
   * Valida que una contraseña no sea igual a otra (ya hasheada)
   * Compara la contraseña en texto plano con una contraseña hasheada usando bcrypt.compare
   * 
   * @param plainPassword Contraseña en texto plano
   * @param hashedPassword Contraseña hasheada con bcrypt
   * @returns Promise<boolean> True si son diferentes, False si son iguales
   * 
   * @example
   * await isPasswordDifferent('newpass', '$2a$12$...oldhash') // true o false
   */
  public static async isPasswordDifferent(
    plainPassword: string,
    hashedPassword: string
  ): Promise<boolean> {
    try {
      // Usar bcrypt.compare para verificar si la contraseña en texto plano
      // coincide con el hash (esto es seguro y es el método correcto)
      const isSame = await bcrypt.compare(plainPassword, hashedPassword);
      // Si son iguales, retornamos false (no son diferentes)
      // Si son diferentes, retornamos true
      return !isSame;
    } catch (error) {
      // Si hay error al comparar, asumimos que son diferentes por seguridad
      // Esto previene errores en casos edge donde el hash pueda estar corrupto
      console.error('Error comparando contraseñas:', error);
      return true;
    }
  }

  /**
   * Verifica si tiene acceso a un rancho específico
   * @param ranchId ID del rancho
   * @returns True si tiene acceso
   */
  public hasRanchAccess(ranchId: string): boolean {
    if (!this.ranchAccess) return false;
    return this.ranchAccess.some(access =>
      access.ranchId === ranchId &&
      access.isActive &&
      (!access.expirationDate || new Date() < access.expirationDate)
    );
  }

  /**
   * Obtiene el nivel de acceso a un rancho
   * @param ranchId ID del rancho
   * @returns Nivel de acceso o null
   */
  public getRanchAccessLevel(ranchId: string): 'OWNER' | 'MANAGER' | 'EMPLOYEE' | 'CONSULTANT' | 'VIEWER' | null {
    if (!this.ranchAccess) return null;
    const access = this.ranchAccess.find(access =>
      access.ranchId === ranchId &&
      access.isActive &&
      (!access.expirationDate || new Date() < access.expirationDate)
    );
    return access?.accessLevel || null;
  }

  /**
   * Verifica si tiene un permiso específico
   * @param module Módulo
   * @param action Acción requerida
   * @returns True si tiene el permiso
   */
  public hasPermission(module: keyof UserPermissions['modules'], action: 'READ' | 'WRITE' | 'ADMIN'): boolean {
    const modulePermission = this.permissions.modules[module];

    switch (action) {
      case 'READ':
        return modulePermission !== 'NONE';
      case 'WRITE':
        return modulePermission === 'WRITE' || modulePermission === 'ADMIN';
      case 'ADMIN':
        return modulePermission === 'ADMIN';
      default:
        return false;
    }
  }

  /**
   * Verifica si puede realizar una acción específica
   * @param action Acción a verificar
   * @returns True si puede realizar la acción
   */
  public canPerformAction(action: keyof UserPermissions['actions']): boolean {
    return this.permissions.actions[action] || false;
  }

  /**
   * Obtiene las certificaciones vigentes
   * @returns Array de certificaciones válidas
   */
  public getValidCertifications(): Array<{
    name: string;
    issuingOrganization: string;
    expirationDate?: Date;
    daysToExpiration?: number;
  }> {
    if (!this.professionalInfo?.certifications) return [];

    const now = new Date();
    return this.professionalInfo.certifications
      .filter(cert => cert.status === 'VALID' && (!cert.expirationDate || cert.expirationDate > now))
      .map(cert => ({
        name: cert.name,
        issuingOrganization: cert.issuingOrganization,
        expirationDate: cert.expirationDate,
        daysToExpiration: cert.expirationDate ?
          Math.ceil((cert.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) :
          undefined
      }));
  }

  /**
   * Verifica si es un profesional de la salud animal
   * @returns True si es veterinario o especialista
   */
  public isAnimalHealthProfessional(): boolean {
    return [
      UserRole.VETERINARIAN,
    ].includes(this.role);
  }

  /**
   * Calcula la puntuación de verificación
   * @returns Puntuación de 0-100
   */
  public getVerificationScore(): number {
    let score = 0;

    if (this.emailVerified) score += 20;
    if (this.phoneVerified) score += 20;
    if (this.verificationStatus === VerificationStatus.IDENTITY_VERIFIED) score += 20;
    if (this.verificationStatus === VerificationStatus.PROFESSIONAL_VERIFIED) score += 20;
    if (this.getValidCertifications().length > 0) score += 10;
    if (this.professionalInfo?.licenses && this.professionalInfo.licenses.length > 0) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Verifica si necesita renovar certificaciones
   * @param days Días de anticipación
   * @returns True si necesita renovar
   */
  public needsCertificationRenewal(days: number = 30): boolean {
    const validCertifications = this.getValidCertifications();
    return validCertifications.some(cert =>
      cert.daysToExpiration !== undefined && cert.daysToExpiration <= days
    );
  }

  /**
   * Obtiene alertas del usuario
   * @returns Array de alertas
   */
  public getUserAlerts(): Array<{
    type: 'INFO' | 'WARNING' | 'CRITICAL';
    category: string;
    message: string;
    priority: number;
  }> {
    const alerts: Array<{
      type: 'INFO' | 'WARNING' | 'CRITICAL';
      category: string;
      message: string;
      priority: number;
    }> = [];

    // Alertas de verificación
    if (!this.emailVerified) {
      alerts.push({
        type: 'WARNING',
        category: 'Verificación',
        message: 'Email no verificado',
        priority: 2
      });
    }

    if (!this.phoneVerified) {
      alerts.push({
        type: 'WARNING',
        category: 'Verificación',
        message: 'Teléfono no verificado',
        priority: 2
      });
    }

    // Alertas de certificaciones
    if (this.needsCertificationRenewal(30)) {
      const expiringSoon = this.getValidCertifications().filter(cert =>
        cert.daysToExpiration !== undefined && cert.daysToExpiration <= 30
      );

      expiringSoon.forEach(cert => {
        alerts.push({
          type: cert.daysToExpiration! <= 7 ? 'CRITICAL' : 'WARNING',
          category: 'Certificación',
          message: `Certificación ${cert.name} vence en ${cert.daysToExpiration} días`,
          priority: cert.daysToExpiration! <= 7 ? 1 : 2
        });
      });
    }

    // Alertas de suscripción
    if (this.subscriptionInfo?.status === 'EXPIRED') {
      alerts.push({
        type: 'CRITICAL',
        category: 'Suscripción',
        message: 'Suscripción expirada',
        priority: 1
      });
    }

    // Alertas de seguridad
    if (this.securityInfo?.passwordLastChanged) {
      const daysSincePasswordChange = Math.floor(
        (new Date().getTime() - this.securityInfo.passwordLastChanged.getTime()) /
        (1000 * 60 * 60 * 24)
      );

      if (daysSincePasswordChange > 90) {
        alerts.push({
          type: 'WARNING',
          category: 'Seguridad',
          message: 'Contraseña no cambiada en más de 90 días',
          priority: 2
        });
      }
    }

    // Alertas de acceso a ranchos
    if (this.ranchAccess) {
      const expiredAccess = this.ranchAccess.filter(access =>
        access.expirationDate && new Date() > access.expirationDate && access.isActive
      );

      if (expiredAccess.length > 0) {
        alerts.push({
          type: 'WARNING',
          category: 'Acceso',
          message: `Acceso expirado a ${expiredAccess.length} rancho(s)`,
          priority: 2
        });
      }
    }

    return alerts.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Actualiza la última actividad del usuario
   */
  public updateLastActivity(): void {
    this.lastActiveAt = new Date();
    if (!this.activity) {
      this.activity = {};
    }
    this.activity.lastActivity = new Date();
  }

  /**
   * Registra un login exitoso
   * @param ipAddress Dirección IP
   * @param device Información del dispositivo
   */
  public recordSuccessfulLogin(ipAddress: string, device: string): void {
    this.lastLoginAt = new Date();

    if (!this.activity) {
      this.activity = {};
    }

    this.activity.lastLogin = new Date();
    this.activity.loginCount = (this.activity.loginCount || 0) + 1;

    if (!this.activity.loginHistory) {
      this.activity.loginHistory = [];
    }

    this.activity.loginHistory.unshift({
      timestamp: new Date(),
      ipAddress,
      device,
      success: true
    });

    // Mantener solo los últimos 50 registros
    this.activity.loginHistory = this.activity.loginHistory.slice(0, 50);
  }

  /**
   * Genera un resumen del perfil del usuario
   * @returns Resumen completo
   */
  public getProfileSummary(): {
    basic: {
      name: string;
      role: string;
      status: string;
      email: string;
      phone?: string;
    };
    verification: {
      score: number;
      emailVerified: boolean;
      phoneVerified: boolean;
      professionalVerified: boolean;
    };
    professional?: {
      title?: string;
      organization?: string;
      experience?: number;
      specializations: string[];
      certifications: number;
    };
    access: {
      ranchesAccess: number;
      permissions: string[];
      restrictions: Object;
    };
    activity: {
      lastLogin?: Date;
      loginCount: number;
      isOnline: boolean;
    };
    alerts: Array<{
      type: string;
      category: string;
      message: string;
      priority: number;
    }>;
  } {
    const alerts = this.getUserAlerts();
    const isOnline = this.lastActiveAt ?
      (new Date().getTime() - this.lastActiveAt.getTime()) < (15 * 60 * 1000) : // 15 minutos
      false;

    return {
      basic: {
        name: this.getFullName(),
        role: this.getRoleLabel(),
        status: this.status,
        email: this.email,
        phone: this.contactInfo.primaryPhone
      },
      verification: {
        score: this.getVerificationScore(),
        emailVerified: this.emailVerified,
        phoneVerified: this.phoneVerified,
        professionalVerified: this.verificationStatus === VerificationStatus.PROFESSIONAL_VERIFIED ||
          this.verificationStatus === VerificationStatus.FULLY_VERIFIED
      },
      professional: this.professionalInfo ? {
        title: this.professionalInfo.title,
        organization: this.professionalInfo.organization,
        experience: this.professionalInfo.experience,
        specializations: this.professionalInfo.specializations,
        certifications: this.getValidCertifications().length
      } : undefined,
      access: {
        ranchesAccess: this.ranchAccess?.filter(access => access.isActive).length || 0,
        permissions: Object.entries(this.permissions.modules)
          .filter(([_, permission]) => permission !== 'NONE')
          .map(([module, permission]) => `${module}: ${permission}`),
        restrictions: this.permissions.restrictions
      },
      activity: {
        lastLogin: this.lastLoginAt,
        loginCount: this.activity?.loginCount || 0,
        isOnline
      },
      alerts
    };
  }

  /**
   * Verifica si puede acceder a una funcionalidad específica
   * @param feature Funcionalidad a verificar
   * @returns True si puede acceder
   */
  public canAccessFeature(feature: string): boolean {
    // Verificar estado del usuario
    if (this.status !== UserStatus.ACTIVE) return false;

    // Verificar suscripción
    if (this.subscriptionInfo?.status !== 'ACTIVE') return false;

    // Verificar si la funcionalidad está en el plan
    if (this.subscriptionInfo?.features && !this.subscriptionInfo.features.includes(feature)) {
      return false;
    }

    return true;
  }
}

// Definición del modelo en Sequelize
User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del usuario'
    },
    userCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: () => {
        const timestamp = Date.now().toString().slice(-6);
        return `US${timestamp}`;
      },
      comment: 'Código único del usuario',
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 50],
        is: {
          args: /^[\p{L}0-9._\-\s]+$/u,
          msg: 'El nombre de usuario solo puede contener letras, números, puntos, guiones bajos, guiones y espacios'
        }
      },
      comment: 'Nombre de usuario único'
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        isEmail: true,
        notEmpty: true
      },
      comment: 'Email único del usuario'
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [8, 255]
      },
      comment: 'Contraseña hasheada'
    },
    role: {
      type: DataTypes.ENUM(...Object.values(UserRole)),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(UserStatus)),
      allowNull: false,
      defaultValue: UserStatus.PENDING_VERIFICATION,
    },
    accessLevel: {
      type: DataTypes.ENUM(...Object.values(AccessLevel)),
      allowNull: false,
      defaultValue: AccessLevel.BASIC,
    },
    verificationStatus: {
      type: DataTypes.ENUM(...Object.values(VerificationStatus)),
      allowNull: false,
      defaultValue: VerificationStatus.UNVERIFIED,
    },
    personalInfo: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        notEmpty: true,
        isValidPersonalInfo(value: PersonalInfo) {
          if (!value.firstName || !value.lastName) {
            throw new Error('Nombre y apellido son requeridos');
          }
        }
      },
      comment: 'Información personal del usuario'
    },
    contactInfo: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        notEmpty: true,
        isValidContactInfo(value: ContactInfo) {
          if (!value.primaryEmail || !value.primaryPhone) {
            throw new Error('Email y teléfono principales son requeridos');
          }
        }
      },
      comment: 'Información de contacto del usuario'
    },
    professionalInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información profesional del usuario'
    },
    systemSettings: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configuraciones del sistema del usuario'
    },
    permissions: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Permisos específicos del usuario'
    },
    activity: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Actividad y estadísticas del usuario'
    },
    performanceMetrics: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Métricas de desempeño del usuario'
    },
    ranchAccess: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Acceso a ranchos específicos'
    },
    subscriptionInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de suscripción del usuario'
    },
    apiAccess: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configuración de acceso a API'
    },
    securityInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de seguridad del usuario'
    },
    complianceInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de cumplimiento y privacidad'
    },
    integrations: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Integraciones externas del usuario'
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'Etiquetas del usuario'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas administrativas del usuario'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el usuario está activo'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si el usuario está verificado'
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si el email está verificado'
    },
    phoneVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si el teléfono está verificado'
    },
    termsAccepted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si aceptó los términos y condiciones'
    },
    termsAcceptedDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de aceptación de términos'
    },
    privacyPolicyAccepted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si aceptó la política de privacidad'
    },
    privacyPolicyAcceptedDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de aceptación de política de privacidad'
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha del último login'
    },
    lastActiveAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de última actividad'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que lo creó'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que lo actualizó'
    },
    pushTokens: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Tokens de notificaciones push del usuario'
    },
    /*createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha de creación del usuario'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha de última actualización'
    },*/
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de eliminación (soft delete)'
    }
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    paranoid: true, // Habilita soft delete
    indexes: [
      // Índices únicos
      {
        unique: true,
        fields: ['user_code']
      },
      {
        unique: true,
        fields: ['username']
      },
      {
        unique: true,
        fields: ['email']
      },
      // Índices de búsqueda
      {
        fields: ['role']
      },
      {
        fields: ['status']
      },
      {
        fields: ['access_level']
      },
      {
        fields: ['verification_status']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['is_verified']
      },
      {
        fields: ['email_verified']
      },
      {
        fields: ['last_login_at']
      },
      {
        fields: ['last_active_at']
      },
      // Índices compuestos
      {
        name: 'users_role_status',
        fields: ['role', 'status']
      },
      {
        name: 'users_active_verified',
        fields: ['is_active', 'is_verified']
      },
      {
        name: 'users_search_text',
        fields: ['personal_info'],
        using: 'gin'
      },
      {
        name: 'users_contact_search',
        fields: ['contact_info'],
        using: 'gin'
      },
      {
        name: 'users_ranch_access',
        fields: ['ranch_access'],
        using: 'gin'
      },
      {
        name: 'users_push_tokens',
        fields: ['push_tokens'],
        using: 'gin'
      },

      // Índice para buscar por token específico (útil para desactivar tokens)
      {
        name: 'users_push_tokens_idx',
        using: 'gin',
        fields: ['push_tokens'],
        operator: 'jsonb_path_ops'
      }
    ],
    hooks: {
      // Hook para hashear contraseña antes de crear
      beforeCreate: async (user: User) => {
        // Generar código de usuario único si no existe
        if (!user.userCode) {
          const role = user.role || UserRole.VIEWER;
          const timestamp = Date.now().toString().slice(-6);
          const rolePrefix = user.role.substring(0, 2).toUpperCase();
          user.userCode = `${rolePrefix}${timestamp}`;
        }

        // Establecer configuraciones por defecto
        if (!user.systemSettings) {
          user.systemSettings = {
            theme: 'LIGHT',
            language: 'es',
            timezone: 'America/Mexico_City',
            dateFormat: 'DD/MM/YYYY',
            timeFormat: '24H',
            currency: 'MXN',
            units: 'METRIC',
            notifications: {
              email: NotificationPreference.ALL,
              sms: NotificationPreference.IMPORTANT_ONLY,
              push: NotificationPreference.ALL,
              whatsapp: NotificationPreference.IMPORTANT_ONLY
            },
            privacy: {
              profileVisibility: 'PRIVATE',
              showOnlineStatus: true,
              allowMessages: 'CONTACTS_ONLY',
              shareLocation: false
            },
            security: {
              twoFactorEnabled: false,
              sessionTimeout: 480, // 8 horas
              loginNotifications: true,
              deviceTracking: true
            }
          };
        }

        // Establecer información de seguridad
        if (!user.securityInfo) {
          user.securityInfo = {
            passwordLastChanged: new Date()
          };
        }

        // Establecer información de cumplimiento
        if (!user.complianceInfo) {
          user.complianceInfo = {
            dataProcessingConsent: user.termsAccepted,
            marketingConsent: false,
            consentDate: new Date(),
            gdprCompliant: true,
            dataRetentionPeriod: 365 * 7 // 7 años
          };
        }
      },

      // Hook para hashear contraseña antes de actualizar
      beforeUpdate: async (user: User) => {
        if (user.changed('password')) {

          // Actualizar el timestamp de último cambio de contraseña
          // Esto es importante para políticas de seguridad (ej: forzar cambio cada X días)
          if (!user.securityInfo) {
            user.securityInfo = {
              passwordLastChanged: new Date()
            };
          } else {
            user.securityInfo.passwordLastChanged = new Date();
          }
        }

        // Actualizar estado de verificación
        if (user.emailVerified && user.phoneVerified &&
          user.verificationStatus === VerificationStatus.UNVERIFIED) {
          user.verificationStatus = VerificationStatus.EMAIL_VERIFIED;
        }

        // Validar email único en contactInfo
        if (user.changed('contactInfo') || user.changed('email')) {
          if (user.contactInfo.primaryEmail !== user.email) {
            user.email = user.contactInfo.primaryEmail;
            user.emailVerified = false;
          }
        }
      },

      // Hook para validaciones antes de guardar
      beforeSave: async (user: User) => {
        // Validar que roles profesionales tengan información profesional
        const professionalRoles = [
          UserRole.VETERINARIAN,
        ];

        if (professionalRoles.includes(user.role) && !user.professionalInfo) {
          throw new Error('Los roles profesionales requieren información profesional');
        }

        // Validar que veterinarios tengan al menos una certificación
        if (user.role === UserRole.VETERINARIAN &&
          user.verificationStatus === VerificationStatus.PROFESSIONAL_VERIFIED) {
          if (!user.professionalInfo?.certifications ||
            user.professionalInfo.certifications.length === 0) {
            throw new Error('Los veterinarios verificados requieren al menos una certificación');
          }
        }

        // Validar términos aceptados para usuarios activos
        if (user.status === UserStatus.ACTIVE && !user.termsAccepted) {
          throw new Error('Los usuarios activos deben aceptar los términos y condiciones');
        }

        // Validar email verificado para usuarios completamente verificados
        if (user.verificationStatus === VerificationStatus.FULLY_VERIFIED && !user.emailVerified) {
          throw new Error('Los usuarios completamente verificados deben tener email verificado');
        }
      }
    },
    comment: 'Tabla para el manejo completo de usuarios del sistema'
  }
);

export default User;