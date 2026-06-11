// ============================================================================
// MIGRACIÓN: integrity_verification
// ID: 20250115120008
// Fecha: 2025-01-15T12:00:08.000Z
// ============================================================================

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🚀 Ejecutando migración: integrity_verification');
  
  // =============================================
  // VERIFICACIÓN DE INTEGRIDAD DE MIGRACIONES
  // =============================================
  
  const verificationResult = await queryInterface.sequelize.query(`
    SELECT 
      'email_verification_tokens' as table_name,
      EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'email_verification_tokens') as exists,
      (SELECT COUNT(*) FROM email_verification_tokens) as row_count
    UNION ALL
    SELECT 
      'password_reset_tokens' as table_name,
      EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'password_reset_tokens') as exists,
      (SELECT COUNT(*) FROM password_reset_tokens) as row_count
    UNION ALL
    SELECT 
      'token_blacklist' as table_name,
      EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'token_blacklist') as exists,
      (SELECT COUNT(*) FROM token_blacklist) as row_count
    UNION ALL
    SELECT 
      'security_events' as table_name,
      EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'security_events') as exists,
      (SELECT COUNT(*) FROM security_events) as row_count;
  `);

  const tables = verificationResult[0] as any[];
  const existingTables = tables.filter(table => table.exists);
  const missingTables = tables.filter(table => !table.exists);

  console.log('📊 Verificación de integridad de migraciones:');
  console.log('===============================================');
  
  existingTables.forEach(table => {
    console.log(`✅ ${table.table_name} - Existe (${table.row_count} registros)`);
  });
  
  if (missingTables.length > 0) {
    console.log('❌ Tablas faltantes:');
    missingTables.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
  }

  // =============================================
  // VERIFICACIÓN DE ÍNDICES
  // =============================================
  
  const indexVerification = await queryInterface.sequelize.query(`
    SELECT 
      schemaname,
      tablename,
      indexname,
      indexdef
    FROM pg_indexes 
    WHERE tablename IN ('email_verification_tokens', 'password_reset_tokens', 'token_blacklist', 'security_events')
    ORDER BY tablename, indexname;
  `);

  const indexes = indexVerification[0] as any[];
  console.log(`\n📊 Índices encontrados: ${indexes.length}`);
  
  // Agrupar por tabla
  const indexesByTable = indexes.reduce((acc, index) => {
    if (!acc[index.tablename]) {
      acc[index.tablename] = [];
    }
    acc[index.tablename].push(index.indexname);
    return acc;
  }, {});

  Object.entries(indexesByTable as Record<string, string[]>).forEach(([table, tableIndexes]) => {
    console.log(`   ${table}: ${tableIndexes.length} índices`);
  });

  // =============================================
  // VERIFICACIÓN DE CONSTRAINTS
  // =============================================
  
  const constraintVerification = await queryInterface.sequelize.query(`
    SELECT 
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type,
      cc.check_clause
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.check_constraints cc 
      ON tc.constraint_name = cc.constraint_name
    WHERE tc.table_name IN ('email_verification_tokens', 'password_reset_tokens', 'token_blacklist', 'security_events')
    ORDER BY tc.table_name, tc.constraint_type;
  `);

  const constraints = constraintVerification[0] as any[];
  console.log(`\n📊 Constraints encontrados: ${constraints.length}`);
  
  // Agrupar por tabla
  const constraintsByTable = constraints.reduce((acc, constraint) => {
    if (!acc[constraint.table_name]) {
      acc[constraint.table_name] = [];
    }
    acc[constraint.table_name].push(constraint.constraint_name);
    return acc;
  }, {});

  Object.entries(constraintsByTable as Record<string, string[]>).forEach(([table, tableConstraints]) => {
    console.log(`   ${table}: ${tableConstraints.length} constraints`);
  });

  // =============================================
  // VERIFICACIÓN DE FUNCIONES
  // =============================================
  
  const functionVerification = await queryInterface.sequelize.query(`
    SELECT 
      routine_name,
      routine_type,
      data_type
    FROM information_schema.routines 
    WHERE routine_name IN ('cleanup_expired_tokens', 'get_security_stats', 'verify_auth_tables')
    ORDER BY routine_name;
  `);

  const functions = functionVerification[0] as any[];
  console.log(`\n📊 Funciones encontradas: ${functions.length}`);
  
  functions.forEach(func => {
    console.log(`   ✅ ${func.routine_name} (${func.routine_type})`);
  });

  // =============================================
  // RESUMEN FINAL
  // =============================================
  
  const totalTables = 4;
  const existingCount = existingTables.length;
  const successRate = (existingCount / totalTables) * 100;

  console.log('\n===============================================');
  console.log(`📊 RESUMEN DE VERIFICACIÓN:`);
  console.log(`   Tablas: ${existingCount}/${totalTables} (${successRate.toFixed(1)}%)`);
  console.log(`   Índices: ${indexes.length}`);
  console.log(`   Constraints: ${constraints.length}`);
  console.log(`   Funciones: ${functions.length}`);
  
  if (existingCount === totalTables) {
    console.log('✅ Todas las migraciones de autenticación se ejecutaron correctamente');
  } else {
    console.log('❌ Algunas migraciones fallaron o no se ejecutaron');
  }

  console.log('===============================================');

  console.log('✅ Migración integrity_verification ejecutada correctamente');
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🔄 Revirtiendo migración: integrity_verification');
  
  // Esta migración es solo de verificación, no tiene rollback
  console.log('ℹ️  Esta migración es solo de verificación, no requiere rollback');
  
  console.log('✅ Migración integrity_verification revertida correctamente');
};

export const info = {
  id: '20250115120008',
  name: 'integrity_verification',
  description: 'Verificar integridad de todas las migraciones de autenticación',
  author: 'Sistema de Migraciones',
  version: '1.0.0'
};
