import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';
import { LocationData } from './Bovine';
import type { GeofenceConfig } from './Location';

// Enums para tipos de rancho
export enum RanchType {
  DAIRY = 'DAIRY',                             // Lechero
  BEEF = 'BEEF',                               // Carne
  MIXED = 'MIXED',                             // Mixto (leche y carne)
  BREEDING = 'BREEDING',                       // Reproducción/Cría
  FEEDLOT = 'FEEDLOT',                         // Engorda
  ORGANIC = 'ORGANIC',                         // Orgánico
  SUSTAINABLE = 'SUSTAINABLE',                 // Sostenible
  COMMERCIAL = 'COMMERCIAL',                   // Comercial
  FAMILY_FARM = 'FAMILY_FARM',                 // Familiar
  COOPERATIVE = 'COOPERATIVE',                 // Cooperativa
  CORPORATE = 'CORPORATE',                     // Corporativo
  RESEARCH = 'RESEARCH',                       // Investigación
  EDUCATIONAL = 'EDUCATIONAL'                  // Educativo
}

export enum RanchStatus {
  ACTIVE = 'ACTIVE',                           // Activo
  INACTIVE = 'INACTIVE',                       // Inactivo
  UNDER_CONSTRUCTION = 'UNDER_CONSTRUCTION',   // En construcción
  RENOVATION = 'RENOVATION',                   // En renovación
  TEMPORARY_CLOSURE = 'TEMPORARY_CLOSURE',     // Cierre temporal
  PERMANENT_CLOSURE = 'PERMANENT_CLOSURE',     // Cierre permanente
  QUARANTINE = 'QUARANTINE',                   // En cuarentena
  SUSPENDED = 'SUSPENDED',                     // Suspendido
  PENDING_APPROVAL = 'PENDING_APPROVAL'        // Pendiente de aprobación
}

export enum LandTenure {
  OWNED = 'OWNED',                             // Propio
  LEASED = 'LEASED',                           // Arrendado
  SHARED = 'SHARED',                           // Compartido
  EJIDAL = 'EJIDAL',                           // Ejidal
  COMMUNAL = 'COMMUNAL',                       // Comunal
  CONCESSION = 'CONCESSION',                   // Concesión
  COOPERATIVE = 'COOPERATIVE',                 // Cooperativo
  MIXED_TENURE = 'MIXED_TENURE'                // Tenencia mixta
}

export enum ClimateZone {
  TROPICAL = 'TROPICAL',                       // Tropical
  SUBTROPICAL = 'SUBTROPICAL',                 // Subtropical
  TEMPERATE = 'TEMPERATE',                     // Templado
  ARID = 'ARID',                               // Árido
  SEMI_ARID = 'SEMI_ARID',                     // Semiárido
  HUMID = 'HUMID',                             // Húmedo
  SEMI_HUMID = 'SEMI_HUMID',                   // Semihúmedo
  HIGHLAND = 'HIGHLAND',                       // Montañoso
  COASTAL = 'COASTAL'                          // Costero
}

// Atributos del modelo Ranch
export interface RanchAttributes {
  id: string;
  ranchCode: string;                           // Código único del rancho
  name: string;                                // Nombre del rancho
  description?: string;                        // Descripción del rancho
  type: RanchType;                             // Tipo de rancho
  status: RanchStatus;                         // Estado del rancho

  address: string;                             // Dirección física
  city: string;                                // Ciudad
  state: string;                               // Estado/Provincia
  country: string;                             // País
  postalCode?: string;                         // Código postal
  timezone: string;                            // Zona horaria

  coordinates: LocationData;                   // Coordenadas principales
  landTenure: LandTenure;                      // Tipo de tenencia
  climateZone: ClimateZone;                    // Zona climática
  elevation?: number;                          // Elevación (metros)
  annualRainfall?: number;                     // Precipitación anual (mm)
  averageTemperature?: number;                 // Temperatura promedio (°C)
  boundaryRadius?: number;                     // Radio operativo del rancho (km) — legacy / fallback CIRCULAR
  boundary?: GeofenceConfig;                   // Perímetro real del rancho (CIRCULAR | RECTANGULAR | POLYGON | CORRIDOR). JSONB.

  totalArea: number;
  grazingArea: number;
  maxCattleCapacity: number;
  currentCattleCount: number;

