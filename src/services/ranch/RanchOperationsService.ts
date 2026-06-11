// services/ranch/RanchOperationsService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import {
  RanchNotFoundError,
  ProductionNotFoundError,
  SustainabilityNotFoundError,
  TechnologyNotFoundError,
  FinancialNotFoundError,
  RanchValidationError,
} from '../../utils/RanchErrors';
import { ensureError } from '../../utils/errorUtils';
import { PRODUCTION_TRENDS, SUSTAINABILITY_SCORE_RANGES } from '../../constants/ranch.constants';

import Ranch from '../../models/Ranch';
import RanchProduction, { MilkQuality, RanchProductionCreationAttributes } from '../../models/RanchProduction';
import RanchSustainability, {
  WasteManagement,
  ClimateAdaptation,
  SustainabilityGoal,
  RanchSustainabilityCreationAttributes,
} from '../../models/RanchSustainability';
import RanchTechnology, {
  AutomationLevel,
  DataStorage,
  ReportingFrequency,
  RanchTechnologyCreationAttributes,
} from '../../models/RanchTechnology';
import RanchFinancial, { OperatingCosts, RevenueStream, RanchFinancialCreationAttributes } from '../../models/RanchFinancial';
import Bovine from '../../models/Bovine';

// ============================================================================
// DTOs para producción
// ============================================================================

export interface ProductionDTO {
  year: number;
  annualMilkProduction?: number;
  averageMilkPerCow?: number;
  milkQualityAverage?: MilkQuality;
  annualMeatProduction?: number;
  averageWeightGain?: number;
  calvingRate?: number;
  calvingInterval?: number;
  mortalityRate?: number;
  cullingRate?: number;
  feedConversionRatio?: number;
  reproductiveEfficiency?: number;
  healthIncidenceRate?: number;
  vaccinationCoverage?: number;
  antibioticUsage?: number;
  organicMatterProduction?: number;
  notes?: string;
}

// ============================================================================
// DTOs para sostenibilidad
// ============================================================================

export interface SustainabilityDTO {
  carbonFootprint?: number;
  waterUsageEfficiency?: number;
  energyConsumption?: number;
  renewableEnergyPercentage?: number;
  wasteManagement: WasteManagement;
  biodiversityIndex?: number;
  soilHealthScore?: number;
  conservationPractices: string[];
  nativeVegetationArea?: number;
  wildlifeCorridors?: boolean;
  environmentalCertifications: string[];
  sustainabilityGoals: SustainabilityGoal[];
  climateAdaptation: ClimateAdaptation;
  lastAssessmentDate?: Date;
  nextAssessmentDate?: Date;
  assessedBy?: string;
  notes?: string;
}

// ============================================================================
// DTOs para tecnología
// ============================================================================

