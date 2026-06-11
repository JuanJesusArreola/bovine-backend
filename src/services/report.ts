// src/services/reports/ReportsService.ts
import { Op } from 'sequelize';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { RanchCoreService } from './ranch/RanchService';
import { RanchOperationsService } from './ranch/RanchOperationsService';
import { ProductionService } from './production';
import { ReproductionService } from './reproduction';
import { HealthRecordService } from './health/HealthRecordService'; // Asumiendo que existe
import logger from '../utils/logger';
import { ValidationError } from '../utils/errorUtils';
import { LaboratoryService } from './health/LaboratoryService';
import { TreatmentService } from './health/TreatmentService';
import { DiagnosisService } from './health/DiagnosisService';
import Bovine, { HealthStatus } from '../models/Bovine';
import { ReproductionType } from '../models/Reproduction';
import { FinanceService } from './FinanceService'
import { InventoryService } from './InventoryService';
// ============================================================================
// TIPOS E INTERFACES (coinciden con el original)
// ============================================================================

export type ReportType =
  | 'HEALTH_OVERVIEW'
  | 'HEALTH_TRENDS'
  | 'DISEASE_ANALYSIS'
  | 'VACCINATION_COVERAGE'
  | 'VACCINATION_SCHEDULE'
  | 'VACCINATION_EFFICACY'
  | 'PRODUCTION_SUMMARY'
  | 'PRODUCTION_TRENDS'
  | 'BREEDING_OVERVIEW'
  | 'PREGNANCY_STATUS'
  | 'BIRTH_RECORDS'
  | 'FINANCIAL_SUMMARY'
  | 'VETERINARY_COSTS'
  | 'ROI_ANALYSIS'
  | 'GEOSPATIAL_ANALYSIS'
  | 'COMPREHENSIVE_DASHBOARD'
  | 'INVENTORY_SUMMARY';

export type ExportFormat = 'PDF' | 'EXCEL' | 'CSV' | 'JSON';

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  ranchId?: string;
  bovineIds?: string[];
  breed?: string;
  healthStatus?: string;
  ageRange?: { min: number; max: number };
  productionType?: string;
  includeGeospatial?: boolean;
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  ignoreCache?: boolean;
  realTime?: boolean;
}

export interface ReportData {
  type: ReportType;
  title: string;
  data?: any;
  charts?: any[];
  maps?: any[];
  startTime?: number;
  metadata?: {
    generatedAt: Date;
    generatedBy: string;
    filters: ReportFilters;
    cacheKey: string;
    processingTime: number;
  };
}

