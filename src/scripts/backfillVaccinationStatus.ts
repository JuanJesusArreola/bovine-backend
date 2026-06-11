// scripts/backfillVaccinationStatus.ts
// ============================================================================
// BACKFILL — ESTADO DE VACUNACIÓN (V-01)
// ============================================================================
// Recalcula el cache `bovine_vaccination_status` para los bovinos activos.
// Resuelve el problema de bovinos antiguos sin fila de estado (que no aparecían
// en los filtros UP_TO_DATE/OVERDUE/PENDING por el INNER JOIN).
//
// Uso (ts-node):
//   npx ts-node src/scripts/backfillVaccinationStatus.ts
//   npx ts-node src/scripts/backfillVaccinationStatus.ts --only-missing
//
//   --only-missing  → solo crea filas faltantes (no reprocesa los que ya tienen).
//                     Sin la bandera, reprocesa TODOS (recomendado la 1ª vez).
// ============================================================================

import '../models/index'; // registra modelos + asociaciones
import { bovineVaccinationStatusService } from '../services/BovineVaccinationStatusService';

async function main(): Promise<void> {
  const onlyMissing = process.argv.includes('--only-missing');

  console.log('══════════════════════════════════════════');
  console.log('  BACKFILL DE ESTADO DE VACUNACIÓN');
  console.log(`  Modo: ${onlyMissing ? 'solo faltantes' : 'reprocesar todos'}`);
  console.log('══════════════════════════════════════════');

  const start = Date.now();
  const result = await bovineVaccinationStatusService.recomputeAll({ onlyMissing });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log('──────────────────────────────────────────');
  console.log(`  Procesados: ${result.processed}`);
  console.log(`  Errores:    ${result.errors}`);
  console.log(`  Omitidos:   ${result.skipped}`);
  console.log(`  Tiempo:     ${elapsed}s`);
  console.log('══════════════════════════════════════════');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error en backfill de estado de vacunación:', err);
    process.exit(1);
  });