export interface TechnologyDTO {
  automationLevel: AutomationLevel;
  digitalSolutions?: any[];
  precisionAgriculture?: any;
  iotDevices?: any[];
  dataManagement?: any;
  innovationProjects?: any[];
  hasInternet: boolean;
  internetSpeed?: number;
  hasCctv: boolean;
  hasAutomatedGates: boolean;
  hasAutomatedFeeders: boolean;
  hasAutomatedWaterers: boolean;
  hasWeatherStation: boolean;
  cellularCoverage?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NONE';
  satelliteInternet?: boolean;
  fiberOptic?: boolean;
  annualTechBudget?: number;
  techInvestmentLastYear?: number;
  techInvestmentNextYear?: number;
  lastTechAudit?: Date;
  nextTechAudit?: Date;
  techReadinessLevel?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

// ============================================================================
// DTOs para finanzas
// ============================================================================

export interface FinancialDTO {
  fiscalYear: number;
  annualRevenue?: number;
  annualExpenses?: number;
  netProfit?: number;
  profitMargin?: number;
  roi?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  equity?: number;
  cashFlow?: number;
  debtToEquityRatio?: number;
  operatingCosts: OperatingCosts;
  revenueStreams: RevenueStream[];
  budgetYear: number;
  lastFinancialAudit?: Date;
  auditor?: string;
  notes?: string;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class RanchOperationsService {
  private readonly context = 'RanchOperationsService';

  // ==========================================================================
  // PRODUCCIÓN
  // ==========================================================================

  async getProduction(ranchId: string, year: number): Promise<RanchProduction> {
    const production = await RanchProduction.findOne({ where: { ranchId, year } });
    if (!production) throw new ProductionNotFoundError(ranchId, year);
    return production;
  }

  async createProduction(ranchId: string, data: ProductionDTO, userId: string, transaction?: Transaction): Promise<RanchProduction> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const ranch = await Ranch.findByPk(ranchId, { transaction: t });
      if (!ranch) throw new RanchNotFoundError(ranchId);

      const existing = await RanchProduction.findOne({ where: { ranchId, year: data.year }, transaction: t });
      if (existing) {
        throw new RanchValidationError(`Ya existen datos de producción para el año ${data.year}`);
      }

      const productionData: RanchProductionCreationAttributes = {
        ranchId,
        year: data.year,
        annualMilkProduction: data.annualMilkProduction,
        averageMilkPerCow: data.averageMilkPerCow,
        milkQualityAverage: data.milkQualityAverage,
        annualMeatProduction: data.annualMeatProduction,
        averageWeightGain: data.averageWeightGain,
        calvingRate: data.calvingRate,
        calvingInterval: data.calvingInterval,
        mortalityRate: data.mortalityRate,
        cullingRate: data.cullingRate,
        feedConversionRatio: data.feedConversionRatio,
        reproductiveEfficiency: data.reproductiveEfficiency,
        healthIncidenceRate: data.healthIncidenceRate,
        vaccinationCoverage: data.vaccinationCoverage,
        antibioticUsage: data.antibioticUsage,
        organicMatterProduction: data.organicMatterProduction,
        notes: data.notes,
      };

      const production = await RanchProduction.create(productionData, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Datos de producción creados para rancho ${ranchId} año ${data.year}`, this.context, {
        ranchId,
        year: data.year,
        userId,
        durationMs: Date.now() - startTime,
      });

      return production;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error creando producción para rancho ${ranchId}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async updateProduction(ranchId: string, year: number, data: Partial<ProductionDTO>, userId: string, transaction?: Transaction): Promise<RanchProduction> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const production = await RanchProduction.findOne({ where: { ranchId, year }, transaction: t });
      if (!production) throw new ProductionNotFoundError(ranchId, year);

      await production.update({ ...data }, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Datos de producción actualizados para rancho ${ranchId} año ${year}`, this.context, {
        ranchId,
        year,
        userId,
        durationMs: Date.now() - startTime,
      });

      return production;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error actualizando producción para rancho ${ranchId}`, this.context, { year, data }, ensureError(error));
      throw error;
    }
  }

  async getProductionTrends(ranchId: string, years: number = 5): Promise<{ milk: number[]; meat: number[]; years: number[] }> {
    const productions = await RanchProduction.findAll({
      where: { ranchId },
      order: [['year', 'DESC']],
      limit: years,
    });

    const sorted = productions.sort((a, b) => a.year - b.year);
    return {
      years: sorted.map(p => p.year),
      milk: sorted.map(p => p.annualMilkProduction || 0),
      meat: sorted.map(p => p.annualMeatProduction || 0),
    };
  }

  async compareWithIndustry(ranchId: string, year: number): Promise<{ milk: string; meat: string; efficiency: string }> {
    const production = await this.getProduction(ranchId, year);
    const milkPerCow = production.averageMilkPerCow || 0;
    const meatPerAnimal = production.annualMeatProduction ? production.annualMeatProduction / (await this.getCattleCount(ranchId)) : 0;

    let milkRating = 'BAJO';
    if (milkPerCow >= PRODUCTION_TRENDS.MILK.HIGH) milkRating = 'ALTO';
    else if (milkPerCow >= PRODUCTION_TRENDS.MILK.MEDIUM) milkRating = 'MEDIO';

    let meatRating = 'BAJO';
    if (meatPerAnimal >= PRODUCTION_TRENDS.MEAT.HIGH) meatRating = 'ALTO';
    else if (meatPerAnimal >= PRODUCTION_TRENDS.MEAT.MEDIUM) meatRating = 'MEDIO';

    const efficiencyRating = (production.feedConversionRatio || 0) < 6 ? 'BUENA' : 'MEJORABLE';

    return { milk: milkRating, meat: meatRating, efficiency: efficiencyRating };
  }

  // ==========================================================================
  // SOSTENIBILIDAD
  // ==========================================================================

  async getSustainability(ranchId: string): Promise<RanchSustainability> {
    const sustainability = await RanchSustainability.findByPk(ranchId);
    if (!sustainability) throw new SustainabilityNotFoundError(ranchId);
    return sustainability;
  }

  async createOrUpdateSustainability(ranchId: string, data: SustainabilityDTO, userId: string, transaction?: Transaction): Promise<RanchSustainability> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const ranch = await Ranch.findByPk(ranchId, { transaction: t });
      if (!ranch) throw new RanchNotFoundError(ranchId);

      const existing = await RanchSustainability.findByPk(ranchId, { transaction: t });
      const sustainabilityData: RanchSustainabilityCreationAttributes = {
        ranchId,
        carbonFootprint: data.carbonFootprint,
        waterUsageEfficiency: data.waterUsageEfficiency,
        energyConsumption: data.energyConsumption,
        renewableEnergyPercentage: data.renewableEnergyPercentage,
        wasteManagement: data.wasteManagement,
        biodiversityIndex: data.biodiversityIndex,
        soilHealthScore: data.soilHealthScore,
        conservationPractices: data.conservationPractices,
        nativeVegetationArea: data.nativeVegetationArea,
        wildlifeCorridors: data.wildlifeCorridors,
        environmentalCertifications: data.environmentalCertifications,
        sustainabilityGoals: data.sustainabilityGoals,
        climateAdaptation: data.climateAdaptation,
        lastAssessmentDate: data.lastAssessmentDate,
        nextAssessmentDate: data.nextAssessmentDate,
        assessedBy: data.assessedBy,
        notes: data.notes,

      };

      let sustainability: RanchSustainability;
      if (existing) {
        await existing.update(sustainabilityData, { transaction: t });
        sustainability = existing;
      } else {
        sustainability = await RanchSustainability.create(sustainabilityData, { transaction: t });
      }

      if (isOwnTransaction) await t.commit();

      logger.info(`Datos de sostenibilidad ${existing ? 'actualizados' : 'creados'} para rancho ${ranchId}`, this.context, {
        ranchId,
        userId,
        durationMs: Date.now() - startTime,
      });

      return sustainability;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error en sostenibilidad para rancho ${ranchId}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  calculateSustainabilityScore(sustainability: RanchSustainability): number {
    let score = 0;
    if (sustainability.carbonFootprint) score += Math.max(0, 20 - sustainability.carbonFootprint / 5);
    if (sustainability.waterUsageEfficiency) score += sustainability.waterUsageEfficiency / 100;
    if (sustainability.renewableEnergyPercentage) score += sustainability.renewableEnergyPercentage / 10;
    if (sustainability.biodiversityIndex) score += sustainability.biodiversityIndex * 2;
    if (sustainability.soilHealthScore) score += sustainability.soilHealthScore / 10;
    if (sustainability.conservationPractices.length) score += 10;
    if (sustainability.environmentalCertifications.length) score += 15;

    return Math.min(100, Math.max(0, score));
  }

  async updateGoalProgress(ranchId: string, goalIndex: number, progress: number, userId: string, transaction?: Transaction): Promise<RanchSustainability> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const sustainability = await RanchSustainability.findByPk(ranchId, { transaction: t });
      if (!sustainability) throw new SustainabilityNotFoundError(ranchId);

      const goals = sustainability.sustainabilityGoals || [];
      if (!goals[goalIndex]) throw new RanchValidationError('Índice de meta inválido');

      goals[goalIndex].progress = progress;
      if (progress >= 100) goals[goalIndex].status = 'COMPLETED';
      else if (new Date(goals[goalIndex].targetDate) < new Date()) goals[goalIndex].status = 'BEHIND';
      else goals[goalIndex].status = 'ON_TRACK';

      sustainability.sustainabilityGoals = goals;
      await sustainability.save({ transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Progreso de meta actualizado para rancho ${ranchId}`, this.context, {
        ranchId,
        goalIndex,
        progress,
        userId,
        durationMs: Date.now() - startTime,
      });

