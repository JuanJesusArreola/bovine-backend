// ============================================================================
// MIGRACIÓN: utility_functions
// ID: 20250115120004
// Fecha: 2025-01-15T12:00:04.000Z
// ============================================================================

import { QueryInterface } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🚀 Ejecutando migración: utility_functions');

  // ============================================================================
  // FUNCIÓN 1: LIMPIAR TOKENS EXPIRADOS (usando WITH ... RETURNING para contar)
  // ============================================================================
  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
    RETURNS INTEGER AS $$
    DECLARE
        deleted_count INTEGER := 0;
    BEGIN
        -- Usamos WITH ... RETURNING para obtener el número de filas eliminadas de forma segura
        WITH d1 AS (
          DELETE FROM email_verification_tokens
          WHERE expires_at < NOW() AND used = FALSE
          RETURNING 1
        ), d2 AS (
          DELETE FROM password_reset_tokens
          WHERE expires_at < NOW() AND used = FALSE
          RETURNING 1
        ), d3 AS (
          DELETE FROM token_blacklist
          WHERE expires_at < NOW() - INTERVAL '30 days'
          RETURNING 1
        )
        SELECT COALESCE((SELECT COUNT(*) FROM d1),0)
             + COALESCE((SELECT COUNT(*) FROM d2),0)
             + COALESCE((SELECT COUNT(*) FROM d3),0)
        INTO deleted_count;

        RETURN deleted_count;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // ============================================================================
  // FUNCIÓN 2: ESTADÍSTICAS DE SEGURIDAD (con chequeo de existencia de tabla)
  // ============================================================================
  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION public.get_security_stats(days INTEGER DEFAULT 7)
    RETURNS TABLE (
        total_events BIGINT,
        login_attempts BIGINT,
        failed_logins BIGINT,
        password_resets BIGINT,
        email_verifications BIGINT,
        critical_events BIGINT,
        unique_ips BIGINT
    ) AS $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_events') THEN
          RETURN QUERY SELECT 0::BIGINT,0::BIGINT,0::BIGINT,0::BIGINT,0::BIGINT,0::BIGINT,0::BIGINT;
          RETURN;
        END IF;

        RETURN QUERY
        SELECT 
            COUNT(*)::BIGINT as total_events,
            COUNT(*) FILTER (WHERE event_type IN ('LOGIN_SUCCESS','LOGIN_FAILED'))::BIGINT as login_attempts,
            COUNT(*) FILTER (WHERE event_type = 'LOGIN_FAILED')::BIGINT as failed_logins,
            COUNT(*) FILTER (WHERE event_type = 'PASSWORD_RESET_REQUEST')::BIGINT as password_resets,
            COUNT(*) FILTER (WHERE event_type = 'EMAIL_VERIFICATION_REQUEST')::BIGINT as email_verifications,
            COUNT(*) FILTER (WHERE severity = 'CRITICAL')::BIGINT as critical_events,
            COUNT(DISTINCT ip_address)::BIGINT as unique_ips
        FROM security_events 
        WHERE created_at >= NOW() - (INTERVAL '1 day' * days);
    END;
    $$ LANGUAGE plpgsql;
  `);

  // ============================================================================
  // FUNCIÓN 3: VERIFICAR INTEGRIDAD DE TABLAS DE AUTENTICACIÓN
  // ============================================================================
  await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION public.verify_auth_tables()
    RETURNS TABLE (
        table_name TEXT,
        "exists" BOOLEAN,
        row_count BIGINT
    ) AS $$
    BEGIN
        RETURN QUERY
        SELECT 
            'email_verification_tokens'::TEXT,
            EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'email_verification_tokens'),
            COALESCE((SELECT COUNT(*) FROM email_verification_tokens), 0)
        UNION ALL
        SELECT 
            'password_reset_tokens',
            EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'password_reset_tokens'),
            COALESCE((SELECT COUNT(*) FROM password_reset_tokens), 0)
        UNION ALL
        SELECT 
            'token_blacklist',
            EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'token_blacklist'),
            COALESCE((SELECT COUNT(*) FROM token_blacklist), 0)
        UNION ALL
        SELECT 
            'security_events',
            EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'security_events'),
            COALESCE((SELECT COUNT(*) FROM security_events), 0);
    END;
    $$ LANGUAGE plpgsql;
  `);

  console.log('✅ Migración utility_functions ejecutada correctamente');
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🔄 Revirtiendo migración: utility_functions');

  await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS public.cleanup_expired_tokens() CASCADE;');
  await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS public.get_security_stats(INTEGER) CASCADE;');
  await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS public.verify_auth_tables() CASCADE;');

  console.log('✅ Migración utility_functions revertida correctamente');
};

export const info = {
  id: '20250115120004',
  name: 'utility_functions',
  description: 'Crear funciones PL/pgSQL para mantenimiento y auditoría de autenticación',
  author: 'Sistema de Migraciones',
  version: '1.0.1'
};
