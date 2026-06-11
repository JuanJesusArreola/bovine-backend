// services/event/EventService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import {
    EventError,
    EventNotFoundError,
    EventValidationError
} from '../utils/EventErrors';
import { getErrorMessage, ensureError } from '../utils/errorUtils';
import { EVENT_CONSTANTS } from '../constants/event.constants';

// Modelos
import Event, {
    EventAttributes,
    EventCreationAttributes,
    EventType,
    EventStatus,
    EventPriority,
    RecurrenceType,
    ExpectedEventData,
    RecurrenceConfig,
    NotificationConfig
} from '../models/Event';
import Bovine, { LocationData } from '../models/Bovine';
import Health from '../models/Health';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface CreateEventDTO {
    bovineId: string;
    eventType: EventType;
    title: string;
    description?: string;
    scheduledDate: Date;
    priority?: EventPriority;
    expectedLocation?: LocationData;
    assignedTo?: string;
    veterinarianId?: string;
    estimatedCost?: number;
    currency?: string;
    expectedData?: ExpectedEventData;
    recurrence?: RecurrenceConfig;
    notifications?: NotificationConfig;
    requiresVeterinarian?: boolean;
    requiresEquipment?: string[];
    requiresFacility?: string;
    createdBy: string;
}

export interface UpdateEventDTO extends Partial<CreateEventDTO> {
    id: string;
    status?: EventStatus;
    healthRecordId?: string;
}

export interface EventFilters {
    bovineId?: string;
    ranchId?: string;
    eventType?: EventType[];
    status?: EventStatus[];
    priority?: EventPriority[];
    startDate?: Date;
    endDate?: Date;
    assignedTo?: string;
    veterinarianId?: string;
    isActive?: boolean;
}

