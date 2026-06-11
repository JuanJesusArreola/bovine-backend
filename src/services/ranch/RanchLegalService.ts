// services/ranch/RanchLegalService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import {
  RanchNotFoundError,
  RanchOwnershipNotFoundError,
  CertificationNotFoundError,
  LicenseNotFoundError,
  InsuranceNotFoundError,
  InvalidShareholdersError,
  RanchValidationError,
} from '../../utils/RanchErrors';
import { ensureError } from '../../utils/errorUtils';

import Ranch from '../../models/Ranch';
import RanchOwnership, {
  OwnerType,
  Shareholder,
  LegalRepresentative,
  OwnerContact,
  RanchOwnershipCreationAttributes,
} from '../../models/RanchOwnership';
import RanchCertification, {
  CertificationType,
  CertificationStatus,
  RanchCertificationCreationAttributes,
} from '../../models/RanchCertification';
import RanchLicense, {
  LicenseType,
  LicenseStatus,
  LicenseAuthority,
  RanchLicenseCreationAttributes,
} from '../../models/RanchLicense';
import RanchInsurance, {
  InsuranceType,
  InsuranceStatus,
  CoverageUnit,
  RanchInsuranceCreationAttributes,
} from '../../models/RanchInsurance';

// ============================================================================
// DTOs
// ============================================================================

export interface OwnershipDTO {
  ownerType: OwnerType;
  ownerName: string;
  ownerTaxId?: string;
  ownerContact: OwnerContact;
  shareholders?: Shareholder[];
  legalRepresentative?: LegalRepresentative;
  foundationDate: Date;
  businessLicense?: string;
  taxRegistration?: string;
  registrationNumber?: string;
}

