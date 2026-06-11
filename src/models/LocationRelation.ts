import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Location from './Location';

// Enums específicos para LocationRelation
export enum RelationType {
  CONTAINS = 'CONTAINS',       // Una ubicación contiene a otra (jerarquía)
  ADJACENT = 'ADJACENT',       // Ubicaciones adyacentes/comparten límite
  CONNECTED = 'CONNECTED',     // Conectadas físicamente (puertas, caminos)
  NEARBY = 'NEARBY'            // Cercanas pero sin conexión directa
}

export enum PathType {
  GATE = 'GATE',
  ROAD = 'ROAD',
  TRAIL = 'TRAIL',
  BRIDGE = 'BRIDGE',
  TUNNEL = 'TUNNEL',
  CORRIDOR = 'CORRIDOR'
}

export enum RestrictionType {
  AUTHORIZED_ONLY = 'AUTHORIZED_ONLY',
  ONE_WAY = 'ONE_WAY',
  ANIMALS_ONLY = 'ANIMALS_ONLY',
  VEHICLES_ONLY = 'VEHICLES_ONLY',
  PEDESTRIANS_ONLY = 'PEDESTRIANS_ONLY',
  TEMPORARILY_CLOSED = 'TEMPORARILY_CLOSED',
  MAINTENANCE = 'MAINTENANCE'
}

// Interface para metadatos
export interface RelationMetadata {
  pathType?: PathType;           // Tipo de camino/conexión
  restrictions?: RestrictionType[]; // Restricciones aplicables
  travelTime?: number;           // Tiempo estimado en minutos
  distance?: number;             // Distancia real en metros (si difiere)
  difficulty?: 'EASY' | 'MODERATE' | 'DIFFICULT'; // Dificultad del trayecto
  seasonalAccess?: string[];     // Meses/horarios de acceso
  condition?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'; // Estado de la conexión
  lastVerifiedAt?: Date;         // Última verificación de la relación
  verifiedBy?: string;           // Quién verificó
  notes?: string;                // Notas adicionales
}

// Atributos del modelo LocationRelation
export interface LocationRelationAttributes {
  id: string;
  sourceLocationId: string;      // FK a Location (origen)
  targetLocationId: string;      // FK a Location (destino)
  
  relationType: RelationType;     // Tipo de relación
  distance?: number;              // Distancia en metros
  bidirectional: boolean;         // ¿Relación simétrica?
  
  isPrimary: boolean;             // ¿Es la relación principal? (para jerarquías)
  
  metadata?: RelationMetadata;    // Metadatos adicionales
  
  // Métricas de uso
  usageCount: number;             // Veces que se ha utilizado esta relación
  lastUsedAt?: Date;              // Último uso registrado
  
  // Vigencia
  validFrom: Date;                // Desde cuándo aplica
  validTo?: Date;                 // Hasta cuándo aplica (opcional)
  isActive: boolean;              // Si está activa actualmente
  
  // Auditoría
  createdBy: string;
  updatedBy: string;

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;               // Soft delete
}

// Atributos opcionales al crear
export interface LocationRelationCreationAttributes
  extends Optional<LocationRelationAttributes,
    'id' | 'distance' | 'metadata' | 'usageCount' | 'lastUsedAt' |
    'validTo' | 'deletedAt'
  > {}

// Clase del modelo LocationRelation
class LocationRelation extends Model<LocationRelationAttributes, LocationRelationCreationAttributes>
  implements LocationRelationAttributes {
  
  public id!: string;
  public sourceLocationId!: string;
  public targetLocationId!: string;
  
  public relationType!: RelationType;
  public distance?: number;
  public bidirectional!: boolean;
  
  public isPrimary!: boolean;
  
  public metadata?: RelationMetadata;
  
  public usageCount!: number;
  public lastUsedAt?: Date;
  
  public validFrom!: Date;
  public validTo?: Date;
  public isActive!: boolean;
  
  public createdBy!: string;
  public updatedBy!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;

  // ❌ LOS MÉTODOS DE NEGOCIO IRÁN EN SERVICIOS
  // (mencionados abajo, no implementados aquí)
}