export interface EventResponse {
    id: string;
    bovineId: string;
    bovineName?: string;
    bovineEarTag?: string;
    eventType: EventType;
    eventTypeLabel: string;
    title: string;
    description?: string;
    status: EventStatus;
    statusLabel: string;
    priority: EventPriority;
    priorityLabel: string;
    scheduledDate: Date;
    completedDate?: Date;
    healthRecordId?: string;
    daysUntil: number;
    isOverdue: boolean;
    requiresVeterinarian: boolean;
    createdAt: Date;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class EventService {
    private readonly context = 'EventService';

    // ==========================================================================
    // MÉTODOS CRUD
    // ==========================================================================

    /**
     * Crea un nuevo evento programado
     */
    async createEvent(data: CreateEventDTO, transaction?: Transaction): Promise<Event> {
         const t = transaction || await sequelize.transaction();
        const isOwnTransaction = !transaction; // ¿Creamos nosotros la transacción?
        const startTime = Date.now();

        try {
            // 1. Validar que el bovino existe
            const bovine = await Bovine.findByPk(data.bovineId, {
                attributes: ['id', 'ranchId'],
                transaction
            });

            if (!bovine) {
                throw new EventNotFoundError(`Bovino con ID ${data.bovineId} no encontrado`);
            }

            // 2. Validar fecha programada
            this.validateScheduledDate(data.scheduledDate);

            // 3. Validar datos según tipo de evento
            this.validateEventData(data);

            // 4. Crear evento
            const event = await Event.create({
                bovineId: data.bovineId,
                eventType: data.eventType,
                title: data.title,
                description: data.description,
                status: EventStatus.SCHEDULED,
                priority: data.priority || EventPriority.MEDIUM,
                scheduledDate: data.scheduledDate,
                expectedLocation: data.expectedLocation,
                assignedTo: data.assignedTo,
                veterinarianId: data.veterinarianId,
                estimatedCost: data.estimatedCost,
                currency: data.currency,
                expectedData: data.expectedData,
                recurrence: data.recurrence,
                notifications: data.notifications,
                requiresVeterinarian: data.requiresVeterinarian || false,
                requiresEquipment: data.requiresEquipment,
                requiresFacility: data.requiresFacility,
                createdBy: data.createdBy,
                isActive: true,
                reminderSent: false
            } as EventCreationAttributes, { transaction: t });

            // 5. Si tiene recurrencia, generar instancias futuras (opcional)
            if (data.recurrence && data.recurrence.type !== RecurrenceType.NONE) {
                await this.generateRecurringEvents(event, t);
            }

            if (isOwnTransaction) {
                await t.commit();
            }

            const duration = Date.now() - startTime;
            logger.info(`Evento creado: ${event.id}`, this.context, {
                eventId: event.id,
                bovineId: data.bovineId,
                eventType: data.eventType,
                scheduledDate: data.scheduledDate,
                durationMs: duration
            });

            return event;

        } catch (error) {
            // Solo hacer rollback si nosotros creamos la transacción
            if (isOwnTransaction) {
                await t.rollback();
            }
            logger.error(`Error creando evento`, this.context, { data }, ensureError(error));

            if (error instanceof EventError) throw error;
            throw new EventError(
                'Error al crear el evento',
                'CREATE_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Actualiza un evento existente
     */
    async updateEvent(id: string, data: UpdateEventDTO): Promise<Event> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            const event = await Event.findByPk(id, { transaction });
            if (!event) {
                throw new EventNotFoundError(`Evento con ID ${id} no encontrado`);
            }

            // Validaciones según cambios
            if (data.scheduledDate) {
                this.validateScheduledDate(data.scheduledDate);
            }

            // No permitir ciertos cambios si ya está completado o cancelado
            if (event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED) {
                throw new EventValidationError(
                    'No se puede modificar un evento completado o cancelado'
                );
            }

            await event.update(data, { transaction });
            await transaction.commit();

            const duration = Date.now() - startTime;
            logger.info(`Evento actualizado: ${id}`, this.context, {
                eventId: id,
                changes: Object.keys(data),
                durationMs: duration
            });

            return event;

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error actualizando evento ${id}`, this.context, { data }, ensureError(error));

            if (error instanceof EventError) throw error;
            throw new EventError(
                'Error al actualizar el evento',
                'UPDATE_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Obtiene un evento por ID
     */
    async getEventById(id: string): Promise<Event | null> {
        try {
            const event = await Event.findByPk(id, {
                include: [{
                    model: Bovine,
                    as: 'bovine',
                    attributes: ['id', 'earTag', 'name']
                }]
            });

            return event;

        } catch (error) {
            logger.error(`Error obteniendo evento ${id}`, this.context, { id }, ensureError(error));
            throw error;
        }
    }

    /**
     * Lista eventos con filtros
     */
    async listEvents(
        filters: EventFilters,
        pagination: { page: number; limit: number } = { page: 1, limit: 20 }
    ): Promise<{ rows: Event[]; count: number }> {
        try {
            const where = this.buildWhereClause(filters);
            const offset = (pagination.page - 1) * pagination.limit;

            const { rows, count } = await Event.findAndCountAll({
                where,
                limit: pagination.limit,
                offset,
                order: [['scheduledDate', 'ASC']],
                include: [{
                    model: Bovine,
                    as: 'bovine',
                    attributes: ['id', 'earTag', 'name']
                }]
            });

            logger.debug(`Eventos listados`, this.context, {
                total: count,
                page: pagination.page,
                filters
            });

            return { rows, count };

        } catch (error) {
            logger.error(`Error listando eventos`, this.context, { filters }, ensureError(error));
            throw error;
        }
    }

    /**
     * Elimina un evento (soft delete)
     */
    async deleteEvent(id: string): Promise<void> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            const event = await Event.findByPk(id, { transaction });
            if (!event) {
                throw new EventNotFoundError(`Evento con ID ${id} no encontrado`);
            }

            // No permitir eliminar eventos completados (mejor mantener historial)
            if (event.status === EventStatus.COMPLETED) {
                throw new EventValidationError(
                    'No se puede eliminar un evento completado'
                );
            }

            await event.destroy({ transaction });
            await transaction.commit();

            const duration = Date.now() - startTime;
            logger.info(`Evento eliminado: ${id}`, this.context, {
                eventId: id,
                durationMs: duration
            });

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error eliminando evento ${id}`, this.context, { id }, ensureError(error));

            if (error instanceof EventError) throw error;
            throw new EventError(
                'Error al eliminar el evento',
                'DELETE_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    // ==========================================================================
    // MÉTODOS DE CONSULTA ESPECIALIZADOS
    // ==========================================================================

    /**
     * Obtiene eventos próximos (próximos N días)
     */
    async getUpcomingEvents(ranchId: string, days: number = 7): Promise<Event[]> {
        try {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + days);

            const events = await Event.findAll({
                where: {
                    scheduledDate: { [Op.between]: [startDate, endDate] },
                    status: { [Op.in]: [EventStatus.SCHEDULED, EventStatus.POSTPONED] },
                    isActive: true
                },
                include: [{
                    model: Bovine,
                    as: 'bovine',
                    where: { ranchId },
                    attributes: ['id', 'earTag', 'name']
                }],
                order: [['scheduledDate', 'ASC']]
            });

            logger.debug(`Eventos próximos obtenidos`, this.context, {
                ranchId,
                days,
                count: events.length
            });

            return events;

        } catch (error) {
            logger.error(`Error obteniendo eventos próximos`, this.context, { ranchId, days }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene eventos atrasados (fecha pasada y no completados)
     */
    async getOverdueEvents(ranchId: string): Promise<Event[]> {
        try {
            const now = new Date();

            const events = await Event.findAll({
                where: {
                    scheduledDate: { [Op.lt]: now },
                    status: { [Op.in]: [EventStatus.SCHEDULED, EventStatus.POSTPONED] },
                    isActive: true
                },
                include: [{
                    model: Bovine,
                    as: 'bovine',
                    where: { ranchId },
                    attributes: ['id', 'earTag', 'name']
                }],
                order: [['scheduledDate', 'ASC']]
            });

            logger.debug(`Eventos atrasados obtenidos`, this.context, {
                ranchId,
                count: events.length
            });

            return events;

        } catch (error) {
            logger.error(`Error obteniendo eventos atrasados`, this.context, { ranchId }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene eventos por bovino
     */
    async getEventsByBovine(
        bovineId: string,
        status?: EventStatus[],
        limit: number = 50
    ): Promise<Event[]> {
        try {
            const where: any = { bovineId };
            if (status) {
                where.status = { [Op.in]: status };
            }

            const events = await Event.findAll({
                where,
                order: [['scheduledDate', 'DESC']],
                limit
            });

            return events;

        } catch (error) {
            logger.error(`Error obteniendo eventos por bovino`, this.context, { bovineId }, ensureError(error));
            throw error;
        }
    }

    // ==========================================================================
    // MÉTODOS DE ACCIÓN SOBRE EVENTOS
    // ==========================================================================

    /**
     * Marca un evento como en progreso
     */
    async startEvent(id: string, userId: string): Promise<Event> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            const event = await Event.findByPk(id, { transaction });
            if (!event) {
                throw new EventNotFoundError(`Evento con ID ${id} no encontrado`);
            }

            if (event.status !== EventStatus.SCHEDULED) {
                throw new EventValidationError(
                    `No se puede iniciar un evento en estado ${event.status}`
                );
            }

            await event.update({
                status: EventStatus.IN_PROGRESS,
                startDate: new Date()
            }, { transaction });

            await transaction.commit();

            logger.info(`Evento iniciado: ${id}`, this.context, {
                eventId: id,
                userId,
                durationMs: Date.now() - startTime
            });

            return event;

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error iniciando evento ${id}`, this.context, { id, userId }, ensureError(error));

            if (error instanceof EventError) throw error;
            throw new EventError(
                'Error al iniciar el evento',
                'START_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Completa un evento y lo vincula con un registro de salud
     */
    async completeEvent(id: string, healthRecordId: string, userId: string): Promise<Event> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            const event = await Event.findByPk(id, { transaction });
            if (!event) {
                throw new EventNotFoundError(`Evento con ID ${id} no encontrado`);
            }

            // Verificar que el registro de salud existe
            const healthRecord = await Health.findByPk(healthRecordId, { transaction });
            if (!healthRecord) {
                throw new EventValidationError(
                    `Registro de salud con ID ${healthRecordId} no encontrado`
                );
            }

            await event.update({
                status: EventStatus.COMPLETED,
                healthRecordId,
                endDate: new Date()
            }, { transaction });

            await transaction.commit();

            logger.info(`Evento completado: ${id}`, this.context, {
                eventId: id,
                healthRecordId,
                userId,
                durationMs: Date.now() - startTime
            });

            return event;

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error completando evento ${id}`, this.context, { id, healthRecordId, userId }, ensureError(error));

            if (error instanceof EventError) throw error;
            throw new EventError(
                'Error al completar el evento',
                'COMPLETE_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Cancela un evento
     */
    async cancelEvent(id: string, reason: string, userId: string): Promise<Event> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            const event = await Event.findByPk(id, { transaction });
            if (!event) {
                throw new EventNotFoundError(`Evento con ID ${id} no encontrado`);
            }

            if (event.status === EventStatus.COMPLETED) {
                throw new EventValidationError('No se puede cancelar un evento completado');
            }

            await event.update({
                status: EventStatus.CANCELLED,
                planningNotes: event.planningNotes
                    ? `${event.planningNotes}\nCancelado: ${reason}`
                    : `Cancelado: ${reason}`
            }, { transaction });

            await transaction.commit();

            logger.info(`Evento cancelado: ${id}`, this.context, {
                eventId: id,
                reason,
                userId,
                durationMs: Date.now() - startTime
            });

            return event;

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error cancelando evento ${id}`, this.context, { id, reason, userId }, ensureError(error));

            if (error instanceof EventError) throw error;
            throw new EventError(
                'Error al cancelar el evento',
                'CANCEL_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    /**
     * Pospone un evento
     */
    async postponeEvent(id: string, newDate: Date, reason: string, userId: string): Promise<Event> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            const event = await Event.findByPk(id, { transaction });
            if (!event) {
                throw new EventNotFoundError(`Evento con ID ${id} no encontrado`);
            }

            this.validateScheduledDate(newDate);

            await event.update({
                status: EventStatus.POSTPONED,
                scheduledDate: newDate,
                planningNotes: event.planningNotes
                    ? `${event.planningNotes}\nPospuesto: ${reason}`
                    : `Pospuesto: ${reason}`
            }, { transaction });

            await transaction.commit();

            logger.info(`Evento pospuesto: ${id}`, this.context, {
                eventId: id,
                newDate,
                reason,
                userId,
                durationMs: Date.now() - startTime
            });

            return event;

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error posponiendo evento ${id}`, this.context, { id, newDate, reason, userId }, ensureError(error));

            if (error instanceof EventError) throw error;
            throw new EventError(
                'Error al posponer el evento',
                'POSTPONE_ERROR',
                500,
                ensureError(error)
            );
        }
    }

    // ==========================================================================
    // MÉTODOS DE UTILIDAD
    // ==========================================================================

    /**
     * Formatea un evento para respuesta
     */
    formatEventResponse(event: Event): EventResponse {
        const now = new Date();
        const scheduledDate = new Date(event.scheduledDate);
        const daysUntil = Math.ceil(
            (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
            id: event.id,
            bovineId: event.bovineId,
            bovineName: (event as any).bovine?.name,
            bovineEarTag: (event as any).bovine?.earTag,
            eventType: event.eventType,
            eventTypeLabel: this.getEventTypeLabel(event.eventType),
            title: event.title,
            description: event.description,
            status: event.status,
            statusLabel: this.getStatusLabel(event.status),
            priority: event.priority,
            priorityLabel: this.getPriorityLabel(event.priority),
            scheduledDate: event.scheduledDate,
            completedDate: event.endDate,
            healthRecordId: event.healthRecordId,
            daysUntil,
            isOverdue: daysUntil < 0 && event.status === EventStatus.SCHEDULED,
            requiresVeterinarian: event.requiresVeterinarian,
            createdAt: event.createdAt
        };
    }

    /**
     * Construye cláusula WHERE para filtros
     */
    private buildWhereClause(filters: EventFilters): any {
        const where: any = { isActive: true };

        if (filters.bovineId) {
            where.bovineId = filters.bovineId;
        }

        if (filters.eventType?.length) {
            where.eventType = { [Op.in]: filters.eventType };
        }

        if (filters.status?.length) {
            where.status = { [Op.in]: filters.status };
        }

        if (filters.priority?.length) {
            where.priority = { [Op.in]: filters.priority };
        }

        if (filters.startDate || filters.endDate) {
            where.scheduledDate = {};
            if (filters.startDate) where.scheduledDate[Op.gte] = filters.startDate;
            if (filters.endDate) where.scheduledDate[Op.lte] = filters.endDate;
        }

        if (filters.assignedTo) {
            where.assignedTo = filters.assignedTo;
        }

        if (filters.veterinarianId) {
            where.veterinarianId = filters.veterinarianId;
        }

        if (filters.ranchId) {
            // Requiere include con Bovine
        }

        return where;
    }

    /**
     * Valida fecha programada
     */
    private validateScheduledDate(date: Date): void {
        const now = new Date();
        if (date < now) {
            throw new EventValidationError(
                'La fecha programada debe ser futura'
            );
        }
    }

    /**
     * Valida datos según tipo de evento
     */
    private validateEventData(data: CreateEventDTO): void {
        switch (data.eventType) {
            case EventType.VACCINATION:
                if (!data.expectedData) {
                    throw new EventValidationError(
                        'Los eventos de vacunación requieren datos de vacuna'
                    );
                }
                break;
            case EventType.TREATMENT:
                if (!data.veterinarianId) {
                    throw new EventValidationError(
                        'Los tratamientos requieren un veterinario asignado'
                    );
                }
                break;
            // ... otras validaciones
        }
    }

    /**
     * Genera eventos recurrentes
     */
    private async generateRecurringEvents(
        parentEvent: Event,
        transaction: Transaction
    ): Promise<void> {
        if (!parentEvent.recurrence) return;

        const { type, interval = 1, endDate, maxOccurrences } = parentEvent.recurrence;

        let currentDate = new Date(parentEvent.scheduledDate);
        let count = 1;
        const occurrences: Date[] = [];

        while (true) {
            // Calcular siguiente fecha
            currentDate = this.calculateNextDate(currentDate, type, interval);

            // Validar límites
            if (endDate && currentDate > endDate) break;
            if (maxOccurrences && count >= maxOccurrences) break;
            if (count > 100) break; // Safety limit

            occurrences.push(new Date(currentDate));
            count++;
        }

        // Crear eventos hijos
        for (const date of occurrences) {
            await Event.create({
                ...parentEvent.toJSON(),
                id: undefined, // Generar nuevo ID
                parentEventId: parentEvent.id,
                scheduledDate: date,
                status: EventStatus.SCHEDULED,
                recurrence: undefined // Los hijos no son recurrentes
            } as EventCreationAttributes, { transaction });
        }
    }

    /**
     * Calcula siguiente fecha según recurrencia
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
        }

        return nextDate;
    }

    /**
     * Obtiene etiqueta de tipo de evento
     */
    getEventTypeLabel(type: EventType): string {
        const labels = {
            [EventType.VACCINATION]: 'Vacunación',
            [EventType.HEALTH_CHECK]: 'Chequeo de salud',
            [EventType.TREATMENT]: 'Tratamiento',
            [EventType.MEDICATION]: 'Medicación',
            [EventType.SURGERY]: 'Cirugía',
            [EventType.REPRODUCTION]: 'Reproducción',
            [EventType.PREGNANCY_CHECK]: 'Chequeo de gestación',
            [EventType.BIRTH]: 'Parto',
            [EventType.WEANING]: 'Destete',
            [EventType.WEIGHING]: 'Pesaje',
            [EventType.MOVEMENT]: 'Movimiento',
            [EventType.QUARANTINE]: 'Cuarentena',
            [EventType.DEATH]: 'Muerte / Baja',
            [EventType.OTHER]: 'Otro'
        };
        return labels[type] || type;
    }

    /**
     * Obtiene etiqueta de estado
     */
    getStatusLabel(status: EventStatus): string {
        const labels = {
            [EventStatus.SCHEDULED]: 'Programado',
            [EventStatus.IN_PROGRESS]: 'En progreso',
            [EventStatus.COMPLETED]: 'Completado',
            [EventStatus.CANCELLED]: 'Cancelado',
            [EventStatus.POSTPONED]: 'Pospuesto'
        };
        return labels[status] || status;
    }

    /**
     * Obtiene etiqueta de prioridad
     */
    getPriorityLabel(priority: EventPriority): string {
        const labels = {
            [EventPriority.LOW]: 'Baja',
            [EventPriority.MEDIUM]: 'Media',
            [EventPriority.HIGH]: 'Alta',
            [EventPriority.CRITICAL]: 'Crítica',
            [EventPriority.EMERGENCY]: 'Emergencia'
        };
        return labels[priority] || priority;
    }

    /**
     * Crea un evento a partir de una acción (para integración)
     */
    async createEventFromAction(
        action: string,
        data: any,
        transaction?: Transaction
    ): Promise<Event | null> {
        try {
            // Mapeo de acciones a tipos de evento
            const actionMap: Record<string, EventType> = {
                'BOVINE_CREATED': EventType.OTHER,
                'HEALTH_STATUS_CHANGED': EventType.HEALTH_CHECK,
                'LOCATION_ENTRY': EventType.MOVEMENT,
                'LOCATION_EXIT': EventType.MOVEMENT
            };

            const eventType = actionMap[action];
            if (!eventType) return null;

            // Crear título según acción
            const titles: Record<string, string> = {
                'BOVINE_CREATED': 'Bovino registrado en el sistema',
                'HEALTH_STATUS_CHANGED': 'Cambio de estado de salud',
                'LOCATION_ENTRY': 'Entrada a ubicación',
                'LOCATION_EXIT': 'Salida de ubicación'
            };

            const event = await Event.create({
                bovineId: data.bovineId,
                eventType,
                title: titles[action] || 'Evento del sistema',
                description: data.description || `Acción: ${action}`,
                status: EventStatus.COMPLETED,
                priority: EventPriority.LOW,
                scheduledDate: new Date(),
                createdBy: data.userId || 'system',
                requiresVeterinarian: false,
                isActive: true,
                metadata: data.metadata
            } as EventCreationAttributes, { transaction });

            logger.debug(`Evento creado desde acción: ${action}`, this.context, {
                eventId: event.id,
                bovineId: data.bovineId,
                action
            });

            return event;

        } catch (error) {
            logger.error(`Error creando evento desde acción ${action}`, this.context, { data }, ensureError(error));
            return null; // No interrumpir el flujo principal
        }
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const eventService = new EventService();