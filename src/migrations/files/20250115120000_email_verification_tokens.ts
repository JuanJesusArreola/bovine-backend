// ============================================================================
// MIGRACIÓN: email_verification_tokens
// ID: 20250115120000
// Fecha: 2025-01-15T12:00:00.000Z
// ============================================================================

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🚀 Ejecutando migración: email_verification_tokens');
  
  // =============================================
  // CREAR TABLA EMAIL_VERIFICATION_TOKENS
  // =============================================
  
  await queryInterface.createTable('email_verification_tokens', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      comment: 'ID único del token'
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'ID del usuario que solicita verificación'
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Email a verificar'
    },
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'Token único de verificación'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha de expiración del token'
    },
    used: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si el token ya fue usado'
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha cuando se usó el token'
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'IP desde donde se solicitó la verificación'
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User agent del navegador'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de creación del token'
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de última actualización'
    }
  });

  // Crear índices para optimizar consultas
  await queryInterface.addIndex('email_verification_tokens', ['user_id']);
  await queryInterface.addIndex('email_verification_tokens', ['email']);
  await queryInterface.addIndex('email_verification_tokens', ['token']);
  await queryInterface.addIndex('email_verification_tokens', ['expires_at']);
  await queryInterface.addIndex('email_verification_tokens', ['used']);
  await queryInterface.addIndex('email_verification_tokens', ['created_at']);

  console.log('✅ Migración email_verification_tokens ejecutada correctamente');
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🔄 Revirtiendo migración: email_verification_tokens');
  
  // =============================================
  // ELIMINAR TABLA EMAIL_VERIFICATION_TOKENS
  // =============================================
  
  await queryInterface.dropTable('email_verification_tokens');

  console.log('✅ Migración email_verification_tokens revertida correctamente');
};

export const info = {
  id: '20250115120000',
  name: 'email_verification_tokens',
  description: 'Crear tabla para tokens de verificación de email',
  author: 'Sistema de Migraciones',
  version: '1.0.0'
};

