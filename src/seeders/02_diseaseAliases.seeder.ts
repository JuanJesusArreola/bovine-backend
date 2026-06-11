// seeders/02_diseaseAliases.seeder.ts
// ============================================================================
// SEEDER — ALIASES DE ENFERMEDADES (~150 aliases)
// ============================================================================
// Idempotente: usa findOrCreate con normalizedAlias como clave única.
// Requiere que las enfermedades ya existan (ejecutar después de 01).
// ============================================================================

import Disease from '../models/Disease';
import DiseaseAlias from '../models/DiseaseAlias';
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

// ── Datos: { diseaseSlug, aliases[] } ───────────────────────────────────────

const ALIAS_MAP: Array<{ diseaseSlug: string; aliases: string[] }> = [
  {
    diseaseSlug: 'brucelosis',
    aliases: ['Enfermedad de Bang', 'Aborto contagioso', 'Aborto infeccioso bovino', 'Fiebre ondulante bovina', 'Brucella'],
  },
  {
    diseaseSlug: 'fiebre-aftosa',
    aliases: ['Aftosa', 'FMD', 'Glosopeda', 'Fiebre aftosa bovina', 'Fiebre de pezuña', 'Boquera'],
  },
  {
    diseaseSlug: 'carbunco-antrax',
    aliases: ['Ántrax', 'Carbón bacteridiano', 'Enfermedad del bazo', 'Pústula maligna', 'Carbunclo', 'Bacillus anthracis'],
  },
  {
    diseaseSlug: 'rabia',
    aliases: ['Rabia bovina', 'Derriengue', 'Rabia paralítica bovina', 'Rabia de los vampiros', 'Mal del rastro'],
  },
  {
    diseaseSlug: 'pierna-negra',
    aliases: ['Carbón sintomático', 'Cojera negra', 'Gangrena enfisematosa', 'Blackleg', 'Clostridium chauvoei'],
  },
  {
    diseaseSlug: 'rinotraqueitis-infecciosa-bovina-ibr',
    aliases: ['IBR', 'Rinotraqueítis bovina', 'Rinitis infecciosa', 'BoHV-1', 'Herpesvirus bovino tipo 1', 'Enfermedad roja nasal'],
  },
  {
    diseaseSlug: 'diarrea-viral-bovina-bvd',
    aliases: ['BVD', 'Enfermedad de las mucosas', 'BVD-MD', 'Diarrea viral bovina', 'Pestivirus bovino', 'Virus BVD'],
  },
  {
    diseaseSlug: 'leptospirosis',
    aliases: ['Leptospira bovina', 'Enfermedad de Weil bovina', 'Fiebre de los pantanos', 'Leptospirosis pomona', 'Leptospirosis hardjo'],
  },
  {
    diseaseSlug: 'tuberculosis-bovina',
    aliases: ['TB bovina', 'Tisis bovina', 'Mycobacterium bovis', 'Tuberculosis del ganado', 'TB'],
  },
  {
    diseaseSlug: 'tetanos',
    aliases: ['Tétano', 'Trismo', 'Clostridium tetani', 'Espasmos musculares bovinos', 'Tétanos bovino'],
  },
  {
    diseaseSlug: 'parainfluenza-bovina',
    aliases: ['PI3 bovina', 'Virus PI3', 'Parainfluenza tipo 3', 'PIV3', 'Parainfluenza 3 bovina'],
  },
  {
    diseaseSlug: 'sincitial-respiratorio-bovino-rsv',
    aliases: ['BRSV', 'RSV bovino', 'Virus respiratorio sincicial bovino', 'Pneumovirus bovino', 'Sincitial respiratorio'],
  },
  {
    diseaseSlug: 'mastitis',
    aliases: ['Infección mamaria', 'Ubritis', 'Mastitis bovina', 'Infección de la ubre', 'Inflamación de la ubre'],
  },
  {
    diseaseSlug: 'cisticercosis-bovina',
    aliases: ['Teniasis bovina', 'Cysticercus bovis', 'Gusano sol', 'Cisticerco bovino', 'Larva de tenia'],
  },
  {
    diseaseSlug: 'encefalopatia-espongiforme-bovina-eeb',
    aliases: ['EEB', 'Mal de las vacas locas', 'BSE', 'Encefalopatía espongiforme', 'Scrapie bovino', 'Prion bovino'],
  },
  {
    diseaseSlug: 'anaplasmosis-bovina',
    aliases: ['Anaplasma', 'Tristeza bovina', 'Ranilla', 'Anaplasmosis marginal', 'Anaplasma marginale'],
  },
  {
    diseaseSlug: 'babesiosis-bovina',
    aliases: ['Piroplasmosis', 'Fiebre de garrapata', 'Tristeza bovina', 'Babesia', 'Tristeza parasitaria'],
  },
  {
    diseaseSlug: 'queratoconjuntivitis-infecciosa',
    aliases: ['Ojo nublado', 'Pinkeye', 'Ojo rosado', 'Pink eye bovino', 'Moraxella bovis', 'Queratitis infecciosa'],
  },
  {
    diseaseSlug: 'neumonia-bovina',
    aliases: ['Pulmonía bovina', 'CRB', 'Complejo respiratorio bovino', 'Bronconeumonía bovina', 'Shipping fever (neumonía)'],
  },
  {
    diseaseSlug: 'diarrea-neonatal-bovina',
    aliases: ['Diarrea del becerro', 'Colibacilosis neonatal', 'Diarrea blanca del becerro', 'Colicibacilosis', 'Scours'],
  },
  {
    diseaseSlug: 'salmonelosis-bovina',
    aliases: ['Salmonela bovina', 'Salmonella Dublin', 'Paratifoidea bovina', 'Fiebre entérica bovina', 'Salmonelosis'],
  },
  {
    diseaseSlug: 'metritis-endometritis',
    aliases: ['Infección uterina', 'Endometritis bovina', 'Inflamación uterina', 'Metritis puerperal', 'Útero sucio'],
  },
  {
    diseaseSlug: 'listeriosis-bovina',
    aliases: ['Enfermedad circular', 'Listeria bovina', 'Listeria monocytogenes', 'Meningoencefalitis listeriana'],
  },
  {
    diseaseSlug: 'actinobacilosis',
    aliases: ['Lengua de madera', 'Actinobacillus lignieresii', 'Absceso mandibular blando', 'Lignieres'],
  },
  {
    diseaseSlug: 'actinomicosis',
    aliases: ['Quijada hinchada', 'Mandíbula de madera', 'Actinomyces bovis', 'Osteomielitis actinomicótica', 'Quijada esponjosa'],
  },
  {
    diseaseSlug: 'hipocalcemia-fiebre-de-leche',
    aliases: ['Fiebre de leche', 'Paresia puerperal', 'Paresia posparto', 'Hipocalcemia puerperal', 'Fiebre vitularia'],
  },
  {
    diseaseSlug: 'cetosis-bovina',
    aliases: ['Acetonemia', 'Cetoacidosis bovina', 'Cuerpos cetónicos', 'Ketosis bovina', 'Hipoglucemia cetótica'],
  },
  {
    diseaseSlug: 'dermatofitosis-tina',
    aliases: ['Tiña bovina', 'Ringworm', 'Trichophyton verrucosum', 'Tiña del ganado', 'Dermatitis fúngica'],
  },
  {
    diseaseSlug: 'fotosensibilizacion',
    aliases: ['Fotosensibilidad bovina', 'Quemadura solar bovina', 'Dermatitis fotosensible', 'Sensibilidad a la luz'],
  },
  {
    diseaseSlug: 'timpanismo-meteorismo',
    aliases: ['Meteorismo', 'Empaste', 'Hinchazón ruminal', 'Timpanismo espumoso', 'Bloat'],
  },
  {
    diseaseSlug: 'pasteurelosis-bovina',
    aliases: ['Mannheimiosis', 'Pasteurella multocida', 'Mannheimia haemolytica', 'Pasteurela', 'Neumonía pasteurélica'],
  },
  {
    diseaseSlug: 'clostridiosis-enterotoxemia',
    aliases: ['Enterotoxemia', 'Enfermedad del riñón pulposo', 'Clostridium perfringens', 'Sobrecarga energética clostridial', 'Polioencefalomacia clostridial'],
  },
  {
    diseaseSlug: 'fiebre-de-embarque',
    aliases: ['Shipping fever', 'BRD', 'Complejo respiratorio bovino por transporte', 'Neumonía de transporte', 'Fiebre de transporte'],
  },
  {
    diseaseSlug: 'campilobacteriosis-genital-bovina',
    aliases: ['Vibriosis bovina', 'Campylobacter fetus', 'Campilobacteriosis venérea', 'Infertilidad por vibrio', 'Campylobacter bovino'],
  },

  // ── Enfermedades añadidas (puente de vacunación) ────────────────────────────
  {
    diseaseSlug: 'tricomoniasis-bovina',
    aliases: ['Tricomonosis', 'Tritrichomonas foetus', 'Tricomoniasis venérea bovina', 'Trich', 'Infertilidad por tricomonas'],
  },
  {
    diseaseSlug: 'pododermatitis-infecciosa-foot-rot',
    aliases: ['Foot rot', 'Pietín bovino', 'Gabarro', 'Pedero', 'Necrobacilosis interdigital', 'Fusobacterium necrophorum'],
  },
  {
    diseaseSlug: 'dermatosis-nodular-contagiosa',
    aliases: ['Lumpy skin disease', 'LSD', 'Enfermedad de la piel grumosa', 'Dermatosis nodular bovina', 'Capripoxvirus bovino'],
  },
  {
    diseaseSlug: 'lengua-azul',
    aliases: ['Bluetongue', 'BTV', 'Fiebre catarral ovina', 'Lengua azul bovina', 'Orbivirus'],
  },
  {
    diseaseSlug: 'teileriosis-bovina',
    aliases: ['Theileriosis', 'Fiebre de la Costa Este', 'Theileria', 'Teileria bovina', 'Theileriosis tropical'],
  },
  {
    diseaseSlug: 'paratuberculosis-enfermedad-de-johne',
    aliases: ['Enfermedad de Johne', 'Paratuberculosis', 'Johne', 'Mycobacterium paratuberculosis', 'MAP', 'Enteritis paratuberculosa'],
  },
  {
    diseaseSlug: 'edema-maligno',
    aliases: ['Gangrena gaseosa', 'Clostridium septicum', 'Edema maligno clostridial', 'Mionecrosis clostridial'],
  },
  {
    diseaseSlug: 'hemoglobinuria-bacilar',
    aliases: ['Redwater bacilar', 'Hemoglobinuria infecciosa', 'Clostridium haemolyticum', 'Ictero hemoglobinúrico'],
  },
  {
    diseaseSlug: 'hepatitis-necrotica-infecciosa',
    aliases: ['Enfermedad negra', 'Black disease', 'Clostridium novyi', 'Hepatitis necrótica clostridial', 'Hepatitis infecciosa necrosante'],
  },
];

