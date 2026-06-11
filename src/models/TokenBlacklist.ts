// ============================================================================
// MODELO: TokenBlacklist
// ============================================================================

import { DataTypes, Model, Optional, Sequelize, Op } from 'sequelize';
import User from './User';
import sequelize from '../config/database';

// =============================================
// ENUMS
// =============================================

export enum TokenType {
  ACCESS = 'ACCESS',
  REFRESH = 'REFRESH'
}

export enum RevocationReason {
  LOGOUT = 'LOGOUT',
  LOGOUT_ALL_DEVICES = 'LOGOUT_ALL_DEVICES',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ADMIN_REVOKE = 'ADMIN_REVOKE',
  SECURITY_BREACH = 'SECURITY_BREACH',
  TOKEN_ROTATION = 'TOKEN_ROTATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
}

// =============================================
// INTERFACES TYPESCRIPT
// =============================================

interface TokenBlacklistAttributes {
  id: string;
  user_id: string;
  token_type: TokenType;
  token_jti: string;
  token_hash: string;
  expires_at: Date;
  reason?: RevocationReason | null;
  ip_address?: string | null;
  user_agent?: string | null;
  revoked_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

interface TokenBlacklistCreationAttributes
  extends Optional<TokenBlacklistAttributes, 'id' | 'reason' | 'ip_address' | 'user_agent' | 'revoked_by' | 'created_at' | 'updated_at'> { }

// =============================================
// CLASE DEL MODELO
// =============================================

export class TokenBlacklist extends Model<
  TokenBlacklistAttributes,
  TokenBlacklistCreationAttributes
> implements TokenBlacklistAttributes {

  // Propiedades del modelo
  public id!: string;
  public user_id!: string;
  public token_type!: TokenType;
  public token_jti!: string;
  public token_hash!: string;
  public expires_at!: Date;
  public reason?: RevocationReason | null;
  public ip_address?: string | null;
  public user_agent?: string | null;
  public revoked_by?: string | null;
  public created_at!: Date;
  public updated_at!: Date;

  // =============================================
  // MÉTODOS DE INSTANCIA
  // =============================================

  // Verificar si el token expiró
  public isExpired(): boolean {
    return this.expires_at <= new Date();
  }

  // Obtener tiempo restante en minutos
  public getTimeRemaining(): number {
    const now = new Date();
    const diff = this.expires_at.getTime() - now.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60))); // minutos
  }

  // =============================================
  // MÉTODOS DE CLASE
  // =============================================

  // Verificar si un token está en blacklist
  static async isTokenBlacklisted(tokenJti: string): Promise<boolean> {
    const blacklistedToken = await this.findOne({
      where: {
        token_jti: tokenJti,
        expires_at: {
          [Op.gt]: new Date() // Solo tokens no expirados
        }
      }
    });
    return !!blacklistedToken;
  }

  // Agregar token a blacklist
  static async addToBlacklist(
    userId: string,
    tokenType: TokenType,
    tokenJti: string,
    tokenHash: string,
    expiresAt: Date,
    reason: RevocationReason,
    ipAddress?: string,
    userAgent?: string,
    revokedBy?: string
  ): Promise<TokenBlacklist> {
    return await this.create({
      user_id: userId,
      token_type: tokenType,
      token_jti: tokenJti,
      token_hash: tokenHash,
      expires_at: expiresAt,
      reason: reason,
      ip_address: ipAddress,
      user_agent: userAgent,
      revoked_by: revokedBy
    });
  }

  // Limpiar tokens expirados
  static async cleanupExpiredTokens(): Promise<number> {
    const result = await this.destroy({
      where: {
        expires_at: {
          [Op.lt]: new Date()
        }
      }
    });
    return result;
  }

  // Obtener tokens de un usuario
  static async getUserTokens(userId: string): Promise<TokenBlacklist[]> {
    return await this.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']]
    });
  }
}

// =============================================
// INICIALIZACIÓN DEL MODELO
// =============================================

TokenBlacklist.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del registro de blacklist',
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'ID del usuario propietario del token (opcional)',
    },
    token_type: {
      type: DataTypes.ENUM(...Object.values(TokenType)),
      allowNull: false,
      validate: {
        isIn: [[TokenType.ACCESS, TokenType.REFRESH]],
      },
    },
    token_jti: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'JWT ID único del token para identificación específica',
    },
    token_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Hash del token para búsquedas rápidas sin exponer el token completo',
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: true,
        isAfterCreated(value: Date): void {
          if (this.created_at && value <= this.created_at) {
            throw new Error('La fecha de expiración debe ser posterior a la fecha de creación');
          }
        }
      },
      comment: 'Fecha y hora de expiración del token original',
    },
    reason: {
      type: DataTypes.ENUM(...Object.values(RevocationReason)),
      allowNull: true,
      validate: {
        isIn: [[RevocationReason.LOGOUT,
        RevocationReason.PASSWORD_CHANGE,
        RevocationReason.ACCOUNT_LOCKED,
        RevocationReason.ADMIN_REVOKE,
        RevocationReason.SECURITY_BREACH,
        RevocationReason.TOKEN_ROTATION,
        RevocationReason.PASSWORD_RESET,
        RevocationReason.ACCOUNT_DELETED,
        RevocationReason.ACCOUNT_SUSPENDED,
        RevocationReason.LOGOUT_ALL_DEVICES]],
      },
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      validate: {
        isIP: true,
      },
      comment: 'Dirección IP desde donde se revocó el token',
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User agent del navegador que revocó el token',
    },
    revoked_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'ID del usuario que revocó el token (opcional)',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha y hora de creación del registro',
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha y hora de última actualización del registro',
    },
  },
  {
    sequelize,
    tableName: 'token_blacklist',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    comment: 'Lista negra de tokens JWT revocados. Incluye tokens de acceso y refresh que han sido invalidados por logout, cambio de contraseña u otras razones de seguridad.',
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['token_jti'],
        unique: true,
      },
      {
        fields: ['expires_at'],
      },
      {
        fields: ['token_hash', 'expires_at'],
      },
      {
        fields: ['token_hash', 'expires_at'],
        name: 'idx_token_blacklist_lookup',
      },
      {
        fields: ['user_id', 'token_type', 'created_at'],
        name: 'idx_token_blacklist_user_type_time',
      }
    ],
  }
);


export default TokenBlacklist;