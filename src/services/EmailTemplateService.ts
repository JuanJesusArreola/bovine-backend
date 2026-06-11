// services/email/EmailTemplateService.ts
import fs from 'fs/promises';
import path from 'path';
import handlebars from 'handlebars';
import type { TemplateDelegate } from 'handlebars';
import logger from '../utils/logger';
import { EmailType } from './EmailService';
import { EmailTemplateNotFoundError } from '../utils/EmailErrors';

export interface CompiledTemplate {
    subject: string;
    html: string;
    text: string;
}

export interface TemplateMetadata {
    name: string;
    type: EmailType;
    description?: string;
    variables: string[];
    lastModified?: Date;
}

export class EmailTemplateService {
    private readonly context = 'EmailTemplateService';
    private templates: Map<string, TemplateDelegate> = new Map();
    private partials: Map<string, TemplateDelegate> = new Map();
    private layouts: Map<string, TemplateDelegate> = new Map();
    private metadata: Map<string, TemplateMetadata> = new Map();
    private templateDir: string;

    constructor(templateDir: string = path.join(__dirname, '../templates/email')) {
        this.templateDir = templateDir;
        this.registerHandlebarsHelpers();
    }

    /**
     * Registra helpers personalizados de Handlebars
     */
    private registerHandlebarsHelpers(): void {
        // Helper para formato de fecha
        handlebars.registerHelper('formatDate', (date: Date, format?: string) => {
            if (!date) return '';

            const options: Intl.DateTimeFormatOptions = {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            };

            if (format === 'short') {
                options.month = 'short';
            } else if (format === 'numeric') {
                options.month = '2-digit';
                options.day = '2-digit';
            }

            return new Date(date).toLocaleDateString('es-MX', options);
        });

        // Helper para formato de hora
        handlebars.registerHelper('formatTime', (date: Date) => {
            if (!date) return '';
            return new Date(date).toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit'
            });
        });

        // Helper para condicionales
        handlebars.registerHelper('ifEquals', function (this: any, arg1, arg2, options) {
            return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
        });

        handlebars.registerHelper('ifNotEquals', function (this: any, arg1, arg2, options) {
            return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
        });

        handlebars.registerHelper('ifIn', function (this: any, value, array, options) {
            return array.includes(value) ? options.fn(this) : options.inverse(this);
        });

        // Helpers de formato
        handlebars.registerHelper('toUpperCase', (str: string) => str?.toUpperCase() || '');
        handlebars.registerHelper('toLowerCase', (str: string) => str?.toLowerCase() || '');
        handlebars.registerHelper('capitalize', (str: string) => {
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        });

        // Helper para números
        handlebars.registerHelper('formatNumber', (num: number, decimals?: number) => {
            if (num === undefined || num === null) return '';
            return num.toLocaleString('es-MX', {
                minimumFractionDigits: decimals || 0,
                maximumFractionDigits: decimals || 0
            });
        });

        // Helper para porcentajes
        handlebars.registerHelper('formatPercent', (num: number) => {
            if (num === undefined || num === null) return '';
            return `${Math.round(num)}%`;
        });

        // Helper para listas
        handlebars.registerHelper('join', (array: any[], separator: string = ', ') => {
            if (!array || !Array.isArray(array)) return '';
            return array.join(separator);
        });

        // Helper para JSON
        handlebars.registerHelper('json', (obj: any) => {
            return JSON.stringify(obj, null, 2);
        });

        // Helper para incrementar contador (útil en bucles)
        handlebars.registerHelper('inc', (value: number) => {
            return value + 1; 
        });

        // Helper para evaluar expresiones
        handlebars.registerHelper('math', (lvalue: number, operator: string, rvalue: number) => {
            
            switch (operator) {
                case '+': return lvalue + rvalue;
                case '-': return lvalue - rvalue;
                case '*': return lvalue * rvalue;
                case '/': return lvalue / rvalue;
                case '%': return lvalue % rvalue;
                default: return '';
            }
        });

        // Helper para URLs
        handlebars.registerHelper('absoluteUrl', (path: string) => {
            const baseUrl = process.env.FRONTEND_URL || 'https://app.ganadero-ujat.com';
            return `${baseUrl}${path}`;
        });
    }

    /**
     * Carga todas las plantillas del directorio
     */
    async loadTemplates(): Promise<void> {
        try {
            
            // Cargar partials primero
            await this.loadPartials();

            // Cargar layouts
            await this.loadLayouts();

            // Cargar plantillas principales
            const files = await fs.readdir(this.templateDir);
            let loadedCount = 0;

            for (const file of files) {
                if (file.endsWith('.hbs') && !file.startsWith('_')) {
                    const templateName = file.replace('.hbs', '');
                    const content = await fs.readFile(
                        path.join(this.templateDir, file),
                        'utf8'
                    );

                    // Aplicar layout si existe
                    const finalContent = await this.applyLayout(content, templateName);

                    this.templates.set(templateName, handlebars.compile(finalContent));

                    // Extraer variables para metadata
                    const variables = this.extractVariables(content);

                    this.metadata.set(templateName, {
                        name: templateName,
                        type: this.mapFileNameToType(templateName),
                        variables,
                        lastModified: (await fs.stat(path.join(this.templateDir, file))).mtime
                    });

                    loadedCount++;
                }
            }

            logger.info(`${loadedCount} plantillas de email cargadas`, this.context, {
                templates: Array.from(this.metadata.values()).map(m => m.name)
            });
        } catch (error) {
            logger.error('Error cargando plantillas de email', this.context, {}, error as Error);
            throw error;
        }
    }

    /**
     * Carga partials reutilizables
     */
    private async loadPartials(): Promise<void> {
        const partialsDir = path.join(this.templateDir, 'partials');

        try {
            await fs.access(partialsDir);
            const files = await fs.readdir(partialsDir);

            for (const file of files) {
                if (file.endsWith('.hbs')) {
                    const partialName = file.replace('.hbs', '');
                    const content = await fs.readFile(
                        path.join(partialsDir, file),
                        'utf8'
                    );

                    handlebars.registerPartial(partialName, content);
                    this.partials.set(partialName, handlebars.compile(content));

                    logger.debug(`Partial cargado: ${partialName}`, this.context);
                }
            }
        } catch (error) {
            logger.debug('No hay directorio de partials, continuando...', this.context);
        }
    }

    /**
     * Carga layouts
     */
    private async loadLayouts(): Promise<void> {
        const layoutsDir = path.join(this.templateDir, 'layouts');

        try {
            await fs.access(layoutsDir);
            const files = await fs.readdir(layoutsDir);

            for (const file of files) {
                if (file.endsWith('.hbs')) {
                    const layoutName = file.replace('.hbs', '');
                    const content = await fs.readFile(
                        path.join(layoutsDir, file),
                        'utf8'
                    );

                    this.layouts.set(layoutName, handlebars.compile(content));
                    logger.debug(`Layout cargado: ${layoutName}`, this.context);
                }
            }
        } catch (error) {
            logger.debug('No hay directorio de layouts, continuando...', this.context);
        }
    }

    /**
     * Aplica layout a una plantilla
     */
    private async applyLayout(content: string, templateName: string): Promise<string> {
        // Por defecto usar layout default si existe
        const defaultLayout = this.layouts.get('default');

        if (defaultLayout) {
            // El contenido se inyecta donde esté {{body}}
            return defaultLayout({ body: content, templateName });
        }

        return content;
    }

    /**
     * Extrae variables de una plantilla
     */
    private extractVariables(content: string): string[] {
        const variableRegex = /{{([^{}]+)}}/g;
        const matches = content.matchAll(variableRegex);
        const variables = new Set<string>();

        for (const match of matches) {
            const varName = match[1].trim().split(' ')[0]; // Ignorar helpers
            if (!varName.includes(' ') && !varName.startsWith('#')) {
                variables.add(varName);
            }
        }

        return Array.from(variables);
    }

    /**
     * Mapea nombre de archivo a tipo de email
     */
    private mapFileNameToType(fileName: string): EmailType {
        const map: Record<string, EmailType> = {
            'welcome': EmailType.WELCOME,
            'password-reset': EmailType.PASSWORD_RESET,
            'vaccination-reminder': EmailType.VACCINATION_REMINDER,
            'health-alert': EmailType.HEALTH_ALERT,
            'weekly-report': EmailType.WEEKLY_REPORT,
            'email-verification': EmailType.EMAIL_VERIFICATION,
            'account-locked': EmailType.ACCOUNT_LOCKED,
            'profile-updated': EmailType.PROFILE_UPDATED,
            'system-notification': EmailType.SYSTEM_NOTIFICATION,
            'emergency-alert': EmailType.EMERGENCY_ALERT,
            'registration-confirmation': EmailType.REGISTRATION_CONFIRMATION
        };

        return map[fileName] || EmailType.SYSTEM_NOTIFICATION;
    }

    /**
     * Compila una plantilla con variables
     */
    compile<T extends Record<string, any>>(
        templateName: string,
        variables: T
    ): CompiledTemplate {
        const templateFn = this.templates.get(templateName);

        if (!templateFn) {
            throw new EmailTemplateNotFoundError(templateName);
        }

        // Agregar variables globales
        const enrichedVariables = {
            ...variables,
            year: new Date().getFullYear(),
            date: new Date().toLocaleDateString('es-MX'),
            time: new Date().toLocaleTimeString('es-MX'),
            appName: 'Sistema Ganadero UJAT',
            appUrl: process.env.FRONTEND_URL || 'https://app.ganadero-ujat.com',
            supportEmail: process.env.SUPPORT_EMAIL || 'soporte@ganadero-ujat.com'
        };

        const html = templateFn(enrichedVariables);
        const text = this.generateTextVersion(html);

        // Extraer asunto del HTML (primer h1 o título)
        const subject = this.extractSubject(html, templateName);

        return { subject, html, text };
    }

    /**
     * Extrae asunto del HTML
     */
    private extractSubject(html: string, templateName: string): string {
        // Intentar extraer de h1
        const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
        if (h1Match) {
            return h1Match[1].replace(/<[^>]*>/g, '').trim();
        }

        // Intentar extraer de title
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
        if (titleMatch) {
            return titleMatch[1].trim();
        }

        // Asuntos por defecto según plantilla
        const defaultSubjects: Record<string, string> = {
            'welcome': '¡Bienvenido al Sistema Ganadero UJAT! 🐄',
            'password-reset': 'Restablece tu contraseña - Sistema Ganadero UJAT',
            'vaccination-reminder': '🏥 Recordatorio de Vacunación',
            'health-alert': '🚨 ALERTA DE SALUD',
            'weekly-report': '📊 Reporte Semanal',
            'email-verification': 'Verifica tu cuenta - Sistema Ganadero UJAT',
            'account-locked': '🔒 Cuenta Bloqueada',
            'profile-updated': '📝 Perfil Actualizado',
            'system-notification': '🔔 Notificación del Sistema',
            'emergency-alert': '🚨 ALERTA DE EMERGENCIA',
            'registration-confirmation': '✅ Registro Confirmado'
        };

        return defaultSubjects[templateName] || 'Notificación del Sistema';
    }

    /**
     * Genera versión texto plano del HTML
     */
    private generateTextVersion(html: string): string {
        return html
            .replace(/<style[^>]*>.*?<\/style>/gs, '')
            .replace(/<script[^>]*>.*?<\/script>/gs, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim();
    }

    /**
     * Obtiene metadata de una plantilla
     */
    getTemplateMetadata(templateName: string): TemplateMetadata | undefined {
        return this.metadata.get(templateName);
    }

    /**
     * Lista todas las plantillas disponibles
     */
    listTemplates(): TemplateMetadata[] {
        return Array.from(this.metadata.values());
    }

    /**
     * Verifica si una plantilla existe
     */
    hasTemplate(name: string): boolean {
        return this.templates.has(name);
    }

    /**
     * Recarga una plantilla específica
     */
    async reloadTemplate(templateName: string): Promise<void> {
        const filePath = path.join(this.templateDir, `${templateName}.hbs`);

        try {
            const content = await fs.readFile(filePath, 'utf8');
            const finalContent = await this.applyLayout(content, templateName);

            this.templates.set(templateName, handlebars.compile(finalContent));

            const variables = this.extractVariables(content);
            this.metadata.set(templateName, {
                name: templateName,
                type: this.mapFileNameToType(templateName),
                variables,
                lastModified: (await fs.stat(filePath)).mtime
            });

            logger.info(`Plantilla ${templateName} recargada`, this.context);
        } catch (error) {
            throw new EmailTemplateNotFoundError(templateName);
        }
    }

    /**
     * Agrega una plantilla en memoria
     */
    addTemplate(name: string, content: string, type?: EmailType): void {
        this.templates.set(name, handlebars.compile(content));
        this.metadata.set(name, {
            name,
            type: type || EmailType.SYSTEM_NOTIFICATION,
            variables: this.extractVariables(content),
            lastModified: new Date()
        });
    }
}

export const emailTemplateService = new EmailTemplateService();