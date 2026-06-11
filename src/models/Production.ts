import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';
import { LocationData } from './Bovine';

// Enums para tipos de producción
export enum ProductionType {
  MILK = 'MILK',                               // Leche
  MEAT = 'MEAT',                               // Carne
  BREEDING = 'BREEDING',                       // Reproducción/Cría
  CALVES = 'CALVES',                           // Terneros
  LEATHER = 'LEATHER',                         // Cuero
  MANURE = 'MANURE',                           // Estiércol
  BIOGAS = 'BIOGAS',                           // Biogás
  SERVICES = 'SERVICES',                       // Servicios (monta, inseminación)
  OTHER = 'OTHER'                              // Otro
}

export enum ProductionStatus {
  PLANNED = 'PLANNED',                         // Planeada
  IN_PROGRESS = 'IN_PROGRESS',                 // En proceso
  COMPLETED = 'COMPLETED',                     // Completada
  SUSPENDED = 'SUSPENDED',                     // Suspendida
  CANCELLED = 'CANCELLED',                     // Cancelada
  DELAYED = 'DELAYED'                          // Retrasada
}

export enum QualityGrade {
  PREMIUM = 'PREMIUM',                         // Premium
  GRADE_A = 'GRADE_A',                         // Grado A
  GRADE_B = 'GRADE_B',                         // Grado B
  GRADE_C = 'GRADE_C',                         // Grado C
  SUBSTANDARD = 'SUBSTANDARD',                 // Bajo estándar
  REJECTED = 'REJECTED'                        // Rechazado
}

export enum MilkingMethod {
  MANUAL = 'MANUAL',                           // Manual
  MECHANICAL = 'MECHANICAL',                   // Mecánico
  AUTOMATED = 'AUTOMATED',                     // Automatizado
  ROBOTIC = 'ROBOTIC'                          // Robótico
}

export enum MeatCut {
  CARCASS = 'CARCASS',                         // Canal
  FOREQUARTER = 'FOREQUARTER',                 // Cuarto delantero
  HINDQUARTER = 'HINDQUARTER',                 // Cuarto trasero
  CHUCK = 'CHUCK',                             // Paleta
  RIB = 'RIB',                                 // Costilla
  LOIN = 'LOIN',                               // Lomo
  ROUND = 'ROUND',                             // Pierna
  BRISKET = 'BRISKET',                         // Pecho
  PLATE = 'PLATE',                             // Falda
  FLANK = 'FLANK',                             // Ijada
  ORGANS = 'ORGANS',                           // Órganos
  OTHER = 'OTHER'                              // Otro
}

// Interface para información de producción de leche
export interface MilkProductionInfo {
  milkingSession: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT'; // Sesión de ordeño
  milkingMethod: MilkingMethod;                // Método de ordeño
  volume: number;                              // Volumen en litros
  fatContent?: number;                         // Contenido de grasa (%)
  proteinContent?: number;                     // Contenido de proteína (%)
  lactoseContent?: number;                     // Contenido de lactosa (%)
  somaticCellCount?: number;                   // Conteo de células somáticas
  bacterialCount?: number;                     // Conteo bacteriano
  antibioticResidues?: boolean;                // Residuos de antibióticos
  temperature?: number;                        // Temperatura (°C)
  ph?: number;                                 // pH
  density?: number;                            // Densidad
  freezingPoint?: number;                      // Punto de congelación
  milkingDuration?: number;                    // Duración del ordeño (minutos)
  milkingSpeed?: number;                       // Velocidad de ordeño (L/min)
  equipmentUsed?: string[];                    // Equipos utilizados
  milkerPersonnel?: string;                    // Personal que ordeñó
  complications?: string[];                    // Complicaciones durante el ordeño
  notes?: string;                              // Notas del ordeño
}

