// services/analytics/DashboardService.ts
import { Op, literal, QueryTypes,  } from 'sequelize';
import sequelize from '../../config/database'
import logger from '../../utils/logger';
import { ensureError } from '../../utils/errorUtils';
import {
    HerdHealthStats,
    bovineHealthService
} from '../BovineHealthService';
import { ranchOperationsService } from '../ranch/RanchOperationsService';
import { financeService } from '../../container';
import { eventService } from '../EventService';
import { notificationService } from '../NotificationService';
import {
    NotificationStatus,
    NotificationPriority,
    NotificationType
} from '../../models/Notification';
import Bovine from '../../models/Bovine';
import Production from '../../models/Production';
import { ProductionType } from '../../models/Production';
import User, { UserRole, UserStatus } from '../../models/User';
import { SecurityEvent, EventSeverity } from '../../models/SecurityEvent';
import Ranch from '../../models/Ranch';
import { reproductionService } from '../../container';
import { ServiceStatus, ReproductionType } from '../../models/Reproduction';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

/**
 * Dashboard completo para la vista principal
 */
export interface FullDashboard {
    health: HealthDashboard;
    production: ProductionDashboard;
    financial: FinancialDashboard;
    summary: DashboardSummary;
    generatedAt: Date;
}

/**
 * Dashboard de salud
 */
export interface HealthDashboard extends HerdHealthStats {
    recentHealthEvents: Array<{
        id: string;
        date: Date;
        type: string;
        bovineId: string;
        bovineEarTag?: string;
        description: string;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }>;
    upcomingHealthChecks: number;
    overdueHealthChecks: number;
}

/**
 * Dashboard de producción
 */
export interface ProductionDashboard {
    currentPeriod: {
        startDate: Date;
        endDate: Date;
    };
    milkProduction: {
        total: number;
        averagePerCow: number;
        vsLastPeriod: number;
    };
    meatProduction: {
        total: number;
        averagePerAnimal: number;
        vsLastPeriod: number;
    };
    reproduction: {
        calvingRate: number;
        conceptionRate: number;
        birthsLastMonth: number;
        expectedBirths: number;
    };
    trends: {
        milk: number[];
        meat: number[];
        years: number[];
    };
}

/**
 * Dashboard financiero
 */
export interface FinancialDashboard {
    currentPeriod: {
        startDate: Date;
        endDate: Date;
    };
    totals: {
        income: number;
        expenses: number;
        net: number;
        profitMargin: number;
    };
    byCategory: {
        income: Array<{ category: string; amount: number; percentage: number }>;
        expenses: Array<{ category: string; amount: number; percentage: number }>;
    };
    veterinaryCosts: {
        total: number;
        trend: 'INCREASING' | 'DECREASING' | 'STABLE';
        percentageOfExpenses: number;
    };
    roi: number;
}

/**
 * Resumen rápido del dashboard
 */
export interface DashboardSummary {
    totalBovines: number;
    activeAlerts: number;
    pendingTasks: number;
    unreadNotifications: number;
    criticalHealthIssues: number;
    lowStockItems: number;
}

/**
 * Filtros para dashboards
 */
export interface DashboardFilters {
    ranchId: string;
    period?: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
    startDate?: Date;
    endDate?: Date;
    compareWithPrevious?: boolean;
}

// ============================================================================
// INTERFACES PARA DASHBOARD POR ROL
// ============================================================================

/**
 * Resumen de salud reducido para roles con visibilidad limitada
 * (MANAGER, WORKER, VIEWER).
 * Solo conteos por estado — sin eventos detallados ni chequeos.
 */
export interface HealthSummaryLight {
    totalBovines: number;
    healthy: number;
    sick: number;
    recovering: number;
    quarantine: number;
    criticalCount: number;
}

/**
 * Resumen de producción reducido para roles con visibilidad limitada
 * (VET, WORKER, VIEWER).
 * Solo totales del período — sin tendencias, sin comparación, sin reproducción.
 */
export interface ProductionSummaryLight {
    currentPeriod: { startDate: Date; endDate: Date };
    milkTotal: number;
    meatTotal: number;
}

/**
 * Resumen financiero parcial para roles con visibilidad READ
 * (RANCH_MANAGER, MANAGER).
 * Solo totales — sin desglose por categoría, sin ROI, sin margen.
 */
export interface FinancialSummaryLight {
    currentPeriod: { startDate: Date; endDate: Date };
    income: number;
    expenses: number;
    net: number;
}

/**
 * Información de usuario para la sección de gestión
 */
export interface UserSummaryItem {
    id: string;
    email: string;
    fullName: string;
    role: string;
    status: string;
    isActive: boolean;
    emailVerified: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
}

/**
 * Sección de usuarios agrupados por rancho (SUPER_ADMIN)
 */
export interface UsersGroupedByRanch {
    ranchId: string;
    ranchName: string;
    totalUsers: number;
    active: number;
    pending: number;
    inactive: number;
    byRole: Record<string, number>;
    users: UserSummaryItem[];
}

/**
 * Sección de usuarios del rancho del OWNER
 */
export interface UsersForOwner {
    ranchId: string;
    ranchName: string;
    totalUsers: number;
    active: number;
    pending: number;
    inactive: number;
    byRole: Record<string, number>;
    users: UserSummaryItem[];
    lastRegistered?: UserSummaryItem;
}

/**
 * Métricas de sistema exclusivas del SUPER_ADMIN
 */
