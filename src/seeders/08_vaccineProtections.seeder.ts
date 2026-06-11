// seeders/08_vaccineProtections.seeder.ts
// ============================================================================
// SEEDER — CATÁLOGO DE PROTECCIÓN (vacuna ↔ enfermedad)
// ============================================================================
// Mapea cada VaccineType a la(s) enfermedad(es) que previene, con la duración
// estimada de inmunidad en días (≈ intervalo de revacunación) y las dosis del
// esquema inicial.
//
// Las vacunas polivalentes (CLOSTRIDIAL, RESPIRATORY_COMPLEX, BABESIA_ANAPLASMA,
// PASTEURELLA) generan varias filas: una por enfermedad cubierta.
//
// Idempotente: findOrCreate por (vaccineType, diseaseId).
// Requiere que el seeder de enfermedades (01) ya se haya ejecutado.
// ============================================================================

import { VaccineType } from '../models/Vaccination';
import Disease from '../models/Disease';
import VaccineDiseaseProtection from '../models/VaccineDiseaseProtection';
import logger from '../utils/logger';

const CONTEXT = '08_vaccineProtections.seeder';

// ── Estructura de mapeo ───────────────────────────────────────────────────────

interface ProtectionEntry {
  diseaseSlug: string;
  immunityDurationDays: number;
  dosesForImmunity: number;
  notes?: string;
}

