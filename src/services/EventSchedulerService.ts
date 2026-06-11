// services/event/EventSchedulerService.ts
import { Op, literal } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import { EventError, EventValidationError } from '../utils/EventErrors';
import { ensureError } from '../utils/errorUtils';
import { EVENT_CONSTANTS } from '../constants/event.constants';

// Modelos
import Event, {
    EventType,
    EventStatus,
    RecurrenceType,
    RecurrenceConfig
} from '../models/Event';

// Servicios
import { eventService } from './EventService';

// ============================================================================
// INTERFACES
// ============================================================================

export interface RecurrenceGenerationResult {
    parentEventId: string;
    occurrencesGenerated: number;
    nextOccurrenceDate?: Date;
    endDate?: Date;
}

// ============================================================================
// SERVICIO DE PROGRAMACIÓN DE EVENTOS RECURRENTES
// ============================================================================

export class EventSchedulerService {
    private readonly context = 'EventSchedulerService';

    /**
     * Genera todas las ocurrencias de un evento recurrente
     */
    async generateRecurrences(parentEventId: string): Promise<RecurrenceGenerationResult> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            const parentEvent = await Event.findByPk(parentEventId, { transaction });
            if (!parentEvent) {
                throw new EventError(
                    `Evento padre con ID ${parentEventId} no encontrado`,
                    'PARENT_NOT_FOUND',
                    404
                );
            }

            if (!parentEvent.recurrence) {
                throw new EventValidationError('El evento no tiene configuración de recurrencia');
            }

            // Eliminar ocurrencias futuras existentes (para regenerar)
            await Event.destroy({
                where: {
                    parentEventId,
                    scheduledDate: { [Op.gt]: new Date() },
                    status: EventStatus.SCHEDULED
                },
                transaction
            });

            // Generar nuevas ocurrencias
            const occurrences = this.generateOccurrenceDates(
                parentEvent.scheduledDate,
                parentEvent.recurrence
            );

            // Crear eventos hijos
            for (const date of occurrences) {
                await Event.create({
                    bovineId: parentEvent.bovineId,
                    eventType: parentEvent.eventType,
                    title: parentEvent.title,
                    description: parentEvent.description,
                    status: EventStatus.SCHEDULED,
                    priority: parentEvent.priority,
                    scheduledDate: date,
                    expectedLocation: parentEvent.expectedLocation,
                    assignedTo: parentEvent.assignedTo,
                    veterinarianId: parentEvent.veterinarianId,
                    estimatedCost: parentEvent.estimatedCost,
                    currency: parentEvent.currency,
                    expectedData: parentEvent.expectedData,
                    requiresVeterinarian: parentEvent.requiresVeterinarian,
                    requiresEquipment: parentEvent.requiresEquipment,
                    requiresFacility: parentEvent.requiresFacility,
                    parentEventId: parentEvent.id,
                    createdBy: 'system',
                    isActive: true
                }, { transaction });
            }

            await transaction.commit();

            const duration = Date.now() - startTime;

            logger.info(`Recurrencias generadas para evento ${parentEventId}`, this.context, {
                parentEventId,
                occurrencesGenerated: occurrences.length,
                nextDate: occurrences[0],
                endDate: occurrences[occurrences.length - 1],
                durationMs: duration
            });