// Definición del modelo en Sequelize
LocationRelation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único de la relación entre ubicaciones'
    },
    sourceLocationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'locations',
        key: 'id'
      },
      comment: 'ID de la ubicación origen'
    },
    targetLocationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'locations',
        key: 'id'
      },
      comment: 'ID de la ubicación destino'
    },
    relationType: {
      type: DataTypes.ENUM(...Object.values(RelationType)),
      allowNull: false,
    },
    distance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0,
        isDecimal: true
      },
      comment: 'Distancia en metros'
    },
    bidirectional: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Indica si la relación es bidireccional'
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si es la relación principal (para jerarquías)'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      validate: {
        isValidMetadata(value: RelationMetadata) {
          if (value) {
            // Validar pathType
            if (value.pathType && !Object.values(PathType).includes(value.pathType)) {
              throw new Error('Tipo de camino inválido');
            }
            
            // Validar restricciones
            if (value.restrictions) {
              value.restrictions.forEach((restriction: RestrictionType) => {
                if (!Object.values(RestrictionType).includes(restriction)) {
                  throw new Error(`Restricción inválida: ${restriction}`);
                }
              });
            }
            
            // Validar dificultad
            if (value.difficulty && 
                !['EASY', 'MODERATE', 'DIFFICULT'].includes(value.difficulty)) {
              throw new Error('Dificultad inválida');
            }
            
            // Validar condición
            if (value.condition && 
                !['EXCELLENT', 'GOOD', 'FAIR', 'POOR'].includes(value.condition)) {
              throw new Error('Condición inválida');
            }
          }
        }
      },
      comment: 'Metadatos adicionales de la relación'
    },
    usageCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'Número de veces que se ha utilizado esta relación'
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Última vez que se utilizó esta relación'
    },
    validFrom: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha desde la cual aplica la relación'
    },
    validTo: {
      type: DataTypes.DATE,
      allowNull: true,
      validate: {
        isAfterValidFrom(value: Date) {
          if (value && value <= (this as any).validFrom) {
            throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
          }
        }
      },
      comment: 'Fecha hasta la cual aplica la relación'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Indica si la relación está activa actualmente'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que creó la relación'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que actualizó la relación'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de eliminación (soft delete)'
    }
  },
  {
    sequelize,
    modelName: 'LocationRelation',
    tableName: 'location_relations',
    timestamps: true,
    paranoid: true,
    indexes: [
      // Índices compuestos para consultas frecuentes
      {
        
        fields: ['source_location_id', 'target_location_id', 'relation_type'],
        where: {
          deleted_at: null
        },
        name: 'unique_relation_source_target_type'
      },
      {
        fields: ['source_location_id']
      },
      {
        fields: ['target_location_id']
      },
      {
        fields: ['relation_type']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['is_primary']
      },
      {
        name: 'location_relations_source_type',
        fields: ['source_location_id', 'relation_type', 'is_active']
      },
      {
        name: 'location_relations_target_type',
        fields: ['target_location_id', 'relation_type', 'is_active']
      },
      {
        name: 'location_relations_bidirectional',
        fields: ['bidirectional', 'is_active']
      },
      {
        name: 'location_relations_valid_dates',
        fields: ['valid_from', 'valid_to', 'is_active']
      }
    ],
    hooks: {
      beforeSave: async (relation: LocationRelation) => {
        // Validar que no sea autorreferencia
        if (relation.sourceLocationId === relation.targetLocationId) {
          throw new Error('Una ubicación no puede relacionarse consigo misma');
        }
        
        // Si es bidireccional, asegurar consistencia
        if (relation.bidirectional && relation.sourceLocationId > relation.targetLocationId) {
          // Opcional: normalizar IDs para relaciones bidireccionales
          // (source siempre menor que target)
        }
        
        // Validar que si es CONTAINS, solo una sea primary
        if (relation.relationType === RelationType.CONTAINS && relation.isPrimary) {
          // Verificar que no exista otra relación primary CONTAINS para source
        }
        
        // Si validTo es menor que hoy y está activa, warning o desactivar
        if (relation.validTo && relation.validTo < new Date() && relation.isActive) {
          relation.isActive = false;
        }
        
        // Validar distancia según tipo
        if (relation.relationType === RelationType.CONTAINS && relation.distance) {
          // Las relaciones de contención no deberían tener distancia
          relation.distance = undefined;
        }
        
        // Validar metadata según tipo
        if (relation.relationType === RelationType.CONNECTED && 
            (!relation.metadata?.pathType)) {
          // Las relaciones conectadas deberían especificar tipo de camino
          console.warn('Relación CONNECTED sin tipo de camino especificado');
        }
      },
      
      beforeCreate: async (relation: LocationRelation) => {
        // Establecer validFrom si no se proporcionó
        if (!relation.validFrom) {
          relation.validFrom = new Date();
        }
      },
      
      afterFind: (relations: LocationRelation | LocationRelation[]) => {
        const processRelation = (relation: LocationRelation) => {
          // Marcar como inactiva si expiró (solo en memoria)
          if (relation.validTo && relation.validTo < new Date() && relation.isActive) {
            relation.isActive = false;
          }
        };
        
        if (Array.isArray(relations)) {
          relations.forEach(processRelation);
        } else if (relations) {
          processRelation(relations);
        }
      }
    },
    comment: 'Tabla para relaciones entre ubicaciones (jerarquías, adyacencias, conexiones)'
  }
);

export default LocationRelation;