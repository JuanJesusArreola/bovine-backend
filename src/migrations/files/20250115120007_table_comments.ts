// ============================================================================
// MIGRACIÓN: table_comments
// ID: 20250115120007
// Fecha: 2025-01-15T12:00:07.000Z
// ============================================================================

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🚀 Ejecutando migración: table_comments');
  
  // =============================================
  // COMENTARIOS EN TABLAS
  // =============================================
  
  await queryInterface.sequelize.query(`
    COMMENT ON TABLE email_verification_tokens IS 'Tokens para verificación de email de usuarios. Cada token es único, tiene expiración de 24 horas y no puede reutilizarse.';
  `);
  
  await queryInterface.sequelize.query(`
    COMMENT ON TABLE password_reset_tokens IS 'Tokens para reset de contraseña de usuarios. Cada token es único, tiene expiración de 1 hora y no puede reutilizarse.';
  `);
  
  await queryInterface.sequelize.query(`
    COMMENT ON TABLE token_blacklist IS 'Lista negra de tokens JWT revocados. Incluye tokens de acceso y refresh que han sido invalidados por logout, cambio de contraseña u otras razones de seguridad.';
  `);
  
  await queryInterface.sequelize.query(`
    COMMENT ON TABLE security_events IS 'Auditoría de eventos de seguridad del sistema. Registra todos los eventos importantes como logins, cambios de contraseña, verificaciones de email y actividades sospechosas.';
  `);

  // =============================================
  // COMENTARIOS EN COLUMNAS DE EMAIL_VERIFICATION_TOKENS
  // =============================================
  
  await queryInterface.sequelize.query(`
    COMMENT ON COLUMN email_verification_tokens.id IS 'ID único del token de verificación';
    COMMENT ON COLUMN email_verification_tokens.user_id IS 'ID del usuario que solicita la verificación';
    COMMENT ON COLUMN email_verification_tokens.email IS 'Email a verificar (debe coincidir con el email del usuario)';
    COMMENT ON COLUMN email_verification_tokens.token IS 'Token único de verificación generado con crypto.randomBytes(32)';
    COMMENT ON COLUMN email_verification_tokens.expires_at IS 'Fecha y hora de expiración del token (24 horas desde la creación)';
    COMMENT ON COLUMN email_verification_tokens.used IS 'Indica si el token ya fue utilizado para verificar el email';
    COMMENT ON COLUMN email_verification_tokens.used_at IS 'Fecha y hora cuando se utilizó el token (solo si used = true)';
    COMMENT ON COLUMN email_verification_tokens.ip_address IS 'Dirección IP desde donde se solicitó la verificación';
    COMMENT ON COLUMN email_verification_tokens.user_agent IS 'User agent del navegador que solicitó la verificación';
    COMMENT ON COLUMN email_verification_tokens.created_at IS 'Fecha y hora de creación del token';
    COMMENT ON COLUMN email_verification_tokens.updated_at IS 'Fecha y hora de última actualización del registro';
  `);

  // =============================================
  // COMENTARIOS EN COLUMNAS DE PASSWORD_RESET_TOKENS
  // =============================================
  
  await queryInterface.sequelize.query(`
    COMMENT ON COLUMN password_reset_tokens.id IS 'ID único del token de reset';
    COMMENT ON COLUMN password_reset_tokens.user_id IS 'ID del usuario que solicita el reset';
    COMMENT ON COLUMN password_reset_tokens.email IS 'Email del usuario (debe coincidir con el email del usuario)';
    COMMENT ON COLUMN password_reset_tokens.token IS 'Token único de reset generado con crypto.randomBytes(32)';
    COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Fecha y hora de expiración del token (1 hora desde la creación)';
    COMMENT ON COLUMN password_reset_tokens.used IS 'Indica si el token ya fue utilizado para resetear la contraseña';
    COMMENT ON COLUMN password_reset_tokens.used_at IS 'Fecha y hora cuando se utilizó el token (solo si used = true)';
    COMMENT ON COLUMN password_reset_tokens.ip_address IS 'Dirección IP desde donde se solicitó el reset';
    COMMENT ON COLUMN password_reset_tokens.user_agent IS 'User agent del navegador que solicitó el reset';
    COMMENT ON COLUMN password_reset_tokens.new_password_hash IS 'Hash temporal de la nueva contraseña para validación';
    COMMENT ON COLUMN password_reset_tokens.created_at IS 'Fecha y hora de creación del token';
    COMMENT ON COLUMN password_reset_tokens.updated_at IS 'Fecha y hora de última actualización del registro';
  `);

  // =============================================
  // COMENTARIOS EN COLUMNAS DE TOKEN_BLACKLIST
  // =============================================
  
  await queryInterface.sequelize.query(`
    COMMENT ON COLUMN token_blacklist.id IS 'ID único del registro de blacklist';
    COMMENT ON COLUMN token_blacklist.user_id IS 'ID del usuario propietario del token (opcional)';
    COMMENT ON COLUMN token_blacklist.token_type IS 'Tipo de token: ACCESS (acceso) o REFRESH (renovación)';
    COMMENT ON COLUMN token_blacklist.token_jti IS 'JWT ID único del token para identificación específica';
    COMMENT ON COLUMN token_blacklist.token_hash IS 'Hash del token para búsquedas rápidas sin exponer el token completo';
    COMMENT ON COLUMN token_blacklist.expires_at IS 'Fecha y hora de expiración del token original';
    COMMENT ON COLUMN token_blacklist.reason IS 'Razón por la cual se revocó el token: LOGOUT, PASSWORD_CHANGE, etc.';
    COMMENT ON COLUMN token_blacklist.ip_address IS 'Dirección IP desde donde se revocó el token';
    COMMENT ON COLUMN token_blacklist.user_agent IS 'User agent del navegador que revocó el token';
    COMMENT ON COLUMN token_blacklist.revoked_by IS 'ID del usuario que revocó el token (opcional)';
    COMMENT ON COLUMN token_blacklist.created_at IS 'Fecha y hora de creación del registro';
    COMMENT ON COLUMN token_blacklist.updated_at IS 'Fecha y hora de última actualización del registro';
  `);

  // =============================================
  // COMENTARIOS EN COLUMNAS DE SECURITY_EVENTS
  // =============================================
  
  await queryInterface.sequelize.query(`
    COMMENT ON COLUMN security_events.id IS 'ID único del evento de seguridad';
    COMMENT ON COLUMN security_events.user_id IS 'ID del usuario relacionado con el evento (opcional)';
    COMMENT ON COLUMN security_events.event_type IS 'Tipo de evento: LOGIN_SUCCESS, LOGIN_FAILED, PASSWORD_CHANGE, etc.';
    COMMENT ON COLUMN security_events.severity IS 'Severidad del evento: LOW, MEDIUM, HIGH, CRITICAL';
    COMMENT ON COLUMN security_events.description IS 'Descripción detallada del evento de seguridad';
    COMMENT ON COLUMN security_events.ip_address IS 'Dirección IP desde donde ocurrió el evento';
    COMMENT ON COLUMN security_events.user_agent IS 'User agent del navegador que generó el evento';
    COMMENT ON COLUMN security_events.location IS 'Información de geolocalización del evento (JSON)';
    COMMENT ON COLUMN security_events.device_info IS 'Información del dispositivo que generó el evento (JSON)';
    COMMENT ON COLUMN security_events.session_id IS 'ID de la sesión relacionada con el evento';
    COMMENT ON COLUMN security_events.token_id IS 'ID del token JWT relacionado con el evento';
    COMMENT ON COLUMN security_events.additional_data IS 'Datos adicionales específicos del evento (JSON)';
    COMMENT ON COLUMN security_events.resolved IS 'Indica si el evento ha sido resuelto por un administrador';
    COMMENT ON COLUMN security_events.resolved_at IS 'Fecha y hora cuando se resolvió el evento';
    COMMENT ON COLUMN security_events.resolved_by IS 'ID del usuario que resolvió el evento';
    COMMENT ON COLUMN security_events.resolution_notes IS 'Notas sobre la resolución del evento';
    COMMENT ON COLUMN security_events.created_at IS 'Fecha y hora de creación del evento';
    COMMENT ON COLUMN security_events.updated_at IS 'Fecha y hora de última actualización del evento';
  `);

  console.log('✅ Migración table_comments ejecutada correctamente');
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🔄 Revirtiendo migración: table_comments');
  
  // =============================================
  // ELIMINAR COMENTARIOS
  // =============================================
  
  // Los comentarios se eliminan automáticamente al eliminar las tablas
  // No es necesario eliminar comentarios individualmente
  
  console.log('✅ Migración table_comments revertida correctamente');
};

export const info = {
  id: '20250115120007',
  name: 'table_comments',
  description: 'Agregar comentarios y documentación a las tablas',
  author: 'Sistema de Migraciones',
  version: '1.0.0'
};