  isActive: boolean;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedDate?: Date;

  createdBy: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;

}

// Atributos opcionales al crear un nuevo rancho
export interface RanchCreationAttributes
  extends Optional<RanchAttributes,
    'id' | 'description' | 'postalCode' | 'elevation' | 'annualRainfall' |
    'averageTemperature' | 'boundaryRadius' | 'boundary' | 'verifiedBy' | 'verifiedDate' | 'updatedBy' | 'deletedAt'
  > { }

// Clase del modelo Ranch
class Ranch extends Model<RanchAttributes, RanchCreationAttributes>
  implements RanchAttributes {

  public id!: string;
  public ranchCode!: string;
  public name!: string;
  public description?: string;
  public type!: RanchType;
  public status!: RanchStatus;

  public address!: string;
  public city!: string;
  public state!: string;
  public country!: string;
  public postalCode?: string;
  public timezone!: string;

  public coordinates!: LocationData;
  public landTenure!: LandTenure;
  public climateZone!: ClimateZone;
  public elevation?: number;
  public annualRainfall?: number;
  public averageTemperature?: number;
  public boundaryRadius?: number;
  public boundary?: GeofenceConfig;

  public totalArea!: number;
  public grazingArea!: number;
  public maxCattleCapacity!: number;
  public currentCattleCount!: number;

  public isActive!: boolean;
  public isVerified!: boolean;
  public verifiedBy?: string;
  public verifiedDate?: Date;

  public lastInspectionDate?: Date;
  public nextInspectionDate?: Date;
  public complianceScore?: number;

  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

// Definición del modelo en Sequelize
Ranch.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del rancho'
    },
    ranchCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 50]
      },
      comment: 'Código único del rancho'
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 200]
      },
      comment: 'Nombre del rancho'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción del rancho'
    },
    type: {
      type: DataTypes.ENUM(...Object.values(RanchType)),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(RanchStatus)),
      allowNull: false,
      defaultValue: RanchStatus.ACTIVE,
    },
    address: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Dirección física del rancho'
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Ciudad'
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: true },
      comment: 'Estado o provincia'
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'México',
      comment: 'País'
    },
    postalCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Código postal'
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'America/Mexico_City',
      comment: 'Zona horaria'
    },
    coordinates: {
      type: DataTypes.JSONB,
      allowNull: false,
      // Setter que normaliza {lat, lng} → {latitude, longitude} antes de guardar
      set(value: any) {
        let coords = typeof value === 'string' ? JSON.parse(value) : value;

        // Normalizar: si el frontend envía {lat, lng}, convertir a {latitude, longitude}
        if (coords && coords.lat !== undefined && coords.latitude === undefined) {
          coords = { latitude: coords.lat, longitude: coords.lng, ...coords };
          delete coords.lat;
          delete coords.lng;
        }

        this.setDataValue('coordinates', coords);
      },
      validate: {
        isValidCoordinates(value: LocationData | string) {
          let coords = value as any;

          if (typeof value === 'string') {
            coords = JSON.parse(value);
          }

          if (coords.latitude === undefined || coords.longitude === undefined) {
            throw new Error('Latitud y longitud son requeridas');
          }
          if (coords.latitude < -90 || coords.latitude > 90) {
            throw new Error('Latitud debe estar entre -90 y 90');
          }
          if (coords.longitude < -180 || coords.longitude > 180) {
            throw new Error('Longitud debe estar entre -180 y 180');
          }
        }
      },
      comment: 'Coordenadas geográficas principales'
    },
    landTenure: {
      type: DataTypes.ENUM(...Object.values(LandTenure)),
      allowNull: false,
    },
    climateZone: {
      type: DataTypes.ENUM(...Object.values(ClimateZone)),
      allowNull: false,
    },
    elevation: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      comment: 'Elevación (metros)'
    },
    annualRainfall: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      validate: { min: 0 },
      comment: 'Precipitación anual (mm)'
    },
    averageTemperature: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Temperatura promedio (°C)'
    },
    boundaryRadius: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      validate: { min: 0.5, max: 500 },
      comment: 'Radio operativo del rancho en kilómetros — legacy / fallback cuando boundary no está configurado'
    },
    boundary: {
      type: DataTypes.JSONB,
      allowNull: true,
      validate: {
        /**
         * Valida la forma del GeofenceConfig según su tipo.
         * Los tipos permitidos coinciden con `GeofenceType` de Location.
         */
        isValidBoundary(value: any) {
          if (value === null || value === undefined) return;

          const cfg = typeof value === 'string' ? JSON.parse(value) : value;
          if (!cfg || typeof cfg !== 'object') {
            throw new Error('boundary debe ser un objeto');
          }
          const type = cfg.type;
          if (!['CIRCULAR', 'RECTANGULAR', 'POLYGON', 'CORRIDOR'].includes(type)) {
            throw new Error(`boundary.type inválido: ${type}`);
          }
          if (type === 'CIRCULAR') {
            if (!cfg.center || typeof cfg.center.latitude !== 'number' || typeof cfg.center.longitude !== 'number') {
              throw new Error('boundary CIRCULAR requiere center.latitude y center.longitude');
            }
            if (typeof cfg.radius !== 'number' || cfg.radius <= 0) {
              throw new Error('boundary CIRCULAR requiere radius > 0 (metros)');
            }
          }
          if (type === 'RECTANGULAR') {
            const bb = cfg.boundingBox;
            if (!bb || typeof bb.north !== 'number' || typeof bb.south !== 'number' ||
                typeof bb.east !== 'number' || typeof bb.west !== 'number') {
              throw new Error('boundary RECTANGULAR requiere boundingBox {north, south, east, west}');
            }
            if (bb.south >= bb.north) throw new Error('boundingBox.south debe ser menor que north');
            if (bb.west >= bb.east) throw new Error('boundingBox.west debe ser menor que east');
          }
          if (type === 'POLYGON') {
            if (!Array.isArray(cfg.coordinates) || cfg.coordinates.length < 3) {
              throw new Error('boundary POLYGON requiere coordinates con al menos 3 vértices');
            }
            for (const c of cfg.coordinates) {
              if (typeof c.latitude !== 'number' || typeof c.longitude !== 'number') {
                throw new Error('Cada vértice de POLYGON debe tener latitude y longitude numéricos');
              }
            }
          }
          if (type === 'CORRIDOR') {
            if (!Array.isArray(cfg.coordinates) || cfg.coordinates.length < 2) {
              throw new Error('boundary CORRIDOR requiere coordinates con al menos 2 puntos');
            }
            if (typeof cfg.width !== 'number' || cfg.width <= 0) {
              throw new Error('boundary CORRIDOR requiere width > 0 (metros)');
            }
          }
        },
      },
      comment: 'Perímetro real del rancho (GeofenceConfig). null = no configurado, se usa boundaryRadius como fallback.',
    },
    totalArea: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: { min: 0 },
      comment: 'Área total en hectáreas'
    },
    grazingArea: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0,
        notExceedTotal(value: number) {
          if (value > (this as any).totalArea) {
            throw new Error('El área de pastoreo no puede exceder el área total');
          }
        }
      },
      comment: 'Área de pastoreo en hectáreas'
    },
    maxCattleCapacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0 },
      comment: 'Capacidad máxima de ganado'
    },
    currentCattleCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        notExceedMax(value: number) {
          if (value > (this as any).maxCattleCapacity) {
            throw new Error('El ganado actual no puede exceder la capacidad máxima');
          }
        }
      },
      comment: 'Número actual de ganado'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el rancho está activo'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si el rancho está verificado'
    },
    verifiedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que verificó'
    },
    verifiedDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de verificación'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que creó'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que actualizó'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Soft delete'
    }
  },
  {
    sequelize,
    modelName: 'Ranch',
    tableName: 'ranches',
    timestamps: true,
    paranoid: true,
    indexes: [
      { unique: true, fields: ['ranch_code'] },
      { fields: ['name'] },
      { fields: ['type', 'status'] },
      { fields: ['land_tenure'] },
      { fields: ['climate_zone'] },
      { fields: ['city', 'state', 'country'] },
      { fields: ['is_active', 'is_verified'] },
      { name: 'ranches_coordinates_gin', fields: ['coordinates'], using: 'gin' },
      { name: 'ranches_boundary_gin', fields: ['boundary'], using: 'gin' }
    ],

    comment: 'Tabla core para el manejo de ranchos'
  }
);

export default Ranch;