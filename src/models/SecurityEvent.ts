// ============================================================================
// MODELO: SecurityEvent
// ============================================================================

import { DataTypes, Model, Optional, Sequelize, Op} from 'sequelize';
import User from './User';
import sequelize from '../config/database';

// =============================================
// ENUMS
// =============================================

export enum EventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  EMAIL_VERIFICATION_REQUEST = 'EMAIL_VERIFICATION_REQUEST',
  EMAIL_VERIFICATION_SUCCESS = 'EMAIL_VERIFICATION_SUCCESS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  ADMIN_ACTION = 'ADMIN_ACTION',
  PASSWORD_RESET_FAILED = 'PASSWORD_RESET_FAILED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_RATE_LIMIT_EXCEEDED = "PASSWORD_RESET_RATE_LIMIT_EXCEEDED"
}

export enum EventSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// =============================================
// INTERFACES TYPESCRIPT
// =============================================

interface LocationData {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

interface DeviceInfo {
  type?: string; // mobile, desktop, tablet
  os?: string;
  browser?: string;
  version?: string;
}

interface SecurityEventAttributes {
  id: string;
  user_id?: string | null;
  event_type: EventType;
  severity: EventSeverity;
  description: string;
  ip_address?: string | null;
  user_agent?: string | null;
  location?: LocationData | null;
  device_info?: DeviceInfo | null;
  session_id?: string | null;
  token_id?: string | null;
  additional_data?: Record<string, any> | null;
  resolved: boolean;
  resolved_at?: Date | null;
  resolved_by?: string | null;
  resolution_notes?: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SecurityEventCreationAttributes 
  extends Optional<SecurityEventAttributes, 'id' | 'user_id' | 'ip_address' | 'user_agent' | 'location' | 'device_info' | 'session_id' | 'token_id' | 'additional_data' | 'resolved' | 'resolved_at' | 'resolved_by' | 'resolution_notes' | 'created_at' | 'updated_at'> {}

// =============================================
// CLASE DEL MODELO
// =============================================

export class SecurityEvent extends Model<
  SecurityEventAttributes,
  SecurityEventCreationAttributes
> implements SecurityEventAttributes {
  
  // Propiedades del modelo
  public id!: string;
  public user_id?: string | null;
  public event_type!: EventType;
  public severity!: EventSeverity;
  public description!: string;
  public ip_address?: string | null;
  public user_agent?: string | null;
  public location?: LocationData | null;
  public device_info?: DeviceInfo | null;
  public session_id?: string | null;
  public token_id?: string | null;
  public additional_data?: Record<string, any> | null;
  public resolved!: boolean;
  public resolved_at?: Date | null;
  public resolved_by?: string | null;
  public resolution_notes?: string | null;
  public created_at!: Date;
  public updated_at!: Date;

  // =============================================
  // MÉTODOS DE INSTANCIA
  // =============================================

  // Marcar evento como resuelto
  public markAsResolved(resolvedBy: string, notes?: string): void {
    this.resolved = true;
    this.resolved_at = new Date();
    this.resolved_by = resolvedBy;
    this.resolution_notes = notes;
  }

  // Verificar si es crítico
  public isCritical(): boolean {
    return this.severity === EventSeverity.CRITICAL;
  }

  // Obtener tiempo transcurrido desde el evento
  public getTimeElapsed(): number {
    const now = new Date();
    const diff = now.getTime() - this.created_at.getTime();
    return Math.floor(diff / (1000 * 60)); // minutos
  }

  // =============================================
  // MÉTODOS DE CLASE
  // =============================================

  // Crear evento de seguridad
  static async createSecurityEvent(
    eventType: EventType,
    severity: EventSeverity,
    description: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    location?: LocationData,
    deviceInfo?: DeviceInfo,
    sessionId?: string,
    tokenId?: string,
    additionalData?: Record<string, any>
  ): Promise<SecurityEvent> {
    return await this.create({
      user_id: userId,
      event_type: eventType,
      severity: severity,
      description: description,
      ip_address: ipAddress,
      user_agent: userAgent,
      location: location,
      device_info: deviceInfo,
      session_id: sessionId,
      token_id: tokenId,
      additional_data: additionalData,
      resolved: false
    });
  }

  // Obtener eventos por severidad
  static async getEventsBySeverity(severity: EventSeverity): Promise<SecurityEvent[]> {
    return await this.findAll({
      where: { severity },
      order: [['created_at', 'DESC']]
    });
  }

  // Obtener eventos no resueltos
  static async getUnresolvedEvents(): Promise<SecurityEvent[]> {
    return await this.findAll({
      where: { resolved: false },
      order: [['created_at', 'DESC']]
    });
  }

  // Obtener eventos de un usuario
  static async getUserEvents(userId: string, limit: number = 50): Promise<SecurityEvent[]> {
    return await this.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit
    });
  }

