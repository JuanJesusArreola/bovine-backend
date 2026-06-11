import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';
import { LocationData } from './Bovine';

// Enums para reproducción
export enum ReproductionType {
  NATURAL_SERVICE = 'NATURAL_SERVICE',         // Monta natural
  ARTIFICIAL_INSEMINATION = 'ARTIFICIAL_INSEMINATION', // Inseminación artificial
  EMBRYO_TRANSFER = 'EMBRYO_TRANSFER',         // Transferencia de embriones
  IN_VITRO_FERTILIZATION = 'IN_VITRO_FERTILIZATION', // Fertilización in vitro
  CLONING = 'CLONING',                         // Clonación
  SYNCHRONIZED_BREEDING = 'SYNCHRONIZED_BREEDING', // Reproducción sincronizada
  MULTIPLE_OVULATION = 'MULTIPLE_OVULATION'    // Ovulación múltiple
}

export enum ServiceStatus {
  PLANNED = 'PLANNED',                         // Planeado
  IN_HEAT = 'IN_HEAT',                         // En celo
  SERVICED = 'SERVICED',                       // Servida
  CONFIRMED_PREGNANT = 'CONFIRMED_PREGNANT',   // Preñez confirmada
  OPEN = 'OPEN',                               // Vacía
  REPEAT_BREEDING = 'REPEAT_BREEDING',         // Repetición de servicio
  ABORTED = 'ABORTED',                         // Aborto
  CALVED = 'CALVED',                           // Parida
  WEANED = 'WEANED',                           // Destetada
  CULLED = 'CULLED'                            // Descartada
}

export enum HeatDetectionMethod {
  VISUAL_OBSERVATION = 'VISUAL_OBSERVATION',   // Observación visual
  HEAT_DETECTOR = 'HEAT_DETECTOR',             // Detector de celo
  PEDOMETER = 'PEDOMETER',                     // Podómetro
  ACTIVITY_MONITOR = 'ACTIVITY_MONITOR',       // Monitor de actividad
  PROGESTERONE_TEST = 'PROGESTERONE_TEST',     // Prueba de progesterona
  ULTRASOUND = 'ULTRASOUND',                   // Ultrasonido
  MOUNTING_BEHAVIOR = 'MOUNTING_BEHAVIOR',     // Comportamiento de monta
  VAGINAL_DISCHARGE = 'VAGINAL_DISCHARGE',     // Descarga vaginal
  TEMPERATURE_MONITORING = 'TEMPERATURE_MONITORING', // Monitoreo de temperatura
  HORMONE_ANALYSIS = 'HORMONE_ANALYSIS'        // Análisis hormonal
}

export enum PregnancyDiagnosisMethod {
  RECTAL_PALPATION = 'RECTAL_PALPATION',       // Palpación rectal
  ULTRASOUND = 'ULTRASOUND',                   // Ultrasonido
  BLOOD_TEST = 'BLOOD_TEST',                   // Prueba sanguínea
  MILK_TEST = 'MILK_TEST',                     // Prueba de leche
  URINE_TEST = 'URINE_TEST',                   // Prueba de orina
  HORMONE_ASSAY = 'HORMONE_ASSAY',             // Ensayo hormonal
  PREGNANCY_ASSOCIATED_GLYCOPROTEINS = 'PREGNANCY_ASSOCIATED_GLYCOPROTEINS' // Glicoproteínas asociadas
}

export enum CalvingDifficulty {
  EASY = 'EASY',                               // Fácil
  SLIGHT_ASSISTANCE = 'SLIGHT_ASSISTANCE',     // Asistencia leve
  MODERATE_ASSISTANCE = 'MODERATE_ASSISTANCE', // Asistencia moderada
  DIFFICULT = 'DIFFICULT',                     // Difícil
  CESAREAN = 'CESAREAN',                       // Cesárea
  EMBRYOTOMY = 'EMBRYOTOMY',                   // Embriotomía
  VETERINARY_ASSISTANCE = 'VETERINARY_ASSISTANCE' // Asistencia veterinaria
}

export enum CalfViability {
  ALIVE_NORMAL = 'ALIVE_NORMAL',               // Vivo normal
  ALIVE_WEAK = 'ALIVE_WEAK',                   // Vivo débil
  STILLBORN = 'STILLBORN',                     // Nacido muerto
  DIED_WITHIN_24H = 'DIED_WITHIN_24H',         // Murió en 24h
  DIED_WITHIN_WEEK = 'DIED_WITHIN_WEEK',       // Murió en la semana
  CONGENITAL_DEFECTS = 'CONGENITAL_DEFECTS'    // Defectos congénitos
}

export enum WeaningMethod {
  NATURAL = 'NATURAL',                         // Natural
  EARLY_WEANING = 'EARLY_WEANING',             // Destete temprano
  GRADUAL_WEANING = 'GRADUAL_WEANING',         // Destete gradual
  ABRUPT_WEANING = 'ABRUPT_WEANING',           // Destete abrupto
  FENCE_LINE_WEANING = 'FENCE_LINE_WEANING',   // Destete con cerca
  TWO_STAGE_WEANING = 'TWO_STAGE_WEANING'      // Destete en dos etapas
}

