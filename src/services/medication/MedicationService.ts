// services/medication/MedicationService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import { HealthError } from '../../utils/HealthErrors';
import { ensureError } from '../../utils/errorUtils';

import Medication, {
  MedicationAttributes,
  MedicationCreationAttributes,
  MedicationType,
  AdministrationRoute,
  StorageRequirement,
  ControlledSubstanceClass,
  DosageInfo,
  ActiveIngredient,
  RegulatoryInfo,
  CommercialInfo,
  QualityInfo,
} from '../../models/Medication';
import Bovine, { HealthStatus } from '../../models/Bovine'; // HealthStatus viene de Bovine

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface CreateMedicationDTO {
  medicationCode: string;
  genericName: string;
  brandName?: string;
  type: MedicationType;
  activeIngredients: ActiveIngredient[];
  strength?: string;
  dosageForm: string;
  presentation: string;
  dosageInfo: DosageInfo[];
  pharmacologicalInfo?: any;
  adverseEffects?: any;
  withdrawalPeriod: number;
  milkWithdrawalPeriod?: number;
  storageRequirements: StorageRequirement[];
  storageTemperatureMin?: number;
  storageTemperatureMax?: number;
  shelfLife: number;
  regulatoryInfo: RegulatoryInfo;
  commercialInfo: CommercialInfo;
  qualityInfo?: QualityInfo;
  targetSpecies: string[];
  indications: string[];
  contraindications?: string[];
  images?: string[];
  documents?: string[];
  safetyDataSheet?: string;
  productInsert?: string;
  notes?: string;
  isActive?: boolean;
  isAvailable?: boolean;
  createdBy: string;
}

export interface UpdateMedicationDTO extends Partial<CreateMedicationDTO> {
  id: string;
  updatedBy: string;
}

