// controllers/medication/medication.controller.ts
import { Request, Response } from 'express';
import { medicationService } from '../services/medication/MedicationService';
import { HealthError } from '../utils/HealthErrors';
import logger from '../utils/logger';

export class MedicationController {
  private readonly context = 'MedicationController';

  constructor() {
    this.createMedication = this.createMedication.bind(this);
    this.updateMedication = this.updateMedication.bind(this);
    this.deleteMedication = this.deleteMedication.bind(this);
    this.getMedicationById = this.getMedicationById.bind(this);
    this.listMedications = this.listMedications.bind(this);
    this.getMedicationTypeLabel = this.getMedicationTypeLabel.bind(this);
    this.getStorageRequirementsLabels = this.getStorageRequirementsLabels.bind(this);
    this.calculateDose = this.calculateDose.bind(this);
    this.checkCompatibilityWithSpecies = this.checkCompatibilityWithSpecies.bind(this);
    this.checkCompatibilityWithConditions = this.checkCompatibilityWithConditions.bind(this);
    this.getMedicationSummary = this.getMedicationSummary.bind(this);
    this.getSafetyWarnings = this.getSafetyWarnings.bind(this);
  }

  // ==============================================================
  // CRUD BÁSICO
  // ==============================================================

  async createMedication(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const medication = await medicationService.createMedication({
        ...req.body,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        data: medication,
        message: 'Medicamento creado exitosamente',
      });
    } catch (error) {
      logger.error('Error en createMedication', this.context, { body: req.body }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async updateMedication(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { id } = req.params;
      const medication = await medicationService.updateMedication({
        id,
        ...req.body,
        updatedBy: userId,
      });

      res.json({
        success: true,
        data: medication,
        message: 'Medicamento actualizado',
      });
    } catch (error) {
      logger.error('Error en updateMedication', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async deleteMedication(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { id } = req.params;
      await medicationService.deleteMedication(id, userId);

      res.json({ success: true, message: 'Medicamento eliminado' });
    } catch (error) {
      logger.error('Error en deleteMedication', this.context, { params: req.params }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getMedicationById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const medication = await medicationService.getMedicationById(id);
      if (!medication) {
        res.status(404).json({ success: false, error: 'Medicamento no encontrado' });
        return;
      }
      res.json({ success: true, data: medication });
    } catch (error) {
      logger.error('Error en getMedicationById', this.context, { params: req.params }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async listMedications(req: Request, res: Response): Promise<void> {
    try {
      const {
        type,
        isActive,
        isAvailable,
        isControlled,
        isVaccine,
        isAntibiotic,
        isPrescriptionOnly,
        requiresRefrigeration,
        targetSpecies,
        searchTerm,
        limit,
        offset,
      } = req.query;

      const filters: any = {};
      if (type) filters.type = (type as string).split(',');
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      if (isAvailable !== undefined) filters.isAvailable = isAvailable === 'true';
      if (isControlled !== undefined) filters.isControlled = isControlled === 'true';
      if (isVaccine !== undefined) filters.isVaccine = isVaccine === 'true';
      if (isAntibiotic !== undefined) filters.isAntibiotic = isAntibiotic === 'true';
      if (isPrescriptionOnly !== undefined) filters.isPrescriptionOnly = isPrescriptionOnly === 'true';
      if (requiresRefrigeration !== undefined) filters.requiresRefrigeration = requiresRefrigeration === 'true';
      if (targetSpecies) filters.targetSpecies = (targetSpecies as string).split(',');
      if (searchTerm) filters.searchTerm = searchTerm as string;
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);

      const result = await medicationService.listMedications(filters);
      res.json({
        success: true,
        data: result.rows,
        pagination: {
          total: result.count,
          limit: filters.limit || 50,
          offset: filters.offset || 0,
        },
      });
    } catch (error) {
      logger.error('Error en listMedications', this.context, { query: req.query }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  // ==============================================================
  // UTILIDADES DE ETIQUETAS
  // ==============================================================

  async getMedicationTypeLabel(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.params;
      const label = medicationService.getMedicationTypeLabel(type as any);
      res.json({ success: true, data: { type, label } });
    } catch (error) {
      logger.error('Error en getMedicationTypeLabel', this.context, { params: req.params }, error as Error);
      res.status(500).json({ success: false, error: 'Error interno' });
    }
  }

  async getStorageRequirementsLabels(req: Request, res: Response): Promise<void> {
    try {
      const { requirements } = req.body;
      if (!Array.isArray(requirements)) {
        res.status(400).json({ success: false, error: 'requirements debe ser un array' });
        return;
      }
      const labels = medicationService.getStorageRequirementsLabels(requirements);
      res.json({ success: true, data: labels });
    } catch (error) {
      logger.error('Error en getStorageRequirementsLabels', this.context, { body: req.body }, error as Error);
      res.status(500).json({ success: false, error: 'Error interno' });
    }
  }

  // ==============================================================
  // DOSIFICACIÓN Y COMPATIBILIDAD
  // ==============================================================

  async calculateDose(req: Request, res: Response): Promise<void> {
    try {
      const { medicationId, species, weight, indication } = req.body;
      if (!medicationId || !species || !weight) {
        res.status(400).json({ success: false, error: 'medicationId, species y weight son requeridos' });
        return;
      }

      const medication = await medicationService.getMedicationById(medicationId);
      if (!medication) {
        res.status(404).json({ success: false, error: 'Medicamento no encontrado' });
        return;
      }

      const dose = medicationService.calculateDoseForAnimal(medication, species, weight, indication);
      res.json({ success: true, data: dose });
    } catch (error) {
      logger.error('Error en calculateDose', this.context, { body: req.body }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno' });
      }
    }
  }

  async checkCompatibilityWithSpecies(req: Request, res: Response): Promise<void> {
    try {
      const { medicationId, species } = req.params;
      const medication = await medicationService.getMedicationById(medicationId);
      if (!medication) {
        res.status(404).json({ success: false, error: 'Medicamento no encontrado' });
        return;
      }
      const compatible = medicationService.isCompatibleWithSpecies(medication, species);
      res.json({ success: true, data: { compatible } });
    } catch (error) {
      logger.error('Error en checkCompatibilityWithSpecies', this.context, { params: req.params }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno' });
      }
    }
  }

  async checkCompatibilityWithConditions(req: Request, res: Response): Promise<void> {
    try {
      const { medicationId, bovineId } = req.body;
      if (!medicationId || !bovineId) {
        res.status(400).json({ success: false, error: 'medicationId y bovineId son requeridos' });
        return;
      }

      const medication = await medicationService.getMedicationById(medicationId);
      if (!medication) {
        res.status(404).json({ success: false, error: 'Medicamento no encontrado' });
        return;
      }

      const result = await medicationService.isCompatibleWithConditions(medication, bovineId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error en checkCompatibilityWithConditions', this.context, { body: req.body }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno' });
      }
    }
  }

  // ==============================================================
  // RESUMEN Y ADVERTENCIAS
  // ==============================================================

  async getMedicationSummary(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const medication = await medicationService.getMedicationById(id);
      if (!medication) {
        res.status(404).json({ success: false, error: 'Medicamento no encontrado' });
        return;
      }
      const summary = medicationService.getMedicationSummary(medication);
      res.json({ success: true, data: summary });
    } catch (error) {
      logger.error('Error en getMedicationSummary', this.context, { params: req.params }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno' });
      }
    }
  }

  async getSafetyWarnings(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const medication = await medicationService.getMedicationById(id);
      if (!medication) {
        res.status(404).json({ success: false, error: 'Medicamento no encontrado' });
        return;
      }
      const warnings = medicationService.getSafetyWarnings(medication);
      res.json({ success: true, data: warnings });
    } catch (error) {
      logger.error('Error en getSafetyWarnings', this.context, { params: req.params }, error as Error);
      if (error instanceof HealthError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno' });
      }
    }
  }
}

export const medicationController = new MedicationController();