// Interface para información de producción de carne
export interface MeatProductionInfo {
  slaughterDate: Date;                         // Fecha de sacrificio
  slaughterhouse: string;                      // Rastro/Matadero
  liveWeight: number;                          // Peso vivo (kg)
  carcassWeight: number;                       // Peso de canal (kg)
  dressingPercentage: number;                  // Rendimiento de canal (%)
  meatCuts: Array<{                            // Cortes de carne
    cut: MeatCut;
    weight: number;
    pricePerKg: number;
    totalValue: number;
  }>;
  qualityGrade: QualityGrade;                  // Grado de calidad
  marbling?: 'TRACE' | 'SLIGHT' | 'SMALL' | 'MODEST' | 'MODERATE' | 'ABUNDANT'; // Marmoleo
  maturity?: 'A' | 'B' | 'C' | 'D' | 'E';     // Madurez
  yieldGrade?: 1 | 2 | 3 | 4 | 5;             // Grado de rendimiento
  fatThickness?: number;                       // Espesor de grasa (mm)
  ribeye_area?: number;                        // Área del ojo de costilla (cm²)
  condemnations?: string[];                    // Decomisos
  processingCosts?: number;                    // Costos de procesamiento
  transportCosts?: number;                     // Costos de transporte
  totalProcessingTime?: number;                // Tiempo total de procesamiento (horas)
  inspectionResults?: string;                  // Resultados de inspección
  certifications?: string[];                   // Certificaciones obtenidas
}

// Interface para información de reproducción/cría
export interface BreedingProductionInfo {
  breedingType: 'NATURAL' | 'ARTIFICIAL_INSEMINATION' | 'EMBRYO_TRANSFER'; // Tipo de reproducción
  sireId?: string;                             // ID del padre
  sireName?: string;                           // Nombre del padre
  serviceDate: Date;                           // Fecha de servicio
  conceptionDate?: Date;                       // Fecha de concepción
  gestationPeriod?: number;                    // Período de gestación (días)
  calvingDate?: Date;                          // Fecha de parto
  calvingDifficulty?: 'EASY' | 'MODERATE' | 'DIFFICULT' | 'CESAREAN'; // Dificultad del parto
  calfId?: string;                             // ID del ternero
  calfGender?: 'MALE' | 'FEMALE';             // Sexo del ternero
  birthWeight?: number;                        // Peso al nacer (kg)
  calfViability?: 'ALIVE' | 'DEAD' | 'WEAK';  // Viabilidad del ternero
  placentaExpulsion?: 'NORMAL' | 'RETAINED' | 'INCOMPLETE'; // Expulsión de placenta
  postPartumComplications?: string[];          // Complicaciones post-parto
  weaningDate?: Date;                          // Fecha de destete
  weaningWeight?: number;                      // Peso al destete (kg)
  averageDailyGain?: number;                   // Ganancia diaria promedio (kg/día)
  reproductiveEfficiency?: number;             // Eficiencia reproductiva (%)
  serviceNumbers?: number;                     // Número de servicios
  conceptionRate?: number;                     // Tasa de concepción (%)
  veterinarianId?: string;                     // ID del veterinario
  assistanceRequired?: boolean;                // Si requirió asistencia
  medications?: string[];                      // Medicamentos utilizados
}

// Interface para métricas de calidad
export interface QualityMetrics {
  overallGrade: QualityGrade;                  // Grado general de calidad
  testResults?: Array<{                        // Resultados de pruebas
    test: string;
    value: number | string;
    unit?: string;
    standardRange?: string;
    passFail: 'PASS' | 'FAIL' | 'PENDING';
    testDate: Date;
    laboratory?: string;
  }>;
  certifications?: Array<{                     // Certificaciones
    type: string;
    certifyingBody: string;
    issueDate: Date;
    expirationDate: Date;
    certificateNumber: string;
    status: 'VALID' | 'EXPIRED' | 'SUSPENDED';
  }>;
  defects?: string[];                          // Defectos encontrados
  improvements?: string[];                     // Mejoras recomendadas
  complianceStatus?: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING'; // Estado de cumplimiento
  qualityScore?: number;                       // Puntaje de calidad (0-100)
  benchmarkComparison?: {                      // Comparación con benchmark
    industryAverage: number;
    percentile: number;
    ranking: 'BELOW_AVERAGE' | 'AVERAGE' | 'ABOVE_AVERAGE' | 'EXCELLENT';
  };
}