export interface CertificationDTO {
  type: CertificationType;
  certifyingBody: string;
  certificateNumber: string;
  issueDate: Date;
  expirationDate: Date;
  status?: CertificationStatus;
  scope?: string;
  products?: string[];
  locations?: string[];
  certificateUrl?: string;
  auditReportUrl?: string;
  documents?: string[];
  lastAuditDate?: Date;
  nextAuditDate?: Date;
  auditor?: string;
  auditScore?: number;
  cost?: number;
  currency?: string;
  responsiblePerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

export interface LicenseDTO {
  type: LicenseType;
  licenseNumber: string;
  authority: LicenseAuthority;
  issuingBody: string;
  issueDate: Date;
  expirationDate: Date;
  status?: LicenseStatus;
  scope?: string;
  locations?: string[];
  activities?: string[];
  documentUrl?: string;
  supportingDocuments?: string[];
  cost?: number;
  currency?: string;
  renewalCost?: number;
  responsiblePerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  renewalReminderSent?: boolean;
  renewalDate?: Date;
  autoRenewal?: boolean;
  notes?: string;
}

export interface InsuranceDTO {
  type: InsuranceType;
  provider: string;
  policyNumber: string;
  startDate: Date;
  endDate: Date;
  status?: InsuranceStatus;
  coverageAmount: number;
  coverageUnit?: CoverageUnit;
  deductible?: number;
  premium: number;
  currency?: string;
  coverageDetails?: any[];
  beneficiaries?: any[];
  coveredLocations?: string[];
  coveredAssets?: string[];
  coveredLivestock?: any;
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  policyDocumentUrl?: string;
  claimForms?: string[];
  claimsCount?: number;
  lastClaimDate?: Date;
  totalClaimedAmount?: number;
  autoRenewal?: boolean;
  renewalDate?: Date;
  renewalPremium?: number;
  notes?: string;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class RanchLegalService {
  private readonly context = 'RanchLegalService';

  // ==========================================================================
  // PROPIEDAD (Ownership)
  // ==========================================================================

  async getOwnership(ranchId: string): Promise<RanchOwnership> {
    const ownership = await RanchOwnership.findByPk(ranchId);
    if (!ownership) throw new RanchOwnershipNotFoundError(ranchId);
    return ownership;
  }

  async createOrUpdateOwnership(ranchId: string, data: OwnershipDTO, userId: string, transaction?: Transaction): Promise<RanchOwnership> {
  const t = transaction || await sequelize.transaction();
  const isOwnTransaction = !transaction;
  const startTime = Date.now();

  try {
    // Validar que el rancho existe
    const ranch = await Ranch.findByPk(ranchId, { transaction: t });
    if (!ranch) throw new RanchNotFoundError(ranchId);

    // Validar estructura de accionistas
    this.validateShareholders(data.shareholders);

    const existing = await RanchOwnership.findByPk(ranchId, { transaction: t });
    const ownershipData: RanchOwnershipCreationAttributes = {
      ranchId,
      ownerType: data.ownerType,
      ownerName: data.ownerName,
      ownerTaxId: data.ownerTaxId,
      ownerContact: data.ownerContact,
      shareholders: data.shareholders,
      legalRepresentative: data.legalRepresentative,
      foundationDate: data.foundationDate,
      businessLicense: data.businessLicense,
      taxRegistration: data.taxRegistration,
      registrationNumber: data.registrationNumber,
    };

    let ownership: RanchOwnership;
    if (existing) {
      await existing.update(ownershipData, { transaction: t });
      ownership = existing;
    } else {
      ownership = await RanchOwnership.create(ownershipData, { transaction: t });
    }

    if (isOwnTransaction) await t.commit();

    logger.info(`Propiedad ${existing ? 'actualizada' : 'creada'} para rancho ${ranchId}`, this.context, {
      ranchId,
      userId,   // solo para log
      durationMs: Date.now() - startTime,
    });

    return ownership;
  } catch (error) {
    if (isOwnTransaction) await t.rollback();
    logger.error(`Error en propiedad de rancho ${ranchId}`, this.context, { data }, ensureError(error));
    throw error;
  }
}

  validateShareholders(shareholders?: Shareholder[]): void {
    if (!shareholders || shareholders.length === 0) return;
    const total = shareholders.reduce((sum, s) => sum + s.percentage, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new InvalidShareholdersError('La suma de porcentajes de accionistas debe ser 100%');
    }
  }

  async getLegalRepresentative(ranchId: string): Promise<LegalRepresentative | null> {
    const ownership = await RanchOwnership.findByPk(ranchId);
    return ownership?.legalRepresentative || null;
  }

  async isCorporateOwner(ranchId: string): Promise<boolean> {
    const ownership = await RanchOwnership.findByPk(ranchId);
    return ownership?.ownerType === OwnerType.CORPORATION;
  }

  // ==========================================================================
  // CERTIFICACIONES
  // ==========================================================================

  async createCertification(ranchId: string, data: CertificationDTO, userId: string, transaction?: Transaction): Promise<RanchCertification> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const ranch = await Ranch.findByPk(ranchId, { transaction: t });
      if (!ranch) throw new RanchNotFoundError(ranchId);

      const certificationData: RanchCertificationCreationAttributes = {
        ranchId,
        type: data.type,
        certifyingBody: data.certifyingBody,
        certificateNumber: data.certificateNumber,
        issueDate: data.issueDate,
        expirationDate: data.expirationDate,
        status: data.status || CertificationStatus.VALID,
        scope: data.scope,
        products: data.products,
        locations: data.locations,
        certificateUrl: data.certificateUrl,
        auditReportUrl: data.auditReportUrl,
        documents: data.documents,
        lastAuditDate: data.lastAuditDate,
        nextAuditDate: data.nextAuditDate,
        auditor: data.auditor,
        auditScore: data.auditScore,
        cost: data.cost,
        currency: data.currency,
        responsiblePerson: data.responsiblePerson,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        notes: data.notes,
        createdBy: userId,
      };

      const certification = await RanchCertification.create(certificationData, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Certificación creada para rancho ${ranchId}`, this.context, {
        certificationId: certification.id,
        userId,
        durationMs: Date.now() - startTime,
      });

      return certification;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error creando certificación para rancho ${ranchId}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async updateCertification(id: string, data: Partial<CertificationDTO>, userId: string, transaction?: Transaction): Promise<RanchCertification> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const certification = await RanchCertification.findByPk(id, { transaction: t });
      if (!certification) throw new CertificationNotFoundError(id);

      await certification.update({ ...data, updatedBy: userId }, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Certificación ${id} actualizada`, this.context, { userId, durationMs: Date.now() - startTime });
      return certification;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error actualizando certificación ${id}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async deleteCertification(id: string, transaction?: Transaction): Promise<void> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const certification = await RanchCertification.findByPk(id, { transaction: t });
      if (!certification) throw new CertificationNotFoundError(id);

      await certification.destroy({ transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Certificación ${id} eliminada`, this.context, { durationMs: Date.now() - startTime });
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error eliminando certificación ${id}`, this.context, { id }, ensureError(error));
      throw error;
    }
  }

  async getValidCertifications(ranchId: string): Promise<RanchCertification[]> {
    const now = new Date();
    return await RanchCertification.findAll({
      where: {
        ranchId,
        status: CertificationStatus.VALID,
        expirationDate: { [Op.gt]: now },
      },
      order: [['expirationDate', 'ASC']],
    });
  }

