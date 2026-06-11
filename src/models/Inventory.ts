import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';
import { LocationData } from './Bovine';

// Enums para categorías de inventario
export enum InventoryCategory {
  FEED = 'FEED',                           // Alimentos
  MEDICATION = 'MEDICATION',               // Medicamentos
  VACCINES = 'VACCINES',                   // Vacunas
  EQUIPMENT = 'EQUIPMENT',                 // Equipos
  TOOLS = 'TOOLS',                         // Herramientas
  SUPPLIES = 'SUPPLIES',                   // Suministros
  BREEDING_MATERIALS = 'BREEDING_MATERIALS', // Materiales de reproducción
  CLEANING_PRODUCTS = 'CLEANING_PRODUCTS', // Productos de limpieza
  SAFETY_EQUIPMENT = 'SAFETY_EQUIPMENT',   // Equipo de seguridad
  OFFICE_SUPPLIES = 'OFFICE_SUPPLIES',     // Suministros de oficina
  FUEL = 'FUEL',                          // Combustible
  SEEDS = 'SEEDS',                        // Semillas
  FERTILIZERS = 'FERTILIZERS',            // Fertilizantes
  PESTICIDES = 'PESTICIDES',              // Pesticidas
  SPARE_PARTS = 'SPARE_PARTS',            // Repuestos
  OTHER = 'OTHER'                         // Otros
}

export enum StockStatus {
  IN_STOCK = 'IN_STOCK',                  // En stock
  LOW_STOCK = 'LOW_STOCK',                // Stock bajo
  OUT_OF_STOCK = 'OUT_OF_STOCK',          // Sin stock
  BACKORDERED = 'BACKORDERED',            // Pedido pendiente
  DISCONTINUED = 'DISCONTINUED',          // Descontinuado
  EXPIRED = 'EXPIRED',                    // Vencido
  DAMAGED = 'DAMAGED',                    // Dañado
  RESERVED = 'RESERVED'                   // Reservado
}

export enum StorageCondition {
  AMBIENT = 'AMBIENT',                    // Temperatura ambiente
  REFRIGERATED = 'REFRIGERATED',          // Refrigerado
  FROZEN = 'FROZEN',                      // Congelado
  DRY = 'DRY',                           // Seco
  HUMID = 'HUMID',                       // Húmedo
  CONTROLLED_ATMOSPHERE = 'CONTROLLED_ATMOSPHERE', // Atmósfera controlada
  HAZMAT = 'HAZMAT',                     // Materiales peligrosos
  SPECIAL = 'SPECIAL'                    // Condiciones especiales
}

export enum MovementType {
  PURCHASE = 'PURCHASE',                  // Compra
  SALE = 'SALE',                         // Venta
  USE = 'USE',                           // Uso/Consumo
  TRANSFER = 'TRANSFER',                 // Transferencia
  ADJUSTMENT = 'ADJUSTMENT',             // Ajuste de inventario
  RETURN = 'RETURN',                     // Devolución
  WASTE = 'WASTE',                       // Desperdicio
  DONATION = 'DONATION',                 // Donación
  THEFT = 'THEFT',                       // Robo
  EXPIRATION = 'EXPIRATION',             // Vencimiento
  DAMAGE = 'DAMAGE',                     // Daño
  PRODUCTION = 'PRODUCTION'              // Producción interna
}

export enum UnitOfMeasure {
  // Peso
  KG = 'KG',                             // Kilogramos
  G = 'G',                               // Gramos
  LB = 'LB',                             // Libras
  OZ = 'OZ',                             // Onzas
  TON = 'TON',                           // Toneladas

  // Volumen
  L = 'L',                               // Litros
  ML = 'ML',                             // Mililitros
  GAL = 'GAL',                           // Galones
  QT = 'QT',                             // Cuartos
  PT = 'PT',                             // Pintas

  // Longitud
  M = 'M',                               // Metros
  CM = 'CM',                             // Centímetros
  MM = 'MM',                             // Milímetros
  FT = 'FT',                             // Pies
  IN = 'IN',                             // Pulgadas

