import { DataTypes, Model, Optional, Sequelize, Op } from 'sequelize';
import User from './User';
import sequelize from '../config/database';

// =============================================
// INTERFACES TYPESCRIPT
// =============================================

interface PasswordResetTokenAttributes {
  id: string;
  user_id: string;
  email: string;
  token: string;
  expires_at: Date;
  used: boolean;
  used_at?: Date | null;
  ip_address?: string | null;
  user_agent?: string | null;
  new_password_hash?: string | null; // DIFERENCIA CLAVE
  created_at: Date;
  updated_at: Date;
}

interface PasswordResetTokenCreationAttributes 
  extends Optional<PasswordResetTokenAttributes, 'id' | 'used' | 'used_at' | 'ip_address' | 'user_agent' | 'new_password_hash' | 'created_at' | 'updated_at'> {}

// =============================================
// CLASE DEL MODELO
// =============================================

export class PasswordResetToken extends Model<
  PasswordResetTokenAttributes,
  PasswordResetTokenCreationAttributes
> implements PasswordResetTokenAttributes {
  
  // Propiedades del modelo
  public id!: string;
  public user_id!: string;
  public email!: string;
  public token!: string;
  public expires_at!: Date;
  public used!: boolean;
  public used_at?: Date | null;
  public ip_address?: string | null;
  public user_agent?: string | null;
  public new_password_hash?: string | null; // DIFERENCIA CLAVE
  public created_at!: Date;
  public updated_at!: Date;

  // =============================================
  // MÉTODOS DE INSTANCIA
  // =============================================

  // Verificar si el token es válido
  public isValid(): boolean {
    return !this.used && this.expires_at > new Date();
  }

  // Marcar token como usado
  public markAsUsed(): void {
    this.used = true;
    this.used_at = new Date();
  }

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

  // Buscar token válido por token string
  static async findByToken(token: string): Promise<PasswordResetToken | null> {
    return await this.findOne({
      where: {
        token: token,
        used: false,
        expires_at: {
          [Op.gt]: new Date()
        }
      }
    });
  }

  // Crear token de reset
  static async createResetToken(
    userId: string,
    email: string,
    token: string,
    newPasswordHash?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<PasswordResetToken> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hora

    return await this.create({
      user_id: userId,
      email,
      token,
      expires_at: expiresAt,
      used: false,
      new_password_hash: newPasswordHash,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }

  // Limpiar tokens expirados
  static async cleanupExpiredTokens(): Promise<number> {
    const result = await this.destroy({
      where: {
        expires_at: {
          [Op.lt]: new Date()
        },
        used: false
      }
    });
    return result;
  }
}

// =============================================
// INICIALIZACIÓN DEL MODELO
// =============================================


  PasswordResetToken.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        comment: 'ID único del token de reset',
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
        comment: 'ID del usuario que solicita el reset',
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          isEmail: true,
        },
        comment: 'Email del usuario (debe coincidir con el email del usuario)',
      },
      token: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          len: [32, 255],
        },
        comment: 'Token único de reset generado con crypto.randomBytes(32)',
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
        comment: 'Fecha y hora de expiración del token (1 hora desde la creación)',
      },
      used: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si el token ya fue utilizado para resetear la contraseña',
      },
      used_at: {
        type: DataTypes.DATE,
        allowNull: true,
        validate: {
          isDate: true,
          logicalConsistency(value: Date | null) {
            if (this.used && !value) {
              throw new Error('used_at debe tener valor si used es TRUE.');
            }
            if (!this.used && value) {
              throw new Error('used_at debe ser NULL si used es FALSE.');
            }
          }
        },
        comment: 'Fecha y hora cuando se utilizó el token (solo si used = true)',
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        validate: {
          isIP: true,
        },
        comment: 'Dirección IP desde donde se solicitó el reset',
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'User agent del navegador que solicitó el reset',
      },
      new_password_hash: { // DIFERENCIA CLAVE
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Hash temporal de la nueva contraseña para validación',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Fecha y hora de creación del token',
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
      tableName: 'password_reset_tokens',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      comment: 'Tokens para reset de contraseña de usuarios. Cada token es único, tiene expiración de 1 hora y no puede reutilizarse.',
      indexes: [
        {
          fields: ['user_id'],
        },
        {
          fields: ['email'],
        },
        {
          fields: ['expires_at'],
        },
        {
          fields: ['token'],
        },
        {
          fields: ['user_id', 'used', 'expires_at'],
          name: 'idx_password_reset_tokens_user_used_expires',
        }
      ],
    }
  );

export default PasswordResetToken;