// Interface para información del sire/semental
export interface SireInfo {
  sireId?: string;                             // ID del semental
  sireName: string;                            // Nombre del semental
  sireBreed: string;                           // Raza del semental
  sireRegistration?: string;                   // Registro del semental
  sireAge?: number;                            // Edad del semental (meses)
  sireWeight?: number;                         // Peso del semental (kg)
  sireOwner?: string;                          // Propietario del semental
  sireEPDs?: {                                 // Diferencias Esperadas en la Progenie
    birthWeight: number;
    weaningWeight: number;
    yearlingWeight: number;
    milkProduction: number;
    maternalAbility: number;
    carcassWeight: number;
    ribeye_area: number;
    fatThickness: number;
    marbling: number;
  };
  sireGenetics?: {                             // Información genética
    bloodlines: string[];
    geneticMarkers: Array<{
      marker: string;
      value: string;
      significance: string;
    }>;
    inbreedingCoefficient?: number;
    genomicAccuracy?: number;
  };
  sireFertility?: {                            // Fertilidad del semental
    scrotalCircumference?: number;             // Circunferencia escrotal
    spermMotility?: number;                    // Motilidad espermática
    spermConcentration?: number;               // Concentración espermática
    abnormalSperm?: number;                    // Espermatozoides anormales (%)
    libido?: 'LOW' | 'MEDIUM' | 'HIGH';        // Libido
    breedingSoundness?: 'PASSED' | 'CONDITIONAL' | 'FAILED'; // Aptitud reproductiva
  };
  serviceHistory?: {                           // Historial de servicios
    totalServices: number;
    conceptionRate: number;                    // Tasa de concepción (%)
    averageGestation: number;                  // Gestación promedio (días)
    calvingEase: number;                       // Facilidad de parto (%)
    offspringViability: number;                // Viabilidad de crías (%)
  };
}

// Interface para información de semen/embrión
export interface GermplasmInfo {
  type: 'FRESH_SEMEN' | 'FROZEN_SEMEN' | 'FRESH_EMBRYO' | 'FROZEN_EMBRYO' | 'OOCYTES';
  supplier: string;                            // Proveedor
  batchNumber: string;                         // Número de lote
  collectionDate: Date;                        // Fecha de colección
  processingDate?: Date;                       // Fecha de procesamiento
  storageDate?: Date;                          // Fecha de almacenamiento
  expirationDate?: Date;                       // Fecha de vencimiento
  storageLocation: string;                     // Ubicación de almacenamiento
  storageTemperature: number;                  // Temperatura de almacenamiento
  quality?: {                                  // Calidad del material
    motility?: number;                         // Motilidad (%)
    concentration?: number;                    // Concentración
    viability?: number;                        // Viabilidad (%)
    morphology?: number;                       // Morfología normal (%)
    freezabilityScore?: number;                // Puntuación de congelabilidad
  };
  dosesAvailable?: number;                     // Dosis disponibles
  dosesUsed?: number;                          // Dosis utilizadas
  cost?: number;                               // Costo por dosis
  certification?: string;                      // Certificación sanitaria
  quarantineStatus?: 'RELEASED' | 'QUARANTINE' | 'TESTING'; // Estado de cuarentena
  healthTesting?: Array<{                      // Pruebas sanitarias
    test: string;
    result: 'POSITIVE' | 'NEGATIVE' | 'PENDING';
    date: Date;
    laboratory: string;
  }>;
}

// Interface para información de celo/estro
export interface HeatInfo {
  heatDetectionDate: Date;                     // Fecha de detección del celo
  heatDetectionTime: string;                   // Hora de detección (HH:MM)
  detectionMethod: HeatDetectionMethod;        // Método de detección
  heatIntensity: 'WEAK' | 'MODERATE' | 'STRONG'; // Intensidad del celo
  heatDuration?: number;                       // Duración del celo (horas)
  behavioralSigns: string[];                   // Signos conductuales observados
  physicalSigns: string[];                     // Signos físicos observados
  cycleDay?: number;                           // Día del ciclo estral
  previousHeatDate?: Date;                     // Fecha del celo anterior
  cycleLength?: number;                        // Duración del ciclo (días)
  cycleRegularity: 'REGULAR' | 'IRREGULAR' | 'FIRST_HEAT'; // Regularidad del ciclo
  environmentalFactors?: {                     // Factores ambientales
    temperature: number;
    humidity: number;
    season: 'SPRING' | 'SUMMER' | 'FALL' | 'WINTER';
    dayLength: number;                         // Horas de luz
  };
  hormonalTreatment?: {                        // Tratamiento hormonal
    protocol: string;
    medications: Array<{
      medication: string;
      dose: number;
      date: Date;
      route: string;
    }>;
    synchronization: boolean;                  // Si fue sincronizado
  };
  technician?: string;                         // Técnico que detectó el celo
  confidence?: number;                         // Confianza en la detección (%)
  notes?: string;                              // Notas del celo
}

// Interface para información de servicio
export interface ServiceInfo {
  serviceDate: Date;                           // Fecha del servicio
  serviceTime: string;                         // Hora del servicio (HH:MM)
  serviceNumber: number;                       // Número de servicio (1, 2, 3...)
  serviceMethod: ReproductionType;             // Método de servicio
  serviceLocation: LocationData;               // Ubicación del servicio
  technician?: string;                         // Técnico que realizó el servicio
  veterinarian?: string;                       // Veterinario responsable
  serviceConditions?: {                        // Condiciones del servicio
    femaleCondition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'; // Condición de la hembra
    stressLevel: 'LOW' | 'MEDIUM' | 'HIGH';    // Nivel de estrés
    restraintMethod: string;                   // Método de sujeción
    hygiene: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'; // Higiene
    equipment: string[];                       // Equipos utilizados
  };
  complications?: string[];                    // Complicaciones durante el servicio
  postServiceCare?: string[];                  // Cuidados post-servicio
  medications?: Array<{                        // Medicamentos administrados
    medication: string;
    dose: number;
    route: string;
    purpose: string;
  }>;
  cost?: number;                               // Costo del servicio
  success_indicators?: string[];               // Indicadores de éxito
  followUpDate?: Date;                         // Fecha de seguimiento
  serviceNotes?: string;                       // Notas del servicio
}

