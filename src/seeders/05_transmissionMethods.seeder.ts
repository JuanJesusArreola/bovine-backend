// seeders/05_transmissionMethods.seeder.ts
// ============================================================================
// SEEDER — CATÁLOGO DE MÉTODOS DE TRANSMISIÓN (12 vías)
// ============================================================================
// Idempotente: usa findOrCreate con slug como clave única.
// ============================================================================

import TransmissionMethod from '../models/TransmissionMethod';
import logger from '../utils/logger';

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function slugify(text: string): string {
  return normalize(text)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

// ── Datos ────────────────────────────────────────────────────────────────────

const TRANSMISSION_METHODS = [
  {
    name: 'Contacto directo',
    description: 'Transmisión por contacto físico directo entre animales infectados y susceptibles (piel, mucosas, secreciones).',
  },
  {
    name: 'Contacto indirecto (fómites)',
    description: 'Transmisión a través de objetos inanimados contaminados: equipos de ordeño, agujas, ropa, comederos, bebederos.',
  },
  {
    name: 'Vía aérea (aerosol)',
    description: 'Transmisión por inhalación de partículas o aerosoles contaminados. Principal vía en enfermedades respiratorias.',
  },
  {
    name: 'Vectores hematófagos',
    description: 'Transmisión a través de artrópodos que se alimentan de sangre: garrapatas, mosquitos, tábanos y moscas.',
  },
  {
    name: 'Agua contaminada',
    description: 'Transmisión por consumo o contacto con agua contaminada por agentes patógenos o sus esporas.',
  },
  {
    name: 'Suelo contaminado',
    description: 'Transmisión por contacto con suelo que contiene esporas u organismos resistentes (Bacillus anthracis, Clostridium spp.).',
  },
  {
    name: 'Alimento contaminado',
    description: 'Transmisión por ingesta de alimentos (pasto, ensilaje, harina de carne) contaminados con agentes patógenos.',
  },
  {
    name: 'Transmisión vertical',
    description: 'Transmisión de madre a cría durante la gestación, el parto o la lactación (transplacentaria o calostral).',
  },
  {
    name: 'Transmisión sexual',
    description: 'Transmisión por monta natural o semen contaminado en inseminación artificial. Relevante en brucelosis y campilobacteriosis.',
  },
  {
    name: 'Heridas y lesiones',
    description: 'Introducción del agente a través de heridas, abrasiones, castraciones, descornes u otras intervenciones.',
  },
  {
    name: 'Iatrógena',
    description: 'Transmisión causada por procedimientos veterinarios con material contaminado: agujas, guantes de palpación, instrumentos no esterilizados.',
  },
  {
    name: 'Fauna silvestre y reservorios',
    description: 'Transmisión a través de animales silvestres que actúan como reservorios: murciélagos (rabia), roedores (leptospirosis), tejones (tuberculosis).',
  },
];

// ── Seeder ───────────────────────────────────────────────────────────────────

const CONTEXT = '05_transmissionMethods.seeder';

export async function seedTransmissionMethods(): Promise<void> {
  logger.info(`Iniciando seeder de métodos de transmisión (${TRANSMISSION_METHODS.length} registros)`, CONTEXT);

  let created = 0;
  let skipped = 0;

  for (const m of TRANSMISSION_METHODS) {
    const slug = slugify(m.name);
    const normalizedName = normalize(m.name);

    const [, wasCreated] = await TransmissionMethod.findOrCreate({
      where: { slug },
      defaults: {
        name: m.name,
        normalizedName,
        slug,
        description: m.description,
        isActive: true,
      },
    });

    if (wasCreated) created++;
    else skipped++;
  }

  logger.info(`Métodos de transmisión — creados: ${created}, ya existían: ${skipped}`, CONTEXT);
}