  async getExpiringCertifications(ranchId: string, days: number = 30): Promise<RanchCertification[]> {
    const now = new Date();
    const limit = new Date();
    limit.setDate(now.getDate() + days);
    return await RanchCertification.findAll({
      where: {
        ranchId,
        status: CertificationStatus.VALID,
        expirationDate: { [Op.between]: [now, limit] },
      },
      order: [['expirationDate', 'ASC']],
    });
  }

  async renewCertification(id: string, newExpirationDate: Date, userId: string, transaction?: Transaction): Promise<RanchCertification> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const certification = await RanchCertification.findByPk(id, { transaction: t });
      if (!certification) throw new CertificationNotFoundError(id);
      if (certification.status !== CertificationStatus.VALID && certification.status !== CertificationStatus.EXPIRED) {
        throw new RanchValidationError('La certificación no es válida o expirada');
      }

      await certification.update({
        issueDate: new Date(),
        expirationDate: newExpirationDate,
        status: CertificationStatus.VALID,
        updatedBy: userId,
      }, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Certificación ${id} renovada`, this.context, { userId, durationMs: Date.now() - startTime });
      return certification;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error renovando certificación ${id}`, this.context, { id }, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // LICENCIAS
  // ==========================================================================

  async createLicense(ranchId: string, data: LicenseDTO, userId: string, transaction?: Transaction): Promise<RanchLicense> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const ranch = await Ranch.findByPk(ranchId, { transaction: t });
      if (!ranch) throw new RanchNotFoundError(ranchId);

      const licenseData: RanchLicenseCreationAttributes = {
        ranchId,
        type: data.type,
        licenseNumber: data.licenseNumber,
        authority: data.authority,
        issuingBody: data.issuingBody,
        issueDate: data.issueDate,
        expirationDate: data.expirationDate,
        status: data.status || LicenseStatus.VALID,
        scope: data.scope,
        locations: data.locations,
        activities: data.activities,
        documentUrl: data.documentUrl,
        supportingDocuments: data.supportingDocuments,
        cost: data.cost,
        currency: data.currency,
        renewalCost: data.renewalCost,
        responsiblePerson: data.responsiblePerson,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        renewalReminderSent: data.renewalReminderSent ?? false,
        renewalDate: data.renewalDate,
        autoRenewal: data.autoRenewal ?? false,
        notes: data.notes,
        createdBy: userId,
      };

      const license = await RanchLicense.create(licenseData, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Licencia creada para rancho ${ranchId}`, this.context, {
        licenseId: license.id,
        userId,
        durationMs: Date.now() - startTime,
      });

      return license;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error creando licencia para rancho ${ranchId}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async updateLicense(id: string, data: Partial<LicenseDTO>, userId: string, transaction?: Transaction): Promise<RanchLicense> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const license = await RanchLicense.findByPk(id, { transaction: t });
      if (!license) throw new LicenseNotFoundError(id);

      await license.update({ ...data, updatedBy: userId }, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Licencia ${id} actualizada`, this.context, { userId, durationMs: Date.now() - startTime });
      return license;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error actualizando licencia ${id}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async deleteLicense(id: string, transaction?: Transaction): Promise<void> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const license = await RanchLicense.findByPk(id, { transaction: t });
      if (!license) throw new LicenseNotFoundError(id);

      await license.destroy({ transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Licencia ${id} eliminada`, this.context, { durationMs: Date.now() - startTime });
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error eliminando licencia ${id}`, this.context, { id }, ensureError(error));
      throw error;
    }
  }

  async getValidLicenses(ranchId: string): Promise<RanchLicense[]> {
    const now = new Date();
    return await RanchLicense.findAll({
      where: {
        ranchId,
        status: LicenseStatus.VALID,
        expirationDate: { [Op.gt]: now },
      },
      order: [['expirationDate', 'ASC']],
    });
  }

  // ==========================================================================
  // SEGUROS
  // ==========================================================================

  async createInsurance(ranchId: string, data: InsuranceDTO, userId: string, transaction?: Transaction): Promise<RanchInsurance> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const ranch = await Ranch.findByPk(ranchId, { transaction: t });
      if (!ranch) throw new RanchNotFoundError(ranchId);

