import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Location from './Location';
import Bovine from './Bovine';

export enum MovementReason {
  GRAZING = 'GRAZING',
  MEDICAL = 'MEDICAL',
  QUARANTINE = 'QUARANTINE',
  BREEDING = 'BREEDING',
  TRANSFER = 'TRANSFER',
  SALE = 'SALE',
  CREATION = 'CREATION',  // Para el ingreso inicial al sistema
  OTHER = 'OTHER'
}

export enum MovementType {
  MANUAL = 'MANUAL',
  AUTOMATED = 'AUTOMATED',
  SCHEDULED = 'SCHEDULED'
}

export interface BovineLocationHistoryAttributes {
  id: string;
  bovineId: string;
  locationId: string;
  enteredAt: Date;
  exitedAt?: Date;  // Puede ser null si aún no ha salido
  reason: MovementReason;
  recordedBy: string;
  movementType: MovementType;
  notes?: string;
  eventId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface BovineLocationHistoryCreationAttributes
  extends Optional<BovineLocationHistoryAttributes,
    'id' | 'exitedAt' | 'notes' | 'eventId' | 'deletedAt'
  > { }

class BovineLocationHistory extends Model<BovineLocationHistoryAttributes, BovineLocationHistoryCreationAttributes>
  implements BovineLocationHistoryAttributes {

  public id!: string;
  public bovineId!: string;
  public locationId!: string;
  public enteredAt!: Date;
  public exitedAt?: Date;
  public reason!: MovementReason;
  public recordedBy!: string;
  public movementType!: MovementType;
  public notes?: string;
  public eventId?: string;

  public bovine?: Bovine;        // ← AGREGAR
  public location?: Location;     // ← AGREGAR

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

BovineLocationHistory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    bovineId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'bovines', key: 'id' },
      onDelete: 'CASCADE'
    },
    locationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'locations', key: 'id' },
      onDelete: 'CASCADE'
    },
    enteredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    exitedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    reason: {
      type: DataTypes.ENUM(...Object.values(MovementReason)),
      allowNull: false
    },
    recordedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    movementType: {
      type: DataTypes.ENUM(...Object.values(MovementType)),
      allowNull: false,
      defaultValue: MovementType.MANUAL
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'events', key: 'id' },
      onDelete: 'SET NULL'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'BovineLocationHistory',
    tableName: 'bovine_location_history',
    timestamps: true,
    paranoid: true,
    indexes: [
      // Para historial por bovino (ordenado)
      { fields: ['bovine_id', 'entered_at'] },

      // Para búsquedas por ubicación
      { fields: ['location_id', 'entered_at'] },

      // Para animales actualmente en ubicación (búsqueda por location)
      {
        name: 'idx_current_location',
        fields: ['location_id', 'exited_at'],
        where: { exited_at: null }
      },

      // Stay activa por bovino — usado por current-location, full detail,
      // filtros del listado y conteo de cattle agregado por rancho.
      // Índice parcial: solo indexa filas con exited_at NULL → muy compacto.
      {
        name: 'idx_active_stay_by_bovine',
        fields: ['bovine_id'],
        where: { exited_at: null }
      },

      // Para análisis por razón
      { fields: ['reason'] },

      // Para búsquedas por fecha
      { fields: ['entered_at', 'exited_at'] }
    ],
    hooks: {
      beforeSave: async (history: BovineLocationHistory) => {
        // Validar que exitedAt sea posterior a enteredAt
        if (history.exitedAt && history.exitedAt <= history.enteredAt) {
          throw new Error('exitedAt debe ser posterior a enteredAt');
        }
      }
    }
  }
);

export default BovineLocationHistory;