export interface HealthReport {
  summary: {
    totalBovines: number;
    healthyCount: number;
    sickCount: number;
    recoveringCount: number;
    quarantineCount: number;
    healthPercentage: number;
  };
  recentIllnesses: Array<{
    id: string;
    bovineId: string;
    earTag?: string;
    bovineName?: string;
    disease: string;
    severity: string;
    diagnosisDate: Date;
    status: string;
    location?: any;
  }>;
  overdueVaccinations: any[];
  trends: any;
  locationDistribution?: any;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class ReportsService {
  private readonly context = 'ReportsService';

  constructor(
    private ranchCoreService: RanchCoreService,
    private ranchOpsService: RanchOperationsService,
    private productionService: ProductionService,
    private reproductionService: ReproductionService,
    private healthRecordService: HealthRecordService,
    private laboratoryService: LaboratoryService,
    private treatmentService: TreatmentService,
    private diagnosisService: DiagnosisService,
    private financeService: FinanceService,
    private inventoryService: InventoryService
  ) { }

  // ==========================================================================
  // MÉTODOS PRINCIPALES
  // ==========================================================================

  async generateReport(type: ReportType, filters: ReportFilters, userId: string): Promise<ReportData> {
    const startTime = Date.now();

    try {
      logger.info('📊 Generando reporte', this.context, { type, filters, userId });

      // Validar filtros básicos
      await this.validateFilters(filters);

      let reportData: ReportData;

      switch (type) {
        case 'HEALTH_OVERVIEW':
          reportData = await this.generateHealthOverviewReport(filters);
          break;
        case 'HEALTH_TRENDS':
          reportData = await this.generateHealthTrendsReport(filters);
          break;
        case 'DISEASE_ANALYSIS':
          reportData = await this.generateDiseaseAnalysisReport(filters);
          break;
        case 'VACCINATION_COVERAGE':
          reportData = await this.generateVaccinationCoverageReport(filters);
          break;
        case 'VACCINATION_SCHEDULE':
          reportData = await this.generateVaccinationScheduleReport(filters);
          break;
        case 'VACCINATION_EFFICACY':
          reportData = await this.generateVaccinationEfficacyReport(filters);
          break;
        case 'PRODUCTION_SUMMARY':
          reportData = await this.generateProductionSummaryReport(filters);
          break;
        case 'PRODUCTION_TRENDS':
          reportData = await this.generateProductionTrendsReport(filters);
          break;
        case 'BREEDING_OVERVIEW':
          reportData = await this.generateBreedingOverviewReport(filters);
          break;
        case 'PREGNANCY_STATUS':
          reportData = await this.generatePregnancyStatusReport(filters);
          break;
        case 'BIRTH_RECORDS':
          reportData = await this.generateBirthRecordsReport(filters);
          break;
        case 'FINANCIAL_SUMMARY':
          reportData = await this.generateFinancialSummaryReport(filters);
          break;
        case 'VETERINARY_COSTS':
          reportData = await this.generateVeterinaryCostsReport(filters);
          break;
        case 'ROI_ANALYSIS':
          reportData = await this.generateROIAnalysisReport(filters);
          break;
        case 'GEOSPATIAL_ANALYSIS':
          reportData = await this.generateGeospatialAnalysisReport(filters);
          break;
        case 'COMPREHENSIVE_DASHBOARD':
          reportData = await this.generateComprehensiveDashboard(filters);
          break;
        case 'INVENTORY_SUMMARY':                                           // ← NUEVO
          reportData = await this.generateInventorySummaryReport(filters);
          break;
        default:
          throw new ValidationError(`Tipo de reporte no soportado: ${type}`);
      }

      const processingTime = Date.now() - startTime;

      // Agregar metadatos
      reportData.metadata = {
        generatedAt: new Date(),
        generatedBy: userId,
        filters,
        cacheKey: this.generateCacheKey(type, filters),
        processingTime,
      };

      logger.info('✅ Reporte generado exitosamente', this.context, { type, processingTime });

      return reportData;
    } catch (error) {
      logger.error('❌ Error generando reporte', this.context, { type, filters, error });
      throw error;
    }
  }

  // ==========================================================================
  // REPORTES DE SALUD
  // ==========================================================================

  private async generateHealthOverviewReport(filters: ReportFilters): Promise<ReportData> {
    const startTime = Date.now();
    const { ranchId, startDate, endDate, healthStatus } = filters;

    if (!ranchId) throw new ValidationError('ranchId es requerido para el reporte de salud');

    // Construir filtros para DiagnosisService
    const diagnosisFilters: Parameters<typeof this.diagnosisService.getDiagnosisStats>[0] = {
      ranchId,
      startDate,
      endDate,
      healthStatus: healthStatus ? [healthStatus as HealthStatus] : undefined,
    };

    // Obtener todos los bovinos del rancho directamente con el modelo
    const bovinesList = await Bovine.findAll({
      where: { ranchId, isActive: true },
      attributes: ['id', 'earTag', 'name', 'healthStatus'],
    });

    // Obtener estadísticas de diagnóstico
    const diagnosisStats = await this.diagnosisService.getDiagnosisStats(diagnosisFilters);

    // Enfermedades recientes (asumiendo que healthRecordService tiene el método)
    const recentIllnesses = await this.healthRecordService.getRecentIllnessesByRanch(ranchId, 10);

    const totalBovines = bovinesList.length;
    const healthyCount = diagnosisStats.byHealthStatus[HealthStatus.HEALTHY] || 0;
    const healthPercentage = totalBovines > 0 ? (healthyCount / totalBovines) * 100 : 0;

    const reportData: HealthReport = {
      summary: {
        totalBovines,
        healthyCount,
        sickCount: diagnosisStats.byHealthStatus[HealthStatus.SICK] || 0,
        recoveringCount: diagnosisStats.byHealthStatus[HealthStatus.RECOVERING] || 0,
        quarantineCount: diagnosisStats.byHealthStatus[HealthStatus.QUARANTINE] || 0,
        healthPercentage,
      },
      recentIllnesses,
      overdueVaccinations: [],
      trends: diagnosisStats.topDiagnoses,
      locationDistribution: null,
    };

    return {
      type: 'HEALTH_OVERVIEW',
      title: 'Reporte General de Salud',
      data: reportData,
      charts: this.generateHealthCharts(reportData),
      startTime,
    };
  }

  private async generateHealthTrendsReport(filters: ReportFilters): Promise<ReportData> {
    const startTime = Date.now();
    const stats = await this.diagnosisService.getDiagnosisStats({
      ranchId: filters.ranchId,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    const trends = {
      period: filters.period || 'month',
      dateRange: { startDate: filters.startDate, endDate: filters.endDate },
      diagnosisTrends: stats.topDiagnoses.map(d => ({ diagnosis: d.diagnosis, count: d.count })),
      outbreakAnalysis: { outbreaks: [] },
      treatmentEfficacy: { efficacy: 0 },
      riskFactors: { factors: [] },
      seasonalPatterns: { patterns: [] },
      recommendations: stats.topDiagnoses.length ? ['Monitorear diagnósticos frecuentes'] : [],
    };

    return {
      type: 'HEALTH_TRENDS',
      title: 'Análisis de Tendencias de Salud',
      data: trends,
      charts: this.generateTrendCharts(trends),
      startTime,
    };
  }

  private async generateDiseaseAnalysisReport(filters: ReportFilters): Promise<ReportData> {
    const startTime = Date.now();
    const { ranchId, startDate, endDate, healthStatus } = filters;
    if (!ranchId) throw new ValidationError('ranchId es requerido para análisis de enfermedades');

    const abnormalResults = await this.laboratoryService.getAbnormalResultsByRanch(ranchId, 30);

    const diagnosisFilters: Parameters<typeof this.diagnosisService.getDiagnosisStats>[0] = {
      ranchId,
      startDate,
      endDate,
      healthStatus: healthStatus ? [healthStatus as HealthStatus] : undefined,
    };
    const diagnosisStats = await this.diagnosisService.getDiagnosisStats(diagnosisFilters);

    return {
      type: 'DISEASE_ANALYSIS',
      title: 'Análisis de Enfermedades',
      data: {
        abnormalResults,
        topDiagnoses: diagnosisStats.topDiagnoses,
        byHealthStatus: diagnosisStats.byHealthStatus,
      },
      startTime,
    };
  }

  // ==========================================================================
  // NUEVO: REPORTE DE INVENTARIO
  // ==========================================================================

  private async generateInventorySummaryReport(filters: ReportFilters): Promise<ReportData> {
    const startTime = Date.now();
    const { ranchId } = filters;

    if (!ranchId) {
      throw new ValidationError('ranchId es requerido para reporte de inventario');
    }

    try {
      // 1. Obtener items del inventario
      const { items, total, metadata } = await this.inventoryService.getInventory({}, ranchId);

      // 2. Calcular valuación
      const valuation = await this.inventoryService.calculateInventoryValuation(ranchId, 'WEIGHTED_AVERAGE');

      // 3. Contar alertas
      const lowStockItems = items.filter(item => item.currentStock <= item.minimumStock);
      const expiredItems = items.filter(item => item.expirationDate && new Date(item.expirationDate) < new Date());

      // 4. Valor por categoría
      const byCategory: Record<string, { count: number; value: number }> = {};
      for (const item of items) {
        const category = item.category;
        if (!byCategory[category]) byCategory[category] = { count: 0, value: 0 };
        byCategory[category].count += 1;
        byCategory[category].value += item.currentStock * item.unitCost;
      }

      return {
        type: 'INVENTORY_SUMMARY',
        title: 'Resumen de Inventario',
        data: {
          summary: {
            totalItems: total,
            totalValue: valuation.totalValue,
            totalQuantity: valuation.totalQuantity,
            lowStockCount: lowStockItems.length,
            expiredCount: expiredItems.length,
          },
          valuation,
          byCategory,
          lowStockItems: lowStockItems.map(item => ({
            id: item.id,
            name: item.itemName,
            currentStock: item.currentStock,
            minStock: item.minimumStock,
            unit: item.unitOfMeasure,
          })),
          metadata,
        },
        startTime,
      };
    } catch (error) {
      logger.error('Error generando reporte de inventario', this.context, { filters, error });
      throw error;
    }
  }

  // ==========================================================================
  // REPORTES DE VACUNACIÓN (placeholders)
  // ==========================================================================

  private async generateVaccinationCoverageReport(filters: ReportFilters): Promise<ReportData> {
    return {
      type: 'VACCINATION_COVERAGE',
      title: 'Cobertura de Vacunación',
      data: { message: 'Reporte en desarrollo' },
      startTime: Date.now(),
    };
  }

  private async generateVaccinationScheduleReport(filters: ReportFilters): Promise<ReportData> {
    return {
      type: 'VACCINATION_SCHEDULE',
      title: 'Cronograma de Vacunación',
      data: { message: 'Reporte en desarrollo' },
      startTime: Date.now(),
    };
  }

  private async generateVaccinationEfficacyReport(filters: ReportFilters): Promise<ReportData> {
    return {
      type: 'VACCINATION_EFFICACY',
      title: 'Eficacia de Vacunación',
      data: { message: 'Reporte en desarrollo' },
      startTime: Date.now(),
    };
  }

  // ==========================================================================
  // REPORTES DE PRODUCCIÓN (usando servicios reales)
  // ==========================================================================

  private async generateProductionSummaryReport(filters: ReportFilters): Promise<ReportData> {
    const startTime = Date.now();
    const { ranchId, startDate, endDate, productionType } = filters;

    if (!ranchId || !startDate || !endDate) {
      throw new ValidationError('ranchId, startDate y endDate son requeridos para reporte de producción');
    }

    // Obtener registros individuales del rancho
    const productions = await this.productionService.getProductionsByRanch(ranchId, {
      startDate,
      endDate,
      productionType,
      limit: 1000000,
    });

    // Calcular totales por tipo
    const totals: Record<string, { total: number; count: number }> = {};
    for (const prod of productions.rows) {
      const type = prod.productionType;
      if (!totals[type]) totals[type] = { total: 0, count: 0 };
      totals[type].total += prod.quantity;
      totals[type].count++;
    }

    const summary = Object.entries(totals).map(([type, data]) => ({
      type,
      unit: productions.rows.find(p => p.productionType === type)?.unit || 'unidad',
      totalRecords: data.count,
      totalValue: data.total,
      averageValue: data.total / data.count,
      minimumValue: 0, // se podría calcular
      maximumValue: 0,
    }));

    // Top productores (bovinos con más producción)
    const topProducers = await this.productionService.getTopProducersByRanch(ranchId, startDate, endDate, 10); // método que debería existir

    return {
      type: 'PRODUCTION_SUMMARY',
      title: 'Resumen de Producción',
      data: {
        period: { startDate, endDate },
        summary,
        topProducers: topProducers || [],
        monthlyTrends: [],
        periodComparison: {},
        efficiencyAnalysis: {},
        recommendations: [],
      },
      startTime,
    };
  }

  private async generateProductionTrendsReport(filters: ReportFilters): Promise<ReportData> {
    return {
      type: 'PRODUCTION_TRENDS',
      title: 'Tendencias de Producción',
      data: { message: 'Reporte en desarrollo' },
      startTime: Date.now(),
    };
  }

  // ==========================================================================
  // REPORTES DE REPRODUCCIÓN (usando servicios reales)
  // ==========================================================================

  private async generateBreedingOverviewReport(filters: ReportFilters): Promise<ReportData> {
    const startTime = Date.now();
    const { ranchId, startDate, endDate } = filters;
    if (!ranchId) throw new ValidationError('ranchId es requerido');

    const events = await this.reproductionService.getEventsByRanch(ranchId, {
      startDate,
      endDate,
      limit: 1000000,
    });

    const byType: Record<string, number> = {};
    for (const ev of events.rows) {
      byType[ev.reproductionType] = (byType[ev.reproductionType] || 0) + 1;
    }

    const conceptionRate = await this.reproductionService.getConceptionRate(
      ranchId,
      startDate || new Date(0),
      endDate || new Date()
    );
    const calvingInterval = await this.reproductionService.getAverageCalvingInterval(ranchId);

    return {
      type: 'BREEDING_OVERVIEW',
      title: 'Resumen Reproductivo',
      data: {
        totalEvents: events.count,
        eventsByType: byType,
        conceptionRate,
        averageCalvingInterval: calvingInterval,
      },
      startTime,
    };
  }

  private async generatePregnancyStatusReport(filters: ReportFilters): Promise<ReportData> {
    const startTime = Date.now();
    const { ranchId, startDate, endDate } = filters;
    if (!ranchId) throw new ValidationError('ranchId es requerido');

    const pregnancies = await this.reproductionService.getEventsByRanch(ranchId, {
      reproductionType: ReproductionType.SYNCHRONIZED_BREEDING,
      startDate,
      endDate,
    });

    const confirmed = pregnancies.rows.filter(p => p.status === 'CONFIRMED_PREGNANT');
    const expectedCalvings = confirmed.map(p => ({
      damId: p.damId,
      expectedDate: p.pregnancyInfo?.pregnancyDiagnosis.expectedCalvingDate,
    }));

    return {
      type: 'PREGNANCY_STATUS',
      title: 'Estado de Preñez',
      data: {
        totalPregnancies: confirmed.length,
        expectedCalvings,
      },
      startTime,
    };
  }

  private async generateBirthRecordsReport(filters: ReportFilters): Promise<ReportData> {
    const startTime = Date.now();
    const { ranchId, startDate, endDate } = filters;
    if (!ranchId) throw new ValidationError('ranchId es requerido');

    const births = await this.reproductionService.getEventsByRanch(ranchId, {
      reproductionType: ReproductionType.SYNCHRONIZED_BREEDING,
      startDate,
      endDate,
    });
    const birthEvents = births.rows.filter(b => b.status === 'CALVED');

    return {
      type: 'BIRTH_RECORDS',
      title: 'Registros de Nacimientos',
      data: {
        totalBirths: birthEvents.length,
        births: birthEvents.map(b => ({
          damId: b.damId,
          birthDate: b.serviceInfo?.serviceDate,
          calfInfo: b.calfInfo,
          calvingInfo: b.calvingInfo,
        })),
      },
      startTime,
    };
  }

  // ==========================================================================
  // REPORTES FINANCIEROS Y OTROS (placeholders)
  // ==========================================================================

  private async generateFinancialSummaryReport(filters: ReportFilters): Promise<ReportData> {
    const startTime = Date.now();
    const { ranchId, startDate, endDate } = filters;
    if (!ranchId || !startDate || !endDate) {
      throw new ValidationError('ranchId, startDate y endDate son requeridos para reporte financiero');
    }

    const summary = await this.financeService.getFinancialSummary(ranchId, startDate, endDate);
    return {
      type: 'FINANCIAL_SUMMARY',
      title: 'Resumen Financiero',
      data: summary,
      startTime,
    };
  }

  private async generateVeterinaryCostsReport(filters: ReportFilters): Promise<ReportData> {
    const startTime = Date.now();
    const { ranchId, startDate, endDate } = filters;
    if (!ranchId || !startDate || !endDate) {
      throw new ValidationError('ranchId, startDate y endDate son requeridos para reporte de costos veterinarios');
    }

    const costs = await this.financeService.getVeterinaryCosts(ranchId, startDate, endDate);
    return {
      type: 'VETERINARY_COSTS',
      title: 'Costos Veterinarios',
      data: costs,
      startTime,
    };
  }

  private async generateROIAnalysisReport(filters: ReportFilters): Promise<ReportData> {
    const startTime = Date.now();
    const { ranchId, startDate, endDate } = filters;
    if (!ranchId || !startDate || !endDate) {
      throw new ValidationError('ranchId, startDate y endDate son requeridos para análisis ROI');
    }

    const roi = await this.financeService.getROIAnalysis(ranchId, startDate, endDate);
    return {
      type: 'ROI_ANALYSIS',
      title: 'Análisis de ROI',
      data: roi,
      startTime,
    };
  }

  private async generateGeospatialAnalysisReport(filters: ReportFilters): Promise<ReportData> {
    return {
      type: 'GEOSPATIAL_ANALYSIS',
      title: 'Análisis Geoespacial',
      data: { message: 'Reporte en desarrollo' },
      startTime: Date.now(),
    };
  }

  private async generateComprehensiveDashboard(filters: ReportFilters): Promise<ReportData> {
    const startTime = Date.now();
    // Combinar algunos reportes
    const health = await this.generateHealthOverviewReport(filters);
    const production = await this.generateProductionSummaryReport(filters);
    const breeding = await this.generateBreedingOverviewReport(filters);
    return {
      type: 'COMPREHENSIVE_DASHBOARD',
      title: 'Dashboard Completo',
      data: {
        health: health.data,
        production: production.data,
        breeding: breeding.data,
      },
      startTime,
    };
  }

  // ==========================================================================
  // MÉTODOS DE EXPORTACIÓN (mantenidos del original)
  // ==========================================================================

  async exportReport(
    reportData: ReportData,
    format: ExportFormat,
    options: { includeCharts?: boolean; includeMaps?: boolean } = {}
  ): Promise<Buffer> {
    logger.info('📤 Exportando reporte', this.context, { type: reportData.type, format });

    switch (format) {
      case 'PDF':
        return this.exportToPDF(reportData, options);
      case 'EXCEL':
        return this.exportToExcel(reportData, options);
      case 'CSV':
        return this.exportToCSV(reportData);
      case 'JSON':
        return Buffer.from(JSON.stringify(reportData, null, 2));
      default:
        throw new ValidationError(`Formato no soportado: ${format}`);
    }
  }

  private async exportToPDF(reportData: ReportData, options: any): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument();
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.fontSize(20).text(reportData.title, 50, 50);
      doc.fontSize(12).text(`Generado: ${new Date().toLocaleString()}`, 50, 80);
      doc.fontSize(12).text(JSON.stringify(reportData.data, null, 2), 50, 120);
      doc.end();
    });
  }

