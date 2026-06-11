// seeders/07_diseaseSources.seeder.ts
// ============================================================================
// SEEDER — CATÁLOGO DE FUENTES DE INFECCIÓN (11 entradas base)
// ============================================================================
// Cubre los orígenes de infección más comunes en ganadería latinoamericana.
// Idempotente: usa findOrCreate con normalizedName como clave única.
// ============================================================================

import DiseaseSource, {
  DiseaseSourceType,
  DiseaseSourceRiskLevel,
} from '../models/DiseaseSource';
import logger from '../utils/logger';

// ── Helper ───────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// ── Datos ────────────────────────────────────────────────────────────────────

const DISEASE_SOURCES: Array<{
  name: string;
  type: DiseaseSourceType;
  riskLevel: DiseaseSourceRiskLevel;
  description: string;
}> = [
  {
    name: 'Animal importado sin cuarentena',
    type: DiseaseSourceType.ANIMAL,
    riskLevel: DiseaseSourceRiskLevel.CRITICAL,
    description:
      'Introducción de un animal proveniente de otro hato o región sin respetar el período de cuarentena obligatorio. Principal vector de introducción de enfermedades exóticas.',
  },
  {
    name: 'Contacto con animal del mismo hato',
    type: DiseaseSourceType.ANIMAL,
    riskLevel: DiseaseSourceRiskLevel.HIGH,
    description:
      'Transmisión entre animales del mismo rancho por contacto directo: peleas, monta, amamantamiento o convivencia en el mismo potrero.',
  },
  {
    name: 'Contacto con fauna silvestre',
    type: DiseaseSourceType.ANIMAL,
    riskLevel: DiseaseSourceRiskLevel.HIGH,
    description:
      'Exposición a animales silvestres que actúan como reservorios: murciélagos (rabia), roedores (leptospirosis), tejones y jabalíes (tuberculosis, brucelosis).',
  },
  {
    name: 'Agua de bebida contaminada',
    type: DiseaseSourceType.WATER,
    riskLevel: DiseaseSourceRiskLevel.HIGH,
    description:
      'Consumo de agua de ríos, jagüeyes, charcos o bebederos contaminados con orina, heces u organismos patógenos. Ruta principal de leptospirosis y enfermedades digestivas.',
  },
  {
    name: 'Pasto o suelo de potrero infectado',
    type: DiseaseSourceType.ENVIRONMENT,
    riskLevel: DiseaseSourceRiskLevel.MEDIUM,
    description:
      'Contacto con suelo o pasto contaminado por esporas resistentes (Bacillus anthracis, Clostridium spp.) o por deposición de animales infectados en el mismo potrero.',
  },
  {
    name: 'Instalaciones o equipos sin desinfectar (fómites)',
    type: DiseaseSourceType.FOMITE,
    riskLevel: DiseaseSourceRiskLevel.MEDIUM,
    description:
      'Transmisión a través de objetos inanimados contaminados: agujas reutilizadas, equipos de ordeño, guantes de palpación, corrales, comederos y bebederos sin limpiar.',
  },
  {
    name: 'Vector biológico (garrapatas)',
    type: DiseaseSourceType.VECTOR,
    riskLevel: DiseaseSourceRiskLevel.HIGH,
    description:
      'Transmisión mediada por garrapatas Boophilus o Amblyomma. Principal vía de Tristeza Bovina (Babesiosis, Anaplasmosis), Hepatozoonosis y otras enfermedades hemoparasitarias.',
  },
  {
    name: 'Vector mecánico (moscas y tábanos)',
    type: DiseaseSourceType.VECTOR,
    riskLevel: DiseaseSourceRiskLevel.MEDIUM,
    description:
      'Transmisión mecánica por insectos hematófagos como moscas (Haematobia, Stomoxys) y tábanos que transportan agentes patógenos entre animales sin ser huéspedes definitivos.',
  },
  {
    name: 'Alimento contaminado',
    type: DiseaseSourceType.FOOD,
    riskLevel: DiseaseSourceRiskLevel.HIGH,
    description:
      'Ingesta de ensilaje, harina de carne, subproductos animales o pasto contaminados con toxinas, micotoxinas o agentes infecciosos (Listeria, Salmonella, micotoxinas).',
  },
  {
    name: 'Persona sin equipo de protección (zoonosis inversa)',
    type: DiseaseSourceType.HUMAN,
    riskLevel: DiseaseSourceRiskLevel.LOW,
    description:
      'En algunos casos (brucelosis, leptospirosis), personas que manipulan animales sin equipo de protección pueden actuar como vector mecánico. Riesgo bajo pero relevante en contexto sanitario.',
  },
  {
    name: 'Fuente no identificada',
    type: DiseaseSourceType.UNKNOWN,
    riskLevel: DiseaseSourceRiskLevel.LOW,
    description:
      'El origen de la infección no pudo ser determinado en el momento del diagnóstico. Usar cuando no hay evidencia suficiente para seleccionar otra fuente.',
  },
];

// ── Seeder ───────────────────────────────────────────────────────────────────

const CONTEXT = '07_diseaseSources.seeder';

export async function seedDiseaseSources(): Promise<void> {
  logger.info(
    `Iniciando seeder de fuentes de infección (${DISEASE_SOURCES.length} registros)`,
    CONTEXT
  );

  let created = 0;
  let skipped = 0;

  for (const source of DISEASE_SOURCES) {
    const normalizedName = normalize(source.name);

    const [, wasCreated] = await DiseaseSource.findOrCreate({
      where: { normalizedName },
      defaults: {
        name:           source.name,
        normalizedName,
        type:           source.type,
        riskLevel:      source.riskLevel,
        description:    source.description,
        isActive:       true,
      },
    });

    if (wasCreated) created++;
    else skipped++;
  }

  logger.info(
    `Fuentes de infección — creadas: ${created}, ya existían: ${skipped}`,
    CONTEXT
  );
}
