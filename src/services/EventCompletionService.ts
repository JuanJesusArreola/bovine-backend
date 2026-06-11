// services/event/EventCompletionService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import {
    EventError,
    EventNotFoundError,
    EventValidationError
} from '../utils/EventErrors';
import { ensureError } from '../utils/errorUtils';

// Modelos
import Event, { EventStatus, EventType } from '../models/Event';
import Health from '../models/Health';
import { HealthRecordType } from '../models/Health';

// Servicios
import { eventService } from './EventService';

// ============================================================================
// INTERFACES
// ============================================================================

export interface EventCompletionData {
    eventId: string;
    healthRecordId: string;
    completedBy: string;
    notes?: string;
    actualCost?: number;
    actualDuration?: number;
    outcome?: 'SUCCESS' | 'PARTIAL' | 'FAILURE';
}

export interface BatchCompletionResult {
    processed: number;
    completed: number;
    failed: Array<{ id: string; error: string }>;
}

// ============================================================================
// SERVICIO DE COMPLETACIÓN DE EVENTOS
// ============================================================================

export class EventCompletionService {
    private readonly context = 'EventCompletionService';

    /**
     * Completa un evento y lo vincula con un registro de salud
     */
    async completeEvent(data: EventCompletionData): Promise<Event> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            // 1. Verificar que el evento existe
            const event = await Event.findByPk(data.eventId, { transaction });
            if (!event) {
                throw new EventNotFoundError(`Evento con ID ${data.eventId} no encontrado`);
            }

            // 2. Verificar que el evento puede ser completado
            this.validateEventCanBeCompleted(event);

            // 3. Verificar que el registro de salud existe
            const healthRecord = await Health.findByPk(data.healthRecordId, { transaction });
            if (!healthRecord) {
                throw new EventValidationError(
                    `Registro de salud con ID ${data.healthRecordId} no encontrado`
                );
            }

            // 4. Verificar que el registro de salud corresponde al mismo bovino
            if (healthRecord.bovineId !== event.bovineId) {
                throw new EventValidationError(
                    'El registro de salud no corresponde al mismo bovino'
                );
            }

            // 5. Verificar que el tipo de evento coincide con el tipo de registro
            this.validateEventHealthCompatibility(event, healthRecord);

            // 6. Actualizar evento
            const updateData: any = {
                status: EventStatus.COMPLETED,
                healthRecordId: data.healthRecordId,
                endDate: new Date(),
                planningNotes: event.planningNotes
                    ? `${event.planningNotes}\nCompletado: ${data.notes || ''}`
                    : data.notes ? `Completado: ${data.notes}` : undefined
            };

            // Solo agregar metadata si hay datos de completación
            if (data.actualCost || data.actualDuration || data.outcome) {
                updateData.metadata = {
                    ...event.metadata,
                    completion: {
                        completedBy: data.completedBy,
                        completedAt: new Date(),
                        actualCost: data.actualCost,
                        actualDuration: data.actualDuration,
                        outcome: data.outcome
                    }
                };
            }

            await event.update(updateData, { transaction });

            await transaction.commit();

            const duration = Date.now() - startTime;

            logger.info(`Evento completado: ${data.eventId}`, this.context, {
                eventId: data.eventId,
                healthRecordId: data.healthRecordId,
                completedBy: data.completedBy,
                durationMs: duration
            });

            return event;

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error completando evento ${data.eventId}`, this.context, {
                eventId: data.eventId,
                healthRecordId: data.healthRecordId
            }, ensureError(error));

            if (error instanceof EventError) throw error;
            throw new EventError(
                'Error al completar el evento',
                'COMPLETION_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Completa eventos en lote (tarea programada)
     */
    async completeOverdueEvents(): Promise<BatchCompletionResult> {
        const startTime = Date.now();
        const result: BatchCompletionResult = {
            processed: 0,
            completed: 0,
            failed: []
        };

        try {
            // Buscar eventos atrasados (SCHEDULED con fecha pasada)
            const overdueEvents = await Event.findAll({
                where: {
                    status: EventStatus.SCHEDULED,
                    scheduledDate: { [Op.lt]: new Date() },
                    isActive: true
                },
                limit: 100 // Límite por lote
            });

            result.processed = overdueEvents.length;

            for (const event of overdueEvents) {
                try {
                    // Marcar como completado automáticamente?
                    // Depende de la lógica de negocio
                    await event.update({
                        status: EventStatus.COMPLETED,
                        endDate: new Date(),
                        planningNotes: event.planningNotes 
                            ? `${event.planningNotes}\nCompletado automáticamente (atrasado)`
                            : 'Completado automáticamente (atrasado)'
                    });
                    result.completed++;

                } catch (error) {
                    result.failed.push({
                        id: event.id,
                        error: error instanceof Error ? error.message : 'Error desconocido'
                    });
                }
            }

            const duration = Date.now() - startTime;

            logger.info(`Completación masiva de eventos atrasados`, this.context, {
                processed: result.processed,
                completed: result.completed,
                failed: result.failed.length,
                durationMs: duration
            });

            return result;

        } catch (error) {
            logger.error(`Error en completación masiva de eventos`, this.context, {}, ensureError(error));
            throw error;
        }
    }

    /**
     * Valida que un evento puede ser completado
     */
    private validateEventCanBeCompleted(event: Event): void {
        if (event.status === EventStatus.COMPLETED) {
            throw new EventValidationError('El evento ya está completado');
        }

        if (event.status === EventStatus.CANCELLED) {
            throw new EventValidationError('No se puede completar un evento cancelado');
        }

        // Eventos programados pueden completarse antes de la fecha
        // pero debería ser la excepción
    }

    /**
     * Valida compatibilidad entre tipo de evento y tipo de registro de salud
     */
    private validateEventHealthCompatibility(
        event: Event,
        healthRecord: Health
    ): void {
        const compatibilityMap: Partial<Record<EventType, HealthRecordType[]>> = {
            [EventType.VACCINATION]: [HealthRecordType.VACCINATION],
            [EventType.HEALTH_CHECK]: [
                HealthRecordType.ROUTINE_CHECKUP,
                HealthRecordType.FOLLOW_UP
            ],
            [EventType.TREATMENT]: [HealthRecordType.TREATMENT],
            [EventType.MEDICATION]: [HealthRecordType.TREATMENT],
            [EventType.SURGERY]: [HealthRecordType.SURGERY],
            [EventType.REPRODUCTION]: [HealthRecordType.REPRODUCTIVE_EXAM],
            [EventType.PREGNANCY_CHECK]: [HealthRecordType.REPRODUCTIVE_EXAM],
            [EventType.BIRTH]: [HealthRecordType.REPRODUCTIVE_EXAM],
            [EventType.WEANING]: [HealthRecordType.ROUTINE_CHECKUP],
            [EventType.WEIGHING]: [HealthRecordType.PHYSICAL_EXAM],
            [EventType.MOVEMENT]: [], // No debería tener registro de salud
            [EventType.QUARANTINE]: [HealthRecordType.QUARANTINE_ASSESSMENT],
            [EventType.OTHER]: Object.values(HealthRecordType)
        };

        const allowedTypes = compatibilityMap[event.eventType] || [];

        if (allowedTypes.length > 0 && !allowedTypes.includes(healthRecord.recordType)) {
            throw new EventValidationError(
                `El tipo de evento ${event.eventType} no es compatible con ` +
                `el tipo de registro ${healthRecord.recordType}`
            );
        }
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const eventCompletionService = new EventCompletionService();