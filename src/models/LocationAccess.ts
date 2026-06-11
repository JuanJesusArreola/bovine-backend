import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Location from './Location';
// import User from './User'; // Cuando exista el modelo User

// Enums específicos para LocationAccess
export enum AccessLevel {
  PUBLIC = 'PUBLIC',
  RESTRICTED = 'RESTRICTED',
  PRIVATE = 'PRIVATE',
  AUTHORIZED_ONLY = 'AUTHORIZED_ONLY',
  EMERGENCY_ONLY = 'EMERGENCY_ONLY',
  STAFF_ONLY = 'STAFF_ONLY',
  VETERINARY_ONLY = 'VETERINARY_ONLY',
  OWNER_ONLY = 'OWNER_ONLY'
}

export enum AccessPurpose {
  GENERAL = 'GENERAL',
  FEEDING = 'FEEDING',
  CLEANING = 'CLEANING',
  MEDICAL = 'MEDICAL',
  MAINTENANCE = 'MAINTENANCE',
  INSPECTION = 'INSPECTION',
  EMERGENCY = 'EMERGENCY',
  DELIVERY = 'DELIVERY',
  VISIT = 'VISIT'
}

// Interface para restricciones de tiempo
export interface TimeRestriction {
  dayOfWeek: number; // 0-6 (domingo-sábado)
  startTime: string; // "HH:MM" en formato 24h
  endTime: string;   // "HH:MM" en formato 24h
  isAllowed: boolean; // true = permitido, false = denegado
}

// Atributos del modelo LocationAccess
export interface LocationAccessAttributes {
  id: string;
  locationId: string;           // FK a Location (OBLIGATORIO)
  userId: string;                // FK a User (OBLIGATORIO)
  
  accessLevel: AccessLevel;      // Nivel de acceso concedido
  grantedBy: string;             // ID del usuario que otorgó el acceso
  grantedAt: Date;               // Fecha de concesión
  expiresAt?: Date;              // Fecha de expiración (opcional)
  
  // Restricciones adicionales
  timeRestrictions?: TimeRestriction[]; // Horarios permitidos/denegados
  purposeRestrictions?: AccessPurpose[]; // Solo para ciertos propósitos
  
  // Metadatos
  isActive: boolean;             // Si el acceso está activo
  revokedAt?: Date;              // Fecha de revocación
  revokedBy?: string;            // Quién revocó el acceso
  revocationReason?: string;     // Motivo de revocación
  
  // Auditoría
  lastAccessedAt?: Date;         // Último uso del acceso
  accessCount: number;           // Contador de usos
  
  createdBy: string;
  updatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;              // Soft delete
}

// Atributos opcionales al crear
export interface LocationAccessCreationAttributes
  extends Optional<LocationAccessAttributes,
    'id' | 'expiresAt' | 'timeRestrictions' | 'purposeRestrictions' |
    'revokedAt' | 'revokedBy' | 'revocationReason' | 'lastAccessedAt' |
    'accessCount' | 'deletedAt'
  > {}

// Clase del modelo LocationAccess
class LocationAccess extends Model<LocationAccessAttributes, LocationAccessCreationAttributes>
  implements LocationAccessAttributes {
  
  public id!: string;
  public locationId!: string;
  public userId!: string;
  
  public accessLevel!: AccessLevel;
  public grantedBy!: string;
  public grantedAt!: Date;
  public expiresAt?: Date;
  
  public timeRestrictions?: TimeRestriction[];
  public purposeRestrictions?: AccessPurpose[];
  
  public isActive!: boolean;
  public revokedAt?: Date;
  public revokedBy?: string;
  public revocationReason?: string;
  
  public lastAccessedAt?: Date;
  public accessCount!: number;
  
  public createdBy!: string;
  public updatedBy!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;

  // ❌ LOS MÉTODOS DE NEGOCIO IRÁN EN SERVICIOS
  // (mencionados abajo, no implementados aquí)
}