      const insuranceData: RanchInsuranceCreationAttributes = {
        ranchId,
        type: data.type,
        provider: data.provider,
        policyNumber: data.policyNumber,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status || InsuranceStatus.ACTIVE,
        coverageAmount: data.coverageAmount,
        coverageUnit: data.coverageUnit || CoverageUnit.FIXED,
        deductible: data.deductible,
        premium: data.premium,
        currency: data.currency || 'MXN',
        coverageDetails: data.coverageDetails,
        beneficiaries: data.beneficiaries,
        coveredLocations: data.coveredLocations,
        coveredAssets: data.coveredAssets,
        coveredLivestock: data.coveredLivestock,
        agentName: data.agentName,
        agentPhone: data.agentPhone,
        agentEmail: data.agentEmail,
        policyDocumentUrl: data.policyDocumentUrl,
        claimForms: data.claimForms,
        claimsCount: data.claimsCount ?? 0,
        lastClaimDate: data.lastClaimDate,
        totalClaimedAmount: data.totalClaimedAmount,
        autoRenewal: data.autoRenewal ?? false,
        renewalDate: data.renewalDate,
        renewalPremium: data.renewalPremium,
        notes: data.notes,
        createdBy: userId,
      };

      const insurance = await RanchInsurance.create(insuranceData, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Seguro creado para rancho ${ranchId}`, this.context, {
        insuranceId: insurance.id,
        userId,
        durationMs: Date.now() - startTime,
      });

      return insurance;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error creando seguro para rancho ${ranchId}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async updateInsurance(id: string, data: Partial<InsuranceDTO>, userId: string, transaction?: Transaction): Promise<RanchInsurance> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const insurance = await RanchInsurance.findByPk(id, { transaction: t });
      if (!insurance) throw new InsuranceNotFoundError(id);

      await insurance.update({ ...data, updatedBy: userId }, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Seguro ${id} actualizado`, this.context, { userId, durationMs: Date.now() - startTime });
      return insurance;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error actualizando seguro ${id}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async recordClaim(insuranceId: string, claimAmount: number, claimDate: Date, userId: string, transaction?: Transaction): Promise<RanchInsurance> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const insurance = await RanchInsurance.findByPk(insuranceId, { transaction: t });
      if (!insurance) throw new InsuranceNotFoundError(insuranceId);

      const newClaimsCount = (insurance.claimsCount || 0) + 1;
      const newTotalClaimed = (insurance.totalClaimedAmount || 0) + claimAmount;

      await insurance.update({
        claimsCount: newClaimsCount,
        lastClaimDate: claimDate,
        totalClaimedAmount: newTotalClaimed,
        updatedBy: userId,
      }, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Reclamación registrada para seguro ${insuranceId}`, this.context, {
        insuranceId,
        claimAmount,
        userId,
        durationMs: Date.now() - startTime,
      });

      return insurance;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error registrando reclamación para seguro ${insuranceId}`, this.context, { insuranceId, claimAmount }, ensureError(error));
      throw error;
    }
  }

  async renewInsurance(insuranceId: string, newEndDate: Date, newPremium?: number, userId?: string, transaction?: Transaction): Promise<RanchInsurance> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const insurance = await RanchInsurance.findByPk(insuranceId, { transaction: t });
      if (!insurance) throw new InsuranceNotFoundError(insuranceId);
      if (insurance.status !== InsuranceStatus.ACTIVE && insurance.status !== InsuranceStatus.EXPIRED) {
        throw new RanchValidationError('El seguro no es válido o expirado');
      }

      const updateData: any = {
        startDate: new Date(),
        endDate: newEndDate,
        status: InsuranceStatus.ACTIVE,
        updatedBy: userId,
      };
      if (newPremium !== undefined) updateData.renewalPremium = newPremium;

      await insurance.update(updateData, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Seguro ${insuranceId} renovado`, this.context, { userId, durationMs: Date.now() - startTime });
      return insurance;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error renovando seguro ${insuranceId}`, this.context, { insuranceId }, ensureError(error));
      throw error;
    }
  }

  async getCoverageSummary(ranchId: string): Promise<{ totalCoverageAmount: number; byType: Record<string, number> }> {
    const insurances = await RanchInsurance.findAll({
      where: {
        ranchId,
        status: InsuranceStatus.ACTIVE,
        endDate: { [Op.gt]: new Date() },
      },
    });

    const byType: Record<string, number> = {};
    let totalCoverageAmount = 0;

    for (const ins of insurances) {
      const amount = ins.coverageAmount || 0;
      totalCoverageAmount += amount;
      byType[ins.type] = (byType[ins.type] || 0) + amount;
    }

    return { totalCoverageAmount, byType };
  }
}

export const ranchLegalService = new RanchLegalService();