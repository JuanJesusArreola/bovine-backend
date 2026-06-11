// ============================================================================
// MIGRACIÓN: composite_indexes
// ID: 20250115120005
// Fecha: 2025-01-15T12:00:05.000Z
// ============================================================================

import { QueryInterface } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🚀 Ejecutando migración: composite_indexes');
  
  // =============================================
  // ÍNDICES COMPUESTOS PARA SECURITY_EVENTS
  // =============================================

  await queryInterface.addIndex('security_events', {
    fields: ['user_id', 'event_type', 'created_at'],
    name: 'idx_security_events_user_type_time',
  });

  await queryInterface.addIndex('security_events', {
    fields: ['ip_address', 'event_type', 'created_at'],
    name: 'idx_security_events_ip_type_time',
  });

  await queryInterface.addIndex('security_events', {
    fields: ['severity', 'resolved', 'created_at'],
    name: 'idx_security_events_severity_resolved_time',
  });

  // =============================================
  // ÍNDICES COMPUESTOS PARA TOKEN_BLACKLIST
  // =============================================

  await queryInterface.addIndex('token_blacklist', {
    fields: ['token_hash', 'expires_at'],
    name: 'idx_token_blacklist_lookup',
  });

  await queryInterface.addIndex('token_blacklist', {
    fields: ['user_id', 'token_type', 'created_at'],
    name: 'idx_token_blacklist_user_type_time',
  });

  // =============================================
  // ÍNDICES COMPUESTOS PARA EMAIL_VERIFICATION_TOKENS
  // =============================================

  await queryInterface.addIndex('email_verification_tokens', {
    fields: ['user_id', 'used', 'expires_at'],
    name: 'idx_email_verification_tokens_user_used_expires',
  });

  // =============================================
  // ÍNDICES COMPUESTOS PARA PASSWORD_RESET_TOKENS
  // =============================================

  await queryInterface.addIndex('password_reset_tokens', {
    fields: ['user_id', 'used', 'expires_at'],
    name: 'idx_password_reset_tokens_user_used_expires',
  });

  console.log('✅ Migración composite_indexes ejecutada correctamente');
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🔄 Revirtiendo migración: composite_indexes');
  
  await queryInterface.removeIndex('security_events', 'idx_security_events_user_type_time');
  await queryInterface.removeIndex('security_events', 'idx_security_events_ip_type_time');
  await queryInterface.removeIndex('security_events', 'idx_security_events_severity_resolved_time');
  
  await queryInterface.removeIndex('token_blacklist', 'idx_token_blacklist_lookup');
  await queryInterface.removeIndex('token_blacklist', 'idx_token_blacklist_user_type_time');
  
  await queryInterface.removeIndex('email_verification_tokens', 'idx_email_verification_tokens_user_used_expires');
  await queryInterface.removeIndex('password_reset_tokens', 'idx_password_reset_tokens_user_used_expires');

  console.log('✅ Migración composite_indexes revertida correctamente');
};

export const info = {
  id: '20250115120005',
  name: 'composite_indexes',
  description: 'Crear índices compuestos para optimización de consultas',
  author: 'Sistema de Migraciones',
  version: '1.0.1'
};
