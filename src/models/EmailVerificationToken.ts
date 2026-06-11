
import { DataTypes, Model, Optional, Sequelize, Op } from 'sequelize';
import User from './User'; // Importar modelo User para relaciones
import sequelize from '../config/database';

// =============================================
// INTERFACES TYPESCRIPT
// =============================================

// Interface para atributos requeridos al crear
interface EmailVerificationTokenAttributes {
  id: string;
  user_id: string;
  email: string;
  token: string;
  expires_at: Date;
  used: boolean;
  used_at?: Date | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: Date;
  updated_at: Date;
}

// Interface para atributos opcionales al crear
interface EmailVerificationTokenCreationAttributes
  extends Optional<EmailVerificationTokenAttributes, 'id' | 'used' | 'used_at' | 'ip_address' | 'user_agent' | 'created_at' | 'updated_at'> { }

// =============================================
// CLASE DEL MODELO
// =============================================

export class EmailVerificationToken extends Model<
  EmailVerificationTokenAttributes,
  EmailVerificationTokenCreationAttributes
> implements EmailVerificationTokenAttributes {

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
  static async findByToken(token: string): Promise<EmailVerificationToken | null> {
    return await this.findOne({
      where: { token },
      include: [User] // Incluir información del usuario
    });
  }

  // Buscar tokens expirados
  static async findExpiredTokens(): Promise<EmailVerificationToken[]> {
    return await this.findAll({
      where: {
        expires_at: {
          [Op.lt]: new Date()
        }
      }
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

  // Crear token de verificación
  static async createVerificationToken(
    userId: string,
    email: string,
    token: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<EmailVerificationToken> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 horas

    return await this.create({
      user_id: userId,
      email,
      token,
      expires_at: expiresAt,
      used: false,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }
}

// =============================================
// INICIALIZACIÓN DEL MODELO
// =============================================

  EmailVerificationToken.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        comment: 'ID único del token de verificación',
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
        comment: 'ID del usuario que solicita la verificación',
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          isEmail: true,
        },
        comment: 'Email a verificar (debe coincidir con el email del usuario)',
      },
      token: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          len: [32, 255], // Mínimo 32 caracteres
        },
        comment: 'Token único de verificación generado con crypto.randomBytes(32)',
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
        comment: 'Fecha y hora de expiración del token (24 horas desde la creación)',
      },
      used: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si el token ya fue utilizado para verificar el email',
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
        type: DataTypes.STRING(45), // IPv4 o IPv6
        allowNull: true,
        validate: {
          isIP: true,
        },
        comment: 'Dirección IP desde donde se solicitó la verificación',
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'User agent del navegador que solicitó la verificación',
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
      tableName: 'email_verification_tokens',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      hooks: {
        beforeCreate: async (token: EmailVerificationToken) => {

          // Validar email del usuario
          const user = await User.findByPk(token.user_id);
          if (user && user.email !== token.email) {
            throw new Error('El email del token no coincide con el email del usuario');
          }

      
        },

        beforeUpdate: (token: EmailVerificationToken) => {
          if (token.changed('used') && token.used && !token.used_at) {
            token.used_at = new Date();
          }
        }
      },
      comment: 'Tokens para verificación de email de usuarios. Cada token es único, tiene expiración de 24 horas y no puede reutilizarse.',
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
          name: 'idx_email_verification_tokens_user_used_expires'
        }
      ],
      
    }
  );


export default EmailVerificationToken;