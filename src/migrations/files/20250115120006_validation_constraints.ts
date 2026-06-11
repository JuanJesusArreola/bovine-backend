// ============================================================================
// MIGRACIÓN: validation_constraints
// ID: 20250115120006
// Fecha: 2025-01-15T12:00:06.000Z
// ============================================================================

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🚀 Ejecutando migración: validation_constraints');
  
  // =============================================
  // CONSTRAINTS PARA TOKEN_BLACKLIST
  // =============================================
  
  // Constraint para token_type
  await queryInterface.sequelize.query(`
    ALTER TABLE token_blacklist 
    ADD CONSTRAINT chk_token_blacklist_token_type 
    CHECK (token_type IN ('ACCESS', 'REFRESH'))
  `);
  
  // Constraint para reason
  await queryInterface.sequelize.query(`
    ALTER TABLE token_blacklist 
    ADD CONSTRAINT chk_token_blacklist_reason 
    CHECK (reason IN ('LOGOUT', 'PASSWORD_CHANGE', 'ACCOUNT_LOCKED', 'ADMIN_REVOKE', 'SECURITY_BREACH'))
  `);

  // =============================================
  // CONSTRAINTS PARA SECURITY_EVENTS
  // =============================================
  
  // Constraint para event_type
  await queryInterface.sequelize.query(`
    ALTER TABLE security_events 
    ADD CONSTRAINT chk_security_events_event_type 
    CHECK (event_type IN (
        'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGE',
        'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_SUCCESS', 'EMAIL_VERIFICATION_REQUEST',
        'EMAIL_VERIFICATION_SUCCESS', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED',
        'TOKEN_REVOKED', 'SUSPICIOUS_ACTIVITY', 'RATE_LIMIT_EXCEEDED',
        'INVALID_TOKEN', 'UNAUTHORIZED_ACCESS', 'ADMIN_ACTION'
    ))
  `);
  
  // Constraint para severity
  await queryInterface.sequelize.query(`
    ALTER TABLE security_events 
    ADD CONSTRAINT chk_security_events_severity 
    CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
  `);

  // =============================================
  // CONSTRAINTS PARA EMAIL_VERIFICATION_TOKENS
  // =============================================
  
  // Constraint para email válido
  await queryInterface.sequelize.query(`
    ALTER TABLE email_verification_tokens 
    ADD CONSTRAINT chk_email_verification_tokens_email 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
  `);
  
  // Constraint para token no vacío
  await queryInterface.sequelize.query(`
    ALTER TABLE email_verification_tokens 
    ADD CONSTRAINT chk_email_verification_tokens_token 
    CHECK (LENGTH(token) >= 32)
  `);

  // =============================================
  // CONSTRAINTS PARA PASSWORD_RESET_TOKENS
  // =============================================
  
  // Constraint para email válido
  await queryInterface.sequelize.query(`
    ALTER TABLE password_reset_tokens 
    ADD CONSTRAINT chk_password_reset_tokens_email 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
  `);
  
  // Constraint para token no vacío
  await queryInterface.sequelize.query(`
    ALTER TABLE password_reset_tokens 
    ADD CONSTRAINT chk_password_reset_tokens_token 
    CHECK (LENGTH(token) >= 32)
  `);

  // =============================================
  // CONSTRAINTS DE INTEGRIDAD TEMPORAL
  // =============================================
  
  // Constraint para expires_at debe ser futuro
  await queryInterface.sequelize.query(`
    ALTER TABLE email_verification_tokens 
    ADD CONSTRAINT chk_email_verification_tokens_expires_future 
    CHECK (expires_at > created_at)
  `);
  
  await queryInterface.sequelize.query(`
    ALTER TABLE password_reset_tokens 
    ADD CONSTRAINT chk_password_reset_tokens_expires_future 
    CHECK (expires_at > created_at)
  `);
  
  await queryInterface.sequelize.query(`
    ALTER TABLE token_blacklist 
    ADD CONSTRAINT chk_token_blacklist_expires_future 
    CHECK (expires_at > created_at)
  `);

  // =============================================
  // CONSTRAINTS DE LÓGICA DE NEGOCIO
  // =============================================
  
  // Constraint para used_at solo si used es true
  await queryInterface.sequelize.query(`
    ALTER TABLE email_verification_tokens 
    ADD CONSTRAINT chk_email_verification_tokens_used_logic 
    CHECK ((used = FALSE AND used_at IS NULL) OR (used = TRUE AND used_at IS NOT NULL))
  `);
  
  await queryInterface.sequelize.query(`
    ALTER TABLE password_reset_tokens 
    ADD CONSTRAINT chk_password_reset_tokens_used_logic 
    CHECK ((used = FALSE AND used_at IS NULL) OR (used = TRUE AND used_at IS NOT NULL))
  `);

  console.log('✅ Migración validation_constraints ejecutada correctamente');
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🔄 Revirtiendo migración: validation_constraints');
  
  // =============================================
  // ELIMINAR CONSTRAINTS DE VALIDACIÓN
  // =============================================
  
  // Token Blacklist
  await queryInterface.sequelize.query('ALTER TABLE token_blacklist DROP CONSTRAINT IF EXISTS chk_token_blacklist_token_type');
  await queryInterface.sequelize.query('ALTER TABLE token_blacklist DROP CONSTRAINT IF EXISTS chk_token_blacklist_reason');
  await queryInterface.sequelize.query('ALTER TABLE token_blacklist DROP CONSTRAINT IF EXISTS chk_token_blacklist_expires_future');
  
  // Security Events
  await queryInterface.sequelize.query('ALTER TABLE security_events DROP CONSTRAINT IF EXISTS chk_security_events_event_type');
  await queryInterface.sequelize.query('ALTER TABLE security_events DROP CONSTRAINT IF EXISTS chk_security_events_severity');
  
  // Email Verification Tokens
  await queryInterface.sequelize.query('ALTER TABLE email_verification_tokens DROP CONSTRAINT IF EXISTS chk_email_verification_tokens_email');
  await queryInterface.sequelize.query('ALTER TABLE email_verification_tokens DROP CONSTRAINT IF EXISTS chk_email_verification_tokens_token');
  await queryInterface.sequelize.query('ALTER TABLE email_verification_tokens DROP CONSTRAINT IF EXISTS chk_email_verification_tokens_expires_future');
  await queryInterface.sequelize.query('ALTER TABLE email_verification_tokens DROP CONSTRAINT IF EXISTS chk_email_verification_tokens_used_logic');
  
  // Password Reset Tokens
  await queryInterface.sequelize.query('ALTER TABLE password_reset_tokens DROP CONSTRAINT IF EXISTS chk_password_reset_tokens_email');
  await queryInterface.sequelize.query('ALTER TABLE password_reset_tokens DROP CONSTRAINT IF EXISTS chk_password_reset_tokens_token');
  await queryInterface.sequelize.query('ALTER TABLE password_reset_tokens DROP CONSTRAINT IF EXISTS chk_password_reset_tokens_expires_future');
  await queryInterface.sequelize.query('ALTER TABLE password_reset_tokens DROP CONSTRAINT IF EXISTS chk_password_reset_tokens_used_logic');

  console.log('✅ Migración validation_constraints revertida correctamente');
};

export const info = {
  id: '20250115120006',
  name: 'validation_constraints',
  description: 'Agregar constraints de validación para integridad de datos',
  author: 'Sistema de Migraciones',
  version: '1.0.0'
};