export interface MedicationFilters {
  type?: MedicationType[];
  isActive?: boolean;
  isAvailable?: boolean;
  isControlled?: boolean;
  isVaccine?: boolean;
  isAntibiotic?: boolean;
  isPrescriptionOnly?: boolean;
  requiresRefrigeration?: boolean;
  targetSpecies?: string[];
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

export interface MedicationSummary {
  id: string;
  medicationCode: string;
  genericName: string;
  brandName?: string;
  type: string;
  typeLabel: string;
  isActive: boolean;
  isAvailable: boolean;
  requiresRefrigeration: boolean;
  isPrescriptionOnly: boolean;
  withdrawalPeriod: number;
  milkWithdrawalPeriod?: number;
}

export interface CompatibilityResult {
  compatible: boolean;
  reasons: string[];
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class MedicationService {
  private readonly context = 'MedicationService';

  // ==========================================================================
  // CRUD BÁSICO
  // ==========================================================================

  async createMedication(data: CreateMedicationDTO, transaction?: Transaction): Promise<Medication> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const existing = await Medication.findOne({ where: { medicationCode: data.medicationCode }, transaction: t });
      if (existing) {
        throw new HealthError(`Ya existe un medicamento con código ${data.medicationCode}`, 'DUPLICATE_CODE', 400);
      }

      const medication = await Medication.create(data as MedicationCreationAttributes, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Medicamento creado: ${medication.id}`, this.context, {
        medicationId: medication.id,
        genericName: medication.genericName,
        createdBy: data.createdBy,
        durationMs: Date.now() - startTime,
      });

      return medication;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error('Error creando medicamento', this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async updateMedication(data: UpdateMedicationDTO, transaction?: Transaction): Promise<Medication> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const medication = await Medication.findByPk(data.id, { transaction: t });
      if (!medication) {
        throw new HealthError(`Medicamento con ID ${data.id} no encontrado`, 'NOT_FOUND', 404);
      }

      if (data.medicationCode && data.medicationCode !== medication.medicationCode) {
        const existing = await Medication.findOne({ where: { medicationCode: data.medicationCode }, transaction: t });
        if (existing) {
          throw new HealthError(`Ya existe un medicamento con código ${data.medicationCode}`, 'DUPLICATE_CODE', 400);
        }
      }

      await medication.update(data, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Medicamento actualizado: ${data.id}`, this.context, {
        medicationId: data.id,
        updatedBy: data.updatedBy,
        durationMs: Date.now() - startTime,
      });

      return medication;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error actualizando medicamento ${data.id}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async deleteMedication(id: string, deletedBy: string): Promise<void> {
    const transaction = await sequelize.transaction();
    const startTime = Date.now();

    try {
      const medication = await Medication.findByPk(id, { transaction });
      if (!medication) {
        throw new HealthError(`Medicamento con ID ${id} no encontrado`, 'NOT_FOUND', 404);
      }

      await medication.destroy({ transaction });
      await transaction.commit();

      logger.info(`Medicamento eliminado (soft): ${id}`, this.context, {
        medicationId: id,
        deletedBy,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error eliminando medicamento ${id}`, this.context, { id }, ensureError(error));
      throw error;
    }
  }

  async getMedicationById(id: string): Promise<Medication | null> {
    try {
      return await Medication.findByPk(id);
    } catch (error) {
      logger.error(`Error obteniendo medicamento por ID ${id}`, this.context, { id }, ensureError(error));
      throw error;
    }
  }

  async listMedications(filters: MedicationFilters = {}): Promise<{ rows: Medication[]; count: number }> {
    try {
      const where: any = {};

      if (filters.type?.length) where.type = { [Op.in]: filters.type };
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      if (filters.isAvailable !== undefined) where.isAvailable = filters.isAvailable;
      if (filters.isControlled !== undefined) where.isControlled = filters.isControlled;
      if (filters.isVaccine !== undefined) where.isVaccine = filters.isVaccine;
      if (filters.isAntibiotic !== undefined) where.isAntibiotic = filters.isAntibiotic;
      if (filters.isPrescriptionOnly !== undefined) where.isPrescriptionOnly = filters.isPrescriptionOnly;
      if (filters.requiresRefrigeration !== undefined) where.requiresRefrigeration = filters.requiresRefrigeration;
      if (filters.targetSpecies?.length) {
        where.targetSpecies = { [Op.overlap]: filters.targetSpecies };
      }
      if (filters.searchTerm) {
        where[Op.or] = [
          { genericName: { [Op.iLike]: `%${filters.searchTerm}%` } },
          { brandName: { [Op.iLike]: `%${filters.searchTerm}%` } },
          { medicationCode: { [Op.iLike]: `%${filters.searchTerm}%` } },
        ];
      }

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const { rows, count } = await Medication.findAndCountAll({
        where,
        limit,
        offset,
        order: [['genericName', 'ASC']],
      });

      logger.debug(`Medicamentos listados`, this.context, { count, filters });
      return { rows, count };
    } catch (error) {
      logger.error('Error listando medicamentos', this.context, { filters }, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // UTILIDADES DE ETIQUETAS
  // ==========================================================================

  getMedicationTypeLabel(type: MedicationType): string {
    const labels: Record<MedicationType, string> = {
      [MedicationType.ANTIBIOTIC]: 'Antibiótico',
      [MedicationType.ANTI_INFLAMMATORY]: 'Antiinflamatorio',
      [MedicationType.ANALGESIC]: 'Analgésico',
      [MedicationType.ANTIPARASITIC]: 'Antiparasitario',
      [MedicationType.ANTIFUNGAL]: 'Antifúngico',
      [MedicationType.ANTIVIRAL]: 'Antiviral',
      [MedicationType.VACCINE]: 'Vacuna',
      [MedicationType.VITAMIN]: 'Vitamina',
      [MedicationType.MINERAL]: 'Mineral',
      [MedicationType.HORMONE]: 'Hormona',
      [MedicationType.SEDATIVE]: 'Sedante',
      [MedicationType.ANESTHETIC]: 'Anestésico',
      [MedicationType.REPRODUCTIVE]: 'Reproductivo',
      [MedicationType.NUTRITIONAL]: 'Nutricional',
      [MedicationType.IMMUNOMODULATOR]: 'Inmunomodulador',
      [MedicationType.ANTIDIARRHEAL]: 'Antidiarreico',
      [MedicationType.RESPIRATORY]: 'Respiratorio',
      [MedicationType.CARDIOVASCULAR]: 'Cardiovascular',
      [MedicationType.TOPICAL]: 'Tópico',
      [MedicationType.DISINFECTANT]: 'Desinfectante',
      [MedicationType.SUPPLEMENT]: 'Suplemento',
      [MedicationType.PROBIOTIC]: 'Probiótico',
      [MedicationType.PREBIOTIC]: 'Prebiótico',
      [MedicationType.OTHER]: 'Otro',
    };
    return labels[type] || type;
  }

  getStorageRequirementsLabels(requirements: StorageRequirement[]): string[] {
    const labels: Record<StorageRequirement, string> = {
      [StorageRequirement.ROOM_TEMPERATURE]: 'Temperatura ambiente',
      [StorageRequirement.REFRIGERATED]: 'Refrigerado (2-8°C)',
      [StorageRequirement.FROZEN]: 'Congelado (-20°C)',
      [StorageRequirement.CONTROLLED_TEMPERATURE]: 'Temperatura controlada',
      [StorageRequirement.PROTECT_FROM_LIGHT]: 'Proteger de la luz',
      [StorageRequirement.PROTECT_FROM_MOISTURE]: 'Proteger de la humedad',
      [StorageRequirement.STORE_UPRIGHT]: 'Almacenar en posición vertical',
      [StorageRequirement.DO_NOT_SHAKE]: 'No agitar',
      [StorageRequirement.SPECIAL_HANDLING]: 'Manejo especial',
    };
    return requirements.map(r => labels[r] || r);
  }

  // ==========================================================================
  // UTILIDADES DE VERIFICACIÓN
  // ==========================================================================

  requiresVeterinaryPrescription(medication: Medication): boolean {
    return medication.regulatoryInfo?.prescriptionRequired === true ||
           medication.regulatoryInfo?.veterinaryPrescriptionOnly === true;
  }

  isCompatibleWithSpecies(medication: Medication, species: string): boolean {
    if (!medication.targetSpecies || medication.targetSpecies.length === 0) return true;
    return medication.targetSpecies.includes(species);
  }

  /**
   * Verifica si el medicamento ha expirado según la fecha de vencimiento en regulatoryInfo.
   */
  isExpired(medication: Medication, referenceDate: Date = new Date()): boolean {
    const expiration = medication.regulatoryInfo?.expirationDate;
    if (!expiration) return false;
    return new Date(expiration) < referenceDate;
  }

  getWithdrawalPeriod(medication: Medication, forMilk: boolean = false): number {
    return forMilk ? (medication.milkWithdrawalPeriod || 0) : medication.withdrawalPeriod;
  }

  // ==========================================================================
  // DOSIFICACIÓN
  // ==========================================================================

  getDosageForSpecies(medication: Medication, species: string, indication?: string): DosageInfo | undefined {
    if (!medication.dosageInfo) return undefined;
    return medication.dosageInfo.find(info =>
      info.species.includes(species) &&
      (!indication || info.indication === indication)
    );
  }

  /**
   * Calcula la dosis para un animal específico basado en peso.
   * Nota: Se asume que la dosis está expresada en mg/kg o similar.
   * Para una implementación más precisa, se necesitaría un campo 'dosageType'.
   */
  calculateDoseForAnimal(
    medication: Medication,
    species: string,
    weight: number,
    indication?: string
  ): { dose: number; unit: string; frequency: string; duration: number } | null {
    const dosageInfo = this.getDosageForSpecies(medication, species, indication);
    if (!dosageInfo) return null;

    // Aquí asumimos que la dosis es por kg (lo más común). En un caso real, se necesitaría lógica adicional.
    return {
      dose: dosageInfo.dosage * weight, // dosis total
      unit: dosageInfo.dosageUnit,
      frequency: dosageInfo.frequency,
      duration: dosageInfo.duration,
    };
  }

  // ==========================================================================
  // INTERACCIONES Y ADVERTENCIAS
  // ==========================================================================

  async checkDrugInteractions(medicationIds: string[]): Promise<any[]> {
    // TODO: Implementar cuando exista tabla de interacciones.
    logger.warn('checkDrugInteractions no implementado', this.context, { medicationIds });
    return [];
  }

  getSafetyWarnings(medication: Medication): string[] {
    const warnings: string[] = [];
    if (medication.adverseEffects?.warnings) warnings.push(...medication.adverseEffects.warnings);
    if (medication.adverseEffects?.contraindications) warnings.push(...medication.adverseEffects.contraindications);
    if (medication.regulatoryInfo?.restrictions) warnings.push(...medication.regulatoryInfo.restrictions);
    if (medication.isControlled) warnings.push('Sustancia controlada');
    if (medication.isPrescriptionOnly) warnings.push('Requiere receta médica');
    return warnings;
  }

  // ==========================================================================
  // RESUMEN Y COMPATIBILIDAD CON CONDICIONES DEL ANIMAL
  // ==========================================================================

  getMedicationSummary(medication: Medication): MedicationSummary {
    return {
      id: medication.id,
      medicationCode: medication.medicationCode,
      genericName: medication.genericName,
      brandName: medication.brandName,
      type: medication.type,
      typeLabel: this.getMedicationTypeLabel(medication.type),
      isActive: medication.isActive,
      isAvailable: medication.isAvailable,
      requiresRefrigeration: medication.requiresRefrigeration,
      isPrescriptionOnly: medication.isPrescriptionOnly,
      withdrawalPeriod: medication.withdrawalPeriod,
      milkWithdrawalPeriod: medication.milkWithdrawalPeriod,
    };
  }

  /**
   * Verifica si el medicamento es compatible con las condiciones actuales del bovino.
   * @param medication Medicamento
   * @param bovineId ID del bovino
   */
  async isCompatibleWithConditions(medication: Medication, bovineId: string): Promise<CompatibilityResult> {
    try {
      const bovine = await Bovine.findByPk(bovineId, {
        attributes: ['id', 'healthStatus', 'reproductiveInfo', 'birthDate'],
      });
      if (!bovine) {
        return { compatible: false, reasons: ['Bovino no encontrado'] };
      }

      const reasons: string[] = [];

      // Verificar contraindicaciones generales (ej. "no usar en gestación")
      if (medication.contraindications?.some(c => c.toLowerCase().includes('gestación'))) {
        const isPregnant = bovine.reproductiveInfo?.isPregnant === true;
        if (isPregnant) {
          reasons.push('Contraindicado en animales gestantes');
        }
      }

      // Verificar contraindicaciones por edad (si existen en el medicamento)
      if (medication.contraindications?.some(c => c.toLowerCase().includes('menor'))) {
        const ageInMonths = this.calculateAgeInMonths(bovine.birthDate);
        if (ageInMonths < 6) { // ejemplo: menor a 6 meses
          reasons.push('Contraindicado en animales jóvenes');
        }
      }

      // Verificar estado de salud (ej. no usar en animales enfermos si así lo indica)
      if (medication.contraindications?.some(c => c.toLowerCase().includes('enfermo'))) {
        if (bovine.healthStatus !== HealthStatus.HEALTHY) {
          reasons.push('Contraindicado en animales con problemas de salud');
        }
      }

      return {
        compatible: reasons.length === 0,
        reasons,
      };
    } catch (error) {
      logger.error(`Error verificando compatibilidad de medicamento ${medication.id} con bovino ${bovineId}`, this.context, { medicationId: medication.id, bovineId }, ensureError(error));
      throw error;
    }
  }

  /**
   * Calcula la edad en meses a partir de la fecha de nacimiento.
   */
  private calculateAgeInMonths(birthDate?: Date): number {
    if (!birthDate) return 0;
    const now = new Date();
    const years = now.getFullYear() - birthDate.getFullYear();
    const months = now.getMonth() - birthDate.getMonth();
    return years * 12 + months;
  }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const medicationService = new MedicationService();