export interface SystemMetrics {
    totalUsers: number;
    totalRanches: number;
    usersActive: number;
    usersPendingVerification: number;
    usersInactive: number;
    recentSecurityEvents: Array<{
        id: string;
        eventType: string;
        severity: string;
        description: string;
        createdAt: Date;
    }>;
    securitySummary: {
        criticalLast7Days: number;
        failedLoginsLast24h: number;
        lockedAccounts: number;
    };
}

/**
 * Dashboard filtrado por rol.
 *
 * Cada campo es opcional porque la presencia depende del rol:
 * - health / healthLight: mutuamente excluyentes
 * - production / productionLight: mutuamente excluyentes
 * - financial / financialLight: mutuamente excluyentes, o null
 * - users: solo SUPER_ADMIN y OWNER
 * - system: solo SUPER_ADMIN
 */
export interface RoleDashboard {
    role: UserRole;
    health?: HealthDashboard;
    healthLight?: HealthSummaryLight;
    production?: ProductionDashboard;
    productionLight?: ProductionSummaryLight;
    financial?: FinancialDashboard;
    financialLight?: FinancialSummaryLight;
    summary: DashboardSummary;
    usersGrouped?: UsersGroupedByRanch[];
    usersForOwner?: UsersForOwner;
    system?: SystemMetrics;
    generatedAt: Date;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class DashboardService {
    private readonly context = 'DashboardService';

    /**
     * Obtiene el dashboard completo para un rancho
     */
    async getFullDashboard(filters: DashboardFilters): Promise<FullDashboard> {
        const startTime = Date.now();

        try {
            logger.info('Obteniendo dashboard completo', this.context, {
                ranchId: filters.ranchId,
                period: filters.period
            });

            // Ejecutar todas las consultas en paralelo para máxima eficiencia
            const [health, production, financial] = await Promise.all([
                this.getHealthDashboard(filters),
                this.getProductionDashboard(filters),
                this.getFinancialDashboard(filters)
            ]);

            // Calcular resumen
            const summary = this.calculateSummary(health, production, financial);

            const duration = Date.now() - startTime;

            logger.info('Dashboard completo obtenido', this.context, {
                ranchId: filters.ranchId,
                durationMs: duration
            });

            return {
                health,
                production,
                financial,
                summary,
                generatedAt: new Date()
            };

        } catch (error) {
            logger.error('Error obteniendo dashboard completo', this.context, {
                filters
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene dashboard de salud
     */
    async getHealthDashboard(filters: DashboardFilters): Promise<HealthDashboard> {
        const startTime = Date.now();

        try {
            const { ranchId } = filters;

            // 1. Obtener estadísticas base de salud
            const healthStats = await bovineHealthService.getHerdHealthStats(ranchId);

            // 2. Obtener eventos de salud recientes (últimos 7 días)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const recentHealthEvents = await this.getRecentHealthEvents(ranchId, sevenDaysAgo);

            // 3. Obtener chequeos programados
            const upcomingChecks = await this.getUpcomingHealthChecks(ranchId);
            const overdueChecks = await this.getOverdueHealthChecks(ranchId);

            const duration = Date.now() - startTime;

            logger.debug('Dashboard de salud obtenido', this.context, {
                ranchId,
                totalBovines: healthStats.totalBovines,
                sickCount: healthStats.byStatus.SICK,
                durationMs: duration
            });

            return {
                ...healthStats,
                recentHealthEvents,
                upcomingHealthChecks: upcomingChecks,
                overdueHealthChecks: overdueChecks
            };

        } catch (error) {
            logger.error('Error obteniendo dashboard de salud', this.context, {
                filters
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene dashboard de producción
     */
    async getProductionDashboard(filters: DashboardFilters): Promise<ProductionDashboard> {
        const startTime = Date.now();

        try {
            const { ranchId, period = 'month' } = filters;

            // Determinar fechas del período
            const { startDate, endDate, previousStartDate, previousEndDate } =
                this.getPeriodDates(period, filters.startDate, filters.endDate);

            // 1. Obtener bovinos del rancho para contar vacas
            const bovines = await Bovine.findAll({
                where: { ranchId, isActive: true },
                attributes: ['id', 'cattleType']
            });
            const cowCount = bovines.filter(b => b.cattleType === 'COW').length;
            const totalBovines = bovines.length;

            // 2. Obtener producción del período actual (usando modelo Production directamente)
            const currentProduction = await Production.findAll({
                where: {
                    [Op.and]: [
                        literal(`bovine_id IN (SELECT id FROM bovines WHERE ranch_id = '${ranchId}')`),
                        {
                            productionDate: { [Op.between]: [startDate, endDate] }
                        }
                    ]
                }
            });

            // 3. Obtener producción del período anterior para comparación
            let previousProduction: Production[] = [];
            if (filters.compareWithPrevious && previousStartDate && previousEndDate) {
                previousProduction = await Production.findAll({
                    where: {
                        [Op.and]: [
                            literal(`bovine_id IN (SELECT id FROM bovines WHERE ranch_id = '${ranchId}')`),
                            {
                                productionDate: { [Op.between]: [previousStartDate, previousEndDate] }
                            }
                        ]
                    }
                });
            }

            // 4. Calcular métricas de leche
            const milkRecords = currentProduction.filter(p => p.productionType === ProductionType.MILK);
            const totalMilk = milkRecords.reduce((sum, p) => sum + p.quantity, 0);

            const previousMilkRecords = previousProduction.filter(p => p.productionType === ProductionType.MILK);
            const previousTotalMilk = previousMilkRecords.reduce((sum, p) => sum + p.quantity, 0);
            const milkVsLastPeriod = previousTotalMilk > 0
                ? ((totalMilk - previousTotalMilk) / previousTotalMilk) * 100
                : 0;

            // 5. Calcular métricas de carne
            const meatRecords = currentProduction.filter(p => p.productionType === ProductionType.MEAT);
            const totalMeat = meatRecords.reduce((sum, p) => sum + p.quantity, 0);

            const previousMeatRecords = previousProduction.filter(p => p.productionType === ProductionType.MEAT);
            const previousTotalMeat = previousMeatRecords.reduce((sum, p) => sum + p.quantity, 0);
            const meatVsLastPeriod = previousTotalMeat > 0
                ? ((totalMeat - previousTotalMeat) / previousTotalMeat) * 100
                : 0;

            // 6. Obtener tendencias (últimos 5 años)
            const trends = await ranchOperationsService.getProductionTrends(ranchId, 5);

            // 7. Obtener métricas de reproducción
            const reproductionMetrics = await this.getReproductionMetrics(ranchId, startDate, endDate);

            const duration = Date.now() - startTime;

            logger.debug('Dashboard de producción obtenido', this.context, {
                ranchId,
                totalMilk,
                totalMeat,
                cowCount,
                durationMs: duration
            });

            return {
                currentPeriod: { startDate, endDate },
                milkProduction: {
                    total: totalMilk,
                    averagePerCow: cowCount > 0 ? totalMilk / cowCount : 0,
                    vsLastPeriod: milkVsLastPeriod
                },
                meatProduction: {
                    total: totalMeat,
                    averagePerAnimal: totalBovines > 0 ? totalMeat / totalBovines : 0,
                    vsLastPeriod: meatVsLastPeriod
                },
                reproduction: {
                    calvingRate: reproductionMetrics.calvingRate,
                    conceptionRate: reproductionMetrics.conceptionRate,
                    birthsLastMonth: reproductionMetrics.birthsLastMonth,
                    expectedBirths: reproductionMetrics.expectedBirths
                },
                trends: {
                    milk: trends.milk,
                    meat: trends.meat,
                    years: trends.years
                }
            };

        } catch (error) {
            logger.error('Error obteniendo dashboard de producción', this.context, {
                filters
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene dashboard financiero
     */
    async getFinancialDashboard(filters: DashboardFilters): Promise<FinancialDashboard> {
        const startTime = Date.now();

        try {
            const { ranchId, period = 'month' } = filters;

            // Determinar fechas del período
            const { startDate, endDate, previousStartDate, previousEndDate } =
                this.getPeriodDates(period, filters.startDate, filters.endDate);

            // 1. Obtener resumen financiero del período actual
            const summary = await financeService.getFinancialSummary(ranchId, startDate, endDate);

            // 2. Obtener costos veterinarios
            const veterinaryCosts = await financeService.getVeterinaryCosts(ranchId, startDate, endDate);

            // 3. Obtener ROI
            const roiAnalysis = await financeService.getROIAnalysis(ranchId, startDate, endDate);

            // 4. Calcular tendencia de costos veterinarios
            let veterinaryTrend: 'INCREASING' | 'DECREASING' | 'STABLE' = 'STABLE';
            if (previousStartDate && previousEndDate) {
                const previousVetCosts = await financeService.getVeterinaryCosts(ranchId, previousStartDate, previousEndDate);
                if (veterinaryCosts.total > previousVetCosts.total * 1.1) {
                    veterinaryTrend = 'INCREASING';
                } else if (veterinaryCosts.total < previousVetCosts.total * 0.9) {
                    veterinaryTrend = 'DECREASING';
                }
            }

            // 5. Calcular porcentajes por categoría
            const totalIncome = summary.totals.income;
            const totalExpenses = summary.totals.expense;

            const incomeByCategory = Object.entries(summary.byCategory)
                .filter(([cat]) => this.isIncomeCategory(cat))
                .map(([category, amount]) => ({
                    category: this.getCategoryLabel(category),
                    amount,
                    percentage: totalIncome > 0 ? (amount / totalIncome) * 100 : 0
                }))
                .sort((a, b) => b.amount - a.amount);

            const expensesByCategory = Object.entries(summary.byCategory)
                .filter(([cat]) => this.isExpenseCategory(cat))
                .map(([category, amount]) => ({
                    category: this.getCategoryLabel(category),
                    amount,
                    percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
                }))
                .sort((a, b) => b.amount - a.amount);

            const duration = Date.now() - startTime;

            logger.debug('Dashboard financiero obtenido', this.context, {
                ranchId,
                income: totalIncome,
                expenses: totalExpenses,
                net: summary.totals.net,
                durationMs: duration
            });

            return {
                currentPeriod: { startDate, endDate },
                totals: {
                    income: totalIncome,
                    expenses: totalExpenses,
                    net: summary.totals.net,
                    profitMargin: totalIncome > 0 ? (summary.totals.net / totalIncome) * 100 : 0
                },
                byCategory: {
                    income: incomeByCategory,
                    expenses: expensesByCategory
                },
                veterinaryCosts: {
                    total: veterinaryCosts.total,
                    trend: veterinaryTrend,
                    percentageOfExpenses: totalExpenses > 0 ? (veterinaryCosts.total / totalExpenses) * 100 : 0
                },
                roi: roiAnalysis.roi
            };

        } catch (error) {
            logger.error('Error obteniendo dashboard financiero', this.context, {
                filters
            }, ensureError(error));
            throw error;
        }
    }

    // ==========================================================================
    // MÉTODOS AUXILIARES
    // ==========================================================================

    /**
     * Obtiene eventos de salud recientes
     */
    private async getRecentHealthEvents(
        ranchId: string,
        since: Date
    ): Promise<HealthDashboard['recentHealthEvents']> {
        try {
            const users = await sequelize.query(`
            SELECT id FROM users 
            WHERE is_active = true 
            AND status = 'ACTIVE'
            AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(ranch_access) AS access
                WHERE access->>'ranchId' = :ranchId 
                AND (access->>'isActive')::boolean = true
            )
        `, {
                replacements: { ranchId },
                type: QueryTypes.SELECT
            });

            const userIds = (users as any[]).map(u => u.id);

            if (userIds.length === 0) return [];

            const notifications = await notificationService?.listNotifications({
                userId: { [Op.in]: userIds } as any,
                type: [NotificationType.HEALTH_ALERT, NotificationType.PRODUCTION_ALERT],
                startDate: since,
                limit: 10
            });

            if (!notifications) return [];

            return notifications.rows.map(n => ({
                id: n.id,
                date: n.createdAt,
                type: n.type,
                bovineId: n.metadata?.bovineId || 'unknown',
                bovineEarTag: n.metadata?.bovineEarTag,
                description: n.content,
                severity: this.mapPriorityToSeverity(n.priority)
            }));

        } catch (error) {
            logger.error('Error obteniendo dashboard completo', this.context, {
                ranchId,
                since
            }, ensureError(error));
            return [];
        }
    }

    /**
     * Obtiene cantidad de chequeos de salud próximos
     */
    private async getUpcomingHealthChecks(ranchId: string): Promise<number> {
        try {
            const events = await eventService.getUpcomingEvents(ranchId, 7);
            return events.filter(e => e.eventType === 'HEALTH_CHECK').length;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Obtiene cantidad de chequeos de salud atrasados
     */
    private async getOverdueHealthChecks(ranchId: string): Promise<number> {
        try {
            const events = await eventService.getOverdueEvents(ranchId);
            return events.filter(e => e.eventType === 'HEALTH_CHECK').length;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Obtiene métricas de reproducción
     */
    /**
     * Obtiene métricas de reproducción reales desde ReproductionService.
     *
     * Consultas que ejecuta:
     * 1. conceptionRate: inseminaciones vs preñeces confirmadas en el período
     * 2. birthsLastMonth: eventos con status CALVED en los últimos 30 días
     * 3. expectedBirths: preñeces confirmadas sin parto (todavía gestando)
     * 4. calvingRate: partos / total vacas activas del rancho
     */
    private async getReproductionMetrics(
        ranchId: string,
        startDate: Date,
        endDate: Date
    ): Promise<{
        calvingRate: number;
        conceptionRate: number;
        birthsLastMonth: number;
        expectedBirths: number;
    }> {
        const defaults = {
            calvingRate: 0,
            conceptionRate: 0,
            birthsLastMonth: 0,
            expectedBirths: 0
        };

        try {
            // ── 1. Tasa de concepción ───────────────────────────────
            // Usa el método existente de ReproductionService que calcula
            // inseminaciones vs preñeces confirmadas en el rango de fechas.
            const conceptionRate = await reproductionService.getConceptionRate(
                ranchId, startDate, endDate
            );

            // ── 2. Nacimientos del último mes ───────────────────────
            // Buscar eventos con status CALVED en los últimos 30 días.
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const recentEvents = await reproductionService.getEventsByRanch(ranchId, {
                startDate: thirtyDaysAgo,
                endDate: new Date(),
                limit: 10000
            });
            const birthsLastMonth = recentEvents.rows.filter(
                e => e.status === ServiceStatus.CALVED
            ).length;

            // ── 3. Partos esperados ─────────────────────────────────
            // Preñeces confirmadas que aún no han parido.
            const allActiveEvents = await reproductionService.getEventsByRanch(ranchId, {
                limit: 10000
            });
            const expectedBirths = allActiveEvents.rows.filter(
                e => e.status === ServiceStatus.CONFIRMED_PREGNANT
            ).length;

            // ── 4. Tasa de partos ───────────────────────────────────
            // Partos en el período / total de vacas activas del rancho.
            const birthsInPeriod = recentEvents.rows.filter(
                e => e.status === ServiceStatus.CALVED
            ).length;

            const cowCount = await Bovine.count({
                where: {
                    ranchId,
                    isActive: true,
                    cattleType: 'COW'
                }
            });

            const calvingRate = cowCount > 0
                ? (birthsInPeriod / cowCount) * 100
                : 0;

            logger.debug('Métricas de reproducción calculadas', this.context, {
                ranchId,
                conceptionRate,
                birthsLastMonth,
                expectedBirths,
                calvingRate,
                cowCount
            });

            return {
                calvingRate: Math.round(calvingRate * 100) / 100,
                conceptionRate: Math.round(conceptionRate * 100) / 100,
                birthsLastMonth,
                expectedBirths
            };

        } catch (error) {
            logger.error('Error calculando métricas de reproducción', this.context, {
                ranchId, startDate, endDate
            }, ensureError(error));
            return defaults;
        }
    }

    /**
     * Calcula resumen del dashboard
     */
    private calculateSummary(
        health: HealthDashboard,
        production: ProductionDashboard,
        financial: FinancialDashboard
    ): DashboardSummary {
        return {
            totalBovines: health.totalBovines,
            activeAlerts: health.byStatus.SICK + health.byStatus.QUARANTINE,
            pendingTasks: health.upcomingHealthChecks + health.overdueHealthChecks,
            unreadNotifications: 0,
            criticalHealthIssues: health.byStatus.QUARANTINE,
            lowStockItems: 0
        };
    }

    /**
     * Determina fechas del período
     */
    private getPeriodDates(
        period: string,
        customStartDate?: Date,
        customEndDate?: Date
    ): {
        startDate: Date;
        endDate: Date;
        previousStartDate?: Date;
        previousEndDate?: Date;
    } {
        const endDate = customEndDate || new Date();
        let startDate: Date;

        if (customStartDate) {
            startDate = customStartDate;
        } else {
            startDate = new Date(endDate);
            switch (period) {
                case 'day':
                    startDate.setDate(startDate.getDate() - 1);
                    break;
                case 'week':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'month':
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                case 'quarter':
                    startDate.setMonth(startDate.getMonth() - 3);
                    break;
                case 'year':
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    break;
                default:
                    startDate.setDate(startDate.getDate() - 30);
            }
        }

        // Calcular período anterior para comparación
        const duration = endDate.getTime() - startDate.getTime();
        const previousStartDate = new Date(startDate.getTime() - duration);
        const previousEndDate = new Date(startDate.getTime());

        return {
            startDate,
            endDate,
            previousStartDate,
            previousEndDate
        };
    }

    /**
     * Mapea prioridad a severidad
     */
    private mapPriorityToSeverity(priority: NotificationPriority): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
        const map: Record<NotificationPriority, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
            [NotificationPriority.LOW]: 'LOW',
            [NotificationPriority.MEDIUM]: 'MEDIUM',
            [NotificationPriority.HIGH]: 'HIGH',
            [NotificationPriority.URGENT]: 'CRITICAL'
        };
        return map[priority] || 'MEDIUM';
    }

    /**
     * Verifica si una categoría es de ingresos
     */
    private isIncomeCategory(category: string): boolean {
        const incomeCategories = [
            'CATTLE_SALE', 'MILK_PRODUCTION', 'MEAT_PRODUCTION',
            'BREEDING_SERVICES', 'RENTAL_INCOME', 'GOVERNMENT_SUBSIDIES',
            'INSURANCE_CLAIMS', 'CONSULTATION_SERVICES', 'EQUIPMENT_SALE',
            'OTHER_INCOME'
        ];
        return incomeCategories.includes(category);
    }

    /**
     * Verifica si una categoría es de gastos
     */
    private isExpenseCategory(category: string): boolean {
        const expenseCategories = [
            'FEED_PURCHASE', 'VETERINARY_SERVICES', 'MEDICATION',
            'VACCINATION', 'CATTLE_PURCHASE', 'EQUIPMENT_PURCHASE',
            'FACILITY_MAINTENANCE', 'LABOR_COSTS', 'UTILITIES',
            'FUEL_COSTS', 'INSURANCE_PREMIUMS', 'TRANSPORTATION',
            'PROPERTY_TAXES', 'LICENSING_FEES', 'PROFESSIONAL_SERVICES',
            'MARKETING_ADVERTISING', 'OFFICE_SUPPLIES', 'TECHNOLOGY_SOFTWARE',
            'RESEARCH_DEVELOPMENT', 'OTHER_EXPENSES'
        ];
        return expenseCategories.includes(category);
    }

    /**
     * Obtiene etiqueta legible de categoría
     */
    private getCategoryLabel(category: string): string {
        const labels: Record<string, string> = {
            // Ingresos
            'CATTLE_SALE': 'Venta de Ganado',
            'MILK_PRODUCTION': 'Producción de Leche',
            'MEAT_PRODUCTION': 'Producción de Carne',
            'BREEDING_SERVICES': 'Servicios de Reproducción',
            'RENTAL_INCOME': 'Ingresos por Alquiler',
            'GOVERNMENT_SUBSIDIES': 'Subsidios Gubernamentales',
            'INSURANCE_CLAIMS': 'Reclamaciones de Seguro',
            'CONSULTATION_SERVICES': 'Servicios de Consultoría',
            'EQUIPMENT_SALE': 'Venta de Equipo',
            'OTHER_INCOME': 'Otros Ingresos',

            // Gastos
            'FEED_PURCHASE': 'Compra de Alimento',
            'VETERINARY_SERVICES': 'Servicios Veterinarios',
            'MEDICATION': 'Medicamentos',
            'VACCINATION': 'Vacunaciones',
            'CATTLE_PURCHASE': 'Compra de Ganado',
            'EQUIPMENT_PURCHASE': 'Compra de Equipo',
            'FACILITY_MAINTENANCE': 'Mantenimiento',
            'LABOR_COSTS': 'Mano de Obra',
            'UTILITIES': 'Servicios Públicos',
            'FUEL_COSTS': 'Combustible',
            'INSURANCE_PREMIUMS': 'Seguros',
            'TRANSPORTATION': 'Transporte',
            'PROPERTY_TAXES': 'Impuestos',
            'LICENSING_FEES': 'Licencias',
            'PROFESSIONAL_SERVICES': 'Servicios Profesionales',
            'MARKETING_ADVERTISING': 'Marketing',
            'OFFICE_SUPPLIES': 'Suministros',
            'TECHNOLOGY_SOFTWARE': 'Tecnología',
            'RESEARCH_DEVELOPMENT': 'I+D',
            'OTHER_EXPENSES': 'Otros Gastos'
        };
        return labels[category] || category;
    }

    // ==========================================================================
    // DASHBOARD POR ROL
    // ==========================================================================

    /**
     * Obtiene el dashboard filtrado según el rol del usuario.
     *
     * Estrategia: ejecuta en paralelo SOLO las queries que el rol necesita.
     * Roles con `finance: NONE` nunca disparan getFinancialDashboard(),
     * ahorrando queries a la BD.
     *
     * @param filters - Filtros estándar (ranchId, period, etc.)
     * @param user    - Usuario autenticado (se lee role, id, ranchAccess)
     */
    async getRoleDashboard(
        filters: DashboardFilters,
        user: { id: string; role: UserRole; ranchAccess?: Array<{ ranchId: string; ranchName: string; isActive: boolean }> }
    ): Promise<RoleDashboard> {
        const startTime = Date.now();
        const { role } = user;

        try {
            logger.info('Obteniendo dashboard por rol', this.context, {
                ranchId: filters.ranchId,
                role,
                userId: user.id
            });

            const result: RoleDashboard = {
                role,
                summary: {
                    totalBovines: 0,
                    activeAlerts: 0,
                    pendingTasks: 0,
                    unreadNotifications: 0,
                    criticalHealthIssues: 0,
                    lowStockItems: 0
                },
                generatedAt: new Date()
            };

            // ── Determinar qué secciones necesita este rol ──────────────
            const needsFullHealth = [
                UserRole.SUPER_ADMIN, UserRole.OWNER,
                UserRole.RANCH_MANAGER, UserRole.VETERINARIAN
            ].includes(role);

            const needsFullProduction = [
                UserRole.SUPER_ADMIN, UserRole.OWNER,
                UserRole.RANCH_MANAGER, UserRole.MANAGER
            ].includes(role);

            const needsFullFinancial = [
                UserRole.SUPER_ADMIN, UserRole.OWNER
            ].includes(role);

            const needsLightFinancial = [
                UserRole.RANCH_MANAGER, UserRole.MANAGER
            ].includes(role);

            const needsUsers = [
                UserRole.SUPER_ADMIN, UserRole.OWNER
            ].includes(role);

            const needsSystem = role === UserRole.SUPER_ADMIN;

            // ── Ejecutar queries en paralelo según necesidad ────────────
            const promises: Promise<any>[] = [];
            const promiseKeys: string[] = [];

            // Health: siempre se consulta (todos los roles ven al menos un resumen)
            promises.push(this.getHealthDashboard(filters));
            promiseKeys.push('health');

            // Production: completo o light
            if (needsFullProduction) {
                promises.push(this.getProductionDashboard(filters));
                promiseKeys.push('production');
            } else {
                promises.push(this.getProductionLight(filters));
                promiseKeys.push('productionLight');
            }

            // Financial: completo, light, o nada
            if (needsFullFinancial) {
                promises.push(this.getFinancialDashboard(filters));
                promiseKeys.push('financial');
            } else if (needsLightFinancial) {
                promises.push(this.getFinancialLight(filters));
                promiseKeys.push('financialLight');
            }

            // Users: SUPER_ADMIN o OWNER
            if (needsUsers) {
                if (role === UserRole.SUPER_ADMIN) {
                    promises.push(this.getUsersGroupedByRanch());
                    promiseKeys.push('usersGrouped');
                } else {
                    // OWNER: usuarios de su(s) rancho(s)
                    const ownerRanchIds = user.ranchAccess
                        ?.filter(a => a.isActive)
                        .map(a => a.ranchId) || [filters.ranchId];
                    promises.push(this.getUsersForOwner(ownerRanchIds));
                    promiseKeys.push('usersForOwner');
                }
            }

            // System: solo SUPER_ADMIN
            if (needsSystem) {
                promises.push(this.getSystemMetrics());
                promiseKeys.push('system');
            }

            // ── Esperar todas las queries ────────────────────────────────
            const results = await Promise.all(promises);

            // ── Mapear resultados a la estructura del dashboard ──────────
            for (let i = 0; i < promiseKeys.length; i++) {
                const key = promiseKeys[i];
                const data = results[i];

                switch (key) {
                    case 'health':
                        if (needsFullHealth) {
                            result.health = data as HealthDashboard;
                        } else {
                            // Roles con health limitado: extraer solo conteos
                            const full = data as HealthDashboard;
                            result.healthLight = {
                                totalBovines: full.totalBovines,
                                healthy: full.byStatus.HEALTHY,
                                sick: full.byStatus.SICK,
                                recovering: full.byStatus.RECOVERING,
                                quarantine: full.byStatus.QUARANTINE,
                                criticalCount: full.criticalCount
                            };
                        }
                        break;

                    case 'production':
                        result.production = data as ProductionDashboard;
                        break;

                    case 'productionLight':
                        result.productionLight = data as ProductionSummaryLight;
                        break;

                    case 'financial':
                        result.financial = data as FinancialDashboard;
                        break;

                    case 'financialLight':
                        result.financialLight = data as FinancialSummaryLight;
                        break;

                    case 'usersGrouped':
                        result.usersGrouped = data as UsersGroupedByRanch[];
                        break;

                    case 'usersForOwner':
                        result.usersForOwner = data as UsersForOwner;
                        break;

                    case 'system':
                        result.system = data as SystemMetrics;
                        break;
                }
            }

            // ── Calcular summary adaptado al rol ────────────────────────
            const healthData = result.health || null;
            const healthLightData = result.healthLight || null;

            result.summary = {
                totalBovines: healthData?.totalBovines ?? healthLightData?.totalBovines ?? 0,
                activeAlerts: healthData
                    ? (healthData.byStatus.SICK + healthData.byStatus.QUARANTINE)
                    : (healthLightData ? healthLightData.sick + healthLightData.quarantine : 0),
                pendingTasks: healthData
                    ? (healthData.upcomingHealthChecks + healthData.overdueHealthChecks)
                    : 0,
                unreadNotifications: 0,
                criticalHealthIssues: healthData?.criticalCount ?? healthLightData?.criticalCount ?? 0,
                lowStockItems: 0
            };

            const duration = Date.now() - startTime;

            logger.info('Dashboard por rol generado', this.context, {
                role,
                userId: user.id,
                sections: promiseKeys,
                durationMs: duration
            });

            return result;

        } catch (error) {
            logger.error('Error obteniendo dashboard por rol', this.context, {
                filters, role, userId: user.id
            }, ensureError(error));
            throw error;
        }
    }

    // ==========================================================================
    // MÉTODOS AUXILIARES PARA DASHBOARD POR ROL
    // ==========================================================================

    /**
     * Producción resumida: solo totales de leche y carne del período.
     * Para VET, WORKER, VIEWER.
     */
    private async getProductionLight(filters: DashboardFilters): Promise<ProductionSummaryLight> {
        try {
            const { ranchId, period = 'month' } = filters;
            const { startDate, endDate } = this.getPeriodDates(period, filters.startDate, filters.endDate);

            const currentProduction = await Production.findAll({
                where: {
                    [Op.and]: [
                        literal(`bovine_id IN (SELECT id FROM bovines WHERE ranch_id = '${ranchId}')`),
                        { productionDate: { [Op.between]: [startDate, endDate] } }
                    ]
                }
            });

            const milkTotal = currentProduction
                .filter(p => p.productionType === ProductionType.MILK)
                .reduce((sum, p) => sum + p.quantity, 0);

            const meatTotal = currentProduction
                .filter(p => p.productionType === ProductionType.MEAT)
                .reduce((sum, p) => sum + p.quantity, 0);

            return {
                currentPeriod: { startDate, endDate },
                milkTotal,
                meatTotal
            };

        } catch (error) {
            logger.error('Error en getProductionLight', this.context, { filters }, ensureError(error));
            return {
                currentPeriod: { startDate: new Date(), endDate: new Date() },
                milkTotal: 0,
                meatTotal: 0
            };
        }
    }

    /**
     * Finanzas resumidas: solo totales.
     * Para RANCH_MANAGER, MANAGER.
     */
    private async getFinancialLight(filters: DashboardFilters): Promise<FinancialSummaryLight> {
        try {
            const { ranchId, period = 'month' } = filters;
            const { startDate, endDate } = this.getPeriodDates(period, filters.startDate, filters.endDate);

            const summary = await financeService.getFinancialSummary(ranchId, startDate, endDate);

            return {
                currentPeriod: { startDate, endDate },
                income: summary.totals.income,
                expenses: summary.totals.expense,
                net: summary.totals.net
            };

        } catch (error) {
            logger.error('Error en getFinancialLight', this.context, { filters }, ensureError(error));
            return {
                currentPeriod: { startDate: new Date(), endDate: new Date() },
                income: 0,
                expenses: 0,
                net: 0
            };
        }
    }

    /**
     * Usuarios agrupados por rancho (SUPER_ADMIN).
     * Consulta todos los ranchos y agrupa los usuarios por cada uno.
     */
    private async getUsersGroupedByRanch(): Promise<UsersGroupedByRanch[]> {
        try {
            const ranches = await Ranch.findAll({
                attributes: ['id', 'name'],
                where: { isActive: true }
            });

            const allUsers = await User.findAll({
                attributes: [
                    'id', 'email', 'username', 'role', 'status',
                    'isActive', 'emailVerified', 'lastLoginAt',
                    'created_at', 'personalInfo', 'ranchAccess'
                ]
            });

            const result: UsersGroupedByRanch[] = ranches.map(ranch => {
                // Filtrar usuarios que tienen acceso activo a este rancho
                const ranchUsers = allUsers.filter(u =>
                    u.ranchAccess?.some(a => a.ranchId === ranch.id && a.isActive)
                );

                const byRole: Record<string, number> = {};
                let active = 0;
                let pending = 0;
                let inactive = 0;

                const users: UserSummaryItem[] = ranchUsers.map(u => {
                    // Contar por rol
                    byRole[u.role] = (byRole[u.role] || 0) + 1;

                    // Contar por estado
                    if (u.status === UserStatus.ACTIVE && u.isActive) active++;
                    else if (u.status === UserStatus.PENDING_VERIFICATION) pending++;
                    else inactive++;

                    return {
                        id: u.id,
                        email: u.email,
                        fullName: u.getFullName(),
                        role: u.role,
                        status: u.status,
                        isActive: u.isActive,
                        emailVerified: u.emailVerified,
                        lastLoginAt: u.lastLoginAt,
                        createdAt: u.createdAt
                    };
                });

                return {
                    ranchId: ranch.id,
                    ranchName: ranch.name,
                    totalUsers: ranchUsers.length,
                    active,
                    pending,
                    inactive,
                    byRole,
                    users
                };
            });

            return result;

        } catch (error) {
            logger.error('Error en getUsersGroupedByRanch', this.context, {}, ensureError(error));
            return [];
        }
    }

    /**
     * Usuarios del/los rancho(s) del OWNER.
     * Recibe los ranchIds activos del owner y agrupa los usuarios.
     */
    private async getUsersForOwner(ranchIds: string[]): Promise<UsersForOwner> {
        try {
            // Si el OWNER tiene múltiples ranchos, usamos el primero como principal
            // (en futuro se puede extender a multi-rancho)
            const primaryRanchId = ranchIds[0];

            const ranch = await Ranch.findByPk(primaryRanchId, {
                attributes: ['id', 'name']
            });

            const allUsers = await User.findAll({
                attributes: [
                    'id', 'email', 'username', 'role', 'status',
                    'isActive', 'emailVerified', 'lastLoginAt',
                    'created_at', 'personalInfo', 'ranchAccess'
                ]
            });

            // Filtrar usuarios con acceso activo a alguno de los ranchos del owner
            const ranchUsers = allUsers.filter(u =>
                u.ranchAccess?.some(a => ranchIds.includes(a.ranchId) && a.isActive)
            );

            const byRole: Record<string, number> = {};
            let active = 0;
            let pending = 0;
            let inactive = 0;

            const users: UserSummaryItem[] = ranchUsers.map(u => {
                byRole[u.role] = (byRole[u.role] || 0) + 1;

                if (u.status === UserStatus.ACTIVE && u.isActive) active++;
                else if (u.status === UserStatus.PENDING_VERIFICATION) pending++;
                else inactive++;

                return {
                    id: u.id,
                    email: u.email,
                    fullName: u.getFullName(),
                    role: u.role,
                    status: u.status,
                    isActive: u.isActive,
                    emailVerified: u.emailVerified,
                    lastLoginAt: u.lastLoginAt,
                    createdAt: u.createdAt
                };
            });

            // Último registrado
            const sortedByDate = [...users].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            return {
                ranchId: primaryRanchId,
                ranchName: ranch?.name || 'Rancho',
                totalUsers: ranchUsers.length,
                active,
                pending,
                inactive,
                byRole,
                users,
                lastRegistered: sortedByDate[0] || undefined
            };

        } catch (error) {
            logger.error('Error en getUsersForOwner', this.context, { ranchIds }, ensureError(error));
            return {
                ranchId: ranchIds[0] || '',
                ranchName: 'Error',
                totalUsers: 0,
                active: 0,
                pending: 0,
                inactive: 0,
                byRole: {},
                users: []
            };
        }
    }

    /**
     * Métricas de sistema (SUPER_ADMIN).
     * Datos de la plataforma: usuarios totales, ranchos, eventos de seguridad.
     */
    private async getSystemMetrics(): Promise<SystemMetrics> {
        try {
            // Ejecutar consultas en paralelo
            const [
                totalUsers,
                totalRanches,
                activeUsers,
                pendingUsers,
                inactiveUsers,
                recentEvents,
                criticalEvents,
                failedLogins,
                lockedAccounts
            ] = await Promise.all([
                // Total usuarios
                User.count(),
                // Total ranchos activos
                Ranch.count({ where: { isActive: true } }),
                // Usuarios activos
                User.count({ where: { isActive: true, status: UserStatus.ACTIVE } }),
                // Usuarios pendientes de verificación
                User.count({ where: { status: UserStatus.PENDING_VERIFICATION } }),
                // Usuarios inactivos
                User.count({ where: { isActive: false } }),
                // Eventos de seguridad recientes (últimos 7 días, máximo 10)
                SecurityEvent.findAll({
                    where: {
                        created_at: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                    },
                    order: [['created_at', 'DESC']],
                    limit: 10,
                    attributes: ['id', 'event_type', 'severity', 'description', 'created_at']
                }),
                // Eventos críticos últimos 7 días
                SecurityEvent.count({
                    where: {
                        severity: EventSeverity.CRITICAL,
                        created_at: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                    }
                }),
                // Logins fallidos últimas 24h
                SecurityEvent.count({
                    where: {
                        event_type: 'LOGIN_FAILED',
                        created_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                    }
                }),
                // Cuentas bloqueadas actualmente
                User.count({ where: { status: UserStatus.BLOCKED } })
            ]);

            return {
                totalUsers,
                totalRanches,
                usersActive: activeUsers,
                usersPendingVerification: pendingUsers,
                usersInactive: inactiveUsers,
                recentSecurityEvents: recentEvents.map(e => ({
                    id: e.id,
                    eventType: e.event_type,
                    severity: e.severity,
                    description: e.description,
                    createdAt: e.created_at
                })),
                securitySummary: {
                    criticalLast7Days: criticalEvents,
                    failedLoginsLast24h: failedLogins,
                    lockedAccounts: lockedAccounts
                }
            };

        } catch (error) {
            logger.error('Error en getSystemMetrics', this.context, {}, ensureError(error));
            return {
                totalUsers: 0,
                totalRanches: 0,
                usersActive: 0,
                usersPendingVerification: 0,
                usersInactive: 0,
                recentSecurityEvents: [],
                securitySummary: {
                    criticalLast7Days: 0,
                    failedLoginsLast24h: 0,
                    lockedAccounts: 0
                }
            };
        }
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const dashboardService = new DashboardService();