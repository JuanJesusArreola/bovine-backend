// services/email/EmailService.ts
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import logger from '../utils/logger';
import {
    EmailError,
    EmailValidationError,
    EmailSendError,
    EmailQuotaExceededError
} from '../utils/EmailErrors';
import { emailTemplateService } from './EmailTemplateService';
import { EmailQueueService } from './EmailQueueService';
import { API_LIMITS, RETRY_CONFIG } from '../constants/email.constants';
import redisConfig from '../config/redis';
import Mail from 'nodemailer/lib/mailer';

// ============================================================================
// ENUMS
// ============================================================================

export enum EmailType {
    WELCOME = 'welcome',
    PASSWORD_RESET = 'password-reset',
    VACCINATION_REMINDER = 'vaccination-reminder',
    HEALTH_ALERT = 'health-alert',
    SYSTEM_NOTIFICATION = 'system-notification',
    WEEKLY_REPORT = 'weekly-report',
    EMERGENCY_ALERT = 'emergency-alert',
    EMAIL_VERIFICATION = 'email-verification',
    ACCOUNT_LOCKED = 'account-locked',
    PROFILE_UPDATED = 'profile-updated',
    REGISTRATION_CONFIRMATION = 'registration-confirmation'
}

export enum EmailPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface EmailConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromName: string;
    fromEmail: string;
    pool?: boolean;
    maxConnections?: number;
    rateLimit?: number;
}

export interface EmailAttachment {
    filename: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
    cid?: string; // Content ID para imágenes embebidas
}

export interface EmailRecipient {
    email: string;
    name?: string;
    variables?: Record<string, any>;
}

export interface EmailOptions<T = any> {
    to: string | string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    template: EmailType;
    variables: T;
    attachments?: EmailAttachment[];
    priority?: EmailPriority;
    replyTo?: string;
    headers?: Record<string, string>;
    tracking?: {
        enabled: boolean;
        openTracking?: boolean;
        clickTracking?: boolean;
    };
    scheduledAt?: Date;
    metadata?: Record<string, any>;
}

export interface BulkEmailOptions {
    recipients: EmailRecipient[];
    template: EmailType;
    variables: Record<string, any>;
    priority?: EmailPriority;
    sendAt?: Date;
    batchSize?: number;
}

export interface SendResult {
    jobId: string;
    messageId?: string;
    status: 'queued' | 'sent' | 'failed';
    error?: string;
    scheduledFor?: Date;
}

export interface EmailJobResult {
    jobId: string;
    messageId?: string;
    success: boolean;
    attempts: number;
    error?: string;
    completedAt?: Date;
}

export interface EmailDeliveryStats {
    totalSent: number;
    totalFailed: number;
    deliveryRate: number;
    bounceRate: number;
    openRate: number;
    clickRate: number;
    periodStart: Date;
    periodEnd: Date;
    byTemplate: Record<string, {
        sent: number;
        failed: number;
        rate: number;
    }>;
}

export interface SimpleQueueStats {
    // Métricas básicas
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;

    // Métricas calculadas
    total: number;
    successRate: number;
    health: 'good' | 'warning' | 'critical';

    // Timestamp
    timestamp: Date;
}



// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class EmailService extends EventEmitter {
    private readonly context = 'EmailService';
    private transporter!: nodemailer.Transporter;
    private config!: EmailConfig;
    private queueService: EmailQueueService;
    private isInitialized = false;
    private quota: Map<string, { count: number; resetAt: Date }> = new Map();

    constructor() {
        super();
        // ✅ Pasar redisConfig Y el callback
        this.queueService = new EmailQueueService(
            redisConfig,
            // Callback para que el queue service pueda enviar emails
            async (options: EmailOptions) => {
                await this.sendEmailImmediately(options);
            }
        );
        this.initialize();
    }

    /**
     * Inicializa el servicio
     */
    private async initialize(): Promise<void> {
        try {
            this.loadConfig();
            await this.initializeTransporter();
            await emailTemplateService.loadTemplates();
            this.setupProcessHandlers();

            this.startQueueProcessor();    // Procesador automático
            this.startAutoCleanup();       // Limpieza automática
            this.isInitialized = true;

            logger.info('EmailService inicializado correctamente', this.context, {
                host: this.config.host,
                fromEmail: this.config.fromEmail,
                features: {
                    queueProcessor: true,
                    autoCleanup: true,
                    priorityMapping: true,
                    deliveryStats: true
                }
            });
        } catch (error) {
            logger.error('Error inicializando EmailService', this.context, {}, error as Error);
            throw new EmailError('INITIALIZATION_FAILED', 'No se pudo inicializar el servicio de email');
        }
    }

    /**
     * Carga configuración desde variables de entorno
     */
    private loadConfig(): void {
        this.config = {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            user: process.env.SMTP_USER || '',
            password: process.env.SMTP_PASSWORD || '',
            fromName: process.env.FROM_NAME || 'Sistema Ganadero UJAT',
            fromEmail: process.env.FROM_EMAIL || 'noreply@ganadero-ujat.com',
            pool: true,
            maxConnections: 5,
            rateLimit: parseInt(process.env.SMTP_RATE_LIMIT || '10') // emails por segundo
        };
    }

    /**
     * Inicializa transporter de Nodemailer
     */
    private async initializeTransporter(): Promise<void> {
        try {
            // Construir opciones de transporte
            const transportOptions: any = {
                host: this.config.host,
                port: this.config.port,
                secure: this.config.secure,
                auth: {
                    user: this.config.user,
                    pass: this.config.password
                },
                tls: {
                    rejectUnauthorized: false
                }
            };

            // Añadir opciones de pool si están configuradas
            if (this.config.pool) {
                transportOptions.pool = this.config.pool;
                transportOptions.maxConnections = this.config.maxConnections;
                transportOptions.rateLimit = this.config.rateLimit;
            }

            this.transporter = nodemailer.createTransport(transportOptions);

            // Prueba de conexión SMTP en segundo plano
            this.transporter.verify((error, success) => {
                if (error) {
                    logger.error('Error al conectar con el servidor SMTP', 'EmailService', {
                        host: this.config.host,
                        user: this.config.user,
                        error: error.message
                    });
                } else {
                    logger.info('Conexión SMTP verificada correctamente', 'EmailService', {
                        host: this.config.host,
                        port: this.config.port,
                        secure: this.config.secure,
                        pool: this.config.pool,
                        maxConnections: this.config.maxConnections
                    });
                }
            });

        } catch (error) {
            logger.error('Error inicializando transportador de email', 'EmailService', {
                host: this.config.host,
                user: this.config.user
            }, error as Error);
            throw error;
        }
    }

    /**
     * Verifica conexión SMTP
     */
    private async verifyConnection(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.transporter.verify((error, success) => {
                if (error) {
                    logger.error('Error conectando a SMTP', this.context, {
                        host: this.config.host,
                        error: error.message
                    }, error);
                    reject(new EmailError('SMTP_CONNECTION_FAILED', 'No se pudo conectar al servidor SMTP'));
                } else {
                    logger.info('Conexión SMTP verificada', this.context, {
                        host: this.config.host
                    });
                    resolve();
                }
            });
        });
    }

    /**
     * Configura manejadores de proceso
     */
    private setupProcessHandlers(): void {
        process.on('SIGTERM', () => this.cleanup());
        process.on('SIGINT', () => this.cleanup());
    }

    /**
     * Valida un email
     */
    private validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Valida destinatarios
     */
    private validateRecipients(to: string | string[]): void {
        const emails = Array.isArray(to) ? to : [to];

        for (const email of emails) {
            if (!this.validateEmail(email)) {
                throw new EmailValidationError(`Email inválido: ${email}`);
            }
        }
    }

    /**
     * Verifica cuota de emails
     */
    private async checkQuota(userId?: string): Promise<void> {
        if (!userId) return;

        const key = `quota:${userId}`;
        const now = new Date();
        const quota = this.quota.get(key);

        if (quota && quota.resetAt > now) {
            if (quota.count >= 100) { // Límite: 100 emails por hora
                throw new EmailQuotaExceededError(100, 'hora');
            }
            quota.count++;
        } else {
            this.quota.set(key, {
                count: 1,
                resetAt: new Date(now.getTime() + 60 * 60 * 1000) // 1 hora
            });
        }
    }

    /**
     * Envía un email
     */
    async sendEmail<T extends Record<string, any>>(
        options: EmailOptions<T>,
        userId?: string
    ): Promise<SendResult> {
        try {
            // Validaciones
            this.validateRecipients(options.to);
            await this.checkQuota(userId);
            let subject: string;
            let html: string;
            let text: string;

            // Compilar plantilla
            try {
                // Verificar si la plantilla existe
                if (!emailTemplateService.hasTemplate(options.template)) {
                    throw new EmailValidationError(`Plantilla no encontrada: ${options.template}`);
                }

                const compiled = emailTemplateService.compile(options.template, options.variables);
                subject = options.subject || compiled.subject;
                html = compiled.html;
                text = compiled.text;
                logger.debug('Plantilla compilada exitosamente', this.context, {
                    template: options.template,
                    variables: Object.keys(options.variables)
                });
            } catch (error) {
                // ✅ CORREGIDO: Manejo de error de tipo unknown
                let errorMessage = 'Error desconocido';

                if (error instanceof Error) {
                    errorMessage = error.message;
                } else if (typeof error === 'string') {
                    errorMessage = error;
                }

                logger.error('Error compilando plantilla', this.context, {
                    template: options.template,
                    error: errorMessage
                }, error instanceof Error ? error : undefined);

                throw new EmailError(
                    'TEMPLATE_COMPILATION_FAILED',
                    `Error compilando plantilla ${options.template}: ${errorMessage}`
                );
            }

            // Generar ID único
            const emailId = uuidv4();

            // Preparar opciones de email
            const mailOptions: nodemailer.SendMailOptions = {
                from: `${this.config.fromName} <${this.config.fromEmail}>`,
                to: options.to,
                cc: options.cc,
                bcc: options.bcc,
                subject: subject,
                html: html,
                text: text,
                attachments: this.prepareAttachments(options.attachments),
                replyTo: options.replyTo,
                priority: this.mapPriorityToNodemailer(options.priority),
                headers: {
                    'X-Email-ID': emailId,
                    'X-Email-Type': options.template, // ✅ Nuevo header
                    'X-Priority': this.getPriorityHeader(options.priority),
                    ...options.headers
                }
            };


            // Si está programado, agregar a cola
            if (options.scheduledAt && options.scheduledAt > new Date()) {
                const job = await this.queueService.add({
                    id: emailId,
                    type: options.template,
                    options: options, // ✅ Aquí van las opciones originales
                    priority: options.priority || EmailPriority.MEDIUM,
                    maxAttempts: RETRY_CONFIG[options.priority || EmailPriority.MEDIUM].maxAttempts,
                    scheduledFor: options.scheduledAt,
                    metadata: options.metadata
                });

                return {
                    jobId: job.id!.toString(),
                    status: 'queued',
                    scheduledFor: options.scheduledAt
                };
            }

            // Envío inmediato
            const result = await this.transporter.sendMail(mailOptions);

            logger.info('Email enviado', this.context, {
                emailId,
                to: options.to,
                template: options.template,
                messageId: result.messageId
            });

            return {
                jobId: emailId,
                messageId: result.messageId,
                status: 'sent'
            };

        } catch (error) {
            logger.error('Error enviando email', this.context, {
                to: options.to,
                template: options.template
            }, error as Error);

            if (error instanceof EmailError) throw error;
            throw new EmailSendError(Array.isArray(options.to) ? options.to[0] : options.to, error as Error);
        }
    }

    /**
 * Envía email inmediatamente (sin pasar por la cola)
 * Este método es usado por el queue service como callback
 */
    private async sendEmailImmediately<T extends Record<string, any>>(
        options: EmailOptions<T>
    ): Promise<void> {
        try {
            // Compilar plantilla
            const compiled = emailTemplateService.compile(options.template, options.variables);

            // Preparar opciones de email
            const mailOptions: nodemailer.SendMailOptions = {
                from: `${this.config.fromName} <${this.config.fromEmail}>`,
                to: options.to,
                cc: options.cc,
                bcc: options.bcc,
                subject: options.subject || compiled.subject,
                html: compiled.html,
                text: compiled.text,
                attachments: this.prepareAttachments(options.attachments),
                replyTo: options.replyTo,
                priority: this.mapPriorityToNodemailer(options.priority),
                headers: {
                    'X-Email-Type': options.template,
                    ...options.headers
                }
            };

            // Enviar
            await this.transporter.sendMail(mailOptions);

            logger.debug('Email enviado inmediatamente', this.context, {
                to: options.to,
                template: options.template
            });

        } catch (error) {
            logger.error('Error en envío inmediato', this.context, {
                to: options.to,
                template: options.template
            }, error as Error);
            throw error; // Importante: relanzar para que Bull reintente
        }
    }

    /**
     * Envía emails en lote
     */
    async sendBulkEmails(options: BulkEmailOptions): Promise<SendResult[]> {
        const results: SendResult[] = [];
        const batchSize = options.batchSize || API_LIMITS.MAX_RECIPIENTS_PER_BATCH;

        // Procesar en lotes
        for (let i = 0; i < options.recipients.length; i += batchSize) {
            const batch = options.recipients.slice(i, i + batchSize);

            const batchPromises = batch.map(async (recipient) => {
                try {
                    const variables = { ...options.variables, ...recipient.variables };

                    const result = await this.sendEmail({
                        to: recipient.email,
                        template: options.template,
                        variables,
                        priority: options.priority,
                        scheduledAt: options.sendAt,
                        metadata: {
                            recipientName: recipient.name,
                            batchIndex: i
                        }
                    });

                    results.push(result);
                } catch (error) {
                    results.push({
                        jobId: uuidv4(),
                        status: 'failed',
                        error: error instanceof Error ? error.message : 'Error desconocido'
                    });
                }
            });

            await Promise.allSettled(batchPromises);

            // Pequeña pausa entre lotes
            if (i + batchSize < options.recipients.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        logger.info(`${results.length} emails en lote procesados`, this.context, {
            total: options.recipients.length,
            successful: results.filter(r => r.status !== 'failed').length,
            failed: results.filter(r => r.status === 'failed').length,
            template: options.template
        });

        return results;
    }

    /**
     * Obtiene estado de un envío
     */
    async getStatus(jobId: string): Promise<EmailJobResult | null> {
        const status = await this.queueService.getJobStatus(jobId);

        if (!status.job) return null;

        return {
            jobId,
            messageId: status.job.returnvalue?.messageId,
            success: status.state === 'completed',
            attempts: status.job.attemptsMade,
            error: status.job.failedReason,
            completedAt: status.job.finishedOn ? new Date(status.job.finishedOn) : undefined
        };
    }

    /**
     * Cancela un envío programado
     */
    async cancelScheduled(jobId: string): Promise<boolean> {
        return this.queueService.cancelJob(jobId);
    }

    /**
     * Obtiene estadísticas del servicio
     */
    async getStats(): Promise<any> {
        const queueStats = await this.queueService.getStats();
        const total = queueStats.completed + queueStats.failed;
        const successRate = total > 0 ? (queueStats.completed / total) * 100 : 100;

        // Determinar salud
        let health = 'good';
        if (queueStats.failed > 100 || queueStats.waiting > 1000 || successRate < 90) {
            health = 'critical';
        } else if (queueStats.failed > 20 || queueStats.waiting > 500 || successRate < 95) {
            health = 'warning';
        }

        return {
            queue: queueStats,
            transporter: {
                host: this.config.host,
                port: this.config.port,
                secure: this.config.secure,
                pool: this.config.pool,
                maxConnections: this.config.maxConnections,
                rateLimit: this.config.rateLimit,
                isConnected: this.isInitialized,
                fromEmail: this.config.fromEmail,
                queueStats,
                total,
                successRate: Math.round(successRate * 100) / 100,
                health
            },
            templates: {
                total: emailTemplateService.listTemplates().length,
                list: emailTemplateService.listTemplates().map(t => ({
                    name: t.name,
                    type: t.type,
                    variables: t.variables,
                    lastModified: t.lastModified
                }))
            },
            quota: Array.from(this.quota.entries()).map(([key, value]) => ({
                user: key.replace('quota:', ''),
                count: value.count,
                resetAt: value.resetAt,
                remaining: Math.max(0, 100 - value.count)
            })),
            uptime: process.uptime()
        };
    }

    /**
     * Prepara attachments para Nodemailer
     */
    private prepareAttachments(attachments?: EmailAttachment[]): Mail.Attachment[] | undefined {
        if (!attachments || attachments.length === 0) return undefined;

        return attachments.map(att => ({
            filename: att.filename,
            path: att.path,
            content: att.content,
            contentType: att.contentType,
            cid: att.cid
        }));
    }

    /**
     * Obtiene header de prioridad
     */
    private getPriorityHeader(priority?: EmailPriority): string {
        switch (priority) {
            case EmailPriority.CRITICAL: return '1 (Highest)';
            case EmailPriority.HIGH: return '2 (High)';
            case EmailPriority.MEDIUM: return '3 (Normal)';
            case EmailPriority.LOW: return '4 (Low)';
            default: return '3 (Normal)';
        }
    }

    /**
 * Métodos de conveniencia para tipos específicos
 */
    async sendWelcomeEmail(email: string, firstName: string): Promise<SendResult> {
        return this.sendEmail({
            to: email,
            template: EmailType.WELCOME,
            variables: {
                firstName,
                year: new Date().getFullYear()
            },
            priority: EmailPriority.MEDIUM
        });
    }

    async sendPasswordResetEmail(email: string, resetToken: string, firstName: string): Promise<SendResult> {
        // El link de recuperación apunta al FRONTEND (no a la API), donde la
        // página `/reset-password` toma el token, lo valida y ofrece el form
        // para escribir la nueva contraseña. Si apuntara al backend, el usuario
        // vería un JSON crudo al abrir el correo.
        const frontendBase = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:5173';
        const resetLink = `${frontendBase}/reset-password?token=${resetToken}`;

        return this.sendEmail({
            to: email,
            template: EmailType.PASSWORD_RESET,
            variables: {
                firstName,
                resetLink,
                year: new Date().getFullYear()
            },
            priority: EmailPriority.HIGH
        });
    }

    async sendEmailVerification(email: string, verificationToken: string, firstName: string): Promise<SendResult> {
        // El link de verificación apunta al FRONTEND `/verify-email?token=...`
        // — esa página llama al endpoint `/api/auth/verify-email` por debajo
        // y muestra al usuario un mensaje de éxito/error con botón a Login.
        // Antes apuntaba directo al backend → el usuario veía un JSON.
        const frontendBase = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:5173';
        const verificationLink = `${frontendBase}/verify-email?token=${verificationToken}`;

        return this.sendEmail({
            to: email,
            template: EmailType.EMAIL_VERIFICATION,
            variables: {
                firstName,
                verificationLink,
                year: new Date().getFullYear()
            },
            priority: EmailPriority.HIGH
        });
    }

    async sendVaccinationReminder(
        email: string,
        data: {
            ownerName: string;
            bovineEarTag: string;
            bovineName?: string;
            vaccineType: string;
            dueDate: Date;
            daysUntilDue: number;
            veterinarianName: string;
            ranchName: string;
        }
    ): Promise<SendResult> {
        return this.sendEmail({
            to: email,
            template: EmailType.VACCINATION_REMINDER,
            variables: {
                ...data,
                year: new Date().getFullYear()
            },
            priority: EmailPriority.HIGH
        });
    }

    async sendHealthAlert(
        email: string,
        data: {
            ownerName: string;
            bovineEarTag: string;
            bovineName?: string;
            healthStatus: string;
            severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
            symptomsList?: string;
            location: string;
            reportedAt: Date;
        }
    ): Promise<SendResult> {
        return this.sendEmail({
            to: email,
            template: EmailType.HEALTH_ALERT,
            variables: {
                ...data,
                year: new Date().getFullYear()
            },
            priority: data.severity === 'CRITICAL' ? EmailPriority.CRITICAL : EmailPriority.HIGH
        });
    }

    // ✅ NUEVO MÉTODO: Enviar reporte semanal
    async sendWeeklyReport(
        email: string,
        data: {
            ownerName: string;
            ranchName: string;
            period: { start: Date; end: Date };
            statistics: {
                totalBovines: number;
                healthyBovines: number;
                healthPercentage: number;
                vaccinationsCompleted: number;
                upcomingVaccinations: number;
                births: number;
            };
            alerts: {
                criticalAlerts: number;
                vaccinationsDue: number;
                healthConcerns: number;
            };
        }
    ): Promise<SendResult> {
        return this.sendEmail({
            to: email,
            template: EmailType.WEEKLY_REPORT,
            variables: {
                ...data,
                year: new Date().getFullYear()
            },
            priority: EmailPriority.MEDIUM
        });
    }

    // ✅ NUEVO MÉTODO: Enviar alerta de emergencia
    async sendEmergencyAlert(
        email: string,
        data: {
            firstName: string;
            alertTitle: string;
            alertMessage: string;
            details?: string;
            location?: string;
            timestamp: Date;
            actionUrl: string;
        }
    ): Promise<SendResult> {
        return this.sendEmail({
            to: email,
            template: EmailType.EMERGENCY_ALERT,
            variables: {
                ...data,
                year: new Date().getFullYear()
            },
            priority: EmailPriority.CRITICAL
        });
    }

    // ✅ NUEVO MÉTODO: Enviar notificación de cuenta bloqueada
    async sendAccountLockedEmail(
        email: string,
        firstName: string,
        reason?: string
    ): Promise<SendResult> {
        return this.sendEmail({
            to: email,
            template: EmailType.ACCOUNT_LOCKED,
            variables: {
                firstName,
                reason,
                year: new Date().getFullYear()
            },
            priority: EmailPriority.HIGH
        });
    }

    // ✅ NUEVO MÉTODO: Enviar notificación de perfil actualizado
    async sendProfileUpdatedEmail(
        email: string,
        firstName: string,
        changes?: Record<string, any>
    ): Promise<SendResult> {
        return this.sendEmail({
            to: email,
            template: EmailType.PROFILE_UPDATED,
            variables: {
                firstName,
                changes,
                year: new Date().getFullYear()
            },
            priority: EmailPriority.LOW
        });
    }

    /**
 * Obtiene lista de plantillas disponibles
 */
    getAvailableTemplates() {
        return emailTemplateService.listTemplates();
    }

    /**
     * Recarga una plantilla específica (útil para desarrollo)
     */
    async reloadTemplate(templateName: EmailType): Promise<void> {
        try {
            await emailTemplateService.reloadTemplate(templateName);
            logger.info(`Plantilla ${templateName} recargada`, this.context);

            // Emitir evento
            this.emit('template:reloaded', { template: templateName });
        } catch (error) {
            logger.error(`Error recargando plantilla ${templateName}`, this.context, {}, error as Error);
            throw new EmailError('TEMPLATE_RELOAD_FAILED', `No se pudo recargar la plantilla ${templateName}`);
        }
    }

    /**
     * Recarga todas las plantillas
     */
    async reloadAllTemplates(): Promise<void> {
        try {
            await emailTemplateService.loadTemplates();
            logger.info('Todas las plantillas recargadas', this.context);

            // Emitir evento
            this.emit('templates:reloaded', {
                count: emailTemplateService.listTemplates().length
            });
        } catch (error) {
            logger.error('Error recargando todas las plantillas', this.context, {}, error as Error);
            throw new EmailError('TEMPLATES_RELOAD_FAILED', 'No se pudieron recargar las plantillas');
        }
    }

    /**
     * Obtiene metadata de una plantilla
     */
    getTemplateMetadata(templateName: EmailType) {
        return emailTemplateService.getTemplateMetadata(templateName);
    }

    /**
     * Valida variables para una plantilla
     */
    validateTemplateVariables(templateName: EmailType, variables: Record<string, any>): {
        valid: boolean;
        missing: string[];
        extra: string[];
    } {
        const metadata = emailTemplateService.getTemplateMetadata(templateName);

        if (!metadata) {
            throw new EmailValidationError(`Plantilla no encontrada: ${templateName}`);
        }

        const providedVars = Object.keys(variables);
        const missing = metadata.variables.filter(v => !providedVars.includes(v));
        const extra = providedVars.filter(v => !metadata.variables.includes(v));

        return {
            valid: missing.length === 0,
            missing,
            extra
        };
    }

    /**
 * Inicia el procesador automático de la cola para monitoreo
 * Bull ya procesa automáticamente, esto es solo para logging y visibilidad
 */
    private startQueueProcessor(): void {
        const processQueue = async () => {
            try {
                const stats = await this.getSimpleQueueStats();

                // Logs según salud
                switch (stats.health) {
                    case 'critical':
                        logger.error('🚨 COL CRÍTICA', this.context, {
                            failed: stats.failed,
                            waiting: stats.waiting,
                            successRate: stats.successRate
                        });
                        break;

                    case 'warning':
                        logger.warn('⚠️ COLA CON ADVERTENCIAS', this.context, {
                            failed: stats.failed,
                            waiting: stats.waiting,
                            successRate: stats.successRate
                        });
                        break;

                    default:
                        logger.debug('✅ COLA SALUDABLE', this.context, {
                            waiting: stats.waiting,
                            successRate: stats.successRate
                        });
                }

                // Emitir evento con stats
                this.emit('queue:stats', stats);

            } catch (error) {
                logger.error('Error en procesador de cola', this.context, {}, error as Error);
            }

            // Ejecutar cada 30 segundos
            setTimeout(processQueue, 30000);
        };

        processQueue();
        logger.info('🔄 Procesador automático de cola iniciado (cada 30s)', this.context);
    }

    /**
     * Inicia limpieza automática de la cola
     * Elimina jobs antiguos para evitar acumulación en Redis
     */
    private startAutoCleanup(): void {
        const cleanup = async () => {
            try {
                // Limpiar jobs completados y fallidos de hace más de 7 días
                const age = API_LIMITS.QUEUE_CLEANUP_DAYS * 24 * 60 * 60 * 1000;

                await this.queueService.clean(age);

                logger.info('🧹 Limpieza automática de cola completada', this.context, {
                    ageDays: API_LIMITS.QUEUE_CLEANUP_DAYS
                });

            } catch (error) {
                logger.error('Error en limpieza automática', this.context, {}, error as Error);
            }

            // Ejecutar cada 24 horas
            setTimeout(cleanup, 24 * 60 * 60 * 1000);
        };

        cleanup();
        logger.info('🧹 Limpieza automática de cola iniciada (cada 24h)', this.context);
    }

    /**
 * Mapea prioridad interna a prioridad de Nodemailer
 * Nodemailer acepta: 'high', 'normal', 'low' o números 1-5
 */
    private mapPriorityToNodemailer(priority?: EmailPriority): 'high' | 'normal' | 'low' | undefined {
        switch (priority) {
            case EmailPriority.CRITICAL:
                return 'high';  // CRITICAL también es high
            case EmailPriority.HIGH:
                return 'high';
            case EmailPriority.MEDIUM:
                return 'normal';
            case EmailPriority.LOW:
                return 'low';
            default:
                return 'normal';
        }
    }

    /**
 * Obtiene estadísticas completas de entrega de emails
 * @param days - Número de días hacia atrás para el análisis
 */
    async getDeliveryStats(days: number = 7): Promise<EmailDeliveryStats> {
        const endDate = new Date();
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        try {
            // Obtener estadísticas de la cola
            const queueStats = await this.queueService.getStats();
            const totalEmails = queueStats.completed + queueStats.failed;


            return {
                totalSent: queueStats.completed,
                totalFailed: queueStats.failed,
                deliveryRate: totalEmails > 0
                    ? Number(((queueStats.completed / totalEmails) * 100).toFixed(2))
                    : 0,
                bounceRate: 0,
                openRate: 0,
                clickRate: 0,
                periodStart: startDate,
                periodEnd: endDate,
                byTemplate: await this.getTemplateStats(queueStats)

            };

        } catch (error) {
            logger.error('Error obteniendo estadísticas de entrega', this.context, {
                days
            }, error as Error);
            throw new EmailError('STATS_FAILED', 'No se pudieron obtener las estadísticas');
        }
    }

    /**
     * Obtiene estadísticas por tipo de plantilla
     */
    private async getTemplateStats(queueStats: any): Promise<Record<string, any>> {
        const templates = emailTemplateService.listTemplates();
        const stats: Record<string, any> = {};

        // Distribución proporcional básica (asumiendo distribución uniforme)
        const totalTemplates = templates.length;
        if (totalTemplates > 0) {
            const sentPerTemplate = Math.floor(queueStats.completed / totalTemplates);
            const failedPerTemplate = Math.floor(queueStats.failed / totalTemplates);

            for (const template of templates) {
                stats[template.name] = {
                    sent: sentPerTemplate,
                    failed: failedPerTemplate,
                    rate: sentPerTemplate > 0
                        ? Math.round((sentPerTemplate / (sentPerTemplate + failedPerTemplate)) * 100)
                        : 0
                };
            }
        }

        return stats;
    }

    /**
 * Obtiene estadísticas simples de la cola
 * Implementación profesional pero sencilla
 */
    async getSimpleQueueStats(): Promise<SimpleQueueStats> {
        try {
            // 1. Obtener stats de la cola
            const stats = await this.queueService.getStats();

            // 2. Calcular total y tasa de éxito
            const total = stats.completed + stats.failed;
            const successRate = total > 0
                ? Math.round((stats.completed / total) * 100 * 100) / 100
                : 100;

            // 3. Determinar salud (lógica simple pero efectiva)
            let health: 'good' | 'warning' | 'critical' = 'good';

            if (stats.failed > 100 || stats.waiting > 1000 || successRate < 90) {
                health = 'critical';
            } else if (stats.failed > 20 || stats.waiting > 500 || successRate < 95) {
                health = 'warning';
            }

            // 4. Retornar stats enriquecidas
            return {
                waiting: stats.waiting,
                active: stats.active,
                completed: stats.completed,
                failed: stats.failed,
                delayed: stats.delayed,
                total,
                successRate,
                health,
                timestamp: new Date()
            };

        } catch (error) {
            logger.error('Error obteniendo queue stats', this.context, {}, error as Error);
            throw new EmailError('QUEUE_STATS_FAILED', 'No se pudieron obtener estadísticas');
        }
    }



    /**
     * Limpieza al cerrar
     */
    private async cleanup(): Promise<void> {
        logger.info('Cerrando EmailService...', this.context);
        await this.queueService.close();
        this.transporter.close();
    }
}

// Exportar instancia única
export const emailService = new EmailService();