// Interface para información de gestación
export interface PregnancyInfo {
  pregnancyDiagnosis: {                        // Diagnóstico de gestación
    method: PregnancyDiagnosisMethod;
    diagnosisDate: Date;
    resultDate: Date;
    result: 'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE';
    gestationAge?: number;                     // Edad gestacional (días)
    expectedCalvingDate?: Date;                // Fecha esperada de parto
    confidence: number;                        // Confianza en el diagnóstico (%)
    technician?: string;
    notes?: string;
  };
  pregnancyMonitoring?: Array<{                // Monitoreo de gestación
    checkDate: Date;
    gestationDay: number;
    method: string;
    findings: string;
    fetalViability: 'VIABLE' | 'NON_VIABLE' | 'QUESTIONABLE';
    fetalDevelopment?: 'NORMAL' | 'ADVANCED' | 'DELAYED';
    complications?: string[];
    recommendations?: string[];
    nextCheckDate?: Date;
    veterinarian?: string;
  }>;
  nutritionDuringPregnancy?: {                 // Nutrición durante gestación
    feedingPlan: string;
    supplementation: Array<{
      supplement: string;
      dosage: number;
      duration: number;
      purpose: string;
    }>;
    bodyConditionScore?: number;               // Puntuación de condición corporal
    weightGain?: number;                       // Ganancia de peso (kg)
    nutritionCost?: number;                    // Costo de nutrición
  };
  healthDuringPregnancy?: {                    // Salud durante gestación
    vaccinations: Array<{
      vaccine: string;
      date: Date;
      purpose: string;
    }>;
    healthChecks: Array<{
      date: Date;
      findings: string;
      treatments?: string[];
    }>;
    complications?: Array<{
      complication: string;
      date: Date;
      treatment: string;
      outcome: string;
    }>;
  };
  pregnancyLoss?: {                            // Pérdida de gestación
    lossDate: Date;
    gestationDay: number;
    cause: string;
    necropsy?: boolean;
    necropsyFindings?: string;
    preventiveMeasures?: string[];
  };
}

// Interface para información de parto
export interface CalvingInfo {
  calvingDate: Date;                           // Fecha de parto
  calvingTime?: string;                        // Hora de parto (HH:MM)
  gestationLength: number;                     // Duración de gestación (días)
  calvingDifficulty: CalvingDifficulty;        // Dificultad del parto
  assistance: {                                // Asistencia durante el parto
    assistanceRequired: boolean;
    assistedBy?: string;                       // Quién asistió
    veterinarianCalled: boolean;
    instruments_used?: string[];               // Instrumentos utilizados
    medications?: Array<{
      medication: string;
      dose: number;
      purpose: string;
    }>;
    duration?: number;                         // Duración del parto (minutos)
  };
  calvingLocation: LocationData;               // Ubicación del parto
  environmentalConditions?: {                  // Condiciones ambientales
    temperature: number;
    weather: string;
    facility: string;
    cleanliness: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  };
  calvingComplications?: Array<{               // Complicaciones del parto
    complication: string;
    severity: 'MILD' | 'MODERATE' | 'SEVERE';
    treatment: string;
    outcome: string;
  }>;
  placentaInfo?: {                             // Información de placenta
    expulsion: 'NORMAL' | 'RETAINED' | 'INCOMPLETE';
    expulsionTime?: number;                    // Tiempo de expulsión (horas)
    condition?: string;                        // Condición de la placenta
    treatment?: string;                        // Tratamiento si es necesario
  };
  damCondition?: {                             // Condición de la madre post-parto
    postCalvingHealth: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    appetite: 'NORMAL' | 'REDUCED' | 'ABSENT';
    mobility: 'NORMAL' | 'SLIGHT_STIFFNESS' | 'DIFFICULTY_STANDING';
    udderCondition: 'NORMAL' | 'SWOLLEN' | 'MASTITIS' | 'INJURY';
    postCalvingTreatments?: string[];
    complications?: string[];
  };
  calvingCost?: number;                        // Costo del parto
  calvingNotes?: string;                       // Notas del parto
}

