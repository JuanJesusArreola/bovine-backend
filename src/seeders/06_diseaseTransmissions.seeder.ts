// seeders/06_diseaseTransmissions.seeder.ts
// ============================================================================
// SEEDER — RELACIONES ENFERMEDAD ↔ MÉTODO DE TRANSMISIÓN
// ============================================================================
// Idempotente: usa findOrCreate con (diseaseId, transmissionMethodId).
// Requiere enfermedades y métodos de transmisión ya existentes (01 y 05).
// ============================================================================

import Disease from '../models/Disease';
import TransmissionMethod from '../models/TransmissionMethod';
import DiseaseTransmission from '../models/DiseaseTransmission';
import logger from '../utils/logger';

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

// ── Referencias de slugs (métodos de transmisión) ────────────────────────────

const T = {
  directo:    slugify('Contacto directo'),
  fomites:    slugify('Contacto indirecto (fómites)'),
  aereo:      slugify('Vía aérea (aerosol)'),
  vectores:   slugify('Vectores hematófagos'),
  agua:       slugify('Agua contaminada'),
  suelo:      slugify('Suelo contaminado'),
  alimento:   slugify('Alimento contaminado'),
  vertical:   slugify('Transmisión vertical'),
  sexual:     slugify('Transmisión sexual'),
  heridas:    slugify('Heridas y lesiones'),
  iatrogenica:slugify('Iatrógena'),
  silvestre:  slugify('Fauna silvestre y reservorios'),
};

// ── Datos ────────────────────────────────────────────────────────────────────

const DISEASE_TRANSMISSIONS: Array<{
  diseaseSlug: string;
  transmissionSlugs: string[];
}> = [
  { diseaseSlug: 'brucelosis',
    transmissionSlugs: [T.directo, T.vertical, T.sexual, T.alimento] },

  { diseaseSlug: 'fiebre-aftosa',
    transmissionSlugs: [T.directo, T.aereo, T.fomites, T.alimento] },

  { diseaseSlug: 'carbunco-antrax',
    transmissionSlugs: [T.suelo, T.alimento, T.vectores, T.heridas] },

  { diseaseSlug: 'rabia',
    transmissionSlugs: [T.silvestre, T.heridas] },

  { diseaseSlug: 'pierna-negra',
    transmissionSlugs: [T.suelo, T.heridas] },

  { diseaseSlug: 'rinotraqueitis-infecciosa-bovina-ibr',
    transmissionSlugs: [T.directo, T.aereo, T.sexual] },

  { diseaseSlug: 'diarrea-viral-bovina-bvd',
    transmissionSlugs: [T.directo, T.vertical, T.aereo] },

  { diseaseSlug: 'leptospirosis',
    transmissionSlugs: [T.agua, T.directo, T.silvestre] },

  { diseaseSlug: 'tuberculosis-bovina',
    transmissionSlugs: [T.aereo, T.directo, T.alimento, T.silvestre] },

  { diseaseSlug: 'tetanos',
    transmissionSlugs: [T.heridas, T.suelo] },

  { diseaseSlug: 'parainfluenza-bovina',
    transmissionSlugs: [T.aereo, T.directo] },

  { diseaseSlug: 'sincitial-respiratorio-bovino-rsv',
    transmissionSlugs: [T.aereo, T.directo, T.fomites] },

  { diseaseSlug: 'mastitis',
    transmissionSlugs: [T.fomites, T.iatrogenica, T.directo] },

  { diseaseSlug: 'cisticercosis-bovina',
    transmissionSlugs: [T.alimento, T.agua] },

  { diseaseSlug: 'encefalopatia-espongiforme-bovina-eeb',
    transmissionSlugs: [T.alimento] },

  { diseaseSlug: 'anaplasmosis-bovina',
    transmissionSlugs: [T.vectores, T.iatrogenica] },

  { diseaseSlug: 'babesiosis-bovina',
    transmissionSlugs: [T.vectores] },

  { diseaseSlug: 'queratoconjuntivitis-infecciosa',
    transmissionSlugs: [T.directo, T.vectores, T.fomites] },

  { diseaseSlug: 'neumonia-bovina',
    transmissionSlugs: [T.aereo, T.directo] },

  { diseaseSlug: 'diarrea-neonatal-bovina',
    transmissionSlugs: [T.directo, T.fomites, T.alimento] },

  { diseaseSlug: 'salmonelosis-bovina',
    transmissionSlugs: [T.alimento, T.agua, T.directo] },

  { diseaseSlug: 'metritis-endometritis',
    transmissionSlugs: [T.iatrogenica, T.directo] },

  { diseaseSlug: 'listeriosis-bovina',
    transmissionSlugs: [T.alimento, T.suelo] },

  { diseaseSlug: 'actinobacilosis',
    transmissionSlugs: [T.heridas, T.alimento] },

  { diseaseSlug: 'actinomicosis',
    transmissionSlugs: [T.heridas, T.alimento] },

  { diseaseSlug: 'dermatofitosis-tina',
    transmissionSlugs: [T.directo, T.fomites] },

  { diseaseSlug: 'pasteurelosis-bovina',
    transmissionSlugs: [T.aereo, T.directo, T.silvestre] },

  { diseaseSlug: 'clostridiosis-enterotoxemia',
    transmissionSlugs: [T.suelo, T.alimento] },

  { diseaseSlug: 'fiebre-de-embarque',
    transmissionSlugs: [T.aereo, T.directo] },

  { diseaseSlug: 'campilobacteriosis-genital-bovina',
    transmissionSlugs: [T.sexual, T.directo] },

  // ── Enfermedades añadidas (puente de vacunación) ────────────────────────────
  { diseaseSlug: 'tricomoniasis-bovina',
    transmissionSlugs: [T.sexual, T.directo] },

  { diseaseSlug: 'pododermatitis-infecciosa-foot-rot',
    transmissionSlugs: [T.suelo, T.directo, T.heridas] },

  { diseaseSlug: 'dermatosis-nodular-contagiosa',
    transmissionSlugs: [T.vectores, T.directo, T.fomites] },

  { diseaseSlug: 'lengua-azul',
    transmissionSlugs: [T.vectores] },

  { diseaseSlug: 'teileriosis-bovina',
    transmissionSlugs: [T.vectores] },

  { diseaseSlug: 'paratuberculosis-enfermedad-de-johne',
    transmissionSlugs: [T.alimento, T.agua, T.vertical, T.directo] },

  { diseaseSlug: 'edema-maligno',
    transmissionSlugs: [T.heridas, T.suelo] },

  { diseaseSlug: 'hemoglobinuria-bacilar',
    transmissionSlugs: [T.alimento, T.agua, T.suelo] },

  { diseaseSlug: 'hepatitis-necrotica-infecciosa',
    transmissionSlugs: [T.alimento, T.suelo] },
];

