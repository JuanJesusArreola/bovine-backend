import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { HealthStatus } from './Bovine';

//Modelo que se utilizara en caso de que los bovinos ceunten con gps y se registre de manera automatica el cambio
export enum TrackingSource {
  GPS = 'GPS',
  MANUAL = 'MANUAL',
  ESTIMATED = 'ESTIMATED'
}
export interface BovineTrackingAttributes {
  id: string;
  bovineId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  deviceId?: string;
  recordedAt: Date;
  source: TrackingSource;
  healthStatusAtTime?: HealthStatus;

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface BovineTrackingCreationAttributes
  extends Optional<BovineTrackingAttributes,
    'id' | 'altitude' | 'accuracy' | 'speed' | 'heading' | 'batteryLevel' |
    'deviceId' | 'healthStatusAtTime' | 'deletedAt'
  > { }

class BovineTracking extends Model<BovineTrackingAttributes, BovineTrackingCreationAttributes>
  implements BovineTrackingAttributes {

  public id!: string;
  public bovineId!: string;
  public latitude!: number;
  public longitude!: number;
  public altitude?: number;
  public accuracy?: number;
  public speed?: number;
  public heading?: number;
  public batteryLevel?: number;
  public deviceId?: string;
  public recordedAt!: Date;
  public source!: TrackingSource;
  public healthStatusAtTime?: HealthStatus;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

BovineTracking.init(
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
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false,
      validate: { min: -90, max: 90 }
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false,
      validate: { min: -180, max: 180 }
    },
    altitude: {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: true,
      validate: { min: -500, max: 9000 }
    },
    accuracy: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      validate: { min: 0 }
    },
    speed: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      validate: { min: 0 }
    },
    heading: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0, max: 360 }
    },
    batteryLevel: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0, max: 100 }
    },
    deviceId: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    recordedAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    source: {
      type: DataTypes.ENUM(...Object.values(TrackingSource)),
      allowNull: false,
      defaultValue: TrackingSource.GPS
    },
    healthStatusAtTime: {
      type: DataTypes.ENUM(...Object.values(HealthStatus)),
      allowNull: true
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'BovineTracking',
    tableName: 'bovine_tracking',
    timestamps: true,
    paranoid: true,
    indexes: [
      // Para series temporales por bovino
      { fields: ['bovine_id', 'recorded_at'] },

      // Para búsquedas por tiempo
      { fields: ['recorded_at'] },

      // Índice espacial GIST (para mapas históricos)
      {
        name: 'idx_tracking_location_gist',
        fields: [sequelize.fn('ST_SetSRID',
          sequelize.fn('ST_MakePoint',
            sequelize.col('longitude'),
            sequelize.col('latitude')
          ), 4326
        )],
        using: 'gist'
      },

      // Para dispositivos
      { fields: ['device_id'] },

      // Para análisis de batería
      { fields: ['battery_level', 'recorded_at'] }
    ]
  }
);

export default BovineTracking;