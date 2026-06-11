// seeders/04_diseaseSymptoms.seeder.ts
// ============================================================================
// SEEDER — RELACIONES ENFERMEDAD ↔ SÍNTOMA (~192 relaciones)
// ============================================================================
// Idempotente: usa findOrCreate con (diseaseId, symptomId) como clave.
// Requiere que enfermedades y síntomas ya existan (ejecutar después de 01 y 03).
// ============================================================================

import { Op } from 'sequelize';
import Disease from '../models/Disease';
import Symptom from '../models/Symptom';
import DiseaseSymptom, { SymptomRelevance } from '../models/DiseaseSymptom';
import logger from '../utils/logger';

// ── Tipos locales ────────────────────────────────────────────────────────────

type RelevanceKey = 'PATH' | 'COM' | 'OCC' | 'RARE';

interface SymptomEntry {
  symptomSlug: string;
  relevance: RelevanceKey;
}

interface DiseaseSymptomEntry {
  diseaseSlug: string;
  symptoms: SymptomEntry[];
}

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

const RELEVANCE_MAP: Record<RelevanceKey, SymptomRelevance> = {
  PATH: SymptomRelevance.PATHOGNOMONIC,
  COM:  SymptomRelevance.COMMON,
  OCC:  SymptomRelevance.OCCASIONAL,
  RARE: SymptomRelevance.RARE,
};

function isCommon(r: RelevanceKey): boolean {
  return r === 'PATH' || r === 'COM';
}

// ── Datos ────────────────────────────────────────────────────────────────────

// Síntomas referenciados por slug (generado automáticamente en el seeder 03)
const S = {
  fiebre:                  slugify('Fiebre'),
  fiebreAlta:              slugify('Fiebre alta'),
  perdidaPeso:             slugify('Pérdida de peso'),
  anorexia:                slugify('Anorexia'),
  debilidad:               slugify('Debilidad general'),
  muerteSudita:            slugify('Muerte súbita'),
  hemoglobinuria:          slugify('Hemoglobinuria'),
  ictericia:               slugify('Ictericia'),
  anemia:                  slugify('Anemia'),
  letargia:                slugify('Letargia'),
  tos:                     slugify('Tos'),
  disnea:                  slugify('Disnea'),
  descargaNasal:           slugify('Descarga nasal'),
  respLaboriosa:           slugify('Respiración laboriosa'),
  estertores:              slugify('Estertores pulmonares'),
  disnea_grave:            slugify('Disnea grave'),
  diarrea:                 slugify('Diarrea'),
  diarreaHem:              slugify('Diarrea hemorrágica'),
  timpanismo:              slugify('Timpanismo'),
  salivacion:              slugify('Salivación excesiva'),
  lesionesOral:            slugify('Lesiones en mucosa oral'),
  vomito:                  slugify('Vómito y regurgitación'),
  aborto:                  slugify('Aborto'),
  retencionPlacenta:       slugify('Retención de placenta'),
  descargaVaginal:         slugify('Descarga vaginal purulenta'),
  infertilidad:            slugify('Infertilidad'),
  inflamacionMamaria:      slugify('Inflamación mamaria'),
  disminucionLeche:        slugify('Disminución de producción láctea'),
  cojera:                  slugify('Cojera'),
  inflamacionArticular:    slugify('Inflamación articular'),
  rigidezMuscular:         slugify('Rigidez muscular'),
  lesionesPezunas:         slugify('Lesiones en pezuñas'),
  edemaMiembros:           slugify('Edema en extremidades'),
  incapacidadLevantarse:   slugify('Incapacidad para levantarse'),
  convulsiones:            slugify('Convulsiones'),
  paralisis:               slugify('Parálisis'),
  incoordinacion:          slugify('Incoordinación'),
  cambiosComport:          slugify('Cambios de comportamiento'),
  opistotonos:             slugify('Opistótonos'),
  lesionesVesiculares:     slugify('Lesiones vesiculares y úlceras'),
  alopecia:                slugify('Alopecia'),
  lesionesCutaneas:        slugify('Lesiones cutáneas'),
};

