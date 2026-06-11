import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';
import Location from './Location';

// Enums específicos para LocationInfo
export enum CurrentCondition {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR'
}

// Atributos del modelo LocationInfo
export interface LocationInfoAttributes {
  
  locationId: string;                    // FK a Location (OBLIGATORIO)
  description?: string;                   // Descripción detallada
  currentCondition: CurrentCondition;     // Condición actual
  currentNotes?: string;                  // Notas sobre condición actual
  
  notes: string;                          // Notas generales (obligatorio)
  tags: string[];                          // Array de etiquetas
  images?: string[];                       // URLs de imágenes
  documents?: string[];                     // URLs de documentos
  videos?: string[];                        // URLs de videos
  maps?: string[];                          // URLs de mapas específicos
  
  lastInspectionDate?: Date;               // Fecha última inspección
  nextInspectionDate?: Date;                // Fecha próxima inspección
  inspectionNotes?: string;                  // Notas de inspección
  inspectedBy?: string;                      // Inspector
  
  lastReviewedAt?: Date;                     // Fecha última revisión
  reviewedBy?: string;                        // Revisor
  lastUpdated: Date;                          // Fecha última actualización
  updatedBy: string;                           // Usuario que actualizó
  
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;                            // Soft delete
}

// Atributos opcionales al crear
export interface LocationInfoCreationAttributes
  extends Optional<LocationInfoAttributes,
    'description' | 'currentNotes' | 'images' | 'documents' | 
    'videos' | 'maps' | 'lastInspectionDate' | 'nextInspectionDate' | 
    'inspectionNotes' | 'inspectedBy' | 'lastReviewedAt' | 'reviewedBy' |
    'deletedAt'
  > {}


class LocationInfo extends Model {
 
  
  public locationId!: string;
  public description?: string;
  public currentCondition!: CurrentCondition;
  public currentNotes?: string;

  public notes!: string;
  public tags!: string[];
  public images?: string[];
  public documents?: string[];
  public videos?: string[];
  public maps?: string[];

  public lastInspectionDate?: Date;
  public nextInspectionDate?: Date;
  public inspectionNotes?: string;
  public inspectedBy?: string;
  
  public lastReviewedAt?: Date;
  public reviewedBy?: string;
  public lastUpdated!: Date;
  public updatedBy!: string;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;

// Métodos de instancia

  /**
   * Obtiene la condición actual en español
   * @returns Condición traducida
   */
  public getConditionLabel(): string {
    const labels = {
      [CurrentCondition.EXCELLENT]: 'Excelente',
      [CurrentCondition.GOOD]: 'Buena',
      [CurrentCondition.FAIR]: 'Regular',
      [CurrentCondition.POOR]: 'Mala'
    };
    return labels[this.currentCondition];
  }

  /**
   * Verifica si necesita inspección
   * @returns True si necesita inspección
   */
  public needsInspection(): boolean {
    if (!this.nextInspectionDate) return true;
    return new Date() >= new Date(this.nextInspectionDate);
  }

  /**
   * Verifica si necesita revisión
   * @param daysThreshold Días para considerar revisión necesaria
   * @returns True si necesita revisión
   */
  public needsReview(daysThreshold: number = 30): boolean {
    if (!this.lastReviewedAt) return true;
    
    const daysSinceReview = Math.floor(
      (new Date().getTime() - this.lastReviewedAt.getTime()) / (1000 * 3600 * 24)
    );
    
    return daysSinceReview >= daysThreshold;
  }

  /**
   * Obtiene el resumen de la información
   * @returns Resumen formateado
   */
  public getInfoSummary(): {
    condition: string;
    needsInspection: boolean;
    needsReview: boolean;
    lastInspection: Date | null;
    nextInspection: Date | null;
    lastReview: Date | null;
    mediaCount: {
      images: number;
      documents: number;
      videos: number;
      maps: number;
    };
  } {
    return {
      condition: this.getConditionLabel(),
      needsInspection: this.needsInspection(),
      needsReview: this.needsReview(),
      lastInspection: this.lastInspectionDate || null,
      nextInspection: this.nextInspectionDate || null,
      lastReview: this.lastReviewedAt || null,
      mediaCount: {
        images: this.images?.length || 0,
        documents: this.documents?.length || 0,
        videos: this.videos?.length || 0,
        maps: this.maps?.length || 0
      }
    };
  }
}

// Definición del modelo en Sequelize
LocationInfo.init(
  {
    
    locationId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      references: {
        model: 'locations',
        key: 'id'
      },
      // Una ubicación solo puede tener un registro de información
      comment: 'ID de la ubicación (relación 1:1)'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción detallada de la ubicación'
    },
    currentCondition: {
      type: DataTypes.ENUM(...Object.values(CurrentCondition)),
      allowNull: false,
      defaultValue: CurrentCondition.GOOD,
    },
    currentNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas sobre la condición actual'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
      comment: 'Notas generales de la ubicación'
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
      comment: 'Etiquetas para categorización'
    },
    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de imágenes de la ubicación',
      validate: {
        isValidImages(value: string[]) {
          if (value) {
            value.forEach((url, index) => {
              if (!url.match(/^https?:\/\/.+/)) {
                throw new Error(`URL de imagen inválida en índice ${index}`);
              }
            });
          }
        }
      }
    },
    documents: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de documentos relacionados'
    },
    videos: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de videos de la ubicación'
    },
    maps: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de mapas específicos'
    },
    lastInspectionDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de la última inspección'
    },
    nextInspectionDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de la próxima inspección',
      validate: {
        isAfterLastInspection(value: Date) {
          if (this.lastInspectionDate && value <= this.lastInspectionDate) {
            throw new Error('La próxima inspección debe ser posterior a la última');
          }
        }
      }
    },
    inspectionNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas de la última inspección'
    },
    inspectedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del inspector'
    },
    lastReviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de la última revisión'
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del revisor'
    },
    lastUpdated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de última actualización de la información'
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
    modelName: 'LocationInfo',
    tableName: 'location_info',
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        
        fields: ['location_id']
      },
      {
        fields: ['current_condition']
      },
      {
        fields: ['last_inspection_date']
      },
      {
        fields: ['next_inspection_date']
      },
      {
        fields: ['last_reviewed_at']
      },
      {
        name: 'location_info_inspection_dates',
        fields: ['next_inspection_date', 'last_inspection_date']
      },
      {
        name: 'location_info_condition_status',
        fields: ['current_condition', 'next_inspection_date']
      }
    ],
    hooks: {
      beforeSave: async (info: LocationInfo) => {
        // Actualizar lastUpdated automáticamente
        info.lastUpdated = new Date();
        
        // Validar que nextInspectionDate sea posterior a lastInspectionDate
        if (info.lastInspectionDate && info.nextInspectionDate) {
          if (info.nextInspectionDate <= info.lastInspectionDate) {
            throw new Error('La próxima inspección debe ser posterior a la última inspección');
          }
        }

        // Validar que inspectedBy esté presente si hay fecha de inspección
        if (info.lastInspectionDate && !info.inspectedBy) {
          throw new Error('Debe especificar el inspector cuando registra una inspección');
        }

        // Validar que reviewedBy esté presente si hay fecha de revisión
        if (info.lastReviewedAt && !info.reviewedBy) {
          throw new Error('Debe especificar el revisor cuando registra una revisión');
        }

        // Sanitizar tags (eliminar duplicados, trim)
        if (info.tags) {
          info.tags = [...new Set(info.tags.map(tag => tag.trim()))];
        }
      }
    },
    comment: 'Tabla para información detallada y dinámica de ubicaciones'
  }
);

export default LocationInfo;
