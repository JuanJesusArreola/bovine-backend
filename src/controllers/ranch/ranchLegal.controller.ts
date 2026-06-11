// controllers/ranch/ranchLegal.controller.ts
import { Request, Response } from 'express';
import { ranchLegalService } from '../../services/ranch/RanchLegalService';
import { RanchError } from '../../utils/RanchErrors';
import logger from '../../utils/logger';

export class RanchLegalController {
  private readonly context = 'RanchLegalController';

  constructor() {
    this.getOwnership = this.getOwnership.bind(this);
    this.createOrUpdateOwnership = this.createOrUpdateOwnership.bind(this);
    this.getLegalRepresentative = this.getLegalRepresentative.bind(this);
    this.isCorporateOwner = this.isCorporateOwner.bind(this);
    this.createCertification = this.createCertification.bind(this);
    this.updateCertification = this.updateCertification.bind(this);
    this.deleteCertification = this.deleteCertification.bind(this);
    this.getValidCertifications = this.getValidCertifications.bind(this);
    this.getExpiringCertifications = this.getExpiringCertifications.bind(this);
    this.renewCertification = this.renewCertification.bind(this);
    this.createLicense = this.createLicense.bind(this);
    this.updateLicense = this.updateLicense.bind(this);
    this.deleteLicense = this.deleteLicense.bind(this);
    this.getValidLicenses = this.getValidLicenses.bind(this);
    this.createInsurance = this.createInsurance.bind(this);
    this.updateInsurance = this.updateInsurance.bind(this);
    this.recordClaim = this.recordClaim.bind(this);
    this.renewInsurance = this.renewInsurance.bind(this);
    this.getCoverageSummary = this.getCoverageSummary.bind(this);
  }

  // ==========================================================================
  // PROPIEDAD
  // ==========================================================================

  async getOwnership(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const ownership = await ranchLegalService.getOwnership(ranchId);
      res.json({ success: true, data: ownership });
    } catch (error) {
      logger.error('Error en getOwnership', this.context, { params: req.params }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async createOrUpdateOwnership(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { ranchId } = req.params;
      const ownership = await ranchLegalService.createOrUpdateOwnership(ranchId, req.body, userId);
      res.json({ success: true, data: ownership, message: 'Propiedad actualizada' });
    } catch (error) {
      logger.error('Error en createOrUpdateOwnership', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getLegalRepresentative(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const rep = await ranchLegalService.getLegalRepresentative(ranchId);
      res.json({ success: true, data: rep });
    } catch (error) {
      logger.error('Error en getLegalRepresentative', this.context, { params: req.params }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async isCorporateOwner(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const isCorporate = await ranchLegalService.isCorporateOwner(ranchId);
      res.json({ success: true, data: { isCorporate } });
    } catch (error) {
      logger.error('Error en isCorporateOwner', this.context, { params: req.params }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  // ==========================================================================
  // CERTIFICACIONES
  // ==========================================================================

  async createCertification(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { ranchId } = req.params;
      const certification = await ranchLegalService.createCertification(ranchId, req.body, userId);
      res.status(201).json({ success: true, data: certification, message: 'Certificación creada' });
    } catch (error) {
      logger.error('Error en createCertification', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async updateCertification(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { id } = req.params;
      const certification = await ranchLegalService.updateCertification(id, req.body, userId);
      res.json({ success: true, data: certification, message: 'Certificación actualizada' });
    } catch (error) {
      logger.error('Error en updateCertification', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async deleteCertification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await ranchLegalService.deleteCertification(id);
      res.json({ success: true, message: 'Certificación eliminada' });
    } catch (error) {
      logger.error('Error en deleteCertification', this.context, { params: req.params }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getValidCertifications(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const certs = await ranchLegalService.getValidCertifications(ranchId);
      res.json({ success: true, data: certs });
    } catch (error) {
      logger.error('Error en getValidCertifications', this.context, { params: req.params }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getExpiringCertifications(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const certs = await ranchLegalService.getExpiringCertifications(ranchId, days);
      res.json({ success: true, data: certs });
    } catch (error) {
      logger.error('Error en getExpiringCertifications', this.context, { params: req.params, query: req.query }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async renewCertification(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { id } = req.params;
      const { newExpirationDate } = req.body;
      if (!newExpirationDate) {
        res.status(400).json({ success: false, error: 'newExpirationDate es requerido' });
        return;
      }
      const certification = await ranchLegalService.renewCertification(id, new Date(newExpirationDate), userId);
      res.json({ success: true, data: certification, message: 'Certificación renovada' });
    } catch (error) {
      logger.error('Error en renewCertification', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  // ==========================================================================
  // LICENCIAS
  // ==========================================================================

  async createLicense(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { ranchId } = req.params;
      const license = await ranchLegalService.createLicense(ranchId, req.body, userId);
      res.status(201).json({ success: true, data: license, message: 'Licencia creada' });
    } catch (error) {
      logger.error('Error en createLicense', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async updateLicense(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { id } = req.params;
      const license = await ranchLegalService.updateLicense(id, req.body, userId);
      res.json({ success: true, data: license, message: 'Licencia actualizada' });
    } catch (error) {
      logger.error('Error en updateLicense', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async deleteLicense(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await ranchLegalService.deleteLicense(id);
      res.json({ success: true, message: 'Licencia eliminada' });
    } catch (error) {
      logger.error('Error en deleteLicense', this.context, { params: req.params }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getValidLicenses(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const licenses = await ranchLegalService.getValidLicenses(ranchId);
      res.json({ success: true, data: licenses });
    } catch (error) {
      logger.error('Error en getValidLicenses', this.context, { params: req.params }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  // ==========================================================================
  // SEGUROS
  // ==========================================================================

  async createInsurance(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { ranchId } = req.params;
      const insurance = await ranchLegalService.createInsurance(ranchId, req.body, userId);
      res.status(201).json({ success: true, data: insurance, message: 'Seguro creado' });
    } catch (error) {
      logger.error('Error en createInsurance', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async updateInsurance(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { id } = req.params;
      const insurance = await ranchLegalService.updateInsurance(id, req.body, userId);
      res.json({ success: true, data: insurance, message: 'Seguro actualizado' });
    } catch (error) {
      logger.error('Error en updateInsurance', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async recordClaim(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { id } = req.params;
      const { claimAmount, claimDate } = req.body;
      if (claimAmount === undefined || !claimDate) {
        res.status(400).json({ success: false, error: 'claimAmount y claimDate son requeridos' });
        return;
      }
      const insurance = await ranchLegalService.recordClaim(id, claimAmount, new Date(claimDate), userId);
      res.json({ success: true, data: insurance, message: 'Reclamación registrada' });
    } catch (error) {
      logger.error('Error en recordClaim', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async renewInsurance(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { id } = req.params;
      const { newEndDate, newPremium } = req.body;
      if (!newEndDate) {
        res.status(400).json({ success: false, error: 'newEndDate es requerido' });
        return;
      }
      const insurance = await ranchLegalService.renewInsurance(id, new Date(newEndDate), newPremium, userId);
      res.json({ success: true, data: insurance, message: 'Seguro renovado' });
    } catch (error) {
      logger.error('Error en renewInsurance', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getCoverageSummary(req: Request, res: Response): Promise<void> {
    try {
      const { ranchId } = req.params;
      const summary = await ranchLegalService.getCoverageSummary(ranchId);
      res.json({ success: true, data: summary });
    } catch (error) {
      logger.error('Error en getCoverageSummary', this.context, { params: req.params }, error as Error);
      if (error instanceof RanchError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }
}

export const ranchLegalController = new RanchLegalController();