            return {
                parentEventId,
                occurrencesGenerated: occurrences.length,
                nextOccurrenceDate: occurrences[0],
                endDate: occurrences[occurrences.length - 1]
            };

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error generando recurrencias para evento ${parentEventId}`, this.context, {
                parentEventId
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Genera fechas de ocurrencia según configuración
     */
    private generateOccurrenceDates(
        startDate: Date,
        recurrence: RecurrenceConfig
    ): Date[] {
        const dates: Date[] = [];
        const { type, interval = 1, endDate, maxOccurrences, daysOfWeek, dayOfMonth } = recurrence;

        let currentDate = new Date(startDate);
        let count = 0;

        // Avanzar al primer día válido según configuración
        if (type === RecurrenceType.WEEKLY && daysOfWeek) {
            currentDate = this.adjustToNextValidDay(currentDate, daysOfWeek);
        }

        while (true) {
            // Verificar límites
            if (endDate && currentDate > new Date(endDate)) break;
            if (maxOccurrences && count >= maxOccurrences) break;
            if (count > 1000) break; // Límite de seguridad

            // Verificar si es un día válido según configuración
            if (this.isValidOccurrenceDate(currentDate, recurrence)) {
                dates.push(new Date(currentDate));
                count++;
            }

            // Calcular siguiente fecha
            currentDate = this.calculateNextDate(currentDate, type, interval);
        }

        return dates;
    }

    /**
     * Calcula siguiente fecha según tipo de recurrencia
     */
    private calculateNextDate(
        currentDate: Date,
        type: RecurrenceType,
        interval: number
    ): Date {
        const nextDate = new Date(currentDate);

        switch (type) {
            case RecurrenceType.DAILY:
                nextDate.setDate(nextDate.getDate() + interval);
                break;
            case RecurrenceType.WEEKLY:
                nextDate.setDate(nextDate.getDate() + (7 * interval));
                break;
            case RecurrenceType.MONTHLY:
                nextDate.setMonth(nextDate.getMonth() + interval);
                break;
            case RecurrenceType.QUARTERLY:
                nextDate.setMonth(nextDate.getMonth() + (3 * interval));
                break;
            case RecurrenceType.YEARLY:
                nextDate.setFullYear(nextDate.getFullYear() + interval);
                break;
            case RecurrenceType.CUSTOM:
                // Lógica personalizada según configuración
                break;
        }

        return nextDate;
    }

    /**
     * Verifica si una fecha es válida según la configuración de recurrencia
     */
    private isValidOccurrenceDate(
        date: Date,
        recurrence: RecurrenceConfig
    ): boolean {
        const { type, daysOfWeek, dayOfMonth } = recurrence;

        switch (type) {
            case RecurrenceType.WEEKLY:
                if (!daysOfWeek) return true;
                return daysOfWeek.includes(date.getDay());

            case RecurrenceType.MONTHLY:
                if (!dayOfMonth) return true;
                return date.getDate() === dayOfMonth;

            default:
                return true;
        }
    }

    /**
     * Ajusta la fecha al próximo día válido de la semana
     */
    private adjustToNextValidDay(date: Date, validDays: number[]): Date {
        const currentDay = date.getDay();

        // Ordenar días válidos
        const sortedDays = [...validDays].sort((a, b) => a - b);

        // Buscar el próximo día válido
        let nextDay = sortedDays.find(day => day > currentDay);

        if (nextDay === undefined) {
            // Si no hay, tomar el primero de la próxima semana
            nextDay = sortedDays[0];
            date.setDate(date.getDate() + (7 - currentDay + nextDay));
        } else {
            date.setDate(date.getDate() + (nextDay - currentDay));
        }

        return date;
    }

    /**
     * Programa todas las recurrencias pendientes (tarea programada)
     */
    async scheduleAllPendingRecurrences(): Promise<{
        processed: number;
        generated: number;
    }> {
        const startTime = Date.now();
        let processed = 0;
        let generated = 0;

        try {
            // Buscar eventos recurrentes activos sin ocurrencias futuras
            const events = await Event.findAll({
                where: {
                    parentEventId: { [Op.is]: null } as any,
                    isActive: true,
                    [Op.and]: literal('recurrence IS NOT NULL')
                }
            });

            for (const event of events) {
                try {
                    const result = await this.generateRecurrences(event.id);
                    processed++;
                    generated += result.occurrencesGenerated;
                } catch (error) {
                    logger.error(`Error generando recurrencias para evento ${event.id}`, this.context, {
                        eventId: event.id
                    }, ensureError(error));
                }
            }

            const duration = Date.now() - startTime;

            logger.info(`Programación masiva de recurrencias completada`, this.context, {
                eventsProcessed: processed,
                occurrencesGenerated: generated,
                durationMs: duration
            });

            return { processed, generated };

        } catch (error) {
            logger.error(`Error en programación masiva de recurrencias`, this.context, {}, ensureError(error));
            throw error;
        }
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const eventSchedulerService = new EventSchedulerService();