// Interface para información de mercado
export interface MarketInfo {
  targetMarket: 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'EXPORT'; // Mercado objetivo
  buyer?: string;                              // Comprador
  buyerContact?: string;                       // Contacto del comprador
  contractNumber?: string;                     // Número de contrato
  pricePerUnit: number;                        // Precio por unidad
  totalValue: number;                          // Valor total
  currency: string;                            // Moneda
  paymentTerms?: string;                       // Términos de pago
  deliveryTerms?: string;                      // Términos de entrega
  deliveryDate?: Date;                         // Fecha de entrega
  marketConditions?: string;                   // Condiciones del mercado
  competitivePrice?: number;                   // Precio competitivo
  priceVariation?: number;                     // Variación de precio (%)
  demandLevel?: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH'; // Nivel de demanda
  seasonalFactors?: string[];                  // Factores estacionales
  marketTrends?: string;                       // Tendencias del mercado
}

// Interface para análisis económico
export interface EconomicAnalysis {
  productionCosts: {                           // Costos de producción
    feedCosts: number;
    laborCosts: number;
    veterinaryCosts: number;
    equipmentCosts: number;
    facilityCosts: number;
    transportCosts: number;
    packagingCosts: number;
    marketingCosts: number;
    administrativeCosts: number;
    otherCosts: number;
    totalCosts: number;
  };
  revenue: {                                   // Ingresos
    primaryProduct: number;
    byProducts: number;
    premiums: number;
    subsidies: number;
    totalRevenue: number;
  };
  profitability: {                             // Rentabilidad
    grossProfit: number;
    grossMargin: number;                       // Margen bruto (%)
    netProfit: number;
    netMargin: number;                         // Margen neto (%)
    roi: number;                               // Retorno de inversión (%)
    breakEvenPoint: number;                    // Punto de equilibrio
    paybackPeriod: number;                     // Período de recuperación (meses)
  };
  efficiency: {                                // Eficiencia
    productionPerAnimal: number;               // Producción por animal
    costPerUnit: number;                       // Costo por unidad
    revenuePerAnimal: number;                  // Ingreso por animal
    feedConversionRatio?: number;              // Conversión alimenticia
    laborProductivity: number;                 // Productividad laboral
    equipmentUtilization: number;              // Utilización de equipos (%)
  };
  benchmarks: {                                // Comparaciones
    industryAverage: number;
    topPerformers: number;
    regionalAverage: number;
    performance: 'BELOW_AVERAGE' | 'AVERAGE' | 'ABOVE_AVERAGE' | 'EXCELLENT';
  };
}