// ── Seeder ───────────────────────────────────────────────────────────────────

const CONTEXT = '06_diseaseTransmissions.seeder';

export async function seedDiseaseTransmissions(): Promise<void> {
  const [diseases, methods] = await Promise.all([
    Disease.findAll({ attributes: ['id', 'slug'], raw: true }),
    TransmissionMethod.findAll({ attributes: ['id', 'slug'], raw: true }),
  ]);

  const diseaseMap = new Map((diseases as any[]).map((d) => [d.slug, d.id]));
  const methodMap  = new Map((methods  as any[]).map((m) => [m.slug, m.id]));

  let created  = 0;
  let skipped  = 0;
  let warnings = 0;

  for (const entry of DISEASE_TRANSMISSIONS) {
    const diseaseId = diseaseMap.get(entry.diseaseSlug);
    if (!diseaseId) {
      logger.warn(`Enfermedad no encontrada: ${entry.diseaseSlug}`, CONTEXT);
      warnings++;
      continue;
    }

    for (const tSlug of entry.transmissionSlugs) {
      const transmissionMethodId = methodMap.get(tSlug);
      if (!transmissionMethodId) {
        logger.warn(`Método de transmisión no encontrado: ${tSlug}`, CONTEXT);
        warnings++;
        continue;
      }

      const [, wasCreated] = await DiseaseTransmission.findOrCreate({
        where: { diseaseId, transmissionMethodId },
        defaults: { diseaseId, transmissionMethodId },
      });

      if (wasCreated) created++;
      else skipped++;
    }
  }

  logger.info(
    `Relaciones enfermedad↔transmisión — creadas: ${created}, ya existían: ${skipped}, advertencias: ${warnings}`,
    CONTEXT
  );
}
