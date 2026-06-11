// services/health/TreatmentService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import { HealthError } from '../../utils/HealthErrors';
import { ensureError } from '../../utils/errorUtils';

import Health, {
  Treatment,
  TreatmentStatus,
} from '../../models/Health';
import { medicationService } from '../medication/MedicationService'; // ← importamos el servicio
import Bovine from '../../models/Bovine'; // para obtener la especie
import { inventoryService, InventoryService } from '../InventoryService';

export interface StartTreatmentDTO {
  healthId: string;
  treatmentPlan?: string;
  medications?: Array<{
    medicationId: string;
    name: string;
    activeIngredient?: string;
    dosage: number;
    dosageUnit: string;
    frequency: string;
    duration: number;
    route: 'ORAL' | 'INJECTABLE' | 'TOPICAL' | 'INTRAVENOUS' | 'INTRAMUSCULAR' | 'SUBCUTANEOUS';
    withdrawalPeriod?: number;
    cost?: number;
  }>;
  procedures?: Array<{
    name: string;
    description?: string;
    duration?: number;
    anesthesia?: boolean;
    complications?: string;
    outcome?: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILURE';
    performedAt: Date;
  }>;
  startDate: Date;
  endDate?: Date;
  response?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NO_RESPONSE';
  sideEffects?: string[];
  complications?: string[];
  followUpRequired?: boolean;
  followUpDate?: Date;
  followUpNotes?: string;
  createdBy: string;
}

export interface MedicationAdministrationDTO {
  healthId: string;
  medicationIndex: number;
  administeredAt: Date;
  administeredBy: string;
  notes?: string;
}

export interface WithdrawalCheckResult {
  medicationName: string;
  medicationId?: string;
  withdrawalPeriod: number;
  lastAdministrationDate: Date;
  daysSinceLastAdministration: number;
  isWithdrawn: boolean;
  daysRemaining: number;
}

export class TreatmentService {
  private readonly context = 'TreatmentService';

  constructor(private inventoryService: InventoryService) { }

  async startTreatment(data: StartTreatmentDTO, transaction?: Transaction): Promise<Health> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const healthRecord = await Health.findByPk(data.healthId, { transaction: t });
      if (!healthRecord) {
        throw new HealthError(`Registro de salud con ID ${data.healthId} no encontrado`, 'HEALTH_NOT_FOUND', 404);
      }

      if (healthRecord.treatment?.status === TreatmentStatus.ACTIVE) {
        throw new HealthError('El registro ya tiene un tratamiento activo', 'TREATMENT_ALREADY_ACTIVE', 400);
      }

      // Opcional: obtener especie del bovino para validar compatibilidad
      const bovine = await Bovine.findByPk(healthRecord.bovineId, { transaction: t });
      const species = bovine?.breed; // o un campo específico de especie, según tu modelo
      // ====================================================================
      // NUEVO: Reservar stock para cada medicamento
      // ====================================================================
      const reservedItems: Array<{ itemId: string; medicationIndex: number }> = [];

      // Validar medicamentos contra el catálogo
      if (data.medications) {
        for (let i = 0; i < data.medications.length; i++) {
          const med = data.medications[i];
          const catalogMed = await medicationService.getMedicationById(med.medicationId);
          if (!catalogMed) {
            throw new HealthError(`Medicamento con ID ${med.medicationId} no encontrado`, 'MEDICATION_NOT_FOUND', 404);
          }

          // Verificar compatibilidad con la especie (opcional)
          if (species && !medicationService.isCompatibleWithSpecies(catalogMed, species)) {
            throw new HealthError(
              `El medicamento ${catalogMed.genericName} no es compatible con la especie ${species}`,
              'INCOMPATIBLE_SPECIES',
              400
            );
          }

          // Si no se especifica período de retiro, usar el del catálogo
          if (!med.withdrawalPeriod) {
            med.withdrawalPeriod = catalogMed.withdrawalPeriod;
          }
          // Buscar item de inventario por medicationId
          const inventoryItem = await this.inventoryService.getInventoryItemByMedicationId(med.medicationId);
          if (!inventoryItem) {
            throw new HealthError(
              `No hay inventario disponible para el medicamento ${catalogMed.genericName}`,
              'INVENTORY_NOT_FOUND',
              400
            );
          }
          // Calcular cantidad total necesaria (dosis * duración)
          const totalQuantityNeeded = med.dosage * med.duration;

          // Reservar stock
          await this.inventoryService.reserveStock(
            inventoryItem.id,
            totalQuantityNeeded,
            data.healthId,
            data.createdBy
          );

          reservedItems.push({ itemId: inventoryItem.id, medicationIndex: i });
        }
      }



      const treatment: Treatment = {
        treatmentPlan: data.treatmentPlan,
        medications: data.medications?.map((m, idx) => ({
          ...m,
          administeredAt: [],
          inventoryItemId: reservedItems.find(r => r.medicationIndex === idx)?.itemId,
        })),
        procedures: data.procedures,
        status: TreatmentStatus.ACTIVE,
        startDate: data.startDate,
        endDate: data.endDate,
        response: data.response,
        sideEffects: data.sideEffects,
        complications: data.complications,
        followUpRequired: data.followUpRequired || false,
        followUpDate: data.followUpDate,
        followUpNotes: data.followUpNotes,
      };