// Nota: los días de inmunidad son valores OPERATIVOS (intervalo recomendado de
// revacunación). La inmunidad real depende de marca, edad, vía y etiqueta.
const VACCINE_PROTECTION_MAP: Partial<Record<VaccineType, ProtectionEntry[]>> = {
  [VaccineType.BRUCELLOSIS]: [
    { diseaseSlug: 'brucelosis', immunityDurationDays: 365, dosesForImmunity: 1, notes: 'S19 / RB51 — 1 dosis en becerras según campaña oficial.' },
  ],
  [VaccineType.RABIES]: [
    { diseaseSlug: 'rabia', immunityDurationDays: 365, dosesForImmunity: 1, notes: 'Refuerzo anual en zonas endémicas (algunas etiquetas hasta 730 días).' },
  ],
  [VaccineType.ANTHRAX]: [
    { diseaseSlug: 'carbunco-antrax', immunityDurationDays: 365, dosesForImmunity: 1, notes: '1 dosis anual en zonas endémicas.' },
  ],
  [VaccineType.FOOT_AND_MOUTH]: [
    { diseaseSlug: 'fiebre-aftosa', immunityDurationDays: 270, dosesForImmunity: 1, notes: 'Refuerzos oficiales según campaña (180–365 días).' },
  ],
  [VaccineType.LEPTOSPIROSIS]: [
    { diseaseSlug: 'leptospirosis', immunityDurationDays: 365, dosesForImmunity: 2, notes: '5 vías — refuerzo anual o semestral en alto riesgo (180 días).' },
  ],
  [VaccineType.CAMPYLOBACTER]: [
    { diseaseSlug: 'campilobacteriosis-genital-bovina', immunityDurationDays: 365, dosesForImmunity: 2, notes: 'Vibriosis — aplicar antes del empadre; refuerzo anual.' },
  ],
  [VaccineType.TRICHOMONIASIS]: [
    { diseaseSlug: 'tricomoniasis-bovina', immunityDurationDays: 365, dosesForImmunity: 2, notes: '2 dosis iniciales separadas 2–4 semanas; refuerzo anual.' },
  ],
  [VaccineType.PINKEYE]: [
    { diseaseSlug: 'queratoconjuntivitis-infecciosa', immunityDurationDays: 270, dosesForImmunity: 2, notes: 'Moraxella bovis — refuerzo antes de temporada de moscas.' },
  ],
  [VaccineType.NEONATAL_DIARRHEA]: [
    { diseaseSlug: 'diarrea-neonatal-bovina', immunityDurationDays: 180, dosesForImmunity: 1, notes: 'Rota-Corona-E.coli-K99 — vacunar vacas preparto 3–6 sem; protección calostral.' },
  ],
  [VaccineType.SALMONELLA]: [
    { diseaseSlug: 'salmonelosis-bovina', immunityDurationDays: 365, dosesForImmunity: 2, notes: 'Bacterina — 2 dosis separadas 2–4 semanas; refuerzo anual.' },
  ],
  [VaccineType.FUSOBACTERIUM]: [
    { diseaseSlug: 'pododermatitis-infecciosa-foot-rot', immunityDurationDays: 365, dosesForImmunity: 2, notes: 'Foot rot — 2 dosis iniciales; refuerzo anual si persiste riesgo.' },
  ],
  [VaccineType.LUMPY_SKIN]: [
    { diseaseSlug: 'dermatosis-nodular-contagiosa', immunityDurationDays: 365, dosesForImmunity: 1, notes: 'Refuerzo anual según riesgo/programa.' },
  ],
  [VaccineType.BLUETONGUE]: [
    { diseaseSlug: 'lengua-azul', immunityDurationDays: 365, dosesForImmunity: 2, notes: '1–2 dosis según vacuna/serotipo; refuerzo anual.' },
  ],
  [VaccineType.THEILERIA]: [
    { diseaseSlug: 'teileriosis-bovina', immunityDurationDays: 365, dosesForImmunity: 1, notes: 'Protocolo específico según región/producto.' },
  ],
  [VaccineType.PARATUBERCULOSIS]: [
    { diseaseSlug: 'paratuberculosis-enfermedad-de-johne', immunityDurationDays: 365, dosesForImmunity: 1, notes: 'Dosis temprana donde esté autorizada; no elimina el riesgo.' },
  ],

  // ── Polivalentes ────────────────────────────────────────────────────────────
  [VaccineType.CLOSTRIDIAL]: [
    { diseaseSlug: 'pierna-negra',                  immunityDurationDays: 365, dosesForImmunity: 2, notes: '7/8 vías — carbón sintomático. 2 dosis iniciales 2–6 sem; refuerzo anual.' },
    { diseaseSlug: 'edema-maligno',                 immunityDurationDays: 365, dosesForImmunity: 2, notes: '7/8 vías — edema maligno.' },
    { diseaseSlug: 'clostridiosis-enterotoxemia',   immunityDurationDays: 365, dosesForImmunity: 2, notes: '7/8 vías — enterotoxemia.' },
    { diseaseSlug: 'tetanos',                       immunityDurationDays: 365, dosesForImmunity: 2, notes: '7/8 vías — tétanos.' },
    { diseaseSlug: 'hemoglobinuria-bacilar',        immunityDurationDays: 365, dosesForImmunity: 2, notes: '8 vías — hemoglobinuria bacilar.' },
    { diseaseSlug: 'hepatitis-necrotica-infecciosa',immunityDurationDays: 365, dosesForImmunity: 2, notes: '8 vías — hepatitis necrótica.' },
  ],
  [VaccineType.RESPIRATORY_COMPLEX]: [
    { diseaseSlug: 'rinotraqueitis-infecciosa-bovina-ibr', immunityDurationDays: 365, dosesForImmunity: 2, notes: 'IBR-BVD-PI3-BRSV — refuerzo anual.' },
    { diseaseSlug: 'diarrea-viral-bovina-bvd',             immunityDurationDays: 365, dosesForImmunity: 2, notes: 'IBR-BVD-PI3-BRSV — refuerzo anual.' },
    { diseaseSlug: 'parainfluenza-bovina',                 immunityDurationDays: 365, dosesForImmunity: 2, notes: 'IBR-BVD-PI3-BRSV — refuerzo anual.' },
    { diseaseSlug: 'sincitial-respiratorio-bovino-rsv',    immunityDurationDays: 365, dosesForImmunity: 2, notes: 'IBR-BVD-PI3-BRSV — refuerzo anual.' },
  ],
  [VaccineType.PASTEURELLA]: [
    { diseaseSlug: 'pasteurelosis-bovina', immunityDurationDays: 270, dosesForImmunity: 2, notes: 'Mannheimia/Pasteurella — refuerzo en periodos de riesgo (180–365).' },
    { diseaseSlug: 'neumonia-bovina',      immunityDurationDays: 270, dosesForImmunity: 2, notes: 'Complejo respiratorio bacteriano.' },
  ],
  [VaccineType.BABESIA_ANAPLASMA]: [
    { diseaseSlug: 'babesiosis-bovina',   immunityDurationDays: 365, dosesForImmunity: 1, notes: 'Viva atenuada — uso estrictamente veterinario en zonas endémicas.' },
    { diseaseSlug: 'anaplasmosis-bovina', immunityDurationDays: 365, dosesForImmunity: 1, notes: 'Viva atenuada — uso estrictamente veterinario en zonas endémicas.' },
  ],

  // ── Monovalentes equivalentes a componentes de polivalentes ──────────────────
  [VaccineType.IBR]: [
    { diseaseSlug: 'rinotraqueitis-infecciosa-bovina-ibr', immunityDurationDays: 365, dosesForImmunity: 1 },
  ],
  [VaccineType.BVD]: [
    { diseaseSlug: 'diarrea-viral-bovina-bvd', immunityDurationDays: 365, dosesForImmunity: 1 },
  ],
  [VaccineType.VIRAL_DIARRHEA]: [
    { diseaseSlug: 'diarrea-viral-bovina-bvd', immunityDurationDays: 365, dosesForImmunity: 1 },
  ],
  [VaccineType.BLACKLEG]: [
    { diseaseSlug: 'pierna-negra', immunityDurationDays: 365, dosesForImmunity: 2 },
  ],
  [VaccineType.TETANUS]: [
    { diseaseSlug: 'tetanos', immunityDurationDays: 365, dosesForImmunity: 2 },
  ],
  [VaccineType.PARAINFLUENZA]: [
    { diseaseSlug: 'parainfluenza-bovina', immunityDurationDays: 365, dosesForImmunity: 1 },
  ],
  [VaccineType.RSV]: [
    { diseaseSlug: 'sincitial-respiratorio-bovino-rsv', immunityDurationDays: 365, dosesForImmunity: 1 },
  ],
  // TUBERCULOSIS y OTHER no confieren protección catalogable → sin entradas.
};

