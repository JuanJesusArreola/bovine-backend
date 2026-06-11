// src/controllers/reports.controller.ts
import { Request, Response } from 'express';
import { reportsService } from '../container';
import { ReportType, ExportFormat, ReportFilters } from '../services/report';
import { ValidationError } from '../utils/errorUtils';
import logger from '../utils/logger';

export class ReportsController {
  private readonly context = 'ReportsController';

  constructor() {
    this.generateReport = this.generateReport.bind(this);
    this.exportReport = this.exportReport.bind(this);
  }

  /**
   * POST /api/reports/generate
   * Genera un reporte según el tipo y filtros especificados.
   */
  async generateReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }

      const { type, ...filters } = req.body;
      if (!type) {
        res.status(400).json({ success: false, error: 'Tipo de reporte es requerido' });
        return;
      }

      // Validar que el tipo sea válido
      if (!Object.values(['HEALTH_OVERVIEW', 'HEALTH_TRENDS', 'DISEASE_ANALYSIS', 'VACCINATION_COVERAGE', 'VACCINATION_SCHEDULE', 'VACCINATION_EFFICACY', 'PRODUCTION_SUMMARY', 'PRODUCTION_TRENDS', 'BREEDING_OVERVIEW', 'PREGNANCY_STATUS', 'BIRTH_RECORDS', 'FINANCIAL_SUMMARY', 'VETERINARY_COSTS', 'ROI_ANALYSIS', 'GEOSPATIAL_ANALYSIS', 'COMPREHENSIVE_DASHBOARD']).includes(type)) {
        res.status(400).json({ success: false, error: 'Tipo de reporte inválido' });
        return;
      }

      const report = await reportsService.generateReport(type as ReportType, filters as ReportFilters, userId);

      res.json({ success: true, data: report });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * POST /api/reports/export
   * Exporta un reporte en el formato especificado.
   */
  async exportReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }

      const { type, format, ...filters } = req.body;
      if (!type || !format) {
        res.status(400).json({ success: false, error: 'Tipo de reporte y formato son requeridos' });
        return;
      }

      // Validar formato
      if (!['PDF', 'EXCEL', 'CSV', 'JSON'].includes(format)) {
        res.status(400).json({ success: false, error: 'Formato de exportación inválido' });
        return;
      }

      const report = await reportsService.generateReport(type as ReportType, filters as ReportFilters, userId);
      const buffer = await reportsService.exportReport(report, format as ExportFormat);

      // Configurar headers para descarga
      const mimeTypes: Record<string, string> = {
        PDF: 'application/pdf',
        EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        CSV: 'text/csv',
        JSON: 'application/json',
      };
      const extensions: Record<string, string> = {
        PDF: 'pdf',
        EXCEL: 'xlsx',
        CSV: 'csv',
        JSON: 'json',
      };
      const mime = mimeTypes[format];
      const ext = extensions[format];

      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `attachment; filename=reporte_${Date.now()}.${ext}`);
      res.send(buffer);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: any, res: Response): void {
    logger.error('Error en ReportsController', this.context, { error });
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }
}

export const reportsController = new ReportsController();