  private async exportToExcel(reportData: ReportData, options: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reporte');
    sheet.columns = [
      { header: 'Campo', key: 'field', width: 30 },
      { header: 'Valor', key: 'value', width: 50 },
    ];

    const flatten = (obj: any, prefix = ''): any[] => {
      const rows: any[] = [];
      for (const [key, value] of Object.entries(obj)) {
        const fieldName = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          rows.push(...flatten(value, fieldName));
        } else {
          rows.push({ field: fieldName, value: JSON.stringify(value) });
        }
      }
      return rows;
    };

    const rows = flatten(reportData.data);
    rows.forEach(row => sheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();

    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  }

  private async exportToCSV(reportData: ReportData): Promise<Buffer> {
    const flatten = (obj: any, prefix = ''): Record<string, any> => {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        const field = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.assign(result, flatten(value, field));
        } else {
          result[field] = value;
        }
      }
      return result;
    };

    const flat = flatten(reportData.data);
    const headers = Object.keys(flat);
    const csvRows = [headers.join(',')];
    csvRows.push(headers.map(h => JSON.stringify(flat[h] || '')).join(','));

    return Buffer.from(csvRows.join('\n'), 'utf-8');
  }

  // ==========================================================================
  // MÉTODOS AUXILIARES (validación, caché, etc.)
  // ==========================================================================

  private async validateFilters(filters: ReportFilters): Promise<void> {
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      throw new ValidationError('La fecha de inicio no puede ser posterior a la fecha de fin');
    }
    if (filters.ranchId) {
      const ranch = await this.ranchCoreService.getRanchById(filters.ranchId);
      if (!ranch) throw new ValidationError('El rancho especificado no existe');
    }
    // Otras validaciones según necesidad
  }

  private generateCacheKey(type: ReportType, filters: ReportFilters): string {
    const filterHash = Buffer.from(JSON.stringify(filters)).toString('base64');
    return `report:${type}:${filterHash}`;
  }

  // Métodos de generación de gráficos (placeholders)
  private generateHealthCharts(data: HealthReport): any[] {
    return []; // Implementación pendiente
  }

  private generateTrendCharts(data: any): any[] {
    return [];
  }
}