  // Área
  M2 = 'M2',                             // Metros cuadrados
  FT2 = 'FT2',                           // Pies cuadrados
  HA = 'HA',                             // Hectáreas
  ACRE = 'ACRE',                         // Acres

  // Unidades discretas
  UNIT = 'UNIT',                         // Unidades
  DOZEN = 'DOZEN',                       // Docenas
  BOX = 'BOX',                           // Cajas
  PACK = 'PACK',                         // Paquetes
  BOTTLE = 'BOTTLE',                     // Botellas
  BAG = 'BAG',                           // Bolsas
  ROLL = 'ROLL',                         // Rollos
  SHEET = 'SHEET',                       // Hojas

  // Tiempo
  DAY = 'DAY',                           // Días
  WEEK = 'WEEK',                         // Semanas
  MONTH = 'MONTH',                       // Meses
  YEAR = 'YEAR'                          // Años
}

export enum AlertType {
  LOW_STOCK = 'LOW_STOCK',               // Stock bajo
  EXPIRATION_WARNING = 'EXPIRATION_WARNING', // Alerta de vencimiento
  EXPIRED = 'EXPIRED',                   // Vencido
  DAMAGED = 'DAMAGED',                   // Dañado
  TEMPERATURE_ALERT = 'TEMPERATURE_ALERT', // Alerta de temperatura
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS', // Acceso no autorizado
  MISSING_ITEM = 'MISSING_ITEM',         // Artículo faltante
  QUALITY_ISSUE = 'QUALITY_ISSUE',       // Problema de calidad
  RECALL = 'RECALL',                     // Retiro del mercado
  MAINTENANCE_DUE = 'MAINTENANCE_DUE'    // Mantenimiento vencido
}

// Interface para información del proveedor
export interface SupplierInfo {
  supplierId?: string;                   // ID del proveedor
  supplierName: string;                  // Nombre del proveedor
  contactPerson?: string;                // Persona de contacto
  phone?: string;                        // Teléfono
  email?: string;                        // Email
  address?: string;                      // Dirección
  website?: string;                      // Sitio web
  taxId?: string;                        // RFC o ID fiscal
  paymentTerms?: string;                 // Términos de pago
  deliveryTime?: number;                 // Tiempo de entrega (días)
  notes?: string;                        // Notas del proveedor
}

// Interface para información nutricional (para alimentos)
export interface NutritionalInfo {
  protein?: number;                      // Proteína (%)
  fat?: number;                          // Grasa (%)
  fiber?: number;                        // Fibra (%)
  moisture?: number;                     // Humedad (%)
  ash?: number;                          // Cenizas (%)
  carbohydrates?: number;                // Carbohidratos (%)
  energy?: number;                       // Energía (kcal/kg)
  calcium?: number;                      // Calcio (%)
  phosphorus?: number;                   // Fósforo (%)
  vitamins?: Array<{                     // Vitaminas
    name: string;
    amount: number;
    unit: string;
  }>;
  minerals?: Array<{                     // Minerales
    name: string;
    amount: number;
    unit: string;
  }>;
}

// Interface para información de medicamentos
export interface MedicationInfo {
  activeIngredient?: string;             // Principio activo
  concentration?: string;                // Concentración
  dosage?: string;                       // Dosificación
  administration?: string;               // Forma de administración
  withdrawalPeriod?: number;             // Período de retiro (días)
  contraindications?: string[];          // Contraindicaciones
  sideEffects?: string[];                // Efectos secundarios
  storage?: string;                      // Condiciones de almacenamiento
  prescriptionRequired?: boolean;        // Si requiere receta
  controlledSubstance?: boolean;         // Si es sustancia controlada
}

