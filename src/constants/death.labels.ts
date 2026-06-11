// constants/death.labels.ts
// ============================================================================
// LABELS DE MUERTE / BAJA — FUENTE ÚNICA (X-08)
// ============================================================================
// Etiquetas en español de DeathCause y BovineExitReason. Centralizadas para
// que backend (respuestas, reportes) y frontend usen los mismos textos.
// ============================================================================

import { DeathCause } from '../models/BovineDeath';
import { BovineExitReason } from '../models/Bovine';

export const DEATH_CAUSE_LABELS: Record<DeathCause, string> = {
  DISEASE: 'Enfermedad',
  ACCIDENT: 'Accidente',
  PREDATOR_ATTACK: 'Ataque de depredador',
  DROWNING: 'Ahogamiento',
  OLD_AGE: 'Vejez',
  SLAUGHTER: 'Sacrificio',
  NATURAL_DISASTER: 'Desastre natural',
  UNKNOWN: 'Desconocida',
  OTHER: 'Otra',
};

export const EXIT_REASON_LABELS: Record<BovineExitReason, string> = {
  DECEASED: 'Fallecido',
  SOLD: 'Vendido',
  TRANSFERRED: 'Trasladado',
  CULLED: 'Descartado',
  DELETED_ERROR: 'Borrado por error',
};

export function deathCauseLabel(value?: DeathCause | string | null): string | null {
  if (!value) return null;
  return DEATH_CAUSE_LABELS[value as DeathCause] ?? String(value);
}

export function exitReasonLabel(value?: BovineExitReason | string | null): string | null {
  if (!value) return null;
  return EXIT_REASON_LABELS[value as BovineExitReason] ?? String(value);
}