// Definición del modelo en Sequelize
LocationAccess.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del acceso a ubicación'
    },
    locationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'locations',
        key: 'id'
      },
      comment: 'ID de la ubicación'
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
       references: {
         model: 'users',
        key: 'id'
       },
      comment: 'ID del usuario (cuando exista el modelo User)'
    },
    accessLevel: {
      type: DataTypes.ENUM(...Object.values(AccessLevel)),
      allowNull: false,
    },
    grantedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que otorgó el acceso'
    },
    grantedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de concesión del acceso'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        isAfterGranted(this: LocationAccess, value: Date) {
          if (value && this.grantedAt && value <= this.grantedAt) {
            throw new Error('La fecha de expiración debe ser posterior a la fecha de concesión');
          }
        }
      },
      comment: 'Fecha de expiración del acceso'
    },
    timeRestrictions: {
      type: DataTypes.JSONB,
      allowNull: true,
      validate: {
        isValidTimeRestrictions(value: TimeRestriction[]) {
          if (value) {
            value.forEach((restriction, index) => {
              // Validar día de semana
              if (restriction.dayOfWeek < 0 || restriction.dayOfWeek > 6) {
                throw new Error(`Día de semana inválido en restricción ${index}`);
              }
              
              // Validar formato de hora
              const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
              if (!timeRegex.test(restriction.startTime)) {
                throw new Error(`Hora de inicio inválida en restricción ${index}`);
              }
              if (!timeRegex.test(restriction.endTime)) {
                throw new Error(`Hora de fin inválida en restricción ${index}`);
              }
            });
          }
        }
      },
      comment: 'Restricciones de horario (JSONB)'
    },
    purposeRestrictions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      validate:{
        isValidPurposeRestrictions(value: string[]) {
          const validPurposes = Object.values(AccessPurpose);
          value.forEach(v => {
            if (!validPurposes.includes(v as AccessPurpose)) {
              throw new Error(`Purpose restriction inválida: ${v}`);
            }
          });
        }

      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el acceso está activo'
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de revocación del acceso'
    },
    revokedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que revocó el acceso'
    },
    revocationReason: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Motivo de la revocación'
    },
    lastAccessedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Última vez que se usó este acceso'
    },
    accessCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'Número de veces que se ha utilizado este acceso'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que creó el registro'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que actualizó el registro'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de eliminación (soft delete)'
    }
  },
  {
    sequelize,
    modelName: 'LocationAccess',
    tableName: 'location_access',
    timestamps: true,
    paranoid: true,
    indexes: [
      // Índices compuestos para consultas frecuentes
      {
        
        fields: ['location_id', 'user_id'],
        where: {
          deleted_at: null,
          is_active: true
        },
        name: 'unique_active_user_location'
      },
      {
        fields: ['location_id']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['access_level']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['expires_at']
      },
      {
        name: 'location_access_expired',
        fields: ['expires_at', 'is_active']
      },
      {
        name: 'location_access_user_active',
        fields: ['user_id', 'is_active', 'expires_at']
      },
      {
        name: 'location_access_granted_by',
        fields: ['granted_by']
      }
    ],
    hooks: {
      beforeSave: async (access: LocationAccess) => {
        // Validar que no se pueda reactivar un acceso revocado
        if (access.changed('isActive') && access.isActive === true && access.revokedAt) {
          throw new Error('No se puede reactivar un acceso que ha sido revocado');
        }
        
        // Si se está revocando, establecer fecha y motivo por defecto
        if (access.changed('revokedAt') && access.revokedAt && !access.revocationReason) {
          access.revocationReason = 'Revocado sin motivo específico';
        }
        
        // Si expiró, desactivar automáticamente
        if (access.expiresAt && access.expiresAt < new Date() && access.isActive) {
          access.isActive = false;
        }
        
        // Validar que grantedBy y updatedBy sean diferentes cuando corresponda
        if (!access.isNewRecord && access.changed('updatedBy') && access.updatedBy === access.grantedBy) {
          // Es válido, solo es una advertencia de logging
          console.warn('El mismo usuario está actualizando un acceso que otorgó');
        }
      },
      
      beforeCreate: async (access: LocationAccess) => {
        // Asegurar que grantedAt se establezca
        if (!access.grantedAt) {
          access.grantedAt = new Date();
        }
      },
      
      afterFind: (accesses: LocationAccess | LocationAccess[]) => {
        // Si es un array, procesar cada uno
        if (Array.isArray(accesses)) {
          accesses.forEach(access => {
            // Marcar como inactivo si expiró (solo en memoria, no en BD)
            if (access.expiresAt && access.expiresAt < new Date() && access.isActive) {
              access.isActive = false;
            }
          });
        } else if (accesses) {
          // Si es un solo registro
          if (accesses.expiresAt && accesses.expiresAt < new Date() && accesses.isActive) {
            accesses.isActive = false;
          }
        }
      }
    },
    comment: 'Tabla para control de acceso a ubicaciones (usuarios con permisos específicos)'
  }
);



export default LocationAccess;