// Interface para especificaciones técnicas
export interface TechnicalSpecs {
  dimensions?: {                         // Dimensiones
    length?: number;
    width?: number;
    height?: number;
    unit: string;
  };
  weight?: number;                       // Peso
  capacity?: number;                     // Capacidad
  powerConsumption?: number;             // Consumo de energía
  voltage?: number;                      // Voltaje
  material?: string;                     // Material
  color?: string;                        // Color
  model?: string;                        // Modelo
  serialNumber?: string;                 // Número de serie
  manufacturingDate?: Date;              // Fecha de fabricación
  warranty?: number;                     // Garantía (meses)
  specifications?: Array<{               // Especificaciones adicionales
    name: string;
    value: string;
    unit?: string;
  }>;
}

// Interface para control de calidad
export interface QualityControl {
  inspectionDate?: Date;                 // Fecha de inspección
  inspector?: string;                    // Inspector
  qualityGrade?: 'A' | 'B' | 'C' | 'D' | 'F'; // Grado de calidad
  defects?: string[];                    // Defectos encontrados
  testResults?: Array<{                  // Resultados de pruebas
    test: string;
    result: string;
    passedStandard: boolean;
    notes?: string;
  }>;
  certifications?: string[];             // Certificaciones
  complianceStatus?: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING'; // Estado de cumplimiento
  correctiveActions?: string[];          // Acciones correctivas
  nextInspectionDate?: Date;             // Próxima inspección
}

// Atributos del modelo Inventory
export interface InventoryAttributes {
  id: string;
  itemCode: string;                      // Código único del artículo
  itemName: string;                      // Nombre del artículo
  description?: string;                  // Descripción detallada
  category: InventoryCategory;           // Categoría del inventario
  brand?: string;                        // Marca
  model?: string;                        // Modelo
  barcode?: string;                      // Código de barras
  qrCode?: string;                       // Código QR
  currentStock: number;                  // Stock actual
  reservedStock: number;                // Stock reservado
  availableStock: number;               // Stock disponible (actual - reservado)
  minimumStock: number;                 // Stock mínimo
  maximumStock?: number;                // Stock máximo
  reorderPoint: number;                 // Punto de reorden
  reorderQuantity: number;              // Cantidad de reorden
  unitOfMeasure: UnitOfMeasure;         // Unidad de medida
  unitCost: number;                     // Costo unitario
  totalValue: number;                   // Valor total del inventario
  currency: string;                     // Moneda
  status: StockStatus;                  // Estado del stock
  storageLocation: string;              // Ubicación de almacenamiento
  storageCondition: StorageCondition;   // Condiciones de almacenamiento
  location?: LocationData;              // Ubicación geográfica del almacén
  supplierInfo?: SupplierInfo;          // Información del proveedor
  purchaseDate?: Date;                  // Fecha de compra
  expirationDate?: Date;                // Fecha de vencimiento
  manufacturingDate?: Date;             // Fecha de fabricación
  batchNumber?: string;                 // Número de lote
  serialNumbers?: string[];             // Números de serie (para equipos)
  nutritionalInfo?: NutritionalInfo;    // Información nutricional (alimentos)
  medicationInfo?: MedicationInfo;      // Información de medicamentos
  technicalSpecs?: TechnicalSpecs;      // Especificaciones técnicas
  qualityControl?: QualityControl;      // Control de calidad
  images?: string[];                    // URLs de imágenes
  documents?: string[];                 // URLs de documentos
  tags?: string[];                      // Etiquetas para categorización
  notes?: string;                       // Notas adicionales
  lastInventoryDate?: Date;             // Fecha del último inventario físico
  lastMovementDate?: Date;              // Fecha del último movimiento
  isActive: boolean;                    // Si el artículo está activo
  trackSerial: boolean;                 // Si se rastrean números de serie
  trackExpiration: boolean;             // Si se rastrea fecha de vencimiento
  trackBatch: boolean;                  // Si se rastrean lotes
  allowNegativeStock: boolean;          // Si permite stock negativo
  isCritical: boolean;                  // Si es artículo crítico
  isHazardous: boolean;                 // Si es material peligroso
  temperatureMin?: number;              // Temperatura mínima de almacenamiento
  temperatureMax?: number;              // Temperatura máxima de almacenamiento
  humidityMin?: number;                 // Humedad mínima
  humidityMax?: number;                 // Humedad máxima
  ranchId?: string;                      // ID de la finca
  warehouseId?: string;                 // ID del almacén
  createdBy: string;                    // ID del usuario que creó
  updatedBy?: string;                   // ID del usuario que actualizó
  
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  medicationId?: string;
}