// Interface para información del ternero
export interface CalfInfo {
  calfId?: string;                             // ID del ternero
  calfTag?: string;                            // Etiqueta del ternero
  calfName?: string;                           // Nombre del ternero
  sex: 'MALE' | 'FEMALE';                      // Sexo del ternero
  birthWeight: number;                         // Peso al nacer (kg)
  viability: CalfViability;                    // Viabilidad del ternero
  birthCondition?: {                           // Condición al nacer
    vigor: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'; // Vigor
    breathingPattern: 'NORMAL' | 'LABORED' | 'WEAK'; // Patrón respiratorio
    reflexes: 'STRONG' | 'MODERATE' | 'WEAK' | 'ABSENT'; // Reflejos
    temperatureRegulation: 'NORMAL' | 'HYPOTHERMIA' | 'HYPERTHERMIA'; // Regulación térmica
    firstStanding?: number;                    // Tiempo hasta pararse (minutos)
    firstNursing?: number;                     // Tiempo hasta mamar (minutos)
  };
  colostrumInfo?: {                            // Información de calostro
    firstColostrum: Date;                      // Primera toma de calostro
    colostrumSource: 'DAM' | 'POOLED' | 'SUPPLEMENT'; // Fuente del calostro
    colostrumQuality?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'; // Calidad del calostro
    volume?: number;                           // Volumen administrado (ml)
    iggLevel?: number;                         // Nivel de IgG
    passiveTransfer?: 'ADEQUATE' | 'INADEQUATE'; // Transferencia pasiva
  };
  identification?: {                           // Identificación del ternero
    earTagDate?: Date;                         // Fecha de colocación de etiqueta
    tatooDate?: Date;                          // Fecha de tatuaje
    microchipDate?: Date;                      // Fecha de microchip
    dnaTestDate?: Date;                        // Fecha de prueba de DNA
    photos?: string[];                         // Fotos del ternero
  };
  healthAtBirth?: {                            // Salud al nacer
    vaccinations?: Array<{
      vaccine: string;
      date: Date;
      age: number;                             // Edad en días
    }>;
    treatments?: Array<{
      treatment: string;
      date: Date;
      reason: string;
    }>;
    healthIssues?: string[];                   // Problemas de salud
    veterinaryExam?: {
      date: Date;
      findings: string;
      recommendations: string[];
    };
  };
  congenitalDefects?: Array<{                  // Defectos congénitos
    defect: string;
    severity: 'MILD' | 'MODERATE' | 'SEVERE';
    treatment?: string;
    prognosis?: string;
  }>;
  calfValue?: number;                          // Valor del ternero
  calfNotes?: string;                          // Notas del ternero
}

// Interface para información de destete
export interface WeaningInfo {
  weaningDate: Date;                           // Fecha de destete
  weaningAge: number;                          // Edad al destete (días)
  weaningWeight: number;                       // Peso al destete (kg)
  weaningMethod: WeaningMethod;                // Método de destete
  averageDailyGain: number;                    // Ganancia diaria promedio (kg/día)
  weaningRatio: number;                        // Ratio de destete (%)
  weaningCondition: {                          // Condición al destete
    bodyConditionScore: number;                // Puntuación de condición corporal
    healthStatus: 'HEALTHY' | 'SICK' | 'RECOVERING';
    behavioralAdaptation: 'EASY' | 'MODERATE' | 'DIFFICULT'; // Adaptación conductual
    feedTransition: 'SMOOTH' | 'GRADUAL' | 'DIFFICULT'; // Transición alimentaria
  };
  postWeaningManagement?: {                    // Manejo post-destete
    feedingPlan: string;
    healthProgram: string[];
    grouping: string;
    monitoring_schedule: string;
  };
  weaningStress?: {                            // Estrés del destete
    stressLevel: 'LOW' | 'MODERATE' | 'HIGH';
    stressIndicators: string[];
    mitigationMeasures: string[];
  };
  weaningCost?: number;                        // Costo del destete
  weaningNotes?: string;                       // Notas del destete
}

