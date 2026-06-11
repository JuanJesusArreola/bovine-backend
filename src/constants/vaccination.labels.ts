// constants/vaccination.labels.ts
// ============================================================================
// LABELS DE VACUNACIÓN — FUENTE ÚNICA (V-06)
// ============================================================================
// Etiquetas en español de los enums de vacunación. Centralizadas aquí para que
// tanto BovineFiltersService (catálogo) como VaccinationService (respuestas con
// labels embebidos) usen exactamente los mismos textos, sin duplicación.
// ============================================================================

import { VaccineType, ApplicationRoute } from '../models/Vaccination';
import { VaccinationStatus } from '../models/Bovine';

export const VACCINE_TYPE_LABELS: Record<VaccineType, string> = {
  BRUCELLOSIS: 'Brucelosis',
  FOOT_AND_MOUTH: 'Fiebre aftosa',
  ANTHRAX: 'Carbunco (Ántrax)',
  RABIES: 'Rabia',
  BLACKLEG: 'Pierna negra',
  IBR: 'Rinotraqueítis (IBR)',
  BVD: 'Diarrea Viral Bovina (BVD)',
  LEPTOSPIROSIS: 'Leptospirosis',
  CLOSTRIDIAL: 'Clostridiales (polivalente)',
  PASTEURELLA: 'Pasteurella',
  TUBERCULOSIS: 'Tuberculosis',
  TETANUS: 'Tétanos',
  VIRAL_DIARRHEA: 'Diarrea viral',
  PARAINFLUENZA: 'Parainfluenza',
  RSV: 'Sincicial respiratorio (RSV)',
  RESPIRATORY_COMPLEX: 'Complejo respiratorio (IBR-BVD-PI3-BRSV)',
  CAMPYLOBACTER: 'Campylobacter (Vibriosis)',
  TRICHOMONIASIS: 'Tricomoniasis',
  PINKEYE: 'Queratoconjuntivitis (Pinkeye)',
  NEONATAL_DIARRHEA: 'Diarrea neonatal (Rota-Corona-E.coli)',
  SALMONELLA: 'Salmonella',
  FUSOBACTERIUM: 'Fusobacterium (Foot rot)',
  LUMPY_SKIN: 'Dermatosis nodular contagiosa',
  BLUETONGUE: 'Lengua azul',
  THEILERIA: 'Theileria',
  BABESIA_ANAPLASMA: 'Babesia / Anaplasma',
  PARATUBERCULOSIS: 'Paratuberculosis (Johne)',
  OTHER: 'Otra',
};

export const APPLICATION_ROUTE_LABELS: Record<ApplicationRoute, string> = {
  INTRAMUSCULAR: 'Intramuscular',
  SUBCUTANEOUS: 'Subcutánea',
  INTRANASAL: 'Intranasal',
  ORAL: 'Oral',
  INTRADERMAL: 'Intradérmica',
  OTHER: 'Otra',
};

export const VACCINATION_STATUS_LABELS: Record<VaccinationStatus, string> = {
  UP_TO_DATE: 'Al día',
  PENDING: 'Pendiente',
  OVERDUE: 'Vencida',
  NONE: 'Sin vacunar',
};

// ── Getters seguros (fallback al valor crudo si no hay label) ─────────────────

export function vaccineTypeLabel(value?: VaccineType | string | null): string | null {
  if (!value) return null;
  return VACCINE_TYPE_LABELS[value as VaccineType] ?? String(value);
}

export function applicationRouteLabel(value?: ApplicationRoute | string | null): string | null {
  if (!value) return null;
  return APPLICATION_ROUTE_LABELS[value as ApplicationRoute] ?? String(value);
}

export function vaccinationStatusLabel(value?: VaccinationStatus | string | null): string | null {
  if (!value) return null;
  return VACCINATION_STATUS_LABELS[value as VaccinationStatus] ?? String(value);
}