      return sustainability;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error actualizando progreso de meta para rancho ${ranchId}`, this.context, { goalIndex, progress }, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // TECNOLOGÍA
  // ==========================================================================

  async getTechnology(ranchId: string): Promise<RanchTechnology> {
    const tech = await RanchTechnology.findByPk(ranchId);
    if (!tech) throw new TechnologyNotFoundError(ranchId);
    return tech;
  }

  async createOrUpdateTechnology(ranchId: string, data: TechnologyDTO, userId: string, transaction?: Transaction): Promise<RanchTechnology> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const ranch = await Ranch.findByPk(ranchId, { transaction: t });
      if (!ranch) throw new RanchNotFoundError(ranchId);

      const existing = await RanchTechnology.findByPk(ranchId, { transaction: t });
      const techData: RanchTechnologyCreationAttributes = {
        ranchId,
        automationLevel: data.automationLevel,
        digitalSolutions: data.digitalSolutions || [],
        precisionAgriculture: data.precisionAgriculture || {},
        iotDevices: data.iotDevices || [],
        dataManagement: data.dataManagement || { dataStorage: DataStorage.LOCAL, reportingFrequency: ReportingFrequency.MONTHLY },
        innovationProjects: data.innovationProjects || [],
        hasInternet: data.hasInternet,
        internetSpeed: data.internetSpeed,
        hasCctv: data.hasCctv,
        hasAutomatedGates: data.hasAutomatedGates,
        hasAutomatedFeeders: data.hasAutomatedFeeders,
        hasAutomatedWaterers: data.hasAutomatedWaterers,
        hasWeatherStation: data.hasWeatherStation,
        cellularCoverage: data.cellularCoverage,
        satelliteInternet: data.satelliteInternet,
        fiberOptic: data.fiberOptic,
        annualTechBudget: data.annualTechBudget,
        techInvestmentLastYear: data.techInvestmentLastYear,
        techInvestmentNextYear: data.techInvestmentNextYear,
        lastTechAudit: data.lastTechAudit,
        nextTechAudit: data.nextTechAudit,
        techReadinessLevel: data.techReadinessLevel,
        notes: data.notes,
      };

      let technology: RanchTechnology;
      if (existing) {
        await existing.update(techData, { transaction: t });
        technology = existing;
      } else {
        technology = await RanchTechnology.create(techData, { transaction: t });
      }

      if (isOwnTransaction) await t.commit();

      logger.info(`Datos de tecnología ${existing ? 'actualizados' : 'creados'} para rancho ${ranchId}`, this.context, {
        ranchId,
        userId,
        durationMs: Date.now() - startTime,
      });

      return technology;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error en tecnología para rancho ${ranchId}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  calculateTechReadinessLevel(technology: RanchTechnology): number {
    let score = 0;
    if (technology.hasInternet) score += 5;
    if (technology.internetSpeed && technology.internetSpeed > 10) score += 5;
    if (technology.hasCctv) score += 5;
    if (technology.hasAutomatedGates) score += 5;
    if (technology.hasAutomatedFeeders) score += 10;
    if (technology.hasAutomatedWaterers) score += 10;
    if (technology.hasWeatherStation) score += 5;
    if (technology.digitalSolutions?.length) score += Math.min(15, technology.digitalSolutions.length * 3);
    if (technology.iotDevices?.length) score += Math.min(20, technology.iotDevices.length * 4);
    if (technology.precisionAgriculture) {
      const pa = technology.precisionAgriculture;
      if (pa.gpsGuidedEquipment) score += 5;
      if (pa.soilMapping) score += 5;
      if (pa.variableRateApplication) score += 5;
      if (pa.droneSurveillance) score += 5;
      if (pa.satelliteMonitoring) score += 5;
    }

    if (score <= 20) return 1;
    if (score <= 40) return 2;
    if (score <= 60) return 3;
    if (score <= 80) return 4;
    return 5;
  }

  async recommendInvestments(ranchId: string): Promise<string[]> {
    const tech = await this.getTechnology(ranchId);
    const recommendations: string[] = [];

    if (!tech.hasInternet) recommendations.push('Instalar conexión a internet para acceso a sistemas de gestión.');
    if (tech.internetSpeed && tech.internetSpeed < 10) recommendations.push('Mejorar velocidad de internet para procesamiento de datos en tiempo real.');
    if (!tech.hasAutomatedFeeders) recommendations.push('Implementar comederos automáticos para optimizar alimentación.');
    if (!tech.hasAutomatedWaterers) recommendations.push('Instalar bebederos automáticos para garantizar agua constante.');
    if (!tech.hasWeatherStation) recommendations.push('Adquirir estación meteorológica para monitoreo climático.');
    if ((tech.precisionAgriculture?.gpsGuidedEquipment === false)) recommendations.push('Incorporar equipos con guiado GPS para mejorar eficiencia de insumos.');
    if ((tech.precisionAgriculture?.soilMapping === false)) recommendations.push('Realizar mapeo de suelos para fertilización de precisión.');
    if (!tech.digitalSolutions?.length) recommendations.push('Implementar software de gestión ganadera.');

    return recommendations;
  }

  // ==========================================================================
  // FINANZAS
  // ==========================================================================

  async getFinancial(ranchId: string, fiscalYear: number): Promise<RanchFinancial> {
    const financial = await RanchFinancial.findOne({ where: { ranchId, fiscalYear } });
    if (!financial) throw new FinancialNotFoundError(ranchId, fiscalYear);
    return financial;
  }

  async createFinancial(ranchId: string, data: FinancialDTO, userId: string, transaction?: Transaction): Promise<RanchFinancial> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const ranch = await Ranch.findByPk(ranchId, { transaction: t });
      if (!ranch) throw new RanchNotFoundError(ranchId);

      const existing = await RanchFinancial.findOne({ where: { ranchId, fiscalYear: data.fiscalYear }, transaction: t });
      if (existing) {
        throw new RanchValidationError(`Ya existen datos financieros para el año ${data.fiscalYear}`);
      }

      const financialData: RanchFinancialCreationAttributes = {
        ranchId,
        fiscalYear: data.fiscalYear,
        annualRevenue: data.annualRevenue,
        annualExpenses: data.annualExpenses,
        netProfit: data.netProfit,
        profitMargin: data.profitMargin,
        roi: data.roi,
        totalAssets: data.totalAssets,
        totalLiabilities: data.totalLiabilities,
        equity: data.equity,
        cashFlow: data.cashFlow,
        debtToEquityRatio: data.debtToEquityRatio,
        operatingCosts: data.operatingCosts,
        revenueStreams: data.revenueStreams,
        budgetYear: data.budgetYear,
        lastFinancialAudit: data.lastFinancialAudit,
        auditor: data.auditor,
        notes: data.notes,
      };

      const financial = await RanchFinancial.create(financialData, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Datos financieros creados para rancho ${ranchId} año ${data.fiscalYear}`, this.context, {
        ranchId,
        year: data.fiscalYear,
        userId,
        durationMs: Date.now() - startTime,
      });

