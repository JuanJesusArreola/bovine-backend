// services/email/EmailQueueService.ts
import Bull from 'bull';
import { EventEmitter } from 'events';
import logger from '../utils/logger';
import { EmailQueueError } from '../utils/EmailErrors';
import { EmailPriority, EmailOptions, EmailJobResult } from './EmailService';
import { RETRY_CONFIG, API_LIMITS } from '../constants/email.constants';
import redisConfig, { bullConfig, queueNames } from '../config/redis';

export interface EmailJobData {
    id: string;
    type: string;
    options: EmailOptions;
    priority: EmailPriority;
    attempts: number;
    maxAttempts: number;
    createdAt: Date;
    scheduledFor?: Date;
    metadata?: Record<string, any>;
}

export interface QueueStats {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
}

export class EmailQueueService extends EventEmitter {
    private readonly context = 'EmailQueueService';
    private queue: Bull.Queue<EmailJobData>;
    private isProcessing = false;

    constructor(redisConfig: any, sendEmailCallback?: (options: EmailOptions) => Promise<void>) {
        super();

        this.sendEmailCallback = sendEmailCallback;
        // Inicializar cola con configuración de Redis
        this.queue = new Bull<EmailJobData>(queueNames.email, {
            redis: redisConfig,
            defaultJobOptions: bullConfig.defaultJobOptions,
            settings: bullConfig.settings
        });

        this.setupProcessors();
        this.setupEventHandlers();
    }

    /**
     * Configura manejadores de eventos
     */
    private setupEventHandlers(): void {
        this.queue.on('error', (error) => {
            logger.error('Error en cola de emails', this.context, {}, error);
            this.emit('error', error);
        });

        this.queue.on('failed', (job, error) => {
            logger.error(`Job ${job.id} falló`, this.context, {
                jobId: job.id,
                attempts: job.attemptsMade,
                error: error.message
            }, error);
            this.emit('jobFailed', { job, error });
        });

        this.queue.on('completed', (job) => {
            logger.debug(`Job ${job.id} completado`, this.context, {
                jobId: job.id,
                attempts: job.attemptsMade
            });
            this.emit('jobCompleted', job);
        });

        this.queue.on('stalled', (jobId) => {
            logger.warn(`Job ${jobId} estancado`, this.context, { jobId });
            this.emit('jobStalled', jobId);
        });

        this.queue.on('waiting', (jobId) => {
            this.emit('jobWaiting', jobId);
        });
    }

    /**
 * Configura procesadores para los diferentes tipos de email
 * Este método procesa los jobs de la cola y los envía realmente
 */
    private setupProcessors(): void {
        // Procesador principal para todos los emails
        this.queue.process(async (job) => {
            const { id, type, options, attempts, maxAttempts } = job.data;

            logger.info(`📧 Procesando email ${id}`, this.context, {
                type,
                to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
                attempt: attempts + 1,
                maxAttempts
            });

            try {
                // Actualizar progreso
                await job.progress(10);

                // Aquí llamamos al callback que se pasó en el constructor
                // Este callback debe ser proporcionado por EmailService
                if (this.sendEmailCallback) {
                    await this.sendEmailCallback(options);
                    await job.progress(100);

                    logger.info(`✅ Email ${id} procesado exitosamente`, this.context);

                    return {
                        success: true,
                        processedAt: new Date(),
                        jobId: id,
                        to: options.to
                    };
                } else {
                    throw new Error('No hay callback de envío configurado');
                }

            } catch (error) {
                logger.error(`❌ Error procesando email ${id}`, this.context, {
                    type,
                    error: error instanceof Error ? error.message : 'Error desconocido'
                }, error as Error);

                // Relanzar para que Bull reintente según la configuración
                throw error;
            }
        });

        // Procesador especial para emails CRÍTICOS (prioridad más alta)
        this.queue.process('critical', 1, async (job) => {
            logger.info(`⚡ Procesando email CRÍTICO ${job.id}`, this.context);

            // Misma lógica pero con manejo especial si es necesario
            const { options } = job.data;

            if (this.sendEmailCallback) {
                await this.sendEmailCallback(options);
            }

            return { success: true, critical: true };
        });

        logger.info('Procesadores de cola configurados', this.context);
    }

