// ============================================================================
// MIGRACIÓN: password_reset_tokens
// ID: 20250115120001
// Fecha: 2025-01-15T12:00:01.000Z
// ============================================================================

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🚀 Ejecutando migración: password_reset_tokens');
  
  // =============================================
  // CREAR TABLA PASSWORD_RESET_TOKENS
  // =============================================
  
  await queryInterface.createTable('password_reset_tokens', {
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
      comment: 'ID del usuario que solicita reset'
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Email del usuario'
    },
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'Token único de reset'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha de expiración del token (1 hora)'
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
      comment: 'IP desde donde se solicitó el reset'
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User agent del navegador'
    },
    new_password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Hash de la nueva contraseña (temporal)'
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
  await queryInterface.addIndex('password_reset_tokens', ['user_id']);
  await queryInterface.addIndex('password_reset_tokens', ['email']);
  await queryInterface.addIndex('password_reset_tokens', ['token']);
  await queryInterface.addIndex('password_reset_tokens', ['expires_at']);
  await queryInterface.addIndex('password_reset_tokens', ['used']);
  await queryInterface.addIndex('password_reset_tokens', ['created_at']);

  console.log('✅ Migración password_reset_tokens ejecutada correctamente');
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🔄 Revirtiendo migración: password_reset_tokens');
  
  // =============================================
  // ELIMINAR TABLA PASSWORD_RESET_TOKENS
  // =============================================
  
  await queryInterface.dropTable('password_reset_tokens');

  console.log('✅ Migración password_reset_tokens revertida correctamente');
};

export const info = {
  id: '20250115120001',
  name: 'password_reset_tokens',
  description: 'Crear tabla para tokens de reset de contraseña',
  author: 'Sistema de Migraciones',
  version: '1.0.0'
};