// Atributos del modelo Production
export interface ProductionAttributes {
  id: string;
  productionCode: string;                      // Código único de producción
  productionType: ProductionType;              // Tipo de producción
  bovineId: string;                            // ID del bovino productor
  productionDate: Date;                        // Fecha de producción
  quantity: number;                            // Cantidad producida
  unit: string;                                // Unidad de medida
  status: ProductionStatus;                    // Estado de la producción
  qualityGrade?: QualityGrade;                 // Grado de calidad
  location?: LocationData;                     // Ubicación de producción
  milkInfo?: MilkProductionInfo;               // Información específica de leche
  meatInfo?: MeatProductionInfo;               // Información específica de carne
  breedingInfo?: BreedingProductionInfo;       // Información de reproducción
  qualityMetrics?: QualityMetrics;             // Métricas de calidad
  marketInfo?: MarketInfo;                     // Información de mercado
  economicAnalysis?: EconomicAnalysis;         // Análisis económico
  batchNumber?: string;                        // Número de lote
  productionShift?: 'MORNING' | 'AFTERNOON' | 'NIGHT'; // Turno de producción
  weather?: {                                  // Condiciones climáticas
    temperature: number;
    humidity: number;
    conditions: string;
  };
  equipmentUsed?: string[];                    // Equipos utilizados
  personnelInvolved?: string[];                // Personal involucrado
  supervisorId?: string;                       // ID del supervisor
  inspectionResults?: string;                  // Resultados de inspección
  certifications?: string[];                   // Certificaciones aplicables
  traceabilityCode?: string;                   // Código de trazabilidad
  storageInfo?: {                              // Información de almacenamiento
    storageLocation: string;
    storageConditions: string;
    storageTemperature?: number;
    storageDate: Date;
    expectedShelfLife?: number;
  };
  processingInfo?: {                           // Información de procesamiento
    processingMethod: string;
    processingTime: number;
    processingTemperature?: number;
    additives?: string[];
    processingLoss?: number;
  };
  packaging?: {                                // Información de empaque
    packagingType: string;
    packageSize: number;
    numberOfPackages: number;
    packagingDate: Date;
    labelingInfo: string;
    barcodes?: string[];
  };
  distributionInfo?: {                         // Información de distribución
    distributor?: string;
    transportMethod: string;
    distributionDate?: Date;
    destinationMarket: string;
    expectedDeliveryDate?: Date;
    trackingNumber?: string;
  };
  rejectionInfo?: {                            // Información de rechazos
    rejectionReason: string;
    rejectedQuantity: number;
    rejectionDate: Date;
    disposition: 'DESTROYED' | 'REPURPOSED' | 'DONATED' | 'COMPOSTED';
    rejectedBy: string;
  };
  compliance?: {                               // Cumplimiento regulatorio
    regulatoryRequirements: string[];
    complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
    inspectionDate?: Date;
    inspector?: string;
    corrective_actions?: string[];
  };
  sustainabilityMetrics?: {                    // Métricas de sostenibilidad
    carbonFootprint?: number;                  // Huella de carbono
    waterUsage?: number;                       // Uso de agua
    energyConsumption?: number;                // Consumo de energía
    wasteGenerated?: number;                   // Residuos generados
    recyclableContent?: number;                // Contenido reciclable (%)
    organicCertification?: boolean;            // Certificación orgánica
  };
  images?: string[];                           // URLs de imágenes
  documents?: string[];                        // URLs de documentos
  videos?: string[];                           // URLs de videos
  notes?: string;                              // Notas adicionales
  isCompleted: boolean;                        // Si la producción está completa
  isApproved: boolean;                         // Si está aprobada
  approvedBy?: string;                         // ID del usuario que aprobó
  approvedDate?: Date;                         // Fecha de aprobación
  isActive: boolean;                           // Si está activa
  farmId?: string;                             // ID de la finca
  seasonId?: string;                           // ID de la temporada
  createdBy: string;                           // ID del usuario que creó
  updatedBy?: string;                          // ID del usuario que actualizó
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

// Atributos opcionales al crear un nuevo registro de producción
export interface ProductionCreationAttributes 
  extends Optional<ProductionAttributes, 
    'id' | 'qualityGrade' | 'location' | 'milkInfo' | 'meatInfo' | 'breedingInfo' | 
    'qualityMetrics' | 'marketInfo' | 'economicAnalysis' | 'batchNumber' | 
    'productionShift' | 'weather' | 'equipmentUsed' | 'personnelInvolved' | 
    'supervisorId' | 'inspectionResults' | 'certifications' | 'traceabilityCode' | 
    'storageInfo' | 'processingInfo' | 'packaging' | 'distributionInfo' | 
    'rejectionInfo' | 'compliance' | 'sustainabilityMetrics' | 'images' | 
    'documents' | 'videos' | 'notes' | 'approvedBy' | 'approvedDate' | 
    'farmId' | 'seasonId' | 'updatedBy' | 'deletedAt'
  > {}

// Clase del modelo Production
class Production extends Model<ProductionAttributes, ProductionCreationAttributes> 
  implements ProductionAttributes {
  public id!: string;
  public productionCode!: string;
  public productionType!: ProductionType;
  public bovineId!: string;
  public productionDate!: Date;
  public quantity!: number;
  public unit!: string;
  public status!: ProductionStatus;
  public qualityGrade?: QualityGrade;
  public location?: LocationData;
  public milkInfo?: MilkProductionInfo;
  public meatInfo?: MeatProductionInfo;
  public breedingInfo?: BreedingProductionInfo;
  public qualityMetrics?: QualityMetrics;
  public marketInfo?: MarketInfo;
  public economicAnalysis?: EconomicAnalysis;
  public batchNumber?: string;
  public productionShift?: 'MORNING' | 'AFTERNOON' | 'NIGHT';
  public weather?: {
    temperature: number;
    humidity: number;
    conditions: string;
  };
  public equipmentUsed?: string[];
  public personnelInvolved?: string[];
  public supervisorId?: string;
  public inspectionResults?: string;
  public certifications?: string[];
  public traceabilityCode?: string;
  public storageInfo?: {
    storageLocation: string;
    storageConditions: string;
    storageTemperature?: number;
    storageDate: Date;
    expectedShelfLife?: number;
  };
  public processingInfo?: {
    processingMethod: string;
    processingTime: number;
    processingTemperature?: number;
    additives?: string[];
    processingLoss?: number;
  };
  public packaging?: {
    packagingType: string;
    packageSize: number;
    numberOfPackages: number;
    packagingDate: Date;
    labelingInfo: string;
    barcodes?: string[];
  };
  public distributionInfo?: {
    distributor?: string;
    transportMethod: string;
    distributionDate?: Date;
    destinationMarket: string;
    expectedDeliveryDate?: Date;
    trackingNumber?: string;
  };
  public rejectionInfo?: {
    rejectionReason: string;
    rejectedQuantity: number;
    rejectionDate: Date;
    disposition: 'DESTROYED' | 'REPURPOSED' | 'DONATED' | 'COMPOSTED';
    rejectedBy: string;
  };
  public compliance?: {
    regulatoryRequirements: string[];
    complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
    inspectionDate?: Date;
    inspector?: string;
    corrective_actions?: string[];
  };
  public sustainabilityMetrics?: {
    carbonFootprint?: number;
    waterUsage?: number;
    energyConsumption?: number;
    wasteGenerated?: number;
    recyclableContent?: number;
    organicCertification?: boolean;
  };
  public images?: string[];
  public documents?: string[];
  public videos?: string[];
  public notes?: string;
  public isCompleted!: boolean;
  public isApproved!: boolean;
  public approvedBy?: string;
  public approvedDate?: Date;
  public isActive!: boolean;
  public farmId?: string;
  public seasonId?: string;
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;

  // Métodos de instancia

  /**
   * Obtiene el tipo de producción en español
   * @returns Tipo de producción traducido
   */
  public getProductionTypeLabel(): string {
    const labels = {
      [ProductionType.MILK]: 'Leche',
      [ProductionType.MEAT]: 'Carne',
      [ProductionType.BREEDING]: 'Reproducción/Cría',
      [ProductionType.CALVES]: 'Terneros',
      [ProductionType.LEATHER]: 'Cuero',
      [ProductionType.MANURE]: 'Estiércol',
      [ProductionType.BIOGAS]: 'Biogás',
      [ProductionType.SERVICES]: 'Servicios',
      [ProductionType.OTHER]: 'Otro'
    };
    return labels[this.productionType];
  }

  /**
   * Obtiene el estado de producción en español
   * @returns Estado traducido
   */
  public getStatusLabel(): string {
    const labels = {
      [ProductionStatus.PLANNED]: 'Planeada',
      [ProductionStatus.IN_PROGRESS]: 'En Proceso',
      [ProductionStatus.COMPLETED]: 'Completada',
      [ProductionStatus.SUSPENDED]: 'Suspendida',
      [ProductionStatus.CANCELLED]: 'Cancelada',
      [ProductionStatus.DELAYED]: 'Retrasada'
    };
    return labels[this.status];
  }

  /**
   * Calcula el valor económico total de la producción
   * @returns Valor total o null si no hay información de mercado
   */
  public getTotalEconomicValue(): number | null {
    if (!this.marketInfo) return null;
    return this.marketInfo.totalValue;
  }

  /**
   * Calcula la rentabilidad de la producción
   * @returns Información de rentabilidad
   */
  public getProfitabilityMetrics(): {
    grossProfit?: number;
    grossMargin?: number;
    netProfit?: number;
    netMargin?: number;
    roi?: number;
  } | null {
    if (!this.economicAnalysis) return null;
    
    return {
      grossProfit: this.economicAnalysis.profitability.grossProfit,
      grossMargin: this.economicAnalysis.profitability.grossMargin,
      netProfit: this.economicAnalysis.profitability.netProfit,
      netMargin: this.economicAnalysis.profitability.netMargin,
      roi: this.economicAnalysis.profitability.roi
    };
  }

  /**
   * Verifica si la producción cumple con estándares de calidad
   * @returns True si cumple con los estándares
   */
  public meetsQualityStandards(): boolean {
    if (!this.qualityMetrics) return true; // Si no hay métricas, asumimos que cumple
    
    return this.qualityMetrics.complianceStatus === 'COMPLIANT' &&
           this.qualityGrade !== QualityGrade.REJECTED &&
           this.qualityGrade !== QualityGrade.SUBSTANDARD;
  }

  /**
   * Obtiene las certificaciones vigentes
   * @returns Array de certificaciones válidas
   */
  public getValidCertifications(): Array<{
    type: string;
    certifyingBody: string;
    expirationDate: Date;
  }> | null {
    if (!this.qualityMetrics?.certifications) return null;
    
    const now = new Date();
    return this.qualityMetrics.certifications
      .filter(cert => cert.status === 'VALID' && cert.expirationDate > now)
      .map(cert => ({
        type: cert.type,
        certifyingBody: cert.certifyingBody,
        expirationDate: cert.expirationDate
      }));
  }

  /**
   * Calcula la eficiencia de producción por animal
   * @returns Eficiencia por animal
   */
  public getProductionEfficiency(): number | null {
    if (!this.economicAnalysis) return null;
    return this.economicAnalysis.efficiency.productionPerAnimal;
  }

  /**
   * Verifica si la producción está en temporada alta
   * @returns True si está en temporada alta
   */
  public isInPeakSeason(): boolean {
    const month = this.productionDate.getMonth();
    
    // Para leche, temporada alta típicamente en primavera (marzo-mayo)
    if (this.productionType === ProductionType.MILK) {
      return month >= 2 && month <= 4;
    }
    
    // Para carne, temporada alta en otoño (septiembre-noviembre)
    if (this.productionType === ProductionType.MEAT) {
      return month >= 8 && month <= 10;
    }
    
    return false;
  }

  /**
   * Obtiene el resumen de sostenibilidad
   * @returns Métricas de sostenibilidad
   */
  public getSustainabilityScore(): {
    score: number;
    category: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';
    improvements: string[];
  } | null {
    if (!this.sustainabilityMetrics) return null;
    
    let score = 0;
    const improvements: string[] = [];
    
    // Evaluar huella de carbono (peso: 30%)
    if (this.sustainabilityMetrics.carbonFootprint !== undefined) {
      if (this.sustainabilityMetrics.carbonFootprint < 10) score += 30;
      else if (this.sustainabilityMetrics.carbonFootprint < 20) score += 20;
      else if (this.sustainabilityMetrics.carbonFootprint < 30) score += 10;
      else improvements.push('Reducir huella de carbono');
    }
    
    // Evaluar uso de agua (peso: 25%)
    if (this.sustainabilityMetrics.waterUsage !== undefined) {
      if (this.sustainabilityMetrics.waterUsage < 1000) score += 25;
      else if (this.sustainabilityMetrics.waterUsage < 2000) score += 15;
      else if (this.sustainabilityMetrics.waterUsage < 3000) score += 5;
      else improvements.push('Optimizar uso de agua');
    }
    
    // Evaluar contenido reciclable (peso: 20%)
    if (this.sustainabilityMetrics.recyclableContent !== undefined) {
      if (this.sustainabilityMetrics.recyclableContent > 80) score += 20;
      else if (this.sustainabilityMetrics.recyclableContent > 60) score += 15;
      else if (this.sustainabilityMetrics.recyclableContent > 40) score += 10;
      else improvements.push('Aumentar contenido reciclable');
    }
    
    // Evaluar certificación orgánica (peso: 25%)
    if (this.sustainabilityMetrics.organicCertification) {
      score += 25;
    } else {
      improvements.push('Considerar certificación orgánica');
    }
    
    let category: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';
    if (score >= 80) category = 'EXCELLENT';
    else if (score >= 60) category = 'GOOD';
    else if (score >= 40) category = 'FAIR';
    else category = 'POOR';
    
    return { score, category, improvements };
  }

  /**
   * Genera código de trazabilidad único
   * @returns Código de trazabilidad
   */
  public generateTraceabilityCode(): string {
    const date = this.productionDate.toISOString().split('T')[0].replace(/-/g, '');
    const type = this.productionType.substring(0, 3);
    const bovineCode = this.bovineId.substring(0, 8);
    return `${type}-${date}-${bovineCode}-${this.id.substring(0, 6)}`.toUpperCase();
  }

  /**
   * Verifica si necesita inspección de calidad
   * @returns True si necesita inspección
   */
  public needsQualityInspection(): boolean {
    // Si es producción de alto valor o para exportación
    if (this.marketInfo?.targetMarket === 'EXPORT') return true;
    
    // Si es carne o leche de grado premium
    if ((this.productionType === ProductionType.MILK || this.productionType === ProductionType.MEAT) &&
        this.qualityGrade === QualityGrade.PREMIUM) return true;
    
    // Si no ha sido inspeccionada
    if (!this.compliance?.inspectionDate) return true;
    
    // Si la última inspección fue hace más de 30 días
    if (this.compliance.inspectionDate) {
      const daysSinceInspection = Math.floor(
        (new Date().getTime() - new Date(this.compliance.inspectionDate).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      return daysSinceInspection > 30;
    }
    
    return false;
  }

  /**
   * Calcula el tiempo hasta la fecha de vencimiento
   * @returns Días hasta vencimiento o null
   */
  public getDaysToExpiration(): number | null {
    if (!this.storageInfo?.expectedShelfLife) return null;
    
    const storageDate = new Date(this.storageInfo.storageDate);
    const expirationDate = new Date(storageDate);
    expirationDate.setDate(expirationDate.getDate() + this.storageInfo.expectedShelfLife);
    
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Genera un resumen completo de la producción
   * @returns Resumen detallado
   */
  public getProductionSummary(): {
    basic: {
      type: string;
      quantity: number;
      unit: string;
      date: Date;
      status: string;
    };
    quality: {
      grade?: string;
      meetsStandards: boolean;
      certifications: number;
    };
    economic: {
      totalValue?: number;
      profitMargin?: number;
      efficiency?: number;
    };
    sustainability: {
      score?: number;
      category?: string;
    };
    compliance: {
      status?: string;
      needsInspection: boolean;
    };
    alerts: string[];
  } {
    const alerts: string[] = [];
    
    // Verificar alertas
    if (this.needsQualityInspection()) {
      alerts.push('Requiere inspección de calidad');
    }
    
    const daysToExpiration = this.getDaysToExpiration();
    if (daysToExpiration !== null && daysToExpiration <= 7) {
      alerts.push(`Vence en ${daysToExpiration} días`);
    }
    
    if (!this.meetsQualityStandards()) {
      alerts.push('No cumple estándares de calidad');
    }
    
    const sustainability = this.getSustainabilityScore();
    const profitability = this.getProfitabilityMetrics();
    const validCertifications = this.getValidCertifications();
    
    return {
      basic: {
        type: this.getProductionTypeLabel(),
        quantity: this.quantity,
        unit: this.unit,
        date: this.productionDate,
        status: this.getStatusLabel()
      },
      quality: {
        grade: this.qualityGrade,
        meetsStandards: this.meetsQualityStandards(),
        certifications: validCertifications?.length || 0
      },
      economic: {
        totalValue: this.getTotalEconomicValue() || undefined,
        profitMargin: profitability?.grossMargin,
        efficiency: this.getProductionEfficiency() || undefined
      },
      sustainability: {
        score: sustainability?.score,
        category: sustainability?.category
      },
      compliance: {
        status: this.compliance?.complianceStatus,
        needsInspection: this.needsQualityInspection()
      },
      alerts
    };
  }
}

// Definición del modelo en Sequelize
Production.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del registro de producción'
    },
    productionCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 50]
      },
      comment: 'Código único de producción'
    },
    productionType: {
      type: DataTypes.ENUM(...Object.values(ProductionType)),
      allowNull: false,
    },
    bovineId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'bovines',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'ID del bovino productor'
    },
    productionDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha de producción'
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      validate: {
        min: 0
      },
      comment: 'Cantidad producida'
    },
    unit: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true
      },
      comment: 'Unidad de medida'
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ProductionStatus)),
      allowNull: false,
      defaultValue: ProductionStatus.PLANNED,
    },
    qualityGrade: {
      type: DataTypes.ENUM(...Object.values(QualityGrade)),
      allowNull: true,
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Ubicación geográfica de la producción'
    },
    milkInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información específica de producción de leche'
    },
    meatInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información específica de producción de carne'
    },
    breedingInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de reproducción y cría'
    },
    qualityMetrics: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Métricas de calidad del producto'
    },
    marketInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de mercado y comercialización'
    },
    economicAnalysis: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Análisis económico de la producción'
    },
    batchNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Número de lote de producción'
    },
    productionShift: {
      type: DataTypes.ENUM('MORNING', 'AFTERNOON', 'NIGHT'),
      allowNull: true,
    },
    weather: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Condiciones climáticas durante la producción'
    },
    equipmentUsed: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'Equipos utilizados en la producción'
    },
    personnelInvolved: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'Personal involucrado en la producción'
    },
    supervisorId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del supervisor de producción'
    },
    inspectionResults: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Resultados de inspección'
    },
    certifications: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'Certificaciones aplicables'
    },
    traceabilityCode: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Código de trazabilidad único'
    },
    storageInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de almacenamiento'
    },
    processingInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de procesamiento'
    },
    packaging: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de empaque'
    },
    distributionInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de distribución'
    },
    rejectionInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de rechazos'
    },
    compliance: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de cumplimiento regulatorio'
    },
    sustainabilityMetrics: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Métricas de sostenibilidad'
    },
    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de imágenes de la producción'
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
      comment: 'URLs de videos de la producción'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales de la producción'
    },
    isCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si la producción está completa'
    },
    isApproved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si la producción está aprobada'
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que aprobó'
    },
    approvedDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de aprobación'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el registro está activo'
    },
    farmId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID de la finca'
    },
    seasonId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID de la temporada'
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
    }
  },
  {
    sequelize,
    modelName: 'Production',
    tableName: 'production',
    timestamps: true,
    paranoid: true, // Habilita soft delete
    indexes: [
      // Índices para optimizar consultas
      {
       
        fields: ['production_code']
      },
      {
        fields: ['production_type']
      },
      {
        fields: ['bovine_id']
      },
      {
        fields: ['production_date']
      },
      {
        fields: ['status']
      },
      {
        fields: ['quality_grade']
      },
      {
        fields: ['is_completed']
      },
      {
        fields: ['is_approved']
      },
      {
        fields: ['farm_id']
      },
      {
        fields: ['season_id']
      },
      {
        fields: ['traceability_code']
      },
      {
        name: 'production_bovine_date',
        fields: ['bovine_id', 'production_date']
      },
      {
        name: 'production_type_date',
        fields: ['production_type', 'production_date']
      },
      {
        name: 'production_status_date',
        fields: ['status', 'production_date']
      },
      {
        name: 'production_location_gin',
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
      // Hook para generar código de trazabilidad y validaciones
      beforeSave: async (production: Production) => {
        // Generar código de trazabilidad si no existe
        if (!production.traceabilityCode) {
          production.traceabilityCode = production.generateTraceabilityCode();
        }

        // Validar que la fecha de producción no sea futura
        if (production.productionDate > new Date()) {
          throw new Error('La fecha de producción no puede ser futura');
        }

        // Validar cantidad positiva
        if (production.quantity <= 0) {
          throw new Error('La cantidad debe ser mayor a cero');
        }

        // Auto-completar si cumple condiciones
        if (production.status === ProductionStatus.COMPLETED && !production.isCompleted) {
          production.isCompleted = true;
        }

        // Validar información específica según tipo
        if (production.productionType === ProductionType.MILK && production.milkInfo) {
          if (production.milkInfo.volume <= 0) {
            throw new Error('El volumen de leche debe ser mayor a cero');
          }
        }

        if (production.productionType === ProductionType.MEAT && production.meatInfo) {
          if (production.meatInfo.liveWeight <= 0 || production.meatInfo.carcassWeight <= 0) {
            throw new Error('Los pesos deben ser mayores a cero');
          }
          if (production.meatInfo.carcassWeight > production.meatInfo.liveWeight) {
            throw new Error('El peso de canal no puede ser mayor al peso vivo');
          }
        }
      }
    },
    comment: 'Tabla para el manejo completo de la producción ganadera'
  }
);

export default Production;