    private sendEmailCallback?: (options: EmailOptions) => Promise<void>;

    /**
     * Agrega un email a la cola
     */
    async add(
        jobData: Omit<EmailJobData, 'attempts' | 'createdAt'>
    ): Promise<Bull.Job<EmailJobData>> {
        try {
            const priority = this.getPriorityValue(jobData.priority);
            const retryConfig = RETRY_CONFIG[jobData.priority];

            const job = await this.queue.add(
                {
                    ...jobData,
                    attempts: 0,
                    maxAttempts: retryConfig.maxAttempts,
                    createdAt: new Date()
                },
                {
                    priority,
                    delay: jobData.scheduledFor
                        ? jobData.scheduledFor.getTime() - Date.now()
                        : 0,
                    attempts: retryConfig.maxAttempts,
                    backoff: {
                        type: 'exponential',
                        delay: retryConfig.backoffMinutes * 60 * 1000
                    },
                    jobId: jobData.id
                }
            );

            logger.debug(`Email ${jobData.id} agregado a cola`, this.context, {
                jobId: job.id,
                priority: jobData.priority,
                scheduledFor: jobData.scheduledFor
            });

            return job;

        } catch (error) {
            throw new EmailQueueError('add', error as Error);
        }
    }

    /**
     * Agrega múltiples emails a la cola
     */
    async addBulk(
        jobsData: Array<Omit<EmailJobData, 'attempts' | 'createdAt'>>
    ): Promise<Bull.Job<EmailJobData>[]> {
        const promises = jobsData.map(jobData => this.add(jobData));
        return Promise.all(promises);
    }

    /**
     * Obtiene estado de un job
     */
    async getJobStatus(jobId: string): Promise<{
        job: Bull.Job<EmailJobData> | null;
        state: string;
        progress: number;
    }> {
        const job = await this.queue.getJob(jobId);

        if (!job) {
            return { job: null, state: 'not_found', progress: 0 };
        }

        const state = await job.getState();
        const progress = job.progress();

        return { job, state, progress };
    }

    /**
     * Cancela un job pendiente
     */
    async cancelJob(jobId: string): Promise<boolean> {
        const job = await this.queue.getJob(jobId);

        if (!job) {
            return false;
        }

        const state = await job.getState();
        if (state === 'waiting' || state === 'delayed') {
            await job.remove();
            return true;
        }

        return false;
    }

    /**
     * Obtiene estadísticas de la cola
     */
    async getStats(): Promise<QueueStats> {
        const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
            this.queue.getWaitingCount(),
            this.queue.getActiveCount(),
            this.queue.getCompletedCount(),
            this.queue.getFailedCount(),
            this.queue.getDelayedCount(),
            this.queue.getPausedCount()
        ]);

        return { waiting, active, completed, failed, delayed, paused };
    }

    /**
     * Limpia jobs antiguos
     */
    async clean(age: number = API_LIMITS.QUEUE_CLEANUP_DAYS * 24 * 60 * 60 * 1000): Promise<void> {
        await this.queue.clean(age, 'completed');
        await this.queue.clean(age, 'failed');

        logger.info('Cola de emails limpiada', this.context, {
            ageDays: age / (24 * 60 * 60 * 1000)
        });
    }

    /**
     * Pausa la cola
     */
    async pause(): Promise<void> {
        await this.queue.pause();
        logger.info('Cola de emails pausada', this.context);
    }

    /**
     * Reanuda la cola
     */
    async resume(): Promise<void> {
        await this.queue.resume();
        logger.info('Cola de emails reanudada', this.context);
    }

    /**
     * Obtiene valor numérico de prioridad para Bull
     */
    private getPriorityValue(priority: EmailPriority): number {
        switch (priority) {
            case EmailPriority.CRITICAL: return 1;
            case EmailPriority.HIGH: return 2;
            case EmailPriority.MEDIUM: return 3;
            case EmailPriority.LOW: return 4;
            default: return 3;
        }
    }

    /**
     * Cierra la cola
     */
    async close(): Promise<void> {
        await this.queue.close();
        logger.info('Cola de emails cerrada', this.context);
    }
}