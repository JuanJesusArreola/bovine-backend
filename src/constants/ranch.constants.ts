// constants/ranch.constants.ts
export const RANCH_TYPE_LABELS: Record<string, string> = {
  DAIRY: 'Lechero',
  BEEF: 'Carne',
  MIXED: 'Mixto',
  BREEDING: 'Reproducción/Cría',
  FEEDLOT: 'Engorda',
  ORGANIC: 'Orgánico',
  SUSTAINABLE: 'Sostenible',
  COMMERCIAL: 'Comercial',
  FAMILY_FARM: 'Familiar',
  COOPERATIVE: 'Cooperativa',
  CORPORATE: 'Corporativo',
  RESEARCH: 'Investigación',
  EDUCATIONAL: 'Educativo',
};

export const RANCH_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  UNDER_CONSTRUCTION: 'En construcción',
  RENOVATION: 'En renovación',
  TEMPORARY_CLOSURE: 'Cierre temporal',
  PERMANENT_CLOSURE: 'Cierre permanente',
  QUARANTINE: 'En cuarentena',
  SUSPENDED: 'Suspendido',
  PENDING_APPROVAL: 'Pendiente de aprobación',
};


export const CERTIFICATION_TYPE_LABELS: Record<string, string> = {
  ORGANIC: 'Orgánico',
  FAIR_TRADE: 'Comercio Justo',
  ANIMAL_WELFARE: 'Bienestar Animal',
  ENVIRONMENTAL: 'Ambiental',
  QUALITY_ASSURANCE: 'Aseguramiento de Calidad',
  HALAL: 'Halal',
  KOSHER: 'Kosher',
  NON_GMO: 'No OGM',
  SUSTAINABLE: 'Sostenible',
  CARBON_NEUTRAL: 'Carbono Neutral',
  GRASS_FED: 'Alimentado con Pastura',
  ANTIBIOTIC_FREE: 'Libre de Antibióticos',
  HORMONE_FREE: 'Libre de Hormonas',
  GLOBAL_GAP: 'Global GAP',
  RAINFOREST_ALLIANCE: 'Rainforest Alliance',
  UTZ: 'UTZ',
  BRCGS: 'BRCGS',
  IFS: 'IFS',
  SQF: 'SQF',
  PRIMUS_GFS: 'Primus GFS',
};

export const LICENSE_TYPE_LABELS: Record<string, string> = {
  OPERATING_LICENSE: 'Licencia de Funcionamiento',
  ENVIRONMENTAL_PERMIT: 'Permiso Ambiental',
  SANITARY_LICENSE: 'Licencia Sanitaria',
  WATER_RIGHTS: 'Derechos de Agua',
  LAND_USE_PERMIT: 'Permiso de Uso de Suelo',
  CONSTRUCTION_PERMIT: 'Permiso de Construcción',
  TRANSPORT_PERMIT: 'Permiso de Transporte',
  EXPORT_LICENSE: 'Licencia de Exportación',
  IMPORT_LICENSE: 'Licencia de Importación',
  SLAUGHTERHOUSE_LICENSE: 'Licencia de Rastro',
  DAIRY_LICENSE: 'Licencia Lechera',
  FEEDLOT_LICENSE: 'Licencia de Engorda',
  BREEDING_LICENSE: 'Licencia de Cría',
  VETERINARY_LICENSE: 'Licencia Veterinaria',
  OTHER: 'Otro',
};

export const INSURANCE_TYPE_LABELS: Record<string, string> = {
  PROPERTY: 'Propiedad',
  LIABILITY: 'Responsabilidad Civil',
  LIVESTOCK: 'Ganado',
  CROP: 'Cultivos',
  EQUIPMENT: 'Equipo',
  WORKERS_COMP: 'Compensación Laboral',
  BUSINESS_INTERRUPTION: 'Interrupción de Negocio',
  ENVIRONMENTAL: 'Ambiental',
  TRANSPORT: 'Transporte',
  HEALTH: 'Salud',
  LIFE: 'Vida',
  KEY_PERSON: 'Persona Clave',
  PRODUCT_LIABILITY: 'Responsabilidad de Producto',
  FLOOD: 'Inundación',
  FIRE: 'Incendio',
  DROUGHT: 'Sequía',
  OTHER: 'Otro',
};

export const PRODUCTION_TRENDS = {
  MILK: {
    LOW: 3000,       // litros/vaca/año
    MEDIUM: 6000,
    HIGH: 10000
  },
  MEAT: {
    LOW: 300,        // kg/animal/año
    MEDIUM: 500,
    HIGH: 700
  }
};

export const SUSTAINABILITY_SCORE_RANGES = {
  EXCELLENT: { min: 80, max: 100 },
  GOOD: { min: 60, max: 79 },
  FAIR: { min: 40, max: 59 },
  POOR: { min: 0, max: 39 }
};

export const TURNOVER_RATE_RANGES = {
  LOW: 5,       // <5% excelente
  MEDIUM: 15,   // 5-15% normal
  HIGH: 30      // >15% alerta
};

export const SAFETY_SCORE_RANGES = {
  EXCELLENT: 90,
  GOOD: 70,
  FAIR: 50,
  POOR: 30
};