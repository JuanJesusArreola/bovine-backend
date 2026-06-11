// services/BovineDiseaseService.ts
// ============================================================================
// BOVINE DISEASE SERVICE — GESTIÓN DE CASOS CLÍNICOS (Fase 2)
// ============================================================================
// Operaciones CRUD sobre casos de enfermedad bovinos.
//
// Responsabilidades:
//   - Abrir / cerrar casos clínicos
//   - Agregar síntomas, tratamientos y pruebas de laboratorio
//   - Sincronizar BovineHealthSnapshot (activeDiseaseId, activeCaseId)
//   - Actualizar healthStatus del bovino al abrir/cerrar
//
// No invalida el cache de catálogos — solo opera sobre datos transaccionales.
// ============================================================================

import { Transaction, Op, WhereOptions } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';
import { cacheService } from './CacheService';

import Bovine, { HealthStatus } from '../models/Bovine';
import Disease from '../models/Disease';
import Symptom from '../models/Symptom';
import BovineDiseaseCase, {
  CaseStatus,
  CaseOutcome,
  BovineDiseaseCase_Attributes,
} from '../models/BovineDiseaseCase';
import CaseSymptom, { SymptomIntensity } from '../models/CaseSymptom';
import CaseTreatment from '../models/CaseTreatment';
import LabTest, { LabTestStatus } from '../models/LabTest';
import BovineHealthSnapshot from '../models/BovineHealthSnapshot';
import { ApplicationRoute } from '../models/Vaccination';
import { vaccinationService } from './VaccinationService';

// ============================================================================
// DTOs
// ============================================================================

export interface OpenCaseDTO {
  bovineId: string;
  diseaseId: string;
  ranchId: string;
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  status?: CaseStatus;
  diagnosedBy?: string;
  diagnosedAt?: Date;
  quarantineStartDate?: Date;
  notes?: string;
  createdBy?: string;
  /** C-01: síntomas iniciales a registrar junto con el caso (opcional). */
  symptoms?: AddSymptomDTO[];
}

export interface UpdateCaseDTO {
  status?: CaseStatus;
  severity?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  diagnosedBy?: string;
  quarantineStartDate?: Date;
  quarantineEndDate?: Date;
  notes?: string;
}

export interface CloseCaseDTO {
  outcome: CaseOutcome;
  resolvedAt?: Date;
  quarantineEndDate?: Date;
  notes?: string;
}

export interface AddSymptomDTO {
  symptomId: string;
  intensity?: SymptomIntensity;
  observedAt?: Date;
  notes?: string;
}

export interface AddTreatmentDTO {
  treatmentName: string;
  dosage?: string;
  applicationRoute?: ApplicationRoute;
  administeredAt?: Date;
  administeredBy?: string;
  durationDays?: number;
  withdrawalPeriodDays?: number;
  notes?: string;
}

export interface AddLabTestDTO {
  testName: string;
  requestedAt?: Date;
  labName?: string;
  notes?: string;
}

export interface UpdateLabTestDTO {
  resultStatus: LabTestStatus;
  resultAt?: Date;
  resultDetail?: string;
  notes?: string;
}

export type CaseSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface CaseFilters {
  bovineId?: string;
  diseaseId?: string;
  ranchId?: string;
  status?: CaseStatus | CaseStatus[];
  /** Filtra por severidad del caso. Acepta un valor o un array (OR). */
  severity?: CaseSeverity | CaseSeverity[];
  /** Búsqueda libre: nombre de la enfermedad (iLike) o notas del caso. */
  search?: string;
  fromDate?: Date;
  toDate?: Date;
  /**
   * IDs de ranchos accesibles del usuario.
   * null  = sin restricción (SUPER_ADMIN / OWNER).
   * []    = sin acceso a ningún rancho → devuelve vacío.
   * [...] = filtrar por estos ranchos.
   */
  allowedRanchIds?: string[] | null;
  /** Número de registros por página. Default 20. */
  limit?: number;
  /** Desplazamiento. Calculado como (page - 1) * limit en el controlador. */
  offset?: number;
}

export interface CaseListResponse {
  rows: BovineDiseaseCase[];
  count: number;
}