  // Obtener eventos por IP
  static async getEventsByIP(ipAddress: string, limit: number = 50): Promise<SecurityEvent[]> {
    return await this.findAll({
      where: { ip_address: ipAddress },
      order: [['created_at', 'DESC']],
      limit
    });
  }

  // Obtener estadísticas de eventos
  static async getEventStats(days: number = 7): Promise<{
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    critical: number;
    unresolved: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await this.findAll({
      where: {
        created_at: {
          [Op.gte]: startDate
        }
      }
    });

    const stats = {
      total: events.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      critical: 0,
      unresolved: 0
    };

    events.forEach(event => {
      // Contar por tipo
      stats.byType[event.event_type] = (stats.byType[event.event_type] || 0) + 1;
      
      // Contar por severidad
      stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
      
      // Contar críticos
      if (event.severity === EventSeverity.CRITICAL) {
        stats.critical++;
      }
      
      // Contar no resueltos
      if (!event.resolved) {
        stats.unresolved++;
      }
    });

    return stats;
  }
}

// =============================================
// INICIALIZACIÓN DEL MODELO
// =============================================

SecurityEvent.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        comment: 'ID único del evento de seguridad',
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'ID del usuario relacionado con el evento (opcional)',
      },
      event_type: {
        type: DataTypes.ENUM(...Object.values(EventType)),
        allowNull: false,
        validate:{
          isIn:[[EventType.LOGIN_SUCCESS, EventType.LOGIN_FAILED, EventType.LOGOUT, EventType.PASSWORD_CHANGE, 
            EventType.PASSWORD_RESET_REQUEST, EventType.PASSWORD_RESET_SUCCESS, EventType.EMAIL_VERIFICATION_REQUEST, 
            EventType.EMAIL_VERIFICATION_SUCCESS, EventType.ACCOUNT_LOCKED, EventType.ACCOUNT_UNLOCKED, EventType.TOKEN_REVOKED, 
            EventType.SUSPICIOUS_ACTIVITY, EventType.RATE_LIMIT_EXCEEDED, EventType.INVALID_TOKEN, EventType.UNAUTHORIZED_ACCESS, 
            EventType.ADMIN_ACTION, EventType.PASSWORD_RESET_FAILED, EventType.PASSWORD_CHANGED, EventType.PASSWORD_RESET_RATE_LIMIT_EXCEEDED]],
        },
      },
      severity: {
        type: DataTypes.ENUM(...Object.values(EventSeverity)),
        allowNull: false,
        validate:{
          isIn: [[EventSeverity.LOW, EventSeverity.MEDIUM, EventSeverity.HIGH, EventSeverity.CRITICAL]],
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Descripción detallada del evento de seguridad',
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        validate: {
          isIP: true,
        },
        comment: 'Dirección IP desde donde ocurrió el evento',
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'User agent del navegador que generó el evento',
      },
      location: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de geolocalización del evento (JSON)',
      },
      device_info: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Información del dispositivo que generó el evento (JSON)',
      },
      session_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'ID de la sesión relacionada con el evento',
      },
      token_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'ID del token JWT relacionado con el evento',
      },
      additional_data: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Datos adicionales específicos del evento (JSON)',
      },
      resolved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si el evento ha sido resuelto por un administrador',
      },
      resolved_at: {
        type: DataTypes.DATE,
        allowNull: true,
        validate: {
          isDate: true,
        },
        comment: 'Fecha y hora cuando se resolvió el evento',
      },
      resolved_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'ID del usuario que resolvió el evento',
      },
      resolution_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas sobre la resolución del evento',
        },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Fecha y hora de creación del evento',
        },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Fecha y hora de última actualización del evento',
        },
    },
    {
      sequelize,
      tableName: 'security_events',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      comment: 'Auditoría de eventos de seguridad del sistema. Registra todos los eventos importantes como logins, cambios de contraseña, verificaciones de email y actividades sospechosas.',
      indexes: [
        {
          fields: ['user_id'],
        },
        {
          fields: ['event_type'],
        },
        {
          fields: ['severity'],
        },
        {
          fields: ['ip_address'],
        },
        {
          fields: ['created_at'],
        },  
        {
          fields: ['user_id', 'event_type', 'created_at'],
          name: 'idx_security_events_user_type_time',
        },
        {
          fields: ['ip_address', 'event_type', 'created_at'],
          name: 'idx_security_events_ip_type_time',
        },
        {
          fields: ['severity', 'resolved', 'created_at'],
          name: 'idx_security_events_severity_resolved_time',
        }
      ],
    }
  );

export default SecurityEvent;