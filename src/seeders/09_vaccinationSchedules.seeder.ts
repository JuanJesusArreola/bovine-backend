// seeders/09_vaccinationSchedules.seeder.ts
// ============================================================================
// SEEDER — CALENDARIO BASE DE VACUNACIÓN (Módulo 11 / V-03)
// ============================================================================
// Calendario estándar editable. Define edad de inicio y frecuencia de
// revacunación por tipo de vacuna. Idempotente: findOrCreate por vaccineType.
//
// Valores OPERATIVOS de referencia (ajustables por región/manejo):
//   - frequencyMonths null = dosis única.
//   - genderFilter null = ambos sexos.
// ============================================================================

import VaccinationSchedule from '../models/VaccinationSchedule';
import { VaccineType } from '../models/Vaccination';
import { GenderType } from '../models/Bovine';
import logger from '../utils/logger';

const CONTEXT = '09_vaccinationSchedules.seeder';

interface ScheduleSeed {
  vaccineType: VaccineType;
  fromAgeMonths: number;
  toAgeMonths?: number | null;
  frequencyMonths?: number | null;
  isRequired: boolean;
  genderFilter?: GenderType | null;
  notes?: string;
}

const SCHEDULES: ScheduleSeed[] = [
  {
    vaccineType: VaccineType.CLOSTRIDIAL,
    fromAgeMonths: 3, frequencyMonths: 12, isRequired: true,
    notes: 'Polivalente clostridial. Esquema inicial 2 dosis 2–6 sem; refuerzo anual.',
  },
  {
    vaccineType: VaccineType.RESPIRATORY_COMPLEX,
    fromAgeMonths: 4, frequencyMonths: 12, isRequired: true,
    notes: 'IBR-BVD-PI3-BRSV. Refuerzo anual.',
  },
  {
    vaccineType: VaccineType.BRUCELLOSIS,
    fromAgeMonths: 3, toAgeMonths: 10, frequencyMonths: null, isRequired: true,
    genderFilter: GenderType.FEMALE,
    notes: 'RB51/S19 — dosis única en becerras (3–10 meses), según campaña oficial.',
  },
  {
    vaccineType: VaccineType.RABIES,
    fromAgeMonths: 3, frequencyMonths: 12, isRequired: true,
    notes: 'Antirrábica — refuerzo anual en zonas endémicas.',
  },
  {
    vaccineType: VaccineType.LEPTOSPIROSIS,
    fromAgeMonths: 4, frequencyMonths: 12, isRequired: true,
    notes: 'Leptospirosis 5 vías — refuerzo anual (semestral en alto riesgo).',
  },
  {
    vaccineType: VaccineType.FOOT_AND_MOUTH,
    fromAgeMonths: 2, frequencyMonths: 6, isRequired: true,
    notes: 'Fiebre aftosa — según campaña oficial (refuerzos semestrales).',
  },
];

export async function seedVaccinationSchedules(): Promise<void> {
  logger.info('Iniciando seeder de calendario de vacunación', CONTEXT);

  let created = 0;
  let skipped = 0;

  for (const s of SCHEDULES) {
    const [, wasCreated] = await VaccinationSchedule.findOrCreate({
      where: { vaccineType: s.vaccineType },
      defaults: {
        vaccineType: s.vaccineType,
        fromAgeMonths: s.fromAgeMonths,
        toAgeMonths: s.toAgeMonths ?? null,
        frequencyMonths: s.frequencyMonths ?? null,
        isRequired: s.isRequired,
        genderFilter: s.genderFilter ?? null,
        breedFilter: null,
        isActive: true,
        notes: s.notes ?? null,
      },
    });
    if (wasCreated) created++;
    else skipped++;
  }

  logger.info(`Calendario de vacunación — creados: ${created}, ya existían: ${skipped}`, CONTEXT);
}

if (require.main === module) {
  require('../models/index');
  seedVaccinationSchedules()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error ejecutando seeder de calendario de vacunación:', err);
      process.exit(1);
    });
}
