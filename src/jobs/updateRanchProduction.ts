// src/jobs/updateRanchProduction.ts
import cron from 'node-cron';
import { Op } from 'sequelize';
import { productionService } from '../container'; // tu contenedor con los servicios
import { ranchOperationsService, ranchCoreService } from '../container';
import logger from '../utils/logger';

/**
 * Actualiza las métricas anuales de producción de todos los ranchos activos.
 * Calcula:
 * - Producción total de leche (MILK) para el año actual.
 * - Producción total de carne (MEAT) para el año actual.
 * (Puedes extender para más tipos según tu modelo)
 */
export async function updateRanchProductionJob() {
    const startTime = Date.now();
    logger.info('Iniciando job de actualización de producción anual', 'UpdateRanchProductionJob');

    try {
        // Obtener todos los ranchos activos
        const ranches = await ranchCoreService.listRanches({ isActive: true });

        if (ranches.count === 0) {
            logger.info('No hay ranchos activos para actualizar', 'UpdateRanchProductionJob');
            return;
        }

        let updatedCount = 0;
        let errorCount = 0;
        const currentYear = new Date().getFullYear();
        const startDate = new Date(currentYear, 0, 1);   // 1 de enero
        const endDate = new Date(currentYear, 11, 31);  // 31 de diciembre

        for (const ranch of ranches.rows) {
            try {
                // Obtener registros de leche (MILK) del rancho en el año
                const milkRecords = await productionService.getProductionsByRanch(ranch.id, {
                    productionType: 'MILK',
                    startDate,
                    endDate,
                    limit: 1000000, // ajusta según volumen esperado
                });
                const totalMilk = milkRecords.rows.reduce((sum, prod) => sum + prod.quantity, 0);

                // Obtener registros de carne (MEAT) del rancho en el año
                const meatRecords = await productionService.getProductionsByRanch(ranch.id, {
                    productionType: 'MEAT',
                    startDate,
                    endDate,
                    limit: 1000000,
                });
                const totalMeat = meatRecords.rows.reduce((sum, prod) => sum + prod.quantity, 0);

                // Construir objeto de datos para actualizar
                const productionData = {
                    annualMilkProduction: totalMilk,
                    annualMeatProduction: totalMeat,
                    // Si deseas calcular averageMilkPerCow, necesitarías número de vacas en producción
                    // Por ahora solo estos campos
                };

                // Buscar si ya existe registro para este rancho y año
                const existing = await ranchOperationsService.getProduction(ranch.id, currentYear).catch(() => null);
                if (existing) {
                    await ranchOperationsService.updateProduction(ranch.id, currentYear, productionData, 'system');
                } else {
                    await ranchOperationsService.createProduction(ranch.id, {
                        year: currentYear,
                        ...productionData,
                    }, 'system');
                }

                updatedCount++;
                logger.debug(`Rancho ${ranch.id} actualizado: leche=${totalMilk}L, carne=${totalMeat}kg`, 'UpdateRanchProductionJob');
            } catch (ranchError) {
                errorCount++;
                logger.error(`Error actualizando rancho ${ranch.id}`, 'UpdateRanchProductionJob', { error: ranchError });
            }
        }

        const duration = Date.now() - startTime;
        logger.info(`Job completado. Ranchos actualizados: ${updatedCount}, Errores: ${errorCount}, Duración: ${duration}ms`, 'UpdateRanchProductionJob');
    } catch (error) {
        logger.error('Error crítico en job de actualización de producción', 'UpdateRanchProductionJob', { error });
    }
}

/**
 * Programa el job para que se ejecute diariamente a las 2:00 AM.
 */
export function scheduleRanchProductionUpdate() {
    // Expresión cron: "0 2 * * *" = todos los días a las 2:00 AM
    cron.schedule('0 2 * * *', async () => {
        await updateRanchProductionJob();
    });

    logger.info('Job de actualización de producción programado (2:00 AM)', 'UpdateRanchProductionJob');
}