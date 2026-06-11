// services/health/DiagnosisService.ts
import { Op, Sequelize } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import { HealthError } from '../../utils/HealthErrors';
import { ensureError } from '../../utils/errorUtils';

import Health, {
    HealthAttributes,
    Diagnosis,
    DiagnosisStatus,
} from '../../models/Health';
import Bovine, { HealthStatus } from '../../models/Bovine';
import Ranch from '../../models/Ranch';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface DiagnosisStatsFilters {
    ranchId?: string;
    startDate?: Date;
    endDate?: Date;
    healthStatus?: HealthStatus[];
}

export interface DiagnosisStats {
    // Forma alineada con DiagnosisStatsResponse del frontend.
    totalDiagnoses: number;
    uniqueDiagnoses: number;
    topDiagnoses: Array<{ diagnosis: string; count: number; percentage: number }>;
    byHealthStatus: Record<HealthStatus, number>;
    confirmedVsSuspected: { confirmed: number; suspected: number };
    ruledOutCount: number;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class DiagnosisService {
    private readonly context = 'DiagnosisService';

    /**
     * Registra un diagnóstico en un registro de salud existente.
     *
     * @param healthId     ID del registro de salud
     * @param diagnosisData Datos del diagnóstico JSONB (parcial)
     * @param updatedBy    Usuario que realiza la acción
     * @param diseaseId    UUID del catálogo de enfermedades (opcional).
     *                     Si se provee, actualiza health_records.disease_id.
     *                     Pasar `null` explícitamente desvincula la enfermedad.
     */
    async recordDiagnosis(
        healthId: string,
        diagnosisData: Partial<Diagnosis>,
        updatedBy: string,
        diseaseId?: string | null
    ): Promise<Health> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            const healthRecord = await Health.findByPk(healthId, { transaction });
            if (!healthRecord) {
                throw new HealthError(`Registro de salud con ID ${healthId} no encontrado`, 'HEALTH_NOT_FOUND', 404);
            }

            // Combinar diagnóstico JSONB existente con los nuevos datos
            const currentDiagnosis = healthRecord.diagnosis || ({} as Diagnosis);
            const updatedDiagnosis = {
                ...currentDiagnosis,
                ...diagnosisData,
                updatedAt: new Date(),
            };

            // Construir payload de actualización
            const updatePayload: any = { diagnosis: updatedDiagnosis };

            // Actualizar FK al catálogo solo si el caller la envió explícitamente
            // (undefined = no tocar; null = desvincular; uuid = vincular)
            if (diseaseId !== undefined) {
                updatePayload.diseaseId = diseaseId ?? undefined;
            }

            await healthRecord.update(updatePayload, { transaction });

            await transaction.commit();

            logger.info(`Diagnóstico registrado en health ${healthId}`, this.context, {
                healthId,
                updatedBy,
                diseaseId: diseaseId ?? 'sin cambio',
                durationMs: Date.now() - startTime,
            });

            return healthRecord;
        } catch (error) {
            await transaction.rollback();
            logger.error(`Error registrando diagnóstico en health ${healthId}`, this.context, { healthId }, ensureError(error));
            throw error;
        }
    }

    /**
     * Confirma un diagnóstico sospechado (cambia su estado a CONFIRMED).
     * @param healthId ID del registro de salud
     * @param diagnosisIndex Opcional: índice si hay múltiples diagnósticos (no implementado)
     * @param confirmedBy Usuario que confirma
     */
    async confirmDiagnosis(
        healthId: string,
        confirmedBy: string,
        diagnosisIndex?: number
    ): Promise<Health> {
        const transaction = await sequelize.transaction();
        const startTime = Date.now();

        try {
            const healthRecord = await Health.findByPk(healthId, { transaction });
            if (!healthRecord) {
                throw new HealthError(`Registro de salud con ID ${healthId} no encontrado`, 'HEALTH_NOT_FOUND', 404);
            }

            if (!healthRecord.diagnosis) {
                throw new HealthError('El registro de salud no tiene diagnóstico', 'NO_DIAGNOSIS', 400);
            }

            // Si en el futuro hay múltiples diagnósticos, aquí se manejaría el índice.
            const diagnosis = healthRecord.diagnosis;
            if (diagnosis.status === DiagnosisStatus.CONFIRMED) {
                throw new HealthError('El diagnóstico ya está confirmado', 'ALREADY_CONFIRMED', 400);
            }

            diagnosis.status = DiagnosisStatus.CONFIRMED;
            // Sellamos quién y cuándo confirmó. El filtro `diagnosisConfirmed`
            // del listado de registros y el % de confirmación del dashboard
            // dependen de `confirmedAt`; sin esto el drill-down salía vacío.
            (diagnosis as any).confirmedAt = new Date();
            (diagnosis as any).confirmedBy = confirmedBy;

            await healthRecord.update({ diagnosis }, { transaction });

            await transaction.commit();

            logger.info(`Diagnóstico confirmado en health ${healthId}`, this.context, {
                healthId,
                confirmedBy,
                durationMs: Date.now() - startTime,
            });

            return healthRecord;
        } catch (error) {
            await transaction.rollback();
            logger.error(`Error confirmando diagnóstico en health ${healthId}`, this.context, { healthId }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de diagnósticos en un período y opcionalmente por rancho.
     */
    async getDiagnosisStats(filters: DiagnosisStatsFilters = {}): Promise<DiagnosisStats> {
        const startTime = Date.now();

        try {
            // Construir condiciones WHERE
            const whereHealth: any = {};
            if (filters.startDate) whereHealth.recordDate = { [Op.gte]: filters.startDate };
            if (filters.endDate) whereHealth.recordDate = { ...whereHealth.recordDate, [Op.lte]: filters.endDate };

            // Si se filtra por rancho, necesitamos unir con Bovine
            let includeRanch = false;
            if (filters.ranchId) {
                includeRanch = true;
                // Nota: Para contar correctamente, usaremos una subconsulta o un join en la consulta principal.
                // Usaremos un enfoque con subconsulta para obtener los bovineIds del rancho.
            }

            // Obtener los IDs de bovinos del rancho si es necesario
            let bovineIds: string[] | undefined;
            if (filters.ranchId) {
                const bovines = await Bovine.findAll({
                    where: { ranchId: filters.ranchId },
                    attributes: ['id'],
                });
                bovineIds = bovines.map(b => b.id);
                if (bovineIds.length === 0) {
                    return {
                        totalDiagnoses: 0,
                        uniqueDiagnoses: 0,
                        topDiagnoses: [],
                        byHealthStatus: {} as Record<HealthStatus, number>,
                        confirmedVsSuspected: { confirmed: 0, suspected: 0 },
                        ruledOutCount: 0,
                    };
                }
                whereHealth.bovineId = { [Op.in]: bovineIds };
            }

            // Estadísticas generales
            const totalRecords = await Health.count({ where: whereHealth });

            // Conteo por estado de salud final
            const healthStatusCounts = await Health.findAll({
                where: whereHealth,
                attributes: [
                    'overallHealthStatus',
                    [Sequelize.fn('COUNT', Sequelize.col('overall_health_status')), 'count'],
                ],
                group: ['overall_health_status'],
            });

            const byHealthStatus: Record<HealthStatus, number> = {} as Record<HealthStatus, number>;
            healthStatusCounts.forEach((item: any) => {
                const status = item.overallHealthStatus as HealthStatus;
                byHealthStatus[status] = parseInt(item.getDataValue('count'));
            });

            // Diagnósticos más comunes (contar diagnósticos primarios)
            // Esto requiere extraer el primaryDiagnosis del JSONB. En PostgreSQL se puede hacer con jsonb_extract_path_text.
            // Usaremos raw query para simplificar.
            const topDiagnosesRaw = await sequelize.query(
                `
        SELECT 
          diagnosis->>'primaryDiagnosis' as diagnosis,
          COUNT(*) as count
        FROM health_records
        WHERE diagnosis->>'primaryDiagnosis' IS NOT NULL
          AND deleted_at IS NULL
          ${filters.startDate ? `AND record_date >= :startDate` : ''}
          ${filters.endDate ? `AND record_date <= :endDate` : ''}
          ${filters.ranchId ? `AND bovine_id IN (:bovineIds)` : ''}
        GROUP BY diagnosis->>'primaryDiagnosis'
        ORDER BY count DESC
        LIMIT 10
        `,
                {
                    replacements: {
                        startDate: filters.startDate,
                        endDate: filters.endDate,
                        bovineIds,
                    },
                    type: 'SELECT',
                }
            );

            const topDiagnoses = (topDiagnosesRaw as any[]).map((item: any) => ({
                diagnosis: item.diagnosis || 'Sin diagnóstico',
                count: parseInt(item.count),
                percentage: totalRecords > 0 ? (parseInt(item.count) / totalRecords) * 100 : 0,
            }));

            // Conteo por estado de diagnóstico (usando raw query para extraer del JSON)
            const statusCountsRaw = await sequelize.query(
                `
        SELECT 
          diagnosis->>'status' as status,
          COUNT(*) as count
        FROM health_records
        WHERE diagnosis->>'status' IS NOT NULL
          AND deleted_at IS NULL
          ${filters.startDate ? `AND record_date >= :startDate` : ''}
          ${filters.endDate ? `AND record_date <= :endDate` : ''}
          ${filters.ranchId ? `AND bovine_id IN (:bovineIds)` : ''}
        GROUP BY diagnosis->>'status'
        `,
                {
                    replacements: {
                        startDate: filters.startDate,
                        endDate: filters.endDate,
                        bovineIds,
                    },
                    type: 'SELECT',
                }
            );

            // Las raw queries devuelven count como string → parseamos a entero
            // para que el frontend pueda sumar (confirmed + suspected) sin que
            // concatene strings ("5" + "3" = "53").
            const statusCounts = statusCountsRaw as any[];
            const toInt = (status: DiagnosisStatus) =>
                parseInt(statusCounts.find(s => s.status === status)?.count ?? '0', 10) || 0;
            const confirmedCount    = toInt(DiagnosisStatus.CONFIRMED);
            const ruledOutCount     = toInt(DiagnosisStatus.RULED_OUT);
            const differentialCount = toInt(DiagnosisStatus.DIFFERENTIAL);

            const uniqueDiagnoses = topDiagnoses.length;

            logger.info('Estadísticas de diagnósticos obtenidas', this.context, {
                filters,
                durationMs: Date.now() - startTime,
            });

            return {
                totalDiagnoses: totalRecords,
                uniqueDiagnoses,
                topDiagnoses,
                byHealthStatus,
                // "Sospechosos" = diagnósticos diferenciales (aún sin confirmar).
                // Los descartados (RULED_OUT) van aparte y no cuentan como sospecha.
                confirmedVsSuspected: { confirmed: confirmedCount, suspected: differentialCount },
                ruledOutCount,
            };
        } catch (error) {
            logger.error('Error obteniendo estadísticas de diagnósticos', this.context, { filters }, ensureError(error));
            throw error;
        }
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const diagnosisService = new DiagnosisService();