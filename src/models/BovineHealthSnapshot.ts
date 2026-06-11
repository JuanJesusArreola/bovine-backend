// src/models/bovine/BovineHealthSnapshot.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { HealthStatus } from './Bovine';
import { LocationData } from './Bovine';
import { Geometry } from 'geojson';

// Interfaz para atributos
export interface BovineHealthSnapshotAttributes {
  id: string;
  bovineId: string;
  ranchId: string;
  healthStatus: HealthStatus;
  location: LocationData;
  lastUpdate: Date;
  //healthColor: string;
  clusterSize: number;

  geom?: Geometry;

  // Metadatos para filtros
  breed?: string;
  ageMonths?: number;
  diagnosis?: string | null;
  lastHealthCheck?: Date;

  // Caso clínico activo (Fase 2)
  activeDiseaseId?: string | null;
  activeCaseId?: string | null;

  // Timestamps
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Atributos opcionales al crear
export interface BovineHealthSnapshotCreationAttributes
  extends Optional<BovineHealthSnapshotAttributes,
    'id' | 'breed' | 'ageMonths' | 'diagnosis' | 'lastHealthCheck' |
    'activeDiseaseId' | 'activeCaseId' | 'deletedAt'
  > { }

// Clase del modelo
class BovineHealthSnapshot extends Model<BovineHealthSnapshotAttributes, BovineHealthSnapshotCreationAttributes>
  implements BovineHealthSnapshotAttributes {

  public id!: string;
  public bovineId!: string;
  public ranchId!: string;
  public healthStatus!: HealthStatus;
  public location!: LocationData;
  public lastUpdate!: Date;
  //public healthColor!: string;
  public clusterSize!: number;

  public geom?: Geometry;

  public breed?: string;
  public ageMonths?: number;
  public diagnosis?: string | null;
  public lastHealthCheck?: Date;

  // Caso clínico activo (Fase 2)
  public activeDiseaseId?: string | null;
  public activeCaseId?: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
}

// Inicialización
BovineHealthSnapshot.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del snapshot de salud'
    },
    bovineId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'bovines',
        key: 'id'
      },
      onDelete: 'CASCADE',
      comment: 'ID del bovino'
    },
    ranchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'ranches',
        key: 'id'
      },
      comment: 'ID del rancho'
    },
    healthStatus: {
      type: DataTypes.ENUM(...Object.values(HealthStatus)),
      allowNull: false,
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidLocation(value: LocationData) {
          if (!value.latitude || !value.longitude) {
            throw new Error('Latitud y longitud son requeridas');
          }
        }
      },
      comment: 'Ubicación geográfica del bovino'
    },
    lastUpdate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Última actualización de este snapshot'
    },
    /*healthColor: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        is: /^#[0-9A-F]{6}$/i  // Validar formato hexadecimal de color
      },
      comment: 'Color para visualización en mapa'
    },*/
    clusterSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Tamaño del cluster (para agrupación en mapa)'
    },
    breed: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Raza del bovino (para filtros)'
    },
    ageMonths: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
        max: 360
      },
      comment: 'Edad en meses (para filtros)'
    },
    diagnosis: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Diagnóstico actual (si está enfermo)'
    },
    lastHealthCheck: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha del último chequeo de salud'
    },
    activeDiseaseId: {
      type: DataTypes.UUID,
      allowNull: true,
      // FK sin constraints para evitar conflicto de orden en sync()
      comment: 'FK a la enfermedad activa del caso abierto (diseases.id)'
    },
    activeCaseId: {
      type: DataTypes.UUID,
      allowNull: true,
      // FK sin constraints para evitar conflicto de orden en sync()
      comment: 'FK al caso clínico activo (bovine_disease_cases.id)'
    },
    geom: {
      type: DataTypes.GEOMETRY('POINT', 4326),
      allowNull: true,
      comment: 'Punto geográfico PostGIS — sincronizado con location (lat/lng)'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de eliminación (soft delete)'
    }
  },
  {
    sequelize,
    modelName: 'BovineHealthSnapshot',
    tableName: 'bovine_health_snapshots',
    timestamps: true,
    paranoid: true,
    indexes: [
      // Índices para mapas de calor
      // 🟢 Nuevo: Índice B‑Tree para health_status (filtro rápido)
      /*{
        name: 'idx_health_snapshots_health_status',
        fields: ['health_status']
      },

      // 🟢 Nuevo: Índice GIN para location (JSONB)
      {
        name: 'idx_health_snapshots_location_gin',
        fields: ['location'],
        using: 'gin'
      },
      // Índices para filtros por rancho
      {
        name: 'idx_health_snapshots_ranch_health',
        fields: ['ranch_id', 'health_status']
      },
      // Índice espacial GIST (CRÍTICO para mapas)
      {
        name: 'idx_health_snapshots_location_gist',
        using: 'gist',
        fields: [
          sequelize.literal(`
        ST_SetSRID(
          ST_MakePoint(
            (location->>'longitude')::float,
            (location->>'latitude')::float
          ),
          4326
        )
      `)
        ]
      },*/

      {
        unique: true,
        name: 'unique_snapshot_per_bovine',
        fields: ['bovine_id']
      },
      // ── Filtros frecuentes ─────────────────────────────────────────────
      {
        name: 'idx_health_snapshots_health_status',
        fields: ['health_status']
      },
      {
        name: 'idx_health_snapshots_ranch_health',
        fields: ['ranch_id', 'health_status']
      },
      {
        name: 'idx_health_snapshots_filters',
        fields: ['health_status', 'breed', 'age_months']
      },
      {
        name: 'idx_health_snapshots_last_update',
        fields: ['last_update']
      },
      //  JSONB (para acceso por clave dentro del JSON) 
      {
        name: 'idx_health_snapshots_location_gin',
        fields: ['location'],
        using: 'gin'
      },
      {
        name: 'idx_health_snapshots_geom_gist',
        fields: ['geom'],
        using: 'gist'
      }
    ],
    hooks: {
      // ── Sincronizar geom cada vez que location cambia ──────────────────
      // De esta forma las queries PostGIS (ST_DWithin, ST_Distance, etc.)
      // siempre trabajan sobre datos actualizados sin leer el JSONB.
      beforeSave: async (snapshot: BovineHealthSnapshot) => {
        if (snapshot.changed('location') || snapshot.isNewRecord) {
          const { latitude, longitude } = snapshot.location;
          snapshot.geom = {
            type: 'Point',
            coordinates: [longitude, latitude]
          };
        }
      }
    },
    comment: 'Snapshots de salud para consultas rápidas en mapas de calor'
  }
);

export default BovineHealthSnapshot;