      await healthRecord.update({ treatment }, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Tratamiento iniciado en health ${data.healthId}`, this.context, {
        healthId: data.healthId,
        createdBy: data.createdBy,
        durationMs: Date.now() - startTime,
      });

      return healthRecord;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error iniciando tratamiento en health ${data.healthId}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async recordMedicationAdministration(
    data: MedicationAdministrationDTO,
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

      if (!healthRecord.treatment) {
        throw new HealthError('El registro no tiene un tratamiento asociado', 'TREATMENT_NOT_FOUND', 400);
      }

      if (healthRecord.treatment.status !== TreatmentStatus.ACTIVE) {
        throw new HealthError('El tratamiento no está activo', 'TREATMENT_NOT_ACTIVE', 400);
      }

      if (!healthRecord.treatment.medications) {
        throw new HealthError('El tratamiento no tiene medicamentos', 'NO_MEDICATIONS', 400);
      }

      const medication = healthRecord.treatment.medications[data.medicationIndex];
      if (!medication) {
        throw new HealthError(`No se encontró el medicamento en el índice ${data.medicationIndex}`, 'MEDICATION_INDEX_ERROR', 400);
      }

      medication.administeredAt = medication.administeredAt || [];
      medication.administeredAt.push(data.administeredAt);

      await healthRecord.update(
        { treatment: healthRecord.treatment },
        { transaction: t }
      );

      if (isOwnTransaction) await t.commit();

      logger.info(`Administración registrada en health ${data.healthId}`, this.context, {
        healthId: data.healthId,
        medicationIndex: data.medicationIndex,
        administeredBy: data.administeredBy,
        durationMs: Date.now() - startTime,
      });

      return healthRecord;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error registrando administración en health ${data.healthId}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async completeTreatment(
    healthId: string,
    outcome?: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILURE',
    endDate?: Date,
    updatedBy?: string,
    transaction?: Transaction
  ): Promise<Health> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();  

    try {
      const healthRecord = await Health.findByPk(healthId, { transaction: t });
      if (!healthRecord) {
        throw new HealthError(`Registro de salud con ID ${healthId} no encontrado`, 'HEALTH_NOT_FOUND', 404);
      }

      if (!healthRecord.treatment) {
        throw new HealthError('El registro no tiene un tratamiento asociado', 'TREATMENT_NOT_FOUND', 400);
      }

      if (healthRecord.treatment.status !== TreatmentStatus.ACTIVE) {
        throw new HealthError('El tratamiento no está activo', 'TREATMENT_NOT_ACTIVE', 400);
      }

      // ====================================================================
      // Liberar stock no consumido
      // ====================================================================
      if (healthRecord.treatment.medications) {
        for (const med of healthRecord.treatment.medications) {
          if (med.inventoryItemId) {
            const totalReserved = med.dosage * med.duration;
            const administeredCount = med.administeredAt?.length || 0;
            const consumed = med.dosage * administeredCount;
            const toRelease = totalReserved - consumed;

            if (toRelease > 0) {
              await this.inventoryService.releaseStock(
                med.inventoryItemId,
                toRelease,
                healthId,
                updatedBy || 'system'
              );
            }
          }
        }
      }

      healthRecord.treatment.status = TreatmentStatus.COMPLETED;
      if (outcome) {
        healthRecord.treatment.response = outcome as any;
      }
      healthRecord.treatment.endDate = endDate || new Date();

      await healthRecord.update({ treatment: healthRecord.treatment }, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Tratamiento completado en health ${healthId}`, this.context, {
        healthId,
        updatedBy,
        durationMs: Date.now() - startTime,
      });

      return healthRecord;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error completando tratamiento en health ${healthId}`, this.context, { healthId }, ensureError(error));
      throw error;
    }
  }

  async checkWithdrawalPeriods(healthId: string): Promise<WithdrawalCheckResult[]> {
    try {
      const healthRecord = await Health.findByPk(healthId);
      if (!healthRecord) {
        throw new HealthError(`Registro de salud con ID ${healthId} no encontrado`, 'HEALTH_NOT_FOUND', 404);
      }

      if (!healthRecord.treatment?.medications) {
        return [];
      }

      const results: WithdrawalCheckResult[] = [];

      for (const med of healthRecord.treatment.medications) {
        if (!med.administeredAt?.length) continue;

        const lastAdmin = new Date(Math.max(...med.administeredAt.map(d => new Date(d).getTime())));
        const daysSince = Math.floor((Date.now() - lastAdmin.getTime()) / (1000 * 60 * 60 * 24));

        // Obtener período de retiro: primero el del tratamiento, si no, consultar catálogo
        let withdrawalPeriod = med.withdrawalPeriod || 0;
        if (withdrawalPeriod === 0 && med.medicationId) {
          const catalogMed = await medicationService.getMedicationById(med.medicationId);
          withdrawalPeriod = catalogMed ? medicationService.getWithdrawalPeriod(catalogMed) : 0;
        }

        results.push({
          medicationName: med.name,
          medicationId: med.medicationId,
          withdrawalPeriod,
          lastAdministrationDate: lastAdmin,
          daysSinceLastAdministration: daysSince,
          isWithdrawn: daysSince >= withdrawalPeriod,
          daysRemaining: Math.max(0, withdrawalPeriod - daysSince),
        });
      }

      return results;
    } catch (error) {
      logger.error(`Error verificando períodos de retiro para health ${healthId}`, this.context, { healthId }, ensureError(error));
      throw error;
    }
  }
}

export const treatmentService = new TreatmentService(inventoryService);