const DISEASE_SYMPTOMS: DiseaseSymptomEntry[] = [
  {
    diseaseSlug: 'brucelosis',
    symptoms: [
      { symptomSlug: S.aborto,            relevance: 'PATH' },
      { symptomSlug: S.infertilidad,      relevance: 'COM'  },
      { symptomSlug: S.retencionPlacenta, relevance: 'COM'  },
      { symptomSlug: S.descargaVaginal,   relevance: 'COM'  },
      { symptomSlug: S.fiebre,            relevance: 'OCC'  },
      { symptomSlug: S.anorexia,          relevance: 'OCC'  },
      { symptomSlug: S.perdidaPeso,       relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'fiebre-aftosa',
    symptoms: [
      { symptomSlug: S.lesionesVesiculares, relevance: 'PATH' },
      { symptomSlug: S.salivacion,          relevance: 'PATH' },
      { symptomSlug: S.lesionesOral,        relevance: 'COM'  },
      { symptomSlug: S.lesionesPezunas,     relevance: 'COM'  },
      { symptomSlug: S.fiebreAlta,          relevance: 'COM'  },
      { symptomSlug: S.cojera,              relevance: 'COM'  },
      { symptomSlug: S.anorexia,            relevance: 'OCC'  },
      { symptomSlug: S.disminucionLeche,    relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'carbunco-antrax',
    symptoms: [
      { symptomSlug: S.muerteSudita,  relevance: 'PATH' },
      { symptomSlug: S.fiebreAlta,    relevance: 'COM'  },
      { symptomSlug: S.debilidad,     relevance: 'COM'  },
      { symptomSlug: S.edemaMiembros, relevance: 'OCC'  },
      { symptomSlug: S.hemoglobinuria,relevance: 'OCC'  },
      { symptomSlug: S.anemia,        relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'rabia',
    symptoms: [
      { symptomSlug: S.cambiosComport,  relevance: 'PATH' },
      { symptomSlug: S.paralisis,       relevance: 'COM'  },
      { symptomSlug: S.salivacion,      relevance: 'COM'  },
      { symptomSlug: S.incoordinacion,  relevance: 'COM'  },
      { symptomSlug: S.convulsiones,    relevance: 'OCC'  },
      { symptomSlug: S.opistotonos,     relevance: 'OCC'  },
      { symptomSlug: S.fiebre,          relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'pierna-negra',
    symptoms: [
      { symptomSlug: S.cojera,           relevance: 'PATH' },
      { symptomSlug: S.edemaMiembros,    relevance: 'COM'  },
      { symptomSlug: S.muerteSudita,     relevance: 'COM'  },
      { symptomSlug: S.fiebreAlta,       relevance: 'COM'  },
      { symptomSlug: S.debilidad,        relevance: 'COM'  },
      { symptomSlug: S.inflamacionArticular, relevance: 'OCC' },
    ],
  },
  {
    diseaseSlug: 'rinotraqueitis-infecciosa-bovina-ibr',
    symptoms: [
      { symptomSlug: S.descargaNasal,  relevance: 'COM'  },
      { symptomSlug: S.tos,            relevance: 'COM'  },
      { symptomSlug: S.fiebreAlta,     relevance: 'COM'  },
      { symptomSlug: S.disnea,         relevance: 'COM'  },
      { symptomSlug: S.aborto,         relevance: 'OCC'  },
      { symptomSlug: S.descargaVaginal,relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'diarrea-viral-bovina-bvd',
    symptoms: [
      { symptomSlug: S.diarrea,       relevance: 'PATH' },
      { symptomSlug: S.lesionesOral,  relevance: 'PATH' },
      { symptomSlug: S.fiebre,        relevance: 'COM'  },
      { symptomSlug: S.anorexia,      relevance: 'COM'  },
      { symptomSlug: S.descargaNasal, relevance: 'COM'  },
      { symptomSlug: S.aborto,        relevance: 'OCC'  },
      { symptomSlug: S.perdidaPeso,   relevance: 'OCC'  },
      { symptomSlug: S.debilidad,     relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'leptospirosis',
    symptoms: [
      { symptomSlug: S.hemoglobinuria,   relevance: 'PATH' },
      { symptomSlug: S.aborto,           relevance: 'COM'  },
      { symptomSlug: S.ictericia,        relevance: 'COM'  },
      { symptomSlug: S.anemia,           relevance: 'COM'  },
      { symptomSlug: S.fiebreAlta,       relevance: 'COM'  },
      { symptomSlug: S.disminucionLeche, relevance: 'OCC'  },
      { symptomSlug: S.descargaVaginal,  relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'tuberculosis-bovina',
    symptoms: [
      { symptomSlug: S.tos,         relevance: 'PATH' },
      { symptomSlug: S.perdidaPeso, relevance: 'COM'  },
      { symptomSlug: S.debilidad,   relevance: 'COM'  },
      { symptomSlug: S.estertores,  relevance: 'COM'  },
      { symptomSlug: S.disnea,      relevance: 'OCC'  },
      { symptomSlug: S.anorexia,    relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'tetanos',
    symptoms: [
      { symptomSlug: S.rigidezMuscular,      relevance: 'PATH' },
      { symptomSlug: S.opistotonos,          relevance: 'PATH' },
      { symptomSlug: S.incapacidadLevantarse,relevance: 'COM'  },
      { symptomSlug: S.convulsiones,         relevance: 'COM'  },
      { symptomSlug: S.fiebre,               relevance: 'OCC'  },
      { symptomSlug: S.muerteSudita,         relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'parainfluenza-bovina',
    symptoms: [
      { symptomSlug: S.tos,          relevance: 'COM' },
      { symptomSlug: S.descargaNasal,relevance: 'COM' },
      { symptomSlug: S.fiebre,       relevance: 'COM' },
      { symptomSlug: S.disnea,       relevance: 'OCC' },
      { symptomSlug: S.anorexia,     relevance: 'OCC' },
    ],
  },
  {
    diseaseSlug: 'sincitial-respiratorio-bovino-rsv',
    symptoms: [
      { symptomSlug: S.disnea_grave,  relevance: 'PATH' },
      { symptomSlug: S.tos,           relevance: 'COM'  },
      { symptomSlug: S.fiebreAlta,    relevance: 'COM'  },
      { symptomSlug: S.respLaboriosa, relevance: 'COM'  },
      { symptomSlug: S.estertores,    relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'mastitis',
    symptoms: [
      { symptomSlug: S.inflamacionMamaria, relevance: 'PATH' },
      { symptomSlug: S.disminucionLeche,   relevance: 'PATH' },
      { symptomSlug: S.fiebre,             relevance: 'COM'  },
      { symptomSlug: S.anorexia,           relevance: 'OCC'  },
      { symptomSlug: S.debilidad,          relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'cisticercosis-bovina',
    symptoms: [
      { symptomSlug: S.incoordinacion, relevance: 'COM' },
      { symptomSlug: S.convulsiones,   relevance: 'COM' },
      { symptomSlug: S.paralisis,      relevance: 'OCC' },
      { symptomSlug: S.cambiosComport, relevance: 'OCC' },
      { symptomSlug: S.perdidaPeso,    relevance: 'OCC' },
    ],
  },
  {
    diseaseSlug: 'encefalopatia-espongiforme-bovina-eeb',
    symptoms: [
      { symptomSlug: S.cambiosComport, relevance: 'PATH' },
      { symptomSlug: S.incoordinacion, relevance: 'PATH' },
      { symptomSlug: S.paralisis,      relevance: 'COM'  },
      { symptomSlug: S.convulsiones,   relevance: 'COM'  },
      { symptomSlug: S.perdidaPeso,    relevance: 'COM'  },
      { symptomSlug: S.muerteSudita,   relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'anaplasmosis-bovina',
    symptoms: [
      { symptomSlug: S.anemia,      relevance: 'PATH' },
      { symptomSlug: S.ictericia,   relevance: 'COM'  },
      { symptomSlug: S.fiebreAlta,  relevance: 'COM'  },
      { symptomSlug: S.debilidad,   relevance: 'COM'  },
      { symptomSlug: S.perdidaPeso, relevance: 'OCC'  },
      { symptomSlug: S.anorexia,    relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'babesiosis-bovina',
    symptoms: [
      { symptomSlug: S.hemoglobinuria, relevance: 'PATH' },
      { symptomSlug: S.fiebreAlta,     relevance: 'COM'  },
      { symptomSlug: S.anemia,         relevance: 'COM'  },
      { symptomSlug: S.ictericia,      relevance: 'COM'  },
      { symptomSlug: S.debilidad,      relevance: 'COM'  },
      { symptomSlug: S.incoordinacion, relevance: 'OCC'  },
      { symptomSlug: S.muerteSudita,   relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'queratoconjuntivitis-infecciosa',
    symptoms: [
      { symptomSlug: S.lesionesVesiculares, relevance: 'PATH' },
      { symptomSlug: S.descargaNasal,       relevance: 'OCC'  },
      { symptomSlug: S.anorexia,            relevance: 'OCC'  },
      { symptomSlug: S.letargia,            relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'neumonia-bovina',
    symptoms: [
      { symptomSlug: S.tos,          relevance: 'PATH' },
      { symptomSlug: S.estertores,   relevance: 'PATH' },
      { symptomSlug: S.fiebreAlta,   relevance: 'COM'  },
      { symptomSlug: S.disnea,       relevance: 'COM'  },
      { symptomSlug: S.respLaboriosa,relevance: 'COM'  },
      { symptomSlug: S.anorexia,     relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'diarrea-neonatal-bovina',
    symptoms: [
      { symptomSlug: S.diarrea,      relevance: 'PATH' },
      { symptomSlug: S.diarreaHem,   relevance: 'COM'  },
      { symptomSlug: S.debilidad,    relevance: 'COM'  },
      { symptomSlug: S.anorexia,     relevance: 'COM'  },
      { symptomSlug: S.letargia,     relevance: 'COM'  },
      { symptomSlug: S.muerteSudita, relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'salmonelosis-bovina',
    symptoms: [
      { symptomSlug: S.diarreaHem,   relevance: 'PATH' },
      { symptomSlug: S.fiebreAlta,   relevance: 'COM'  },
      { symptomSlug: S.diarrea,      relevance: 'COM'  },
      { symptomSlug: S.anorexia,     relevance: 'COM'  },
      { symptomSlug: S.debilidad,    relevance: 'OCC'  },
      { symptomSlug: S.muerteSudita, relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'metritis-endometritis',
    symptoms: [
      { symptomSlug: S.descargaVaginal,  relevance: 'PATH' },
      { symptomSlug: S.fiebre,           relevance: 'COM'  },
      { symptomSlug: S.anorexia,         relevance: 'COM'  },
      { symptomSlug: S.infertilidad,     relevance: 'COM'  },
      { symptomSlug: S.retencionPlacenta,relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'listeriosis-bovina',
    symptoms: [
      { symptomSlug: S.incoordinacion, relevance: 'COM' },
      { symptomSlug: S.cambiosComport, relevance: 'COM' },
      { symptomSlug: S.convulsiones,   relevance: 'OCC' },
      { symptomSlug: S.paralisis,      relevance: 'OCC' },
      { symptomSlug: S.fiebre,         relevance: 'OCC' },
    ],
  },
  {
    diseaseSlug: 'actinobacilosis',
    symptoms: [
      { symptomSlug: S.lesionesOral, relevance: 'PATH' },
      { symptomSlug: S.salivacion,   relevance: 'COM'  },
      { symptomSlug: S.anorexia,     relevance: 'COM'  },
      { symptomSlug: S.perdidaPeso,  relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'actinomicosis',
    symptoms: [
      { symptomSlug: S.inflamacionArticular, relevance: 'PATH' },
      { symptomSlug: S.anorexia,             relevance: 'COM'  },
      { symptomSlug: S.perdidaPeso,          relevance: 'COM'  },
      { symptomSlug: S.letargia,             relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'hipocalcemia-fiebre-de-leche',
    symptoms: [
      { symptomSlug: S.incapacidadLevantarse, relevance: 'PATH' },
      { symptomSlug: S.paralisis,             relevance: 'COM'  },
      { symptomSlug: S.incoordinacion,        relevance: 'COM'  },
      { symptomSlug: S.rigidezMuscular,       relevance: 'COM'  },
      { symptomSlug: S.debilidad,             relevance: 'COM'  },
      { symptomSlug: S.anorexia,              relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'cetosis-bovina',
    symptoms: [
      { symptomSlug: S.anorexia,         relevance: 'PATH' },
      { symptomSlug: S.perdidaPeso,      relevance: 'COM'  },
      { symptomSlug: S.letargia,         relevance: 'COM'  },
      { symptomSlug: S.disminucionLeche, relevance: 'COM'  },
      { symptomSlug: S.cambiosComport,   relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'dermatofitosis-tina',
    symptoms: [
      { symptomSlug: S.alopecia,          relevance: 'PATH' },
      { symptomSlug: S.lesionesCutaneas,  relevance: 'PATH' },
      { symptomSlug: S.lesionesVesiculares,relevance: 'OCC' },
      { symptomSlug: S.letargia,          relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'fotosensibilizacion',
    symptoms: [
      { symptomSlug: S.lesionesCutaneas, relevance: 'PATH' },
      { symptomSlug: S.alopecia,         relevance: 'COM'  },
      { symptomSlug: S.debilidad,        relevance: 'OCC'  },
      { symptomSlug: S.anorexia,         relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'timpanismo-meteorismo',
    symptoms: [
      { symptomSlug: S.timpanismo,            relevance: 'PATH' },
      { symptomSlug: S.disnea,                relevance: 'COM'  },
      { symptomSlug: S.incapacidadLevantarse, relevance: 'COM'  },
      { symptomSlug: S.muerteSudita,          relevance: 'OCC'  },
      { symptomSlug: S.anorexia,              relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'pasteurelosis-bovina',
    symptoms: [
      { symptomSlug: S.fiebreAlta,   relevance: 'COM' },
      { symptomSlug: S.tos,          relevance: 'COM' },
      { symptomSlug: S.disnea,       relevance: 'COM' },
      { symptomSlug: S.estertores,   relevance: 'COM' },
      { symptomSlug: S.descargaNasal,relevance: 'COM' },
      { symptomSlug: S.muerteSudita, relevance: 'OCC' },
    ],
  },
  {
    diseaseSlug: 'clostridiosis-enterotoxemia',
    symptoms: [
      { symptomSlug: S.muerteSudita, relevance: 'PATH' },
      { symptomSlug: S.diarreaHem,   relevance: 'COM'  },
      { symptomSlug: S.timpanismo,   relevance: 'COM'  },
      { symptomSlug: S.debilidad,    relevance: 'COM'  },
      { symptomSlug: S.convulsiones, relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'fiebre-de-embarque',
    symptoms: [
      { symptomSlug: S.fiebreAlta,    relevance: 'COM' },
      { symptomSlug: S.tos,           relevance: 'COM' },
      { symptomSlug: S.disnea,        relevance: 'COM' },
      { symptomSlug: S.respLaboriosa, relevance: 'COM' },
      { symptomSlug: S.descargaNasal, relevance: 'COM' },
      { symptomSlug: S.anorexia,      relevance: 'COM' },
    ],
  },
  {
    diseaseSlug: 'campilobacteriosis-genital-bovina',
    symptoms: [
      { symptomSlug: S.aborto,           relevance: 'PATH' },
      { symptomSlug: S.infertilidad,     relevance: 'PATH' },
      { symptomSlug: S.descargaVaginal,  relevance: 'COM'  },
      { symptomSlug: S.retencionPlacenta,relevance: 'OCC'  },
      { symptomSlug: S.fiebre,           relevance: 'OCC'  },
    ],
  },

  // ── Enfermedades añadidas (puente de vacunación) ────────────────────────────
  {
    diseaseSlug: 'tricomoniasis-bovina',
    symptoms: [
      { symptomSlug: S.infertilidad,      relevance: 'PATH' },
      { symptomSlug: S.aborto,            relevance: 'COM'  },
      { symptomSlug: S.descargaVaginal,   relevance: 'COM'  },
      { symptomSlug: S.retencionPlacenta, relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'pododermatitis-infecciosa-foot-rot',
    symptoms: [
      { symptomSlug: S.cojera,         relevance: 'PATH' },
      { symptomSlug: S.lesionesPezunas,relevance: 'COM'  },
      { symptomSlug: S.edemaMiembros,  relevance: 'COM'  },
      { symptomSlug: S.fiebre,         relevance: 'OCC'  },
      { symptomSlug: S.anorexia,       relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'dermatosis-nodular-contagiosa',
    symptoms: [
      { symptomSlug: S.lesionesCutaneas,  relevance: 'PATH' },
      { symptomSlug: S.fiebreAlta,        relevance: 'COM'  },
      { symptomSlug: S.disminucionLeche,  relevance: 'COM'  },
      { symptomSlug: S.alopecia,          relevance: 'OCC'  },
      { symptomSlug: S.edemaMiembros,     relevance: 'OCC'  },
      { symptomSlug: S.anorexia,          relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'lengua-azul',
    symptoms: [
      { symptomSlug: S.lesionesOral,   relevance: 'PATH' },
      { symptomSlug: S.fiebreAlta,     relevance: 'COM'  },
      { symptomSlug: S.salivacion,     relevance: 'COM'  },
      { symptomSlug: S.cojera,         relevance: 'COM'  },
      { symptomSlug: S.lesionesPezunas,relevance: 'OCC'  },
      { symptomSlug: S.edemaMiembros,  relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'teileriosis-bovina',
    symptoms: [
      { symptomSlug: S.anemia,      relevance: 'PATH' },
      { symptomSlug: S.fiebreAlta,  relevance: 'COM'  },
      { symptomSlug: S.ictericia,   relevance: 'COM'  },
      { symptomSlug: S.debilidad,   relevance: 'COM'  },
      { symptomSlug: S.perdidaPeso, relevance: 'OCC'  },
      { symptomSlug: S.letargia,    relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'paratuberculosis-enfermedad-de-johne',
    symptoms: [
      { symptomSlug: S.diarrea,          relevance: 'PATH' },
      { symptomSlug: S.perdidaPeso,      relevance: 'PATH' },
      { symptomSlug: S.debilidad,        relevance: 'COM'  },
      { symptomSlug: S.disminucionLeche, relevance: 'COM'  },
      { symptomSlug: S.anorexia,         relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'edema-maligno',
    symptoms: [
      { symptomSlug: S.edemaMiembros, relevance: 'PATH' },
      { symptomSlug: S.fiebreAlta,    relevance: 'COM'  },
      { symptomSlug: S.muerteSudita,  relevance: 'COM'  },
      { symptomSlug: S.debilidad,     relevance: 'COM'  },
      { symptomSlug: S.cojera,        relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'hemoglobinuria-bacilar',
    symptoms: [
      { symptomSlug: S.hemoglobinuria, relevance: 'PATH' },
      { symptomSlug: S.anemia,         relevance: 'COM'  },
      { symptomSlug: S.ictericia,      relevance: 'COM'  },
      { symptomSlug: S.fiebreAlta,     relevance: 'COM'  },
      { symptomSlug: S.muerteSudita,   relevance: 'OCC'  },
    ],
  },
  {
    diseaseSlug: 'hepatitis-necrotica-infecciosa',
    symptoms: [
      { symptomSlug: S.muerteSudita, relevance: 'PATH' },
      { symptomSlug: S.ictericia,    relevance: 'COM'  },
      { symptomSlug: S.fiebreAlta,   relevance: 'COM'  },
      { symptomSlug: S.debilidad,    relevance: 'COM'  },
      { symptomSlug: S.anorexia,     relevance: 'OCC'  },
    ],
  },
];

// ── Seeder ───────────────────────────────────────────────────────────────────

const CONTEXT = '04_diseaseSymptoms.seeder';

export async function seedDiseaseSymptoms(): Promise<void> {
  // Cargar todos los slugs de una vez
  const [diseases, symptoms] = await Promise.all([
    Disease.findAll({ attributes: ['id', 'slug'], raw: true }),
    Symptom.findAll({ attributes: ['id', 'slug'], raw: true }),
  ]);

  const diseaseMap = new Map((diseases as any[]).map((d) => [d.slug, d.id]));
  const symptomMap = new Map((symptoms as any[]).map((s) => [s.slug, s.id]));

  let created = 0;
  let skipped = 0;
  let warnings = 0;
  let total = 0;

  for (const entry of DISEASE_SYMPTOMS) {
    const diseaseId = diseaseMap.get(entry.diseaseSlug);
    if (!diseaseId) {
      logger.warn(`Enfermedad no encontrada: ${entry.diseaseSlug}`, CONTEXT);
      warnings++;
      continue;
    }

    for (const sym of entry.symptoms) {
      total++;
      const symptomId = symptomMap.get(sym.symptomSlug);
      if (!symptomId) {
        logger.warn(`Síntoma no encontrado: ${sym.symptomSlug}`, CONTEXT);
        warnings++;
        continue;
      }

      const relevance = RELEVANCE_MAP[sym.relevance];
      const [, wasCreated] = await DiseaseSymptom.findOrCreate({
        where: { diseaseId, symptomId },
        defaults: {
          diseaseId,
          symptomId,
          relevance,
          isCommon: isCommon(sym.relevance),
        },
      });

      if (wasCreated) created++;
      else skipped++;
    }
  }

  logger.info(
    `Relaciones enfermedad↔síntoma — total procesadas: ${total}, creadas: ${created}, ya existían: ${skipped}, advertencias: ${warnings}`,
    CONTEXT
  );
}
