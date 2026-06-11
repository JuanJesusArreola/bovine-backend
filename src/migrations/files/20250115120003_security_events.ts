// ============================================================================
// MIGRACIÓN: security_events
// ID: 20250115120003
// Fecha: 2025-01-15T12:00:03.000Z
// ============================================================================

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🚀 Ejecutando migración: security_events');
  
  // =============================================
  // CREAR TABLA SECURITY_EVENTS
  // =============================================
  
  await queryInterface.createTable('security_events', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      comment: 'ID único del evento'
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'ID del usuario relacionado (opcional)'
    },
    event_type: {
      type: DataTypes.ENUM(
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'LOGOUT',
        'PASSWORD_CHANGE',
        'PASSWORD_RESET_REQUEST',
        'PASSWORD_RESET_SUCCESS',
        'EMAIL_VERIFICATION_REQUEST',
        'EMAIL_VERIFICATION_SUCCESS',
        'ACCOUNT_LOCKED',
        'ACCOUNT_UNLOCKED',
        'TOKEN_REVOKED',
        'SUSPICIOUS_ACTIVITY',
        'RATE_LIMIT_EXCEEDED',
        'INVALID_TOKEN',
        'UNAUTHORIZED_ACCESS',
        'ADMIN_ACTION'
      ),
      allowNull: false,
      comment: 'Tipo de evento de seguridad'
    },
    severity: {
      type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
      allowNull: false,
      defaultValue: 'LOW',
      comment: 'Severidad del evento'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Descripción detallada del evento'
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'Dirección IP del evento'
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User agent del navegador'
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de geolocalización (ciudad, país, etc.)'
    },
    device_info: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información del dispositivo (tipo, OS, etc.)'
    },
    session_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'ID de la sesión relacionada'
    },
    token_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'ID del token JWT relacionado'
    },
    additional_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Datos adicionales específicos del evento'
    },
    resolved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si el evento ha sido resuelto'
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha cuando se resolvió el evento'
    },
    resolved_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'ID del usuario que resolvió el evento'
    },
    resolution_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas sobre la resolución del evento'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de creación del evento'
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de última actualización'
    }
  });

  // Crear índices para optimizar consultas
  await queryInterface.addIndex('security_events', ['user_id']);
  await queryInterface.addIndex('security_events', ['event_type']);
  await queryInterface.addIndex('security_events', ['severity']);
  await queryInterface.addIndex('security_events', ['ip_address']);
  await queryInterface.addIndex('security_events', ['session_id']);
  await queryInterface.addIndex('security_events', ['resolved']);
  await queryInterface.addIndex('security_events', ['created_at']);

  // Índices compuestos para consultas frecuentes
  await queryInterface.addIndex('security_events', ['user_id', 'event_type', 'created_at'], {
    name: 'security_events_user_type_time'
  });
  
  await queryInterface.addIndex('security_events', ['ip_address', 'event_type', 'created_at'], {
    name: 'security_events_ip_type_time'
  });

  await queryInterface.addIndex('security_events', ['severity', 'resolved', 'created_at'], {
    name: 'security_events_severity_resolved_time'
  });

  console.log('✅ Migración security_events ejecutada correctamente');
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🔄 Revirtiendo migración: security_events');
  
  // =============================================
  // ELIMINAR TABLA SECURITY_EVENTS
  // =============================================
  
  await queryInterface.dropTable('security_events');

  console.log('✅ Migración security_events revertida correctamente');
};

export const info = {
  id: '20250115120003',
  name: 'security_events',
  description: 'Crear tabla para auditoría de eventos de seguridad',
  author: 'Sistema de Migraciones',
  version: '1.0.0'
};