      return financial;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error creando finanzas para rancho ${ranchId}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async updateFinancial(ranchId: string, fiscalYear: number, data: Partial<FinancialDTO>, userId: string, transaction?: Transaction): Promise<RanchFinancial> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const financial = await RanchFinancial.findOne({ where: { ranchId, fiscalYear }, transaction: t });
      if (!financial) throw new FinancialNotFoundError(ranchId, fiscalYear);

      await financial.update({ ...data }, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Datos financieros actualizados para rancho ${ranchId} año ${fiscalYear}`, this.context, {
        ranchId,
        year: fiscalYear,
        userId,
        durationMs: Date.now() - startTime,
      });

      return financial;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error actualizando finanzas para rancho ${ranchId}`, this.context, { fiscalYear, data }, ensureError(error));
      throw error;
    }
  }

  async calculateProfitability(ranchId: string, fiscalYear: number): Promise<{ grossMargin: number; netMargin: number; roe: number }> {
    const financial = await this.getFinancial(ranchId, fiscalYear);
    const revenue = financial.annualRevenue || 0;
    const expenses = financial.annualExpenses || 0;
    const equity = financial.equity || 1;

    const grossMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
    const netMargin = financial.netProfit ? (financial.netProfit / revenue) * 100 : 0;
    const roe = financial.netProfit ? (financial.netProfit / equity) * 100 : 0;

    return { grossMargin, netMargin, roe };
  }

  async analyzeRevenueStreams(ranchId: string, fiscalYear: number): Promise<{ streams: RevenueStream[]; diversification: number }> {
    const financial = await this.getFinancial(ranchId, fiscalYear);
    const streams = financial.revenueStreams || [];
    const total = streams.reduce((sum, s) => sum + s.percentage, 0);
    const diversification = streams.length === 0 ? 0 : 1 - (Math.max(...streams.map(s => s.percentage), 0) / 100);
    return { streams, diversification };
  }

  async compareWithPreviousYears(ranchId: string, currentYear: number): Promise<{ revenueChange: number; profitChange: number; marginChange: number }> {
    const current = await this.getFinancial(ranchId, currentYear);
    const previous = await RanchFinancial.findOne({ where: { ranchId, fiscalYear: currentYear - 1 } });

    if (!previous) return { revenueChange: 0, profitChange: 0, marginChange: 0 };

    const revenueChange = previous.annualRevenue ? ((current.annualRevenue || 0) - previous.annualRevenue) / previous.annualRevenue * 100 : 0;
    const profitChange = previous.netProfit ? ((current.netProfit || 0) - previous.netProfit) / previous.netProfit * 100 : 0;
    const marginChange = previous.profitMargin ? ((current.profitMargin || 0) - previous.profitMargin) : 0;

    return { revenueChange, profitChange, marginChange };
  }

  // ==========================================================================
  // Métodos auxiliares privados
  // ==========================================================================

  private async getCattleCount(ranchId: string): Promise<number> {
    const count = await Bovine.count({
      where: { ranchId, isActive: true },
    });
    return count;
  }
}

export const ranchOperationsService = new RanchOperationsService();