// ============================================================================
// MIGRACIÓN: token_blacklist
// ID: 20250115120002
// Fecha: 2025-01-15T12:00:02.000Z
// ============================================================================

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🚀 Ejecutando migración: token_blacklist');
  
  // =============================================
  // CREAR TABLA TOKEN_BLACKLIST
  // =============================================
  
  await queryInterface.createTable('token_blacklist', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      comment: 'ID único del registro'
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
      comment: 'ID del usuario (opcional)'
    },
    token_type: {
      type: DataTypes.ENUM('ACCESS', 'REFRESH'),
      allowNull: false,
      comment: 'Tipo de token (ACCESS o REFRESH)'
    },
    token_jti: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'JWT ID del token'
    },
    token_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Hash del token para búsqueda rápida'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha de expiración del token'
    },
    reason: {
      type: DataTypes.ENUM('LOGOUT', 'PASSWORD_CHANGE', 'ACCOUNT_LOCKED', 'ADMIN_REVOKE', 'SECURITY_BREACH'),
      allowNull: false,
      comment: 'Razón por la cual se revocó el token'
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'IP desde donde se revocó el token'
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User agent del navegador'
    },
    revoked_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'ID del usuario que revocó el token'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de creación del registro'
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de última actualización'
    }
  });

  // Crear índices para optimizar consultas
  await queryInterface.addIndex('token_blacklist', ['user_id']);
  await queryInterface.addIndex('token_blacklist', ['token_type']);
  await queryInterface.addIndex('token_blacklist', ['token_jti']);
  await queryInterface.addIndex('token_blacklist', ['token_hash']);
  await queryInterface.addIndex('token_blacklist', ['expires_at']);
  await queryInterface.addIndex('token_blacklist', ['reason']);
  await queryInterface.addIndex('token_blacklist', ['created_at']);

  // Índice compuesto para búsquedas frecuentes
  await queryInterface.addIndex('token_blacklist', ['token_hash', 'expires_at'], {
    name: 'token_blacklist_lookup'
  });

  console.log('✅ Migración token_blacklist ejecutada correctamente');
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🔄 Revirtiendo migración: token_blacklist');
  
  // =============================================
  // ELIMINAR TABLA TOKEN_BLACKLIST
  // =============================================
  
  await queryInterface.dropTable('token_blacklist');

  console.log('✅ Migración token_blacklist revertida correctamente');
};

export const info = {
  id: '20250115120002',
  name: 'token_blacklist',
  description: 'Crear tabla para blacklist de tokens JWT revocados',
  author: 'Sistema de Migraciones',
  version: '1.0.0'
};

