import { sequelize } from '../config/database';
import { QueryTypes } from 'sequelize';

export class DatabaseService {
  /**
   * Ejecuta la función SQL cleanup_expired_tokens()
   * Elimina registros expirados de email_verification_tokens, password_reset_tokens y token_blacklist.
   * @returns número de tokens eliminados
   */
  static async cleanupExpiredTokens(): Promise<number> {
    const result = await sequelize.query<{ cleanup_expired_tokens: number }>(
      'SELECT cleanup_expired_tokens();',
      { type: QueryTypes.SELECT }
    );

    // El resultado puede ser un array o un objeto, dependiendo del driver
    const record = Array.isArray(result) ? result[0] : result;
    return record?.cleanup_expired_tokens ?? 0;
  }

  /**
   * Ejecuta la función SQL get_security_stats(days)
   * Devuelve estadísticas de seguridad (intentos, fallos, IPs únicas, etc.)
   * @param days Número de días hacia atrás (por defecto 7)
   * @returns objeto con métricas agregadas
   */
  static async getSecurityStats(days: number = 7): Promise<any> {
    const result = await sequelize.query(
      'SELECT * FROM get_security_stats(:days);',
      {
        replacements: { days },
        type: QueryTypes.SELECT
      }
    );

    return Array.isArray(result) ? result[0] : result;
  }

  /**
   * Ejecuta la función SQL verify_auth_tables()
   * Verifica la existencia y cantidad de registros en tablas clave.
   * @returns array con { table_name, exists, row_count }
   */
  static async verifyAuthTables(): Promise<any[]> {
    const result = await sequelize.query(
      'SELECT * FROM verify_auth_tables();',
      { type: QueryTypes.SELECT }
    );

    return result as any[];
  }
}