// ============================================================================
// SERVICIO
// ============================================================================

export class BovineDiseaseService {
  private readonly context = 'BovineDiseaseService';

  // --------------------------------------------------------------------------
  // openCase
  // --------------------------------------------------------------------------

  /**
   * Abre un nuevo caso clínico.
   * - Crea el registro en bovine_disease_cases
   * - Actualiza BovineHealthSnapshot (activeDiseaseId, activeCaseId, diagnosis)
   * - Actualiza Bovine.healthStatus → SICK si estaba HEALTHY
   */
  async openCase(dto: OpenCaseDTO, externalTransaction?: Transaction): Promise<BovineDiseaseCase> {
    // C-01: si recibe una transacción externa (ej. desde createBovine), se reusa
    // para que todo (bovino + caso) sea atómico. El dueño de la tx hace commit/rollback.
    const t = externalTransaction ?? await sequelize.transaction();
    const isOwnTransaction = !externalTransaction;
    try {
      // Verificar que el bovino y la enfermedad existen
      const [bovine, disease] = await Promise.all([
        Bovine.findByPk(dto.bovineId, { transaction: t }),
        Disease.findByPk(dto.diseaseId, { transaction: t }),
      ]);

      if (!bovine) throw new Error(`Bovino no encontrado: ${dto.bovineId}`);
      if (!disease) throw new Error(`Enfermedad no encontrada: ${dto.diseaseId}`);

      // Calcular fecha estimada de fin de cuarentena
      let estimatedQuarantineEndDate: Date | undefined;
      const startDate = dto.quarantineStartDate ?? new Date();
      if (disease.defaultQuarantineDays && disease.defaultQuarantineDays > 0) {
        estimatedQuarantineEndDate = new Date(startDate);
        estimatedQuarantineEndDate.setDate(
          estimatedQuarantineEndDate.getDate() + disease.defaultQuarantineDays
        );
      }

      // Crear el caso
      const diseaseCase = await BovineDiseaseCase.create(
        {
          bovineId:                  dto.bovineId,
          diseaseId:                 dto.diseaseId,
          ranchId:                   dto.ranchId,
          createdBy:                 dto.createdBy,
          status:                    dto.status ?? CaseStatus.SUSPECTED,
          severity:                  dto.severity,
          diagnosedAt:               dto.diagnosedAt ?? new Date(),
          diagnosedBy:               dto.diagnosedBy,
          quarantineStartDate:       dto.quarantineStartDate,
          estimatedQuarantineEndDate,
          notes:                     dto.notes,
        },
        { transaction: t }
      );

      // ── Detección de fallo vacunal (breakthrough) ────────────────────────────
      // Si el bovino tenía protección vacunal activa contra esta enfermedad al
      // momento del diagnóstico, marcamos el caso como breakthrough (vacuna que
      // no previno la infección). No interrumpe el flujo si la verificación falla.
      try {
        const wasProtected = await vaccinationService.isProtectedAgainst(
          dto.bovineId,
          dto.diseaseId,
          diseaseCase.diagnosedAt
        );
        if (wasProtected) {
          await diseaseCase.update({ isBreakthrough: true }, { transaction: t });
          logger.warn(
            `Fallo vacunal (breakthrough): bovino ${dto.bovineId} enfermó de ${disease.name} pese a tener protección activa`,
            this.context,
            { bovineId: dto.bovineId, diseaseId: dto.diseaseId, caseId: diseaseCase.id }
          );
        }
      } catch (bthErr) {
        logger.error('Error verificando breakthrough en openCase', this.context, { caseId: diseaseCase.id }, ensureError(bthErr));
      }

      // Mapear el status del caso al healthStatus del bovino
      const CASE_TO_BOVINE: Partial<Record<CaseStatus, HealthStatus>> = {
        [CaseStatus.SUSPECTED]:  HealthStatus.SICK,
        [CaseStatus.CONFIRMED]:  HealthStatus.SICK,
        [CaseStatus.RECOVERING]: HealthStatus.RECOVERING,
        [CaseStatus.DECEASED]:   HealthStatus.DECEASED,
      };
      const openingStatus  = dto.status ?? CaseStatus.SUSPECTED;
      const newBovineHealth = CASE_TO_BOVINE[openingStatus] ?? HealthStatus.SICK;

      // El snapshot debe apuntar al caso MÁS GRAVE de todos los abiertos.
      // Si el bovino ya tenía un caso activo más grave, no lo sobreescribimos.
      const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1 };
      const newSeverityScore = SEVERITY_ORDER[dto.severity] ?? 0;

      // Caso activo actual en el snapshot (si existe)
      const snapshot = await BovineHealthSnapshot.findOne({
        where: { bovineId: dto.bovineId },
        transaction: t,
      });

      let pointerDiseaseId = disease.id;
      let pointerCaseId    = diseaseCase.id;
      let pointerDiagnosis = disease.name;

      if (snapshot?.activeCaseId && snapshot.activeCaseId !== diseaseCase.id) {
        const currentActive = await BovineDiseaseCase.findByPk(snapshot.activeCaseId, {
          include: [{ model: Disease, as: 'disease', attributes: ['id', 'name'] }],
          transaction: t,
        });
        // Solo conserva el caso activo previo si sigue abierto y es más grave
        const stillOpen = currentActive
          && [CaseStatus.SUSPECTED, CaseStatus.CONFIRMED, CaseStatus.RECOVERING].includes(currentActive.status);
        const currentScore = currentActive ? (SEVERITY_ORDER[currentActive.severity] ?? 0) : 0;
        if (stillOpen && currentScore >= newSeverityScore) {
          pointerDiseaseId = currentActive!.diseaseId;
          pointerCaseId    = currentActive!.id;
          pointerDiagnosis = (currentActive as any).disease?.name ?? pointerDiagnosis;
        }
      }

      // healthStatus del bovino: el más grave entre el previo y el nuevo.
      // SICK / DECEASED tienen prioridad sobre RECOVERING; DECEASED es terminal.
      const HEALTH_PRIORITY: Partial<Record<HealthStatus, number>> = {
        [HealthStatus.DECEASED]:   5,
        [HealthStatus.SICK]:       4,
        [HealthStatus.QUARANTINE]: 3,
        [HealthStatus.RECOVERING]: 2,
        [HealthStatus.UNKNOWN]:    1,
        [HealthStatus.HEALTHY]:    0,
      };
      const prevHealth = snapshot?.healthStatus;
      const finalHealth =
        prevHealth && (HEALTH_PRIORITY[prevHealth] ?? 0) > (HEALTH_PRIORITY[newBovineHealth] ?? 0)
          ? prevHealth
          : newBovineHealth;

      // Actualizar snapshot
      await BovineHealthSnapshot.update(
        {
          activeDiseaseId: pointerDiseaseId,
          activeCaseId:    pointerCaseId,
          diagnosis:       pointerDiagnosis,
          healthStatus:    finalHealth,
          lastUpdate:      new Date(),
        },
        { where: { bovineId: dto.bovineId }, transaction: t }
      );

      // Actualizar healthStatus del bovino — usa el estado más grave calculado
      await Bovine.update(
        { healthStatus: finalHealth },
        { where: { id: dto.bovineId }, transaction: t }
      );

      // C-01: registrar síntomas iniciales en la misma transacción (opcional)
      if (dto.symptoms && dto.symptoms.length > 0) {
        for (const s of dto.symptoms) {
          await CaseSymptom.findOrCreate({
            where: { caseId: diseaseCase.id, symptomId: s.symptomId },
            defaults: {
              caseId:     diseaseCase.id,
              symptomId:  s.symptomId,
              intensity:  s.intensity ?? SymptomIntensity.MODERATE,
              observedAt: s.observedAt ?? new Date(),
              notes:      s.notes,
            },
            transaction: t,
          });
        }
      }

      if (isOwnTransaction) await t.commit();

      // Invalidar caché del detalle completo del bovino (si la tx es nuestra;
      // si es externa, el caller invalida tras su commit).
      if (isOwnTransaction) await cacheService.del(`bovine:full:${dto.bovineId}`);

      logger.info(
        `Caso abierto: bovino ${dto.bovineId} — enfermedad ${disease.name}`,
        this.context
      );

      return diseaseCase;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error('Error abriendo caso clínico', this.context, { dto }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // closeCase
  // --------------------------------------------------------------------------

  /**
   * Cierra un caso clínico.
   * - Actualiza status y outcome
   * - Limpia activeDiseaseId / activeCaseId en el snapshot
   * - Actualiza Bovine.healthStatus según outcome
   */
  async closeCase(
    caseId: string,
    dto: CloseCaseDTO,
    externalTransaction?: Transaction,
    options?: { skipDeathHook?: boolean; recordedBy?: string },
  ): Promise<BovineDiseaseCase> {
    // Permite reusarlo dentro de una transacción mayor (ej. deceaseBovine, X-03).
    const t = externalTransaction ?? await sequelize.transaction();
    const isOwnTransaction = !externalTransaction;
    try {
      const diseaseCase = await BovineDiseaseCase.findByPk(caseId, { transaction: t });
      if (!diseaseCase) throw new Error(`Caso no encontrado: ${caseId}`);

      if (!diseaseCase.isOpen) {
        throw new Error(`El caso ${caseId} ya está cerrado (status: ${diseaseCase.status})`);
      }

      // Mapeo outcome → status de cierre del caso
      //   RECOVERED   → RECOVERED
      //   DECEASED    → DECEASED
      //   TRANSFERRED → DISCARDED (sale de nuestro control; deja de ser caso activo)
      //   UNKNOWN     → DISCARDED (sin desenlace conocido; se descarta el seguimiento)
      const closedStatus =
        dto.outcome === CaseOutcome.DECEASED  ? CaseStatus.DECEASED  :
        dto.outcome === CaseOutcome.RECOVERED ? CaseStatus.RECOVERED :
        CaseStatus.DISCARDED;

      // Mapeo outcome → healthStatus del bovino
      //   RECOVERED   → HEALTHY
      //   DECEASED    → DECEASED
      //   TRANSFERRED → UNKNOWN (el animal ya no está bajo nuestra observación)
      //   UNKNOWN     → UNKNOWN (desenlace no determinado)
      const newBovineStatus =
        dto.outcome === CaseOutcome.DECEASED  ? HealthStatus.DECEASED :
        dto.outcome === CaseOutcome.RECOVERED ? HealthStatus.HEALTHY  :
        HealthStatus.UNKNOWN;

      // Actualizar el caso
      await diseaseCase.update(
        {
          status:            closedStatus,
          outcome:           dto.outcome,
          resolvedAt:        dto.resolvedAt ?? new Date(),
          quarantineEndDate: dto.quarantineEndDate,
          notes:             dto.notes ?? diseaseCase.notes,
        },
        { transaction: t }
      );

      // Verificar si hay OTROS casos abiertos para el mismo bovino.
      // Si los hay, el bovino sigue enfermo aunque este caso se cierre.
      const otherOpenCount = await BovineDiseaseCase.count({
        where: {
          bovineId: diseaseCase.bovineId,
          id:       { [Op.ne]: caseId },
          status:   { [Op.in]: [CaseStatus.SUSPECTED, CaseStatus.CONFIRMED, CaseStatus.RECOVERING] },
        },
        transaction: t,
      });

      const finalBovineStatus = otherOpenCount > 0 ? HealthStatus.SICK : newBovineStatus;

      // Determinar el caso activo del snapshot tras el cierre.
      //   - Sin otros casos abiertos → limpiar punteros (null)
      //   - Con otros casos abiertos → apuntar al MÁS GRAVE (desempata por más reciente)
      let activePointer: {
        activeDiseaseId: string | null;
        activeCaseId:    string | null;
        diagnosis:       string | null;
      } = { activeDiseaseId: null, activeCaseId: null, diagnosis: null };

      if (otherOpenCount > 0) {
        const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1 };
        const otherOpenCases = await BovineDiseaseCase.findAll({
          where: {
            bovineId: diseaseCase.bovineId,
            id:       { [Op.ne]: caseId },
            status:   { [Op.in]: [CaseStatus.SUSPECTED, CaseStatus.CONFIRMED, CaseStatus.RECOVERING] },
          },
          include: [{ model: Disease, as: 'disease', attributes: ['id', 'name'] }],
          transaction: t,
        });

        // Elegir el caso más grave; si empatan, el de diagnóstico más reciente
        const mostSevere = otherOpenCases.reduce((best, current) => {
          const bestScore    = SEVERITY_ORDER[best.severity]    ?? 0;
          const currentScore = SEVERITY_ORDER[current.severity] ?? 0;
          if (currentScore > bestScore) return current;
          if (currentScore === bestScore && current.diagnosedAt > best.diagnosedAt) return current;
          return best;
        }, otherOpenCases[0]);

        if (mostSevere) {
          activePointer = {
            activeDiseaseId: mostSevere.diseaseId,
            activeCaseId:    mostSevere.id,
            diagnosis:       (mostSevere as any).disease?.name ?? null,
          };
        }
      }

      // Actualizar snapshot: punteros recalculados + healthStatus final
      await BovineHealthSnapshot.update(
        {
          activeDiseaseId: activePointer.activeDiseaseId,
          activeCaseId:    activePointer.activeCaseId,
          diagnosis:       activePointer.diagnosis,
          healthStatus:    finalBovineStatus,
          lastUpdate:      new Date(),
        },
        { where: { bovineId: diseaseCase.bovineId }, transaction: t }
      );

      // Actualizar bovino
      await Bovine.update(
        { healthStatus: finalBovineStatus },
        { where: { id: diseaseCase.bovineId }, transaction: t }
      );

      // X-05: si el desenlace es DECEASED, disparar el flujo de baja por muerte
      // (crear BovineDeath, isActive=false, cerrar ubicación, snapshot, evento).
      // skipDeathHook evita recursión cuando el llamador ES deceaseBovine.
      if (dto.outcome === CaseOutcome.DECEASED && !options?.skipDeathHook) {
        const { bovineDeathService } = await import('./BovineDeathService');
        const { DeathCause } = await import('../models/BovineDeath');
        await bovineDeathService.applyDeathSideEffects(
          diseaseCase.bovineId,
          {
            cause:         DeathCause.DISEASE,
            deathDate:     dto.resolvedAt ?? new Date(),
            diseaseId:     diseaseCase.diseaseId,
            diseaseCaseId: diseaseCase.id,
            notes:         dto.notes,
          },
          options?.recordedBy,
          t,
        );
      }

      if (isOwnTransaction) await t.commit();

      // Invalidar caché del detalle completo del bovino (si la tx es nuestra)
      if (isOwnTransaction) await cacheService.del(`bovine:full:${diseaseCase.bovineId}`);

      logger.info(`Caso cerrado: ${caseId} — outcome: ${dto.outcome}`, this.context);
      return diseaseCase;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error('Error cerrando caso clínico', this.context, { caseId }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // updateCase
  // --------------------------------------------------------------------------

  async updateCase(caseId: string, dto: UpdateCaseDTO): Promise<BovineDiseaseCase> {
    const t = await sequelize.transaction();
    try {
      const diseaseCase = await BovineDiseaseCase.findByPk(caseId, { transaction: t });
      if (!diseaseCase) throw new Error(`Caso no encontrado: ${caseId}`);

      await diseaseCase.update(dto as Partial<BovineDiseaseCase_Attributes>, { transaction: t });

      // Sincronizar healthStatus del bovino cuando cambia el status del caso.
      // Solo para transiciones intermedias — las terminales las gestiona closeCase().
      if (dto.status) {
        const STATUS_TO_HEALTH: Partial<Record<CaseStatus, HealthStatus>> = {
          [CaseStatus.SUSPECTED]:  HealthStatus.SICK,
          [CaseStatus.CONFIRMED]:  HealthStatus.SICK,
          [CaseStatus.RECOVERING]: HealthStatus.RECOVERING,
        };
        const newHealth = STATUS_TO_HEALTH[dto.status];
        if (newHealth) {
          await Bovine.update(
            { healthStatus: newHealth },
            { where: { id: diseaseCase.bovineId }, transaction: t }
          );
          await BovineHealthSnapshot.update(
            { healthStatus: newHealth, lastUpdate: new Date() },
            { where: { bovineId: diseaseCase.bovineId }, transaction: t }
          );
        }
      }

      await t.commit();
      await cacheService.del(`bovine:full:${diseaseCase.bovineId}`);

      logger.info(`Caso actualizado: ${caseId}`, this.context, { status: dto.status });
      return diseaseCase;
    } catch (error) {
      await t.rollback();
      logger.error('Error actualizando caso', this.context, { caseId }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // getCases
  // --------------------------------------------------------------------------

  async getCases(filters: CaseFilters = {}): Promise<CaseListResponse> {
    try {
      // Sin acceso a ningún rancho → devolver vacío sin tocar la DB
      if (Array.isArray(filters.allowedRanchIds) && filters.allowedRanchIds.length === 0) {
        return { rows: [], count: 0 };
      }

      const where: WhereOptions<BovineDiseaseCase_Attributes> = {};

      if (filters.bovineId)  (where as any).bovineId  = filters.bovineId;
      if (filters.diseaseId) (where as any).diseaseId = filters.diseaseId;

      // Permisos de rancho: allowedRanchIds=null → sin restricción
      // ranchId explícito tiene prioridad; si además hay allowedRanchIds,
      // verificamos que el rancho pedido esté dentro de los permitidos.
      if (filters.ranchId) {
        if (
          Array.isArray(filters.allowedRanchIds) &&
          !filters.allowedRanchIds.includes(filters.ranchId)
        ) {
          return { rows: [], count: 0 }; // El usuario no tiene acceso a ese rancho
        }
        (where as any).ranchId = filters.ranchId;
      } else if (Array.isArray(filters.allowedRanchIds)) {
        (where as any).ranchId = { [Op.in]: filters.allowedRanchIds };
      }

      if (filters.status) {
        (where as any).status = Array.isArray(filters.status)
          ? { [Op.in]: filters.status }
          : filters.status;
      }

      if (filters.severity) {
        (where as any).severity = Array.isArray(filters.severity)
          ? { [Op.in]: filters.severity }
          : filters.severity;
      }

      // Búsqueda libre: nombre de la enfermedad (vía include) o notas del caso.
      // Usa la sintaxis $disease.name$ que Sequelize resuelve contra el include.
      let searchActive = false;
      if (filters.search) {
        const term = `%${filters.search}%`;
        searchActive = true;
        (where as any)[Op.or] = [
          { notes: { [Op.iLike]: term } },
          { '$disease.name$': { [Op.iLike]: term } },
        ];
      }

      if (filters.fromDate || filters.toDate) {
        const dateFilter: any = {};
        if (filters.fromDate) dateFilter[Op.gte] = filters.fromDate;
        if (filters.toDate)   dateFilter[Op.lte] = filters.toDate;
        (where as any).diagnosedAt = dateFilter;
      }

      const { rows, count } = await BovineDiseaseCase.findAndCountAll({
        where,
        include: [
          { model: Disease, as: 'disease', attributes: ['id', 'name', 'slug', 'category', 'severity'] },
          { model: Bovine,  as: 'bovine',  attributes: ['id', 'earTag', 'name', 'breed'] },
        ],
        order: [['diagnosedAt', 'DESC']],
        limit:  filters.limit  ?? 20,
        offset: filters.offset ?? 0,
        distinct: true, // evita count inflado por los includes
        // Cuando el WHERE referencia una columna del include ($disease.name$),
        // subQuery debe ser false para que el JOIN sea visible en el filtro.
        ...(searchActive ? { subQuery: false } : {}),
      });

      return { rows, count };
    } catch (error) {
      logger.error('Error obteniendo casos', this.context, filters as any, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // getCaseById
  // --------------------------------------------------------------------------

  async getCaseById(caseId: string): Promise<BovineDiseaseCase | null> {
    try {
      return await BovineDiseaseCase.findByPk(caseId, {
        include: [
          { model: Disease, as: 'disease' },
          { model: Bovine,  as: 'bovine', attributes: ['id', 'earTag', 'name', 'breed', 'healthStatus'] },
          {
            model: CaseSymptom,
            as: 'caseSymptoms',
            include: [{ model: Symptom, as: 'symptom', attributes: ['id', 'name', 'slug', 'category', 'severityWeight'] }],
          },
          { model: CaseTreatment, as: 'treatments' },
          { model: LabTest,       as: 'labTests' },
        ],
      });
    } catch (error) {
      logger.error('Error obteniendo caso por id', this.context, { caseId }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // addSymptom
  // --------------------------------------------------------------------------

  async addSymptom(caseId: string, dto: AddSymptomDTO): Promise<CaseSymptom> {
    try {
      const diseaseCase = await BovineDiseaseCase.findByPk(caseId);
      if (!diseaseCase) throw new Error(`Caso no encontrado: ${caseId}`);

      const symptom = await Symptom.findByPk(dto.symptomId);
      if (!symptom) throw new Error(`Síntoma no encontrado: ${dto.symptomId}`);

      const [caseSymptom] = await CaseSymptom.findOrCreate({
        where: { caseId, symptomId: dto.symptomId },
        defaults: {
          caseId,
          symptomId:   dto.symptomId,
          intensity:   dto.intensity ?? SymptomIntensity.MODERATE,
          observedAt:  dto.observedAt ?? new Date(),
          notes:       dto.notes,
        },
      });

      return caseSymptom;
    } catch (error) {
      logger.error('Error agregando síntoma a caso', this.context, { caseId }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // removeSymptom
  // --------------------------------------------------------------------------

  async removeSymptom(caseId: string, symptomId: string): Promise<void> {
    try {
      const deleted = await CaseSymptom.destroy({ where: { caseId, symptomId } });
      if (!deleted) throw new Error(`Síntoma ${symptomId} no encontrado en caso ${caseId}`);
    } catch (error) {
      logger.error('Error eliminando síntoma de caso', this.context, { caseId, symptomId }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // addTreatment
  // --------------------------------------------------------------------------

  async addTreatment(caseId: string, dto: AddTreatmentDTO): Promise<CaseTreatment> {
    try {
      const diseaseCase = await BovineDiseaseCase.findByPk(caseId);
      if (!diseaseCase) throw new Error(`Caso no encontrado: ${caseId}`);

      return await CaseTreatment.create({
        caseId,
        treatmentName:       dto.treatmentName,
        dosage:              dto.dosage,
        applicationRoute:    dto.applicationRoute,
        administeredAt:      dto.administeredAt ?? new Date(),
        administeredBy:      dto.administeredBy,
        durationDays:        dto.durationDays,
        withdrawalPeriodDays:dto.withdrawalPeriodDays,
        notes:               dto.notes,
      });
    } catch (error) {
      logger.error('Error agregando tratamiento a caso', this.context, { caseId }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // addLabTest
  // --------------------------------------------------------------------------

  async addLabTest(caseId: string, dto: AddLabTestDTO): Promise<LabTest> {
    try {
      const diseaseCase = await BovineDiseaseCase.findByPk(caseId);
      if (!diseaseCase) throw new Error(`Caso no encontrado: ${caseId}`);

      return await LabTest.create({
        caseId,
        testName:    dto.testName,
        requestedAt: dto.requestedAt ?? new Date(),
        labName:     dto.labName,
        resultStatus: LabTestStatus.PENDING,
        notes:       dto.notes,
      });
    } catch (error) {
      logger.error('Error agregando prueba de lab a caso', this.context, { caseId }, ensureError(error));
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // updateLabTest
  // --------------------------------------------------------------------------

  async updateLabTest(labTestId: string, dto: UpdateLabTestDTO): Promise<LabTest> {
    try {
      const labTest = await LabTest.findByPk(labTestId);
      if (!labTest) throw new Error(`Prueba de laboratorio no encontrada: ${labTestId}`);

      await labTest.update({
        resultStatus: dto.resultStatus,
        resultAt:     dto.resultAt ?? new Date(),
        resultDetail: dto.resultDetail,
        notes:        dto.notes ?? labTest.notes,
      });

      return labTest;
    } catch (error) {
      logger.error('Error actualizando prueba de lab', this.context, { labTestId }, ensureError(error));
      throw error;
    }
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const bovineDiseaseService = new BovineDiseaseService();
