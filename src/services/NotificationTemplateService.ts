// services/notification/NotificationTemplateService.ts
import { NotificationType } from '../models/Notification';
import { DEFAULT_TITLES } from '../constants/notification.constants';

export interface LocationInfo {
    lat: number;
    lng: number;
    address?: string;
}

export interface TemplateData {
    [key: string]: string | number | Date | boolean | LocationInfo | undefined;
    // Campos específicos para alertas
    bovineName?: string;
    bovineEarTag?: string;
    healthStatus?: string;
    symptoms?: string;
    severity?: string;
    message?: string;
    vaccineName?: string;
    vaccineType?: string;
    scheduledDate?: Date;
    motherName?: string;
    motherEarTag?: string;
    calfGender?: string;
    calfWeight?: number;
    birthDate?: Date;
    productName?: string;
    currentStock?: number;
    minStock?: number;
    unit?: string;
    eventType?: string;
    geofenceName?: string;
    location?: LocationInfo;
    reportType?: string;
    period?: string;
    title?: string;
    data?: any;
    year?: number;
}

export interface RenderedTemplate {
    title: string;
    content: string;
}



export class NotificationTemplateService {
    private readonly context = 'NotificationTemplateService';

    /**
     * Renderiza una plantilla con los datos proporcionados
     */
    render(
        type: NotificationType,
        data: TemplateData = {}
    ): RenderedTemplate {
        const title = this.renderTitle(type, data);
        const content = this.renderContent(type, data);

        return { title, content };
    }

    /**
     * Renderiza el título
     */
    private renderTitle(type: NotificationType, data: TemplateData): string {
        const template = DEFAULT_TITLES[type] || 'Notificación';
        return this.replacePlaceholders(template, data);
    }

    /**
     * Renderiza el contenido según el tipo
     */
    private renderContent(type: NotificationType, data: TemplateData): string {
        switch (type) {
            case NotificationType.HEALTH_ALERT:
                return this.renderHealthAlert(data);
            case NotificationType.VACCINATION_REMINDER:
                return this.renderVaccinationReminder(data);
            case NotificationType.BIRTH_ALERT:
                return this.renderBirthAlert(data);
            case NotificationType.LOW_STOCK_ALERT:
                return this.renderLowStockAlert(data);
            case NotificationType.GEOFENCE_ALERT:
                return this.renderGeofenceAlert(data);
            case NotificationType.REPORT_READY:
                return this.renderReportReady(data);
            default:
                return this.renderGeneric(data);
        }
    }

    /**
     * Plantilla para alerta de salud
     */
    private renderHealthAlert(data: TemplateData): string {
        return `
            🏥 Alerta de Salud
            
            Bovino: ${data.bovineName || data.bovineEarTag || 'Desconocido'}
            Estado: ${data.healthStatus || 'No especificado'}
            Síntomas: ${data.symptoms || 'No especificados'}
            Severidad: ${data.severity || 'Media'}
            
            ${data.message || ''}
            
            Por favor, revise al animal a la brevedad.
        `.replace(/\s+/g, ' ').trim();
    }

    /**
     * Plantilla para recordatorio de vacunación
     */
    private renderVaccinationReminder(data: TemplateData): string {
        return `
            💉 Recordatorio de Vacunación
            
            Bovino: ${data.bovineName || data.bovineEarTag || 'Desconocido'}
            Vacuna: ${data.vaccineName || data.vaccineType || 'No especificada'}
            Fecha programada: ${data.scheduledDate ? new Date(data.scheduledDate).toLocaleDateString() : 'No especificada'}
            
            ${data.message || ''}
        `.replace(/\s+/g, ' ').trim();
    }

    /**
     * Plantilla para alerta de nacimiento
     */
    private renderBirthAlert(data: TemplateData): string {
        return `
            🐄 ¡Nuevo Nacimiento!
            
            Madre: ${data.motherName || data.motherEarTag || 'Desconocida'}
            Cría: ${data.calfGender || 'Sexo no especificado'}
            Peso: ${data.calfWeight ? `${data.calfWeight} kg` : 'No registrado'}
            Fecha: ${data.birthDate ? new Date(data.birthDate).toLocaleDateString() : 'No especificada'}
            
            ${data.message || ''}
        `.replace(/\s+/g, ' ').trim();
    }

    /**
     * Plantilla para alerta de stock bajo
     */
    private renderLowStockAlert(data: TemplateData): string {
        return `
            📦 Alerta de Stock Bajo
            
            Producto: ${data.productName || 'Desconocido'}
            Stock actual: ${data.currentStock || 0} ${data.unit || 'unidades'}
            Stock mínimo: ${data.minStock || 0} ${data.unit || 'unidades'}
            
            ${data.message || ''}
        `.replace(/\s+/g, ' ').trim();
    }

    /**
 * Plantilla para alerta de geocerca
 */
    private renderGeofenceAlert(data: TemplateData): string {
        // Validar y extraer datos de ubicación de forma segura
        let locationText = 'No disponible';

        if (data.location && typeof data.location === 'object' && 'lat' in data.location && 'lng' in data.location) {
            const location = data.location as LocationInfo;
            locationText = `${location.lat}, ${location.lng}`;
        }

        return `
        📍 Alerta de Geocerca
        
        Bovino: ${data.bovineName || data.bovineEarTag || 'Desconocido'}
        Evento: ${data.eventType === 'entry' ? 'Entrada a' : 'Salida de'} ${data.geofenceName || 'área restringida'}
        Ubicación: ${locationText}
        
        ${data.message || ''}
    `.replace(/\s+/g, ' ').trim();
    }

    /**
     * Plantilla para reporte listo
     */
    private renderReportReady(data: TemplateData): string {
        return `
            📊 Reporte Listo
            
            Tipo: ${data.reportType || 'Reporte'}
            Período: ${data.period || 'No especificado'}
            
            ${data.message || ''}
            
            Haga clic para descargar.
        `.replace(/\s+/g, ' ').trim();
    }

    /**
 * Convierte cualquier valor a string de forma segura
 */
    private toString(value: string | number | Date | boolean | undefined): string {
        if (value === undefined || value === null) {
            return '';
        }
        if (value instanceof Date) {
            return value.toLocaleDateString('es-MX');
        }
        if (typeof value === 'number') {
            return value.toString();
        }
        if (typeof value === 'boolean') {
            return value ? 'Sí' : 'No';
        }
        return value;
    }

    /**
     * Plantilla genérica
     */
    private renderGeneric(data: TemplateData): string {
        const message = this.toString(data.message);
        return message || 'Tiene una nueva notificación';
    }

    /**
     * Reemplaza placeholders en un texto
     */
    private replacePlaceholders(text: string, data: TemplateData): string {
        return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            const value = data[key];
            if (value === undefined || value === null) {
                return match;
            }
            if (value instanceof Date) {
                return value.toLocaleDateString();
            }
            return String(value);
        });
    }
}

export const notificationTemplateService = new NotificationTemplateService();