// Atributos opcionales al crear un nuevo artículo de inventario
export interface InventoryCreationAttributes
  extends Optional<InventoryAttributes,
    'id' | 'description' | 'brand' | 'model' | 'barcode' | 'qrCode' |
    'reservedStock' | 'availableStock' | 'maximumStock' | 'location' |
    'supplierInfo' | 'purchaseDate' | 'expirationDate' | 'manufacturingDate' |
    'batchNumber' | 'serialNumbers' | 'nutritionalInfo' | 'medicationInfo' |
    'technicalSpecs' | 'qualityControl' | 'images' | 'documents' | 'tags' |
    'notes' | 'lastInventoryDate' | 'lastMovementDate' | 'temperatureMin' |
    'temperatureMax' | 'humidityMin' | 'humidityMax' | 'ranchId' |
    'warehouseId' | 'updatedBy' |  'deletedAt' | 'medicationId'
  > { }

// Clase del modelo Inventory
class Inventory extends Model<InventoryAttributes, InventoryCreationAttributes>
  implements InventoryAttributes {
  public id!: string;
  public itemCode!: string;
  public itemName!: string;
  public description?: string;
  public category!: InventoryCategory;
  public brand?: string;
  public model?: string;
  public barcode?: string;
  public qrCode?: string;
  public currentStock!: number;
  public reservedStock!: number;
  public availableStock!: number;
  public minimumStock!: number;
  public maximumStock?: number;
  public reorderPoint!: number;
  public reorderQuantity!: number;
  public unitOfMeasure!: UnitOfMeasure;
  public unitCost!: number;
  public totalValue!: number;
  public currency!: string;
  public status!: StockStatus;
  public storageLocation!: string;
  public storageCondition!: StorageCondition;
  public location?: LocationData;
  public supplierInfo?: SupplierInfo;
  public purchaseDate?: Date;
  public expirationDate?: Date;
  public manufacturingDate?: Date;
  public batchNumber?: string;
  public serialNumbers?: string[];
  public nutritionalInfo?: NutritionalInfo;
  public medicationInfo?: MedicationInfo;
  public technicalSpecs?: TechnicalSpecs;
  public qualityControl?: QualityControl;
  public images?: string[];
  public documents?: string[];
  public tags?: string[];
  public notes?: string;
  public lastInventoryDate?: Date;
  public lastMovementDate?: Date;
  public isActive!: boolean;
  public trackSerial!: boolean;
  public trackExpiration!: boolean;
  public trackBatch!: boolean;
  public allowNegativeStock!: boolean;
  public isCritical!: boolean;
  public isHazardous!: boolean;
  public temperatureMin?: number;
  public temperatureMax?: number;
  public humidityMin?: number;
  public humidityMax?: number;
  public ranchId?: string;
  public warehouseId?: string;
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;
  public medicationId?: string;

  // Métodos de instancia

  /**
   * Actualiza el stock disponible basado en el stock actual y reservado
   */
  public updateAvailableStock(): void {
    this.availableStock = this.currentStock - this.reservedStock;
  }

  /**
   * Actualiza el valor total del inventario
   */
  public updateTotalValue(): void {
    this.totalValue = this.currentStock * this.unitCost;
  }

  /**
   * Verifica si el artículo necesita reorden
   * @returns True si necesita reorden
   */
  public needsReorder(): boolean {
    return this.availableStock <= this.reorderPoint;
  }

  /**
   * Verifica si el stock está bajo
   * @returns True si el stock está bajo
   */
  public isLowStock(): boolean {
    return this.availableStock <= this.minimumStock;
  }

  /**
   * Verifica si el artículo está vencido
   * @returns True si está vencido
   */
  public isExpired(): boolean {
    if (!this.expirationDate) return false;
    return new Date() > new Date(this.expirationDate);
  }

  /**
   * Verifica si el artículo está próximo a vencer
   * @param days Días de anticipación para considerar próximo a vencer
   * @returns True si está próximo a vencer
   */
  public isNearExpiration(days: number = 30): boolean {
    if (!this.expirationDate) return false;
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + days);
    return new Date(this.expirationDate) <= warningDate;
  }

  /**
   * Obtiene la categoría en español
   * @returns Categoría traducida
   */
  public getCategoryLabel(): string {
    const labels = {
      [InventoryCategory.FEED]: 'Alimentos',
      [InventoryCategory.MEDICATION]: 'Medicamentos',
      [InventoryCategory.VACCINES]: 'Vacunas',
      [InventoryCategory.EQUIPMENT]: 'Equipos',
      [InventoryCategory.TOOLS]: 'Herramientas',
      [InventoryCategory.SUPPLIES]: 'Suministros',
      [InventoryCategory.BREEDING_MATERIALS]: 'Materiales de Reproducción',
      [InventoryCategory.CLEANING_PRODUCTS]: 'Productos de Limpieza',
      [InventoryCategory.SAFETY_EQUIPMENT]: 'Equipo de Seguridad',
      [InventoryCategory.OFFICE_SUPPLIES]: 'Suministros de Oficina',
      [InventoryCategory.FUEL]: 'Combustible',
      [InventoryCategory.SEEDS]: 'Semillas',
      [InventoryCategory.FERTILIZERS]: 'Fertilizantes',
      [InventoryCategory.PESTICIDES]: 'Pesticidas',
      [InventoryCategory.SPARE_PARTS]: 'Repuestos',
      [InventoryCategory.OTHER]: 'Otros'
    };
    return labels[this.category];
  }

  /**
   * Obtiene el estado del stock en español
   * @returns Estado del stock traducido
   */
  public getStatusLabel(): string {
    const labels = {
      [StockStatus.IN_STOCK]: 'En Stock',
      [StockStatus.LOW_STOCK]: 'Stock Bajo',
      [StockStatus.OUT_OF_STOCK]: 'Sin Stock',
      [StockStatus.BACKORDERED]: 'Pedido Pendiente',
      [StockStatus.DISCONTINUED]: 'Descontinuado',
      [StockStatus.EXPIRED]: 'Vencido',
      [StockStatus.DAMAGED]: 'Dañado',
      [StockStatus.RESERVED]: 'Reservado'
    };
    return labels[this.status];
  }

  /**
   * Obtiene la unidad de medida en español
   * @returns Unidad de medida traducida
   */
  public getUnitLabel(): string {
    const labels: Record<UnitOfMeasure, string> = {
      // Peso
      [UnitOfMeasure.KG]: 'Kilogramos',
      [UnitOfMeasure.G]: 'Gramos',
      [UnitOfMeasure.LB]: 'Libras',
      [UnitOfMeasure.OZ]: 'Onzas',
      [UnitOfMeasure.TON]: 'Toneladas',

      // Volumen
      [UnitOfMeasure.L]: 'Litros',
      [UnitOfMeasure.ML]: 'Mililitros',
      [UnitOfMeasure.GAL]: 'Galones',
      [UnitOfMeasure.QT]: 'Cuartos',
      [UnitOfMeasure.PT]: 'Pintas',

      // Longitud
      [UnitOfMeasure.M]: 'Metros',
      [UnitOfMeasure.CM]: 'Centímetros',
      [UnitOfMeasure.MM]: 'Milímetros',
      [UnitOfMeasure.FT]: 'Pies',
      [UnitOfMeasure.IN]: 'Pulgadas',

      // Área
      [UnitOfMeasure.M2]: 'Metros Cuadrados',
      [UnitOfMeasure.FT2]: 'Pies Cuadrados',
      [UnitOfMeasure.HA]: 'Hectáreas',
      [UnitOfMeasure.ACRE]: 'Acres',

      // Unidades discretas
      [UnitOfMeasure.UNIT]: 'Unidades',
      [UnitOfMeasure.DOZEN]: 'Docenas',
      [UnitOfMeasure.BOX]: 'Cajas',
      [UnitOfMeasure.PACK]: 'Paquetes',
      [UnitOfMeasure.BOTTLE]: 'Botellas',
      [UnitOfMeasure.BAG]: 'Bolsas',
      [UnitOfMeasure.ROLL]: 'Rollos',
      [UnitOfMeasure.SHEET]: 'Hojas',

      // Tiempo
      [UnitOfMeasure.DAY]: 'Días',
      [UnitOfMeasure.WEEK]: 'Semanas',
      [UnitOfMeasure.MONTH]: 'Meses',
      [UnitOfMeasure.YEAR]: 'Años'
    };
    return labels[this.unitOfMeasure];
  }

  /**
   * Calcula los días hasta el vencimiento
   * @returns Días hasta vencimiento (negativo si ya venció)
   */
  public getDaysToExpiration(): number | null {
    if (!this.expirationDate) return null;
    const now = new Date();
    const expiration = new Date(this.expirationDate);
    const diffTime = expiration.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Calcula la rotación de inventario
   * @param periodicUsage Uso en el período
   * @returns Índice de rotación
   */
  public calculateTurnoverRate(periodicUsage: number): number {
    if (this.currentStock === 0) return 0;
    return periodicUsage / this.currentStock;
  }

  /**
   * Formatea el valor total con moneda
   * @returns Valor formateado
   */
  public getFormattedValue(): string {
    const currencySymbols: { [key: string]: string } = {
      'MXN': '$',
      'USD': '$',
      'EUR': '€',
      'GBP': '£'
    };

    const symbol = currencySymbols[this.currency] || this.currency;
    return `${symbol}${this.totalValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  }

  /**
   * Obtiene alertas activas del artículo
   * @returns Array de alertas
   */
  public getActiveAlerts(): Array<{
    type: AlertType;
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }> {
    const alerts: Array<{
      type: AlertType;
      message: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }> = [];

    // Alerta de stock bajo
    if (this.isLowStock()) {
      alerts.push({
        type: AlertType.LOW_STOCK,
        message: `Stock bajo: ${this.availableStock} ${this.getUnitLabel()}`,
        severity: 'HIGH'
      });
    }

    // Alerta de vencimiento
    if (this.isExpired()) {
      alerts.push({
        type: AlertType.EXPIRED,
        message: 'Artículo vencido',
        severity: 'CRITICAL'
      });
    } else if (this.isNearExpiration()) {
      const days = this.getDaysToExpiration();
      alerts.push({
        type: AlertType.EXPIRATION_WARNING,
        message: `Vence en ${days} días`,
        severity: days && days <= 7 ? 'HIGH' : 'MEDIUM'
      });
    }

    // Alerta de artículo dañado
    if (this.status === StockStatus.DAMAGED) {
      alerts.push({
        type: AlertType.DAMAGED,
        message: 'Artículo dañado',
        severity: 'HIGH'
      });
    }

    return alerts;
  }

  /**
   * Verifica si el artículo es un medicamento
   * @returns True si es medicamento
   */
  public isMedication(): boolean {
    return this.category === InventoryCategory.MEDICATION ||
      this.category === InventoryCategory.VACCINES;
  }

  /**
   * Verifica si el artículo es alimento
   * @returns True si es alimento
   */
  public isFeed(): boolean {
    return this.category === InventoryCategory.FEED;
  }

  /**
   * Obtiene el porcentaje de stock disponible
   * @returns Porcentaje de stock (0-100)
   */
  public getStockPercentage(): number {
    if (this.maximumStock && this.maximumStock > 0) {
      return (this.availableStock / this.maximumStock) * 100;
    }
    // Si no hay máximo definido, usar el punto de reorden como base
    if (this.reorderPoint > 0) {
      return Math.min((this.availableStock / (this.reorderPoint * 2)) * 100, 100);
    }
    return this.availableStock > 0 ? 100 : 0;
  }

  /**
   * Genera un resumen del estado del inventario
   * @returns Objeto con resumen del estado
   */
  public getInventorySummary(): {
    status: string;
    stockLevel: 'CRITICAL' | 'LOW' | 'NORMAL' | 'HIGH';
    alerts: Array<{ type: string; message: string; severity: string }>;
    needsAttention: boolean;
    daysToExpiration?: number;
    reorderNeeded: boolean;
  } {
    const alerts = this.getActiveAlerts();
    let stockLevel: 'CRITICAL' | 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL';

    if (this.availableStock <= 0) {
      stockLevel = 'CRITICAL';
    } else if (this.isLowStock()) {
      stockLevel = 'LOW';
    } else if (this.maximumStock && this.availableStock >= this.maximumStock * 0.8) {
      stockLevel = 'HIGH';
    }

    return {
      status: this.getStatusLabel(),
      stockLevel,
      alerts,
      needsAttention: alerts.length > 0 || this.needsReorder(),
      daysToExpiration: this.getDaysToExpiration() || undefined,
      reorderNeeded: this.needsReorder()
    };
  }
}

// Definición del modelo en Sequelize
Inventory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del artículo de inventario'
    },
    itemCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 50]
      },
      comment: 'Código único del artículo'
    },
    itemName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 200]
      },
      comment: 'Nombre del artículo'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción detallada del artículo'
    },
    category: {
      type: DataTypes.ENUM(...Object.values(InventoryCategory)),
      allowNull: false,
    },
    brand: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Marca del artículo'
    },
    model: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Modelo del artículo'
    },
    barcode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Código de barras'
    },
    qrCode: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Código QR'
    },
    currentStock: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'Stock actual disponible'
    },
    reservedStock: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'Stock reservado'
    },
    availableStock: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0,
      comment: 'Stock disponible (actual - reservado)'
    },
    minimumStock: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'Stock mínimo requerido'
    },
    maximumStock: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: true,
      validate: {
        min: 0
      },
      comment: 'Stock máximo permitido'
    },
    reorderPoint: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'Punto de reorden'
    },
    reorderQuantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'Cantidad de reorden'
    },
    unitOfMeasure: {
      type: DataTypes.ENUM(...Object.values(UnitOfMeasure)),
      allowNull: false,
    },
    unitCost: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      validate: {
        min: 0
      },
      comment: 'Costo unitario'
    },
    totalValue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'Valor total del inventario'
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'MXN',
      validate: {
        len: [3, 3],
        isUppercase: true
      },
      comment: 'Código de moneda ISO 4217'
    },
    status: {
      type: DataTypes.ENUM(...Object.values(StockStatus)),
      allowNull: false,
      defaultValue: StockStatus.IN_STOCK,
    },
    storageLocation: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      },
      comment: 'Ubicación de almacenamiento'
    },
    storageCondition: {
      type: DataTypes.ENUM(...Object.values(StorageCondition)),
      allowNull: false,
      defaultValue: StorageCondition.AMBIENT,
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Ubicación geográfica del almacén'
    },
    supplierInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información del proveedor'
    },
    purchaseDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de compra'
    },
    expirationDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de vencimiento'
    },
    manufacturingDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de fabricación'
    },
    batchNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Número de lote'
    },
    serialNumbers: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'Números de serie'
    },
    nutritionalInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información nutricional (para alimentos)'
    },
    medicationInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de medicamentos'
    },
    technicalSpecs: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Especificaciones técnicas'
    },
    qualityControl: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Control de calidad'
    },
    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de imágenes del artículo'
    },
    documents: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de documentos relacionados'
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'Etiquetas para categorización'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales'
    },
    lastInventoryDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha del último inventario físico'
    },
    lastMovementDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha del último movimiento'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el artículo está activo'
    },
    trackSerial: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si se rastrean números de serie'
    },
    trackExpiration: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si se rastrea fecha de vencimiento'
    },
    trackBatch: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si se rastrean lotes'
    },
    allowNegativeStock: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si permite stock negativo'
    },
    isCritical: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si es artículo crítico'
    },
    isHazardous: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si es material peligroso'
    },
    temperatureMin: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Temperatura mínima de almacenamiento (°C)'
    },
    temperatureMax: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Temperatura máxima de almacenamiento (°C)'
    },
    humidityMin: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 100
      },
      comment: 'Humedad mínima (%)'
    },
    humidityMax: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 100
      },
      comment: 'Humedad máxima (%)'
    },
    ranchId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID de la finca'
    },
    warehouseId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del almacén'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que creó el registro'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que actualizó el registro'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de eliminación (soft delete)'
    },
    medicationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'medications',
        key: 'id'
      },
      comment: 'ID del medicamento en el catálogo (si aplica)'
    },
  },
  {
    sequelize,
    modelName: 'Inventory',
    tableName: 'inventory',
    timestamps: true,
    paranoid: true, // Habilita soft delete
    indexes: [
      // Índices para optimizar consultas
      {
        
        fields: ['item_code']
      },
      {
        fields: ['category']
      },
      {
        fields: ['status']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['is_critical']
      },
      {
        fields: ['expiration_date']
      },
      {
        fields: ['current_stock']
      },
      {
        fields: ['ranch_id']
      },
      {
        fields: ['warehouse_id']
      },
      {
        fields: ['storage_location']
      },
      {
        name: 'inventory_stock_status',
        fields: ['current_stock', 'minimum_stock', 'status']
      },
      {
        name: 'inventory_expiration_warning',
        fields: ['expiration_date', 'track_expiration']
      },
      {
        name: 'inventory_location_category',
        fields: ['storage_location', 'category']
      },
      {
        name: 'inventory_location_gin',
        fields: ['location'],
        using: 'gin',
        where: {
          location: {
            [Op.ne]: null
          }
        }
      }
    ],
    hooks: {
      // Hook para actualizar stock disponible y valor total
      beforeSave: async (inventory: Inventory) => {
        // Actualizar stock disponible
        inventory.updateAvailableStock();

        // Actualizar valor total
        inventory.updateTotalValue();

        // Actualizar estado basado en stock
        if (inventory.currentStock <= 0) {
          inventory.status = StockStatus.OUT_OF_STOCK;
        } else if (inventory.isLowStock()) {
          inventory.status = StockStatus.LOW_STOCK;
        } else if (inventory.isExpired()) {
          inventory.status = StockStatus.EXPIRED;
        } else {
          inventory.status = StockStatus.IN_STOCK;
        }

        // Validaciones adicionales
        if (inventory.maximumStock && inventory.minimumStock >= inventory.maximumStock) {
          throw new Error('El stock mínimo no puede ser mayor o igual al stock máximo');
        }

        if (inventory.reservedStock > inventory.currentStock) {
          throw new Error('El stock reservado no puede ser mayor al stock actual');
        }

        if (inventory.expirationDate && inventory.manufacturingDate) {
          if (inventory.expirationDate <= inventory.manufacturingDate) {
            throw new Error('La fecha de vencimiento debe ser posterior a la fecha de fabricación');
          }
        }

        // Actualizar fecha de último movimiento
        if (inventory.changed('currentStock') || inventory.changed('reservedStock')) {
          inventory.lastMovementDate = new Date();
        }
      }
    },
    comment: 'Tabla para el manejo completo del inventario de la operación ganadera'
  }
);

export default Inventory;