// Atributos del modelo Reproduction
export interface ReproductionAttributes {
  id: string;
  reproductionCode: string;                    // Código único de reproducción
  damId: string;                               // ID de la madre/vaca
  reproductionType: ReproductionType;          // Tipo de reproducción
  status: ServiceStatus;                       // Estado del servicio
  breedingSeasonId?: string;                   // ID de la temporada reproductiva
  sireInfo: SireInfo;                          // Información del semental
  germplasmInfo?: GermplasmInfo;               // Información de germoplasma
  heatInfo?: HeatInfo;                         // Información del celo
  serviceInfo: ServiceInfo;                    // Información del servicio
  pregnancyInfo?: PregnancyInfo;               // Información de gestación
  calvingInfo?: CalvingInfo;                   // Información de parto
  calfInfo?: CalfInfo;                         // Información del ternero
  weaningInfo?: WeaningInfo;                   // Información de destete
  reproductiveEfficiency?: {                   // Eficiencia reproductiva
    conceptionRate?: number;                   // Tasa de concepción (%)
    pregnancyRate?: number;                    // Tasa de preñez (%)
    calvingRate?: number;                      // Tasa de partos (%)
    weaningRate?: number;                      // Tasa de destete (%)
    calvingInterval?: number;                  // Intervalo entre partos (días)
    servicesPerConception?: number;            // Servicios por concepción
    daysToConception?: number;                 // Días hasta concepción
    daysOpen?: number;                         // Días abierta
    gestationLength?: number;                  // Duración de gestación (días)
  };
  economicAnalysis?: {                         // Análisis económico
    totalCosts: number;                        // Costos totales
    serviceCosts: number;                      // Costos de servicio
    pregnancyCosts: number;                    // Costos de gestación
    calvingCosts: number;                      // Costos de parto
    weaningCosts: number;                      // Costos de destete
    calfValue: number;                         // Valor del ternero
    netReturn: number;                         // Retorno neto
    roi: number;                               // Retorno de inversión (%)
    costPerDay: number;                        // Costo por día
  };
  geneticAnalysis?: {                          // Análisis genético
    parentageVerification?: boolean;           // Verificación de paternidad
    genomicTesting?: Array<{
      test: string;
      result: string;
      date: Date;
      laboratory: string;
    }>;
    expectedPerformance?: {                    // Rendimiento esperado
      birthWeight: number;
      weaningWeight: number;
      yearlingWeight: number;
      maternalAbility: number;
      carcassTraits: Object;
    };
    breedingValue?: number;                    // Valor genético
    inbreedingCoefficient?: number;            // Coeficiente de endogamia
  };
  healthRecords?: Array<{                      // Registros de salud
    date: Date;
    type: string;
    description: string;
    treatment?: string;
    veterinarian?: string;
    cost?: number;
  }>;
  images?: string[];                           // URLs de imágenes
  documents?: string[];                        // URLs de documentos
  videos?: string[];                           // URLs de videos
  notes?: string;                              // Notas generales
  isCompleted: boolean;                        // Si el ciclo está completo
  isSuccessful: boolean;                       // Si fue exitoso
  qualityScore?: number;                       // Puntuación de calidad (0-100)
  ranchId?: string;                            // ID del rancho
  seasonYear?: number;                         // Año de la temporada
  createdBy: string;                           // ID del usuario que creó
  updatedBy?: string;                          // ID del usuario que actualizó
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

// Atributos opcionales al crear un nuevo registro de reproducción
export interface ReproductionCreationAttributes 
  extends Optional<ReproductionAttributes, 
    'id' | 'breedingSeasonId' | 'germplasmInfo' | 'heatInfo' | 'pregnancyInfo' | 
    'calvingInfo' | 'calfInfo' | 'weaningInfo' | 'reproductiveEfficiency' | 
    'economicAnalysis' | 'geneticAnalysis' | 'healthRecords' | 'images' | 
    'documents' | 'videos' | 'notes' | 'qualityScore' | 'ranchId' | 
    'seasonYear' | 'updatedBy' | 'deletedAt'
  > {}

// Clase del modelo Reproduction
class Reproduction extends Model<ReproductionAttributes, ReproductionCreationAttributes> 
  implements ReproductionAttributes {
  public id!: string;
  public reproductionCode!: string;
  public damId!: string;
  public reproductionType!: ReproductionType;
  public status!: ServiceStatus;
  public breedingSeasonId?: string;
  public sireInfo!: SireInfo;
  public germplasmInfo?: GermplasmInfo;
  public heatInfo?: HeatInfo;
  public serviceInfo!: ServiceInfo;
  public pregnancyInfo?: PregnancyInfo;
  public calvingInfo?: CalvingInfo;
  public calfInfo?: CalfInfo;
  public weaningInfo?: WeaningInfo;
  public reproductiveEfficiency?: {
    conceptionRate?: number;
    pregnancyRate?: number;
    calvingRate?: number;
    weaningRate?: number;
    calvingInterval?: number;
    servicesPerConception?: number;
    daysToConception?: number;
    daysOpen?: number;
    gestationLength?: number;
  };
  public economicAnalysis?: {
    totalCosts: number;
    serviceCosts: number;
    pregnancyCosts: number;
    calvingCosts: number;
    weaningCosts: number;
    calfValue: number;
    netReturn: number;
    roi: number;
    costPerDay: number;
  };
  public geneticAnalysis?: {
    parentageVerification?: boolean;
    genomicTesting?: Array<{
      test: string;
      result: string;
      date: Date;
      laboratory: string;
    }>;
    expectedPerformance?: {
      birthWeight: number;
      weaningWeight: number;
      yearlingWeight: number;
      maternalAbility: number;
      carcassTraits: Object;
    };
    breedingValue?: number;
    inbreedingCoefficient?: number;
  };
  public healthRecords?: Array<{
    date: Date;
    type: string;
    description: string;
    treatment?: string;
    veterinarian?: string;
    cost?: number;
  }>;
  public images?: string[];
  public documents?: string[];
  public videos?: string[];
  public notes?: string;
  public isCompleted!: boolean;
  public isSuccessful!: boolean;
  public qualityScore?: number;
  public ranchId?: string;
  public seasonYear?: number;
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;

  // Métodos de instancia

  /**
   * Obtiene el tipo de reproducción en español
   * @returns Tipo traducido
   */
  public getReproductionTypeLabel(): string {
    const labels = {
      [ReproductionType.NATURAL_SERVICE]: 'Monta Natural',
      [ReproductionType.ARTIFICIAL_INSEMINATION]: 'Inseminación Artificial',
      [ReproductionType.EMBRYO_TRANSFER]: 'Transferencia de Embriones',
      [ReproductionType.IN_VITRO_FERTILIZATION]: 'Fertilización in Vitro',
      [ReproductionType.CLONING]: 'Clonación',
      [ReproductionType.SYNCHRONIZED_BREEDING]: 'Reproducción Sincronizada',
      [ReproductionType.MULTIPLE_OVULATION]: 'Ovulación Múltiple'
    };
    return labels[this.reproductionType];
  }

  /**
   * Obtiene el estado del servicio en español
   * @returns Estado traducido
   */
  public getStatusLabel(): string {
    const labels = {
      [ServiceStatus.PLANNED]: 'Planeado',
      [ServiceStatus.IN_HEAT]: 'En Celo',
      [ServiceStatus.SERVICED]: 'Servida',
      [ServiceStatus.CONFIRMED_PREGNANT]: 'Preñez Confirmada',
      [ServiceStatus.OPEN]: 'Vacía',
      [ServiceStatus.REPEAT_BREEDING]: 'Repetición de Servicio',
      [ServiceStatus.ABORTED]: 'Aborto',
      [ServiceStatus.CALVED]: 'Parida',
      [ServiceStatus.WEANED]: 'Destetada',
      [ServiceStatus.CULLED]: 'Descartada'
    };
    return labels[this.status];
  }

  /**
   * Calcula los días desde el servicio
   * @returns Días desde el servicio
   */
  public getDaysSinceService(): number {
    const now = new Date();
    const serviceDate = new Date(this.serviceInfo.serviceDate);
    const diffTime = now.getTime() - serviceDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Calcula la fecha estimada de parto
   * @returns Fecha estimada de parto
   */
  public getEstimatedCalvingDate(): Date | null {
    if (!this.pregnancyInfo?.pregnancyDiagnosis.expectedCalvingDate) {
      // Calcular basado en fecha de servicio + 280 días promedio
      const serviceDate = new Date(this.serviceInfo.serviceDate);
      serviceDate.setDate(serviceDate.getDate() + 280);
      return serviceDate;
    }
    return new Date(this.pregnancyInfo.pregnancyDiagnosis.expectedCalvingDate);
  }

  /**
   * Verifica si está próxima a parir
   * @param days Días de anticipación
   * @returns True si está próxima a parir
   */
  public isNearCalving(days: number = 14): boolean {
    const estimatedDate = this.getEstimatedCalvingDate();
    if (!estimatedDate) return false;
    
    const now = new Date();
    const diffTime = estimatedDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays <= days && diffDays >= 0;
  }

  /**
   * Calcula la eficiencia reproductiva general
   * @returns Puntuación de eficiencia (0-100)
   */
  public calculateReproductiveEfficiency(): number {
    let score = 0;
    let factors = 0;

    // Factor 1: Concepción al primer servicio (30%)
    if (this.serviceInfo.serviceNumber === 1 && this.status === ServiceStatus.CONFIRMED_PREGNANT) {
      score += 30;
    } else if (this.serviceInfo.serviceNumber <= 2 && this.status === ServiceStatus.CONFIRMED_PREGNANT) {
      score += 20;
    } else if (this.status === ServiceStatus.CONFIRMED_PREGNANT) {
      score += 10;
    }
    factors++;

    // Factor 2: Duración de gestación normal (20%)
    if (this.calvingInfo?.gestationLength) {
      const gestationDays = this.calvingInfo.gestationLength;
      if (gestationDays >= 275 && gestationDays <= 285) {
        score += 20;
      } else if (gestationDays >= 270 && gestationDays <= 290) {
        score += 15;
      } else {
        score += 5;
      }
    }
    factors++;

    // Factor 3: Facilidad de parto (15%)
    if (this.calvingInfo?.calvingDifficulty) {
      if (this.calvingInfo.calvingDifficulty === CalvingDifficulty.EASY) {
        score += 15;
      } else if (this.calvingInfo.calvingDifficulty === CalvingDifficulty.SLIGHT_ASSISTANCE) {
        score += 10;
      } else {
        score += 2;
      }
    }
    factors++;

    // Factor 4: Viabilidad del ternero (20%)
    if (this.calfInfo?.viability) {
      if (this.calfInfo.viability === CalfViability.ALIVE_NORMAL) {
        score += 20;
      } else if (this.calfInfo.viability === CalfViability.ALIVE_WEAK) {
        score += 10;
      } else {
        score += 0;
      }
    }
    factors++;

    // Factor 5: Peso al nacer adecuado (15%)
    if (this.calfInfo?.birthWeight) {
      const birthWeight = this.calfInfo.birthWeight;
      if (birthWeight >= 30 && birthWeight <= 45) {
        score += 15;
      } else if (birthWeight >= 25 && birthWeight <= 50) {
        score += 10;
      } else {
        score += 2;
      }
    }
    factors++;

    return factors > 0 ? Math.round(score / factors * (100 / 20)) : 0; // Normalizar a escala 0-100
  }

  /**
   * Calcula el retorno económico de la inversión
   * @returns ROI o null si no hay información
   */
  public getEconomicROI(): number | null {
    if (!this.economicAnalysis) return null;
    return this.economicAnalysis.roi;
  }

  /**
   * Verifica si el ciclo reproductivo está completo
   * @returns True si está completo
   */
  public isReproductiveCycleComplete(): boolean {
    return this.status === ServiceStatus.WEANED || 
           this.status === ServiceStatus.CULLED ||
           (this.isCompleted && this.weaningInfo !== undefined);
  }

  /**
   * Obtiene alertas del ciclo reproductivo
   * @returns Array de alertas
   */
  public getReproductiveAlerts(): Array<{
    type: 'INFO' | 'WARNING' | 'CRITICAL';
    category: string;
    message: string;
    priority: number;
  }> {
    const alerts: Array<{
      type: 'INFO' | 'WARNING' | 'CRITICAL';
      category: string;
      message: string;
      priority: number;
    }> = [];

    // Alerta de parto próximo
    if (this.isNearCalving(7)) {
      alerts.push({
        type: 'WARNING',
        category: 'Parto',
        message: 'Parto próximo en menos de 7 días',
        priority: 1
      });
    } else if (this.isNearCalving(14)) {
      alerts.push({
        type: 'INFO',
        category: 'Parto',
        message: 'Parto próximo en menos de 14 días',
        priority: 3
      });
    }

    // Alerta de gestación prolongada
    const estimatedDate = this.getEstimatedCalvingDate();
    if (estimatedDate && new Date() > estimatedDate) {
      const overdueDays = Math.ceil((new Date().getTime() - estimatedDate.getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        type: overdueDays > 5 ? 'CRITICAL' : 'WARNING',
        category: 'Gestación',
        message: `Gestación prolongada: ${overdueDays} días de retraso`,
        priority: overdueDays > 5 ? 1 : 2
      });
    }

    // Alerta de servicios múltiples
    if (this.serviceInfo.serviceNumber > 3) {
      alerts.push({
        type: 'WARNING',
        category: 'Fertilidad',
        message: `Múltiples servicios: ${this.serviceInfo.serviceNumber}`,
        priority: 2
      });
    }

    // Alerta de problemas en el parto
    if (this.calvingInfo?.calvingComplications && this.calvingInfo.calvingComplications.length > 0) {
      alerts.push({
        type: 'WARNING',
        category: 'Parto',
        message: 'Complicaciones durante el parto',
        priority: 2
      });
    }

    // Alerta de ternero débil
    if (this.calfInfo?.viability === CalfViability.ALIVE_WEAK) {
      alerts.push({
        type: 'WARNING',
        category: 'Ternero',
        message: 'Ternero nacido débil, requiere atención',
        priority: 1
      });
    }

    // Alerta de eficiencia baja
    const efficiency = this.calculateReproductiveEfficiency();
    if (efficiency < 60) {
      alerts.push({
        type: 'WARNING',
        category: 'Eficiencia',
        message: `Eficiencia reproductiva baja: ${efficiency}%`,
        priority: 2
      });
    }

    return alerts.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Genera un resumen completo del ciclo reproductivo
   * @returns Resumen detallado
   */
  public getReproductiveSummary(): {
    basic: {
      code: string;
      type: string;
      status: string;
      serviceDate: Date;
      serviceNumber: number;
    };
    timeline: {
      daysSinceService: number;
      estimatedCalvingDate?: Date;
      daysToCalving?: number;
      isNearCalving: boolean;
    };
    genetics: {
      sireName: string;
      sireBreed: string;
      expectedPerformance?: Object;
    };
    efficiency: {
      score: number;
      category: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';
      isComplete: boolean;
      isSuccessful: boolean;
    };
    economic?: {
      totalCosts: number;
      expectedValue: number;
      roi: number;
    };
    alerts: Array<{
      type: string;
      category: string;
      message: string;
      priority: number;
    }>;
  } {
    const daysSinceService = this.getDaysSinceService();
    const estimatedCalvingDate = this.getEstimatedCalvingDate();
    const daysToCalving = estimatedCalvingDate ? 
      Math.ceil((estimatedCalvingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 
      undefined;
    
    const efficiency = this.calculateReproductiveEfficiency();
    let efficiencyCategory: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';
    if (efficiency >= 85) efficiencyCategory = 'EXCELLENT';
    else if (efficiency >= 70) efficiencyCategory = 'GOOD';
    else if (efficiency >= 50) efficiencyCategory = 'FAIR';
    else efficiencyCategory = 'POOR';

    const alerts = this.getReproductiveAlerts();

    return {
      basic: {
        code: this.reproductionCode,
        type: this.getReproductionTypeLabel(),
        status: this.getStatusLabel(),
        serviceDate: this.serviceInfo.serviceDate,
        serviceNumber: this.serviceInfo.serviceNumber
      },
      timeline: {
        daysSinceService,
        estimatedCalvingDate: estimatedCalvingDate || undefined,
        daysToCalving,
        isNearCalving: this.isNearCalving()
      },
      genetics: {
        sireName: this.sireInfo.sireName,
        sireBreed: this.sireInfo.sireBreed,
        expectedPerformance: this.geneticAnalysis?.expectedPerformance
      },
      efficiency: {
        score: efficiency,
        category: efficiencyCategory,
        isComplete: this.isReproductiveCycleComplete(),
        isSuccessful: this.isSuccessful
      },
      economic: this.economicAnalysis ? {
        totalCosts: this.economicAnalysis.totalCosts,
        expectedValue: this.economicAnalysis.calfValue,
        roi: this.economicAnalysis.roi
      } : undefined,
      alerts
    };
  }

  /**
   * Calcula el intervalo entre partos (si hay información previa)
   * @param previousCalvingDate Fecha del parto anterior
   * @returns Intervalo en días
   */
  public calculateCalvingInterval(previousCalvingDate: Date): number | null {
    if (!this.calvingInfo?.calvingDate) return null;
    
    const currentCalving = new Date(this.calvingInfo.calvingDate);
    const diffTime = currentCalving.getTime() - previousCalvingDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Verifica si necesita atención veterinaria
   * @returns True si necesita atención
   */
  public needsVeterinaryAttention(): boolean {
    const alerts = this.getReproductiveAlerts();
    return alerts.some(alert => alert.type === 'CRITICAL' || 
                              (alert.type === 'WARNING' && alert.priority <= 2));
  }
}

// Definición del modelo en Sequelize
Reproduction.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del registro de reproducción'
    },
    reproductionCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 50]
      },
      comment: 'Código único de reproducción'
    },
    damId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'bovines',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'ID de la madre/vaca'
    },
    reproductionType: {
      type: DataTypes.ENUM(...Object.values(ReproductionType)),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ServiceStatus)),
      allowNull: false,
      defaultValue: ServiceStatus.PLANNED,
    },
    breedingSeasonId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID de la temporada reproductiva'
    },
    sireInfo: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        notEmpty: true,
        isValidSire(value: SireInfo) {
          if (!value.sireName || !value.sireBreed) {
            throw new Error('Nombre y raza del semental son requeridos');
          }
        }
      },
      comment: 'Información completa del semental'
    },
    germplasmInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de semen/embrión utilizado'
    },
    heatInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información del celo detectado'
    },
    serviceInfo: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        notEmpty: true,
        isValidService(value: ServiceInfo) {
          if (!value.serviceDate || !value.serviceMethod) {
            throw new Error('Fecha y método de servicio son requeridos');
          }
        }
      },
      comment: 'Información detallada del servicio'
    },
    pregnancyInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de gestación y monitoreo'
    },
    calvingInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información completa del parto'
    },
    calfInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información completa del ternero'
    },
    weaningInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información del destete'
    },
    reproductiveEfficiency: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Métricas de eficiencia reproductiva'
    },
    economicAnalysis: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Análisis económico del ciclo reproductivo'
    },
    geneticAnalysis: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Análisis genético y mejoramiento'
    },
    healthRecords: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Registros de salud durante el ciclo'
    },
    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de imágenes del proceso reproductivo'
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
      comment: 'URLs de videos del proceso'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas generales del ciclo reproductivo'
    },
    isCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si el ciclo reproductivo está completo'
    },
    isSuccessful: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si el ciclo fue exitoso'
    },
    qualityScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 100
      },
      comment: 'Puntuación de calidad del ciclo (0-100)'
    },
    ranchId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del rancho'
    },
    seasonYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 2000,
        max: 3000
      },
      comment: 'Año de la temporada reproductiva'
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
    modelName: 'Reproduction',
    tableName: 'reproduction',
    timestamps: true,
    paranoid: true, // Habilita soft delete
    indexes: [
      // Índices para optimizar consultas
      {
        unique: true,
        fields: ['reproduction_code']
      },
      {
        fields: ['dam_id']
      },
      {
        fields: ['reproduction_type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['breeding_season_id']
      },
      {
        fields: ['is_completed']
      },
      {
        fields: ['is_successful']
      },
      {
        fields: ['ranch_id']
      },
      {
        fields: ['season_year']
      },
      {
        name: 'reproduction_dam_season',
        fields: ['dam_id', 'season_year']
      },
      {
        name: 'reproduction_status_date',
        fields: ['status', 'created_at']
      },
      {
        name: 'reproduction_type_success',
        fields: ['reproduction_type', 'is_successful']
      },
      {
        name: 'reproduction_sire_analysis',
        fields: ['sire_info'],
        using: 'gin'
      }
    ],
    hooks: {
      // Hook para cálculos automáticos y validaciones
      beforeSave: async (reproduction: Reproduction) => {
        // Calcular puntuación de calidad automáticamente
        if (!reproduction.qualityScore) {
          reproduction.qualityScore = reproduction.calculateReproductiveEfficiency();
        }

        // Marcar como exitoso si se completa el ciclo con ternero vivo
        if (reproduction.calfInfo?.viability === CalfViability.ALIVE_NORMAL && 
            reproduction.status === ServiceStatus.WEANED) {
          reproduction.isSuccessful = true;
          reproduction.isCompleted = true;
        }

        // Validar fechas secuenciales
        const serviceDate = new Date(reproduction.serviceInfo.serviceDate);
        
        if (reproduction.pregnancyInfo?.pregnancyDiagnosis.diagnosisDate) {
          const diagnosisDate = new Date(reproduction.pregnancyInfo.pregnancyDiagnosis.diagnosisDate);
          if (diagnosisDate < serviceDate) {
            throw new Error('La fecha de diagnóstico no puede ser anterior al servicio');
          }
        }

        if (reproduction.calvingInfo?.calvingDate) {
          const calvingDate = new Date(reproduction.calvingInfo.calvingDate);
          if (calvingDate < serviceDate) {
            throw new Error('La fecha de parto no puede ser anterior al servicio');
          }
        }

        if (reproduction.weaningInfo?.weaningDate && reproduction.calvingInfo?.calvingDate) {
          const weaningDate = new Date(reproduction.weaningInfo.weaningDate);
          const calvingDate = new Date(reproduction.calvingInfo.calvingDate);
          if (weaningDate < calvingDate) {
            throw new Error('La fecha de destete no puede ser anterior al parto');
          }
        }

        // Validar número de servicio
        if (reproduction.serviceInfo.serviceNumber < 1) {
          throw new Error('El número de servicio debe ser mayor a 0');
        }

        // Validar peso al nacer si existe
        if (reproduction.calfInfo?.birthWeight) {
          if (reproduction.calfInfo.birthWeight < 15 || reproduction.calfInfo.birthWeight > 80) {
            throw new Error('Peso al nacer fuera de rango normal (15-80 kg)');
          }
        }

        // Establecer año de temporada si no existe
        if (!reproduction.seasonYear) {
          reproduction.seasonYear = new Date(reproduction.serviceInfo.serviceDate).getFullYear();
        }
      }
    },
    comment: 'Tabla para el manejo completo de ciclos reproductivos bovinos'
  }
);

export default Reproduction;