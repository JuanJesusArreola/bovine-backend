import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Location from './Location';

// Enums específicos para LocationCapacity
export enum AreaUnit {
  M2 = 'M2',
  HA = 'HA',
  ACRE = 'ACRE'
}

export enum SecurityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

// Atributos del modelo LocationCapacity
export interface LocationCapacityAttributes {

  locationId: string;           // FK a Location (OBLIGATORIO - relación 1:1)
  maxAnimals: number;            // Capacidad máxima
  currentAnimals: number;        // Animales actuales (se actualiza frecuentemente)
  area: number;                  // Área
  areaUnit: AreaUnit;            // Unidad de área
  carryingCapacity: number;      // Animales por hectárea
  
  waterSources: number;          // Número de fuentes de agua
  feedingStations: number;       // Estaciones de alimentación
  shelters: number;              // Refugios
  
  hasElectricity: boolean;       // Tiene electricidad
  hasWater: boolean;             // Tiene agua
  hasInternet: boolean;          // Tiene internet
  hasRoadAccess: boolean;        // Acceso por carretera
  
  securityLevel: SecurityLevel;  // Nivel de seguridad
  
  lastUpdated: Date;             // Fecha última actualización
  updatedBy: string;             // Usuario que actualizó
  
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;              // Soft delete
}

// Atributos opcionales al crear
export interface LocationCapacityCreationAttributes
  extends Optional<LocationCapacityAttributes,
    'currentAnimals' | 'waterSources' | 'feedingStations' | 'shelters' |
    'hasElectricity' | 'hasWater' | 'hasInternet' | 'hasRoadAccess' |
    'securityLevel' | 'deletedAt'
  > {}

// Clase del modelo LocationCapacity
class LocationCapacity extends Model<LocationCapacityAttributes, LocationCapacityCreationAttributes>
  implements LocationCapacityAttributes {
  

  public locationId!: string;
  public maxAnimals!: number;
  public currentAnimals!: number;
  public area!: number;
  public areaUnit!: AreaUnit;
  public carryingCapacity!: number;
  
  public waterSources!: number;
  public feedingStations!: number;
  public shelters!: number;
  
  public hasElectricity!: boolean;
  public hasWater!: boolean;
  public hasInternet!: boolean;
  public hasRoadAccess!: boolean;
  
  public securityLevel!: SecurityLevel;
  
  public lastUpdated!: Date;
  public updatedBy!: string;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;

}

// Definición del modelo en Sequelize
LocationCapacity.init(
  {
    locationId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'locations',
        key: 'id',
      },
       // Relación 1:1 con Location
      comment: 'ID de la ubicación ( PK Y FK relación 1:1)'
    },
    maxAnimals: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        isInt: true
      },
      comment: 'Capacidad máxima de animales'
    },
    currentAnimals: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true,
        notExceedMax(value: number) {
          if (value > (this as any).maxAnimals) {
            throw new Error('Los animales actuales no pueden exceder la capacidad máxima');
          }
        }
      },
      comment: 'Número actual de animales'
    },
    area: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        isPositive(value: number) {
          if (value <= 0) throw new Error('El área debe ser mayor a 0');
        }
      },
      comment: 'Área total'
    },
    areaUnit: {
      type: DataTypes.ENUM(...Object.values(AreaUnit)),
      allowNull: false,
      defaultValue: AreaUnit.M2,
    },
    carryingCapacity: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      validate: {
        min: 0
      },
      comment: 'Capacidad de carga (animales por hectárea)'
    },
    waterSources: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      },
      comment: 'Número de fuentes de agua'
    },
    feedingStations: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      },
      comment: 'Número de estaciones de alimentación'
    },
    shelters: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      },
      comment: 'Número de refugios'
    },
    hasElectricity: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Tiene electricidad'
    },
    hasWater: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Tiene acceso a agua'
    },
    hasInternet: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Tiene internet'
    },
    hasRoadAccess: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Tiene acceso por carretera'
    },
    securityLevel: {
      type: DataTypes.ENUM(...Object.values(SecurityLevel)),
      allowNull: false,
      defaultValue: SecurityLevel.MEDIUM,
    },
    lastUpdated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de última actualización de capacidades'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que actualizó'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de eliminación (soft delete)'
    }
  },
  {
    sequelize,
    modelName: 'LocationCapacity',
    tableName: 'location_capacities',
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        
        fields: ['location_id']
      },
      {
        fields: ['max_animals']
      },
      {
        fields: ['current_animals']
      },
      {
        fields: ['security_level']
      },
      {
        name: 'location_capacity_occupancy',
        fields: ['current_animals', 'max_animals']
      },
      {
        name: 'location_capacity_area_type',
        fields: ['area', 'area_unit']
      }
    ],
    hooks: {
      beforeSave: async (capacity: LocationCapacity) => {
        // Actualizar lastUpdated automáticamente
        capacity.lastUpdated = new Date();
        
        // Calcular carrying capacity si no se proporcionó explícitamente
        // basado en área y maxAnimals cuando sea relevante
        if (!capacity.carryingCapacity && capacity.area > 0 && capacity.maxAnimals > 0) {
          // Convertir área a hectáreas si es necesario
          let areaInHa = capacity.area;
          if (capacity.areaUnit === AreaUnit.M2) {
            areaInHa = capacity.area / 10000;
          } else if (capacity.areaUnit === AreaUnit.ACRE) {
            areaInHa = capacity.area * 0.404686;
          }
          
          if (areaInHa > 0) {
            capacity.carryingCapacity = capacity.maxAnimals / areaInHa;
          }
        }
        
        // Validar consistencia de capacidad de carga
        if (capacity.carryingCapacity < 0) {
          throw new Error('La capacidad de carga no puede ser negativa');
        }
      }
    },
    comment: 'Tabla para capacidades y características de ubicaciones'
  }
);


export default LocationCapacity;