// ── Seeder ────────────────────────────────────────────────────────────────────

export async function seedVaccineProtections(): Promise<void> {
  logger.info('Iniciando seeder de catálogo de protección vacunal', CONTEXT);

  // Cargar todas las enfermedades una sola vez y construir mapa slug → id
  const diseases = await Disease.findAll({ attributes: ['id', 'slug'] });
  const slugToId = new Map<string, string>();
  for (const d of diseases) slugToId.set(d.slug, d.id);

  let created = 0;
  let skipped = 0;
  let missing = 0;

  for (const [vaccineType, entries] of Object.entries(VACCINE_PROTECTION_MAP)) {
    if (!entries) continue;
    for (const entry of entries) {
      const diseaseId = slugToId.get(entry.diseaseSlug);
      if (!diseaseId) {
        logger.warn(
          `Enfermedad no encontrada para slug "${entry.diseaseSlug}" (vacuna ${vaccineType}) — entrada omitida`,
          CONTEXT
        );
        missing++;
        continue;
      }

      const [, wasCreated] = await VaccineDiseaseProtection.findOrCreate({
        where: { vaccineType: vaccineType as VaccineType, diseaseId },
        defaults: {
          vaccineType: vaccineType as VaccineType,
          diseaseId,
          immunityDurationDays: entry.immunityDurationDays,
          dosesForImmunity: entry.dosesForImmunity,
          isActive: true,
          notes: entry.notes ?? null,
        },
      });

      if (wasCreated) created++;
      else skipped++;
    }
  }

  logger.info(
    `Catálogo de protección — creadas: ${created}, ya existían: ${skipped}, enfermedades faltantes: ${missing}`,
    CONTEXT
  );
}

// ── Ejecución directa ─────────────────────────────────────────────────────────

if (require.main === module) {
  require('../models/index');
  seedVaccineProtections()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error ejecutando seeder de protección vacunal:', err);
      process.exit(1);
    });
}
