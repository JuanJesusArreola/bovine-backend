// seeders/runDiseaseSeeds.ts
// ============================================================================
// RUNNER — EJECUTA TODOS LOS SEEDERS DE ENFERMEDADES EN ORDEN
// ============================================================================
// Orden obligatorio (dependencias entre tablas):
//   1. diseases
//   2. disease_aliases       ← depende de diseases
//   3. symptoms
//   4. disease_symptoms      ← depende de diseases + symptoms
//   5. transmission_methods
//   6. disease_transmissions ← depende de diseases + transmission_methods
//   7. disease_sources       ← catálogo independiente (sin FK a otras tablas)
//
// Uso desde código:
//   import { runDiseaseSeeds } from './seeders/runDiseaseSeeds';
//   await runDiseaseSeeds();
//
// Uso desde terminal (ts-node):
//   npx ts-node src/seeders/runDiseaseSeeds.ts
// ============================================================================

import { seedDiseases }             from './01_diseases.seeder';
import { seedDiseaseAliases }       from './02_diseaseAliases.seeder';
import { seedSymptoms }             from './03_symptoms.seeder';
import { seedDiseaseSymptoms }      from './04_diseaseSymptoms.seeder';
import { seedTransmissionMethods }  from './05_transmissionMethods.seeder';
import { seedDiseaseTransmissions } from './06_diseaseTransmissions.seeder';
import { seedDiseaseSources }       from './07_diseaseSources.seeder';
import { seedVaccineProtections }   from './08_vaccineProtections.seeder';
import { seedVaccinationSchedules } from './09_vaccinationSchedules.seeder';
import logger from '../utils/logger';

const CONTEXT = 'runDiseaseSeeds';

export async function runDiseaseSeeds(): Promise<void> {
  logger.info('══════════════════════════════════════════', CONTEXT);
  logger.info('  INICIANDO SEEDERS DE CATÁLOGO DE ENFERMEDADES', CONTEXT);
  logger.info('══════════════════════════════════════════', CONTEXT);

  const start = Date.now();

  // 1. Catálogos base (pueden correr antes de los dependientes)
  await seedDiseases();
  await seedSymptoms();
  await seedTransmissionMethods();
  await seedDiseaseSources();      // independiente — sin FK a otros catálogos

  // 2. Relaciones (dependen de los catálogos base)
  await seedDiseaseAliases();
  await seedDiseaseSymptoms();
  await seedDiseaseTransmissions();
  await seedVaccineProtections();  // depende de diseases (paso 1)
  await seedVaccinationSchedules(); // calendario base (V-03) — independiente

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  logger.info(`══════════════════════════════════════════`, CONTEXT);
  logger.info(`  SEEDERS COMPLETADOS en ${elapsed}s`, CONTEXT);
  logger.info(`══════════════════════════════════════════`, CONTEXT);
}

// ── Ejecución directa desde terminal ─────────────────────────────────────────

if (require.main === module) {
  // Necesitamos que los modelos estén registrados antes de correr los seeders
  require('../models/index');

  runDiseaseSeeds()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error ejecutando seeders:', err);
      process.exit(1);
    });
}
