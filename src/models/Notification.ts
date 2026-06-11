// models/Notification.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

// ============================================================================
// ENUMS
// ============================================================================

export enum NotificationType {
    HEALTH_ALERT = 'HEALTH_ALERT',
    VACCINATION_REMINDER = 'VACCINATION_REMINDER',
    TREATMENT_REMINDER = 'TREATMENT_REMINDER',
    BIRTH_ALERT = 'BIRTH_ALERT',
    WEANING_ALERT = 'WEANING_ALERT',
    HEAT_DETECTION = 'HEAT_DETECTION',
    INSEMINATION_RESULT = 'INSEMINATION_RESULT',
    PREGNANCY_CHECK = 'PREGNANCY_CHECK',
    WEIGHT_MILESTONE = 'WEIGHT_MILESTONE',
    LOW_STOCK_ALERT = 'LOW_STOCK_ALERT',
    EXPIRATION_ALERT = 'EXPIRATION_ALERT',
    GEOFENCE_ALERT = 'GEOFENCE_ALERT',
    MOVEMENT_ALERT = 'MOVEMENT_ALERT',
    SYSTEM_ALERT = 'SYSTEM_ALERT',
    TASK_REMINDER = 'TASK_REMINDER',
    REPORT_READY = 'REPORT_READY',
    PRODUCTION_ALERT = 'PRODUCTION_ALERT',
    REPRODUCTION_ALERT = 'REPRODUCTION_ALERT',
}

export enum NotificationChannel {
    EMAIL = 'EMAIL',
    SMS = 'SMS',
    PUSH = 'PUSH',
    IN_APP = 'IN_APP',
    WHATSAPP = 'WHATSAPP'
}

export enum NotificationPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    URGENT = 'URGENT'
}

export enum NotificationStatus {
    PENDING = 'PENDING',
    SENT = 'SENT',
    DELIVERED = 'DELIVERED',
    READ = 'READ',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED'
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface NotificationAttributes {
    id: string;
    userId: string;
    type: NotificationType;
    channel: NotificationChannel;
    priority: NotificationPriority;
    title: string;
    content: string;
    data?: any;
    status: NotificationStatus;
    sentAt?: Date;
    deliveredAt?: Date;
    readAt?: Date;
    error?: string;
    retryCount: number;
    maxRetries: number;
    scheduledFor?: Date;
    expiresAt?: Date;
    metadata?: {
        bovineId?: string;
        eventId?: string;
        healthRecordId?: string;
        locationId?: string;
        ranchId?: string;
        [key: string]: any;
    };
    createdBy?: string;

    createdAt?: Date;
    updatedAt?: Date;
    deletedAt?: Date;
}

export interface NotificationCreationAttributes extends Optional<NotificationAttributes,
    'id' | 'sentAt' | 'deliveredAt' | 'readAt' | 'error' | 'retryCount' |
    'maxRetries' | 'scheduledFor' | 'expiresAt' | 'metadata' | 'createdBy' |
    'deletedAt'
> { }

// ============================================================================
// MODELO
// ============================================================================

class Notification extends Model<NotificationAttributes, NotificationCreationAttributes>
    implements NotificationAttributes {

    public id!: string;
    public userId!: string;
    public type!: NotificationType;
    public channel!: NotificationChannel;
    public priority!: NotificationPriority;
    public title!: string;
    public content!: string;
    public data?: any;
    public status!: NotificationStatus;
    public sentAt?: Date;
    public deliveredAt?: Date;
    public readAt?: Date;
    public error?: string;
    public retryCount!: number;
    public maxRetries!: number;
    public scheduledFor?: Date;
    public expiresAt?: Date;
    public metadata?: {
        bovineId?: string;
        eventId?: string;
        healthRecordId?: string;
        locationId?: string;
        ranchId?: string;
        [key: string]: any;
    };
    public createdBy?: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
    public deletedAt?: Date;

    // Métodos de instancia
    public isExpired(): boolean {
        return !!this.expiresAt && this.expiresAt < new Date();
    }

    public canRetry(): boolean {
        return this.status === NotificationStatus.FAILED &&
            this.retryCount < this.maxRetries;
    }

    public markAsSent(): void {
        this.status = NotificationStatus.SENT;
        this.sentAt = new Date();
    }

    public markAsDelivered(): void {
        this.status = NotificationStatus.DELIVERED;
        this.deliveredAt = new Date();
    }

    public markAsRead(): void {
        this.status = NotificationStatus.READ;
        this.readAt = new Date();
    }

    public markAsFailed(error: string): void {
        this.status = NotificationStatus.FAILED;
        this.error = error;
        this.retryCount += 1;
    }
}

Notification.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE'
        },
        type: {
            type: DataTypes.ENUM(...Object.values(NotificationType)),
            allowNull: false
        },
        channel: {
            type: DataTypes.ENUM(...Object.values(NotificationChannel)),
            allowNull: false
        },
        priority: {
            type: DataTypes.ENUM(...Object.values(NotificationPriority)),
            allowNull: false,
            defaultValue: NotificationPriority.MEDIUM
        },
        title: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        data: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM(...Object.values(NotificationStatus)),
            allowNull: false,
            defaultValue: NotificationStatus.PENDING
        },
        sentAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        deliveredAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        readAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        error: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        retryCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: { min: 0 }
        },
        maxRetries: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 3,
            validate: { min: 1, max: 10 }
        },
        scheduledFor: {
            type: DataTypes.DATE,
            allowNull: true
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {}
        },
        createdBy: {
            type: DataTypes.UUID,
            allowNull: true
        },
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    },
    {
        sequelize,
        modelName: 'Notification',
        tableName: 'notifications',
        timestamps: true,
        paranoid: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['type'] },
            { fields: ['status'] },
            { fields: ['priority'] },
            { fields: ['scheduled_for'] },
            { fields: ['expires_at'] },
            { name: 'notifications_user_status', fields: ['user_id', 'status'] },
            { name: 'notifications_scheduled', fields: ['scheduled_for', 'status'] },
            { name: 'notifications_metadata', fields: ['metadata'], using: 'gin' }
        ]
    }
);

export default Notification;