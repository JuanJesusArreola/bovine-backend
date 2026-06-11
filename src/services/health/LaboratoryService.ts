// services/health/LaboratoryService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import { HealthError } from '../../utils/HealthErrors';
import { ensureError } from '../../utils/errorUtils';

import Health, {
  LaboratoryResults,
} from '../../models/Health';
import Bovine from '../../models/Bovine';
import Ranch from '../../models/Ranch';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface AddLaboratoryResultsDTO {
  healthId: string;
  results: Array<{
    testType?: string;
    sampleType?: 'BLOOD' | 'URINE' | 'FECES' | 'TISSUE' | 'MILK' | 'SWAB' | 'OTHER';
    sampleDate?: Date;
    testDate?: Date;
    laboratory?: string;
    results?: Array<{
      parameter: string;
      value: string | number;
      unit?: string;
      referenceRange?: string; // ej. "4.5-11.5" o ">0.5"
      status?: 'NORMAL' | 'ABNORMAL' | 'CRITICAL' | 'PENDING';
      notes?: string;
    }>;
    interpretation?: string;
    recommendations?: string[];
    cost?: number;
    reportUrl?: string;
  }>;
  updatedBy: string;
}

export interface InterpretedResult {
  parameter: string;
  value: string | number;
  unit?: string;
  referenceRange?: string;
  status: 'NORMAL' | 'ABNORMAL' | 'CRITICAL' | 'PENDING';
  interpretation?: string;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class LaboratoryService {
  private readonly context = 'LaboratoryService';

  // ==========================================================================
  // INTERPRETACIÓN DE RESULTADOS
  // ==========================================================================

  /**
   * Interpreta un valor contra un rango de referencia en formato string.
   * Soporta rangos como "4.5-11.5", ">0.5", "<10", ">=20", "<=100", o un número exacto.
   * Retorna 'NORMAL', 'ABNORMAL' o 'CRITICAL' según el valor y el rango.
   */
  private interpretSingleResult(value: string | number, referenceRange?: string): 'NORMAL' | 'ABNORMAL' | 'CRITICAL' | 'PENDING' {
    if (referenceRange === undefined || referenceRange === null || referenceRange === '') {
      return 'NORMAL'; // Sin rango, asumimos normal
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return 'PENDING'; // No se puede interpretar

    // Limpiar espacios
    const range = referenceRange.replace(/\s/g, '');

    // Caso: rango con guión, ej. "4.5-11.5"
    if (range.includes('-')) {
      const parts = range.split('-');
      if (parts.length === 2) {
        const min = parseFloat(parts[0]);
        const max = parseFloat(parts[1]);
        if (!isNaN(min) && !isNaN(max)) {
          if (numValue < min || numValue > max) return 'ABNORMAL';
          return 'NORMAL';
        }
      }
    }

    // Caso: mayor que ">X" o ">=X"
    if (range.startsWith('>=')) {
      const threshold = parseFloat(range.substring(2));
      if (!isNaN(threshold)) {
        return numValue >= threshold ? 'NORMAL' : 'ABNORMAL';
      }
    }
    if (range.startsWith('>')) {
      const threshold = parseFloat(range.substring(1));
      if (!isNaN(threshold)) {
        return numValue > threshold ? 'NORMAL' : 'ABNORMAL';
      }
    }

    // Caso: menor que "<X" o "<=X"
    if (range.startsWith('<=')) {
      const threshold = parseFloat(range.substring(2));
      if (!isNaN(threshold)) {
        return numValue <= threshold ? 'NORMAL' : 'ABNORMAL';
      }
    }
    if (range.startsWith('<')) {
      const threshold = parseFloat(range.substring(1));
      if (!isNaN(threshold)) {
        return numValue < threshold ? 'NORMAL' : 'ABNORMAL';
      }
    }

    // Si no se pudo interpretar, se considera ABNORMAL por precaución
    return 'ABNORMAL';
  }

  /**
   * Interpreta un array de resultados de laboratorio, asignando status a cada ítem.
   * También puede generar una interpretación general (opcional).
   */
  interpretResults(labResults: LaboratoryResults[]): LaboratoryResults[] {
    return labResults.map(lab => {
      if (lab.results) {
        lab.results = lab.results.map(item => {
          const status = this.interpretSingleResult(item.value, item.referenceRange);
          return { ...item, status };
        });
      }
      // Aquí se podría generar una interpretación general combinando varios resultados
      // Por ahora lo dejamos como está.
      return lab;
    });
  }

  // ==========================================================================
  // AGREGAR RESULTADOS
  // ==========================================================================

  /**
   * Añade uno o varios resultados de laboratorio a un registro de salud existente.
   * Interpreta automáticamente los resultados y actualiza el campo laboratoryResults.
   */
  async addLaboratoryResults(
    data: AddLaboratoryResultsDTO,
    transaction?: Transaction
  ): Promise<Health> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const healthRecord = await Health.findByPk(data.healthId, { transaction: t });
      if (!healthRecord) {
        throw new HealthError(`Registro de salud con ID ${data.healthId} no encontrado`, 'HEALTH_NOT_FOUND', 404);
      }

      // Interpretar los nuevos resultados antes de guardarlos
      const interpretedNewResults = this.interpretResults(data.results);

      // Obtener resultados existentes o inicializar array
      const existingResults = healthRecord.laboratoryResults || [];

      // Combinar
      const updatedResults = [...existingResults, ...interpretedNewResults];

      await healthRecord.update(
        { laboratoryResults: updatedResults },
        { transaction: t }
      );

      if (isOwnTransaction) await t.commit();

      logger.info(`Resultados de laboratorio agregados a health ${data.healthId}`, this.context, {
        healthId: data.healthId,
        count: data.results.length,
        updatedBy: data.updatedBy,
        durationMs: Date.now() - startTime,
      });

      return healthRecord;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error agregando resultados a health ${data.healthId}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // CONSULTAS DE RESULTADOS ANORMALES
  // ==========================================================================

  /**
   * Obtiene los resultados anormales (status ABNORMAL o CRITICAL) de un registro de salud específico.
   */
  async getAbnormalResults(healthId: string): Promise<LaboratoryResults[]> {
    try {
      const healthRecord = await Health.findByPk(healthId, {
        attributes: ['id', 'laboratoryResults'],
      });
      if (!healthRecord) {
        throw new HealthError(`Registro de salud con ID ${healthId} no encontrado`, 'HEALTH_NOT_FOUND', 404);
      }

      if (!healthRecord.laboratoryResults) return [];

      // Filtrar aquellos laboratorios que tengan al menos un resultado anormal
      const abnormalLabs = healthRecord.laboratoryResults
        .map(lab => {
          const abnormalItems = lab.results?.filter(
            item => item.status === 'ABNORMAL' || item.status === 'CRITICAL'
          ) || [];
          if (abnormalItems.length === 0) return null;
          return {
            ...lab,
            results: abnormalItems,
          };
        })
        .filter(lab => lab !== null) as LaboratoryResults[];

      return abnormalLabs;
    } catch (error) {
      logger.error(`Error obteniendo resultados anormales de health ${healthId}`, this.context, { healthId }, ensureError(error));
      throw error;
    }
  }

  /**
   * Obtiene los últimos resultados anormales de un bovino.
   * @param bovineId ID del bovino
   * @param limit Número máximo de registros a revisar (por defecto 10)
   * @returns Array de objetos con healthRecordId, fecha y resultados anormales
   */
  async getAbnormalResultsByBovine(
    bovineId: string,
    limit: number = 10
  ): Promise<Array<{ healthRecordId: string; recordDate: Date; abnormalResults: LaboratoryResults[] }>> {
    try {
      const healthRecords = await Health.findAll({
        where: { bovineId },
        order: [['recordDate', 'DESC']],
        limit,
        attributes: ['id', 'recordDate', 'laboratoryResults'],
      });

      const result: Array<{ healthRecordId: string; recordDate: Date; abnormalResults: LaboratoryResults[] }> = [];

      for (const record of healthRecords) {
        if (record.laboratoryResults) {
          const abnormalLabs = record.laboratoryResults
            .map(lab => {
              const abnormalItems = lab.results?.filter(
                item => item.status === 'ABNORMAL' || item.status === 'CRITICAL'
              ) || [];
              if (abnormalItems.length === 0) return null;
              return {
                ...lab,
                results: abnormalItems,
              };
            })
            .filter(lab => lab !== null) as LaboratoryResults[];

          if (abnormalLabs.length > 0) {
            result.push({
              healthRecordId: record.id,
              recordDate: record.recordDate,
              abnormalResults: abnormalLabs,
            });
          }
        }
      }

      return result;
    } catch (error) {
      logger.error(`Error obteniendo resultados anormales del bovino ${bovineId}`, this.context, { bovineId }, ensureError(error));
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de resultados anormales en un rancho durante un período.
   * @param ranchId ID del rancho
   * @param days Número de días hacia atrás (opcional, por defecto 30)
   */
  async getAbnormalResultsByRanch(
    ranchId: string,
    days: number = 30
  ): Promise<{
    totalBovinesWithAbnormal: number;
    totalAbnormalResults: number;
    byParameter: Record<string, number>;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Obtener todos los bovinos del rancho
      const bovines = await Bovine.findAll({
        where: { ranchId },
        attributes: ['id'],
      });
      const bovineIds = bovines.map(b => b.id);
      if (bovineIds.length === 0) {
        return { totalBovinesWithAbnormal: 0, totalAbnormalResults: 0, byParameter: {} };
      }

      // Obtener health records de esos bovinos en el período
      const healthRecords = await Health.findAll({
        where: {
          bovineId: { [Op.in]: bovineIds },
          recordDate: { [Op.gte]: startDate },
        },
        attributes: ['id', 'bovineId', 'laboratoryResults'],
      });

      const bovineSet = new Set<string>();
      const parameterCount: Record<string, number> = {};
      let totalAbnormal = 0;

      for (const record of healthRecords) {
        if (!record.laboratoryResults) continue;
        let hasAbnormal = false;
        for (const lab of record.laboratoryResults) {
          if (lab.results) {
            for (const item of lab.results) {
              if (item.status === 'ABNORMAL' || item.status === 'CRITICAL') {
                hasAbnormal = true;
                totalAbnormal++;
                const param = item.parameter || 'Desconocido';
                parameterCount[param] = (parameterCount[param] || 0) + 1;
              }
            }
          }
        }
        if (hasAbnormal) bovineSet.add(record.bovineId);
      }

      return {
        totalBovinesWithAbnormal: bovineSet.size,
        totalAbnormalResults: totalAbnormal,
        byParameter: parameterCount,
      };
    } catch (error) {
      logger.error(`Error obteniendo estadísticas de anormales en rancho ${ranchId}`, this.context, { ranchId, days }, ensureError(error));
      throw error;
    }
  }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const laboratoryService = new LaboratoryService();