// ── Seeder ───────────────────────────────────────────────────────────────────

const CONTEXT = '02_diseaseAliases.seeder';

export async function seedDiseaseAliases(): Promise<void> {
  logger.info('Iniciando seeder de aliases de enfermedades', CONTEXT);

  // Cargar mapa slug → id de una sola vez
  const diseases = await Disease.findAll({ attributes: ['id', 'slug'], raw: true });
  const slugToId = new Map(diseases.map((d: any) => [d.slug, d.id]));

  let created = 0;
  let skipped = 0;
  let warnings = 0;

  for (const entry of ALIAS_MAP) {
    const diseaseId = slugToId.get(entry.diseaseSlug);

    if (!diseaseId) {
      logger.warn(`Enfermedad no encontrada para slug: ${entry.diseaseSlug}`, CONTEXT);
      warnings++;
      continue;
    }

    for (const alias of entry.aliases) {
      const normalizedAlias = normalize(alias);

      const [, wasCreated] = await DiseaseAlias.findOrCreate({
        where: { normalizedAlias },
        defaults: {
          diseaseId,
          alias,
          normalizedAlias,
        },
      });

      if (wasCreated) created++;
      else skipped++;
    }
  }

  logger.info(
    `Aliases — creados: ${created}, ya existían: ${skipped}, advertencias: ${warnings}`,
    CONTEXT
  );
}
