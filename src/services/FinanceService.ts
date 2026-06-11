// src/services/FinanceService.ts
import { Op, Transaction, WhereOptions, Order } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import { ValidationError } from '../utils/errorUtils';
import Finance, {
    FinanceAttributes,
    FinanceCreationAttributes,
    TransactionType,
    IncomeCategory,
    ExpenseCategory,
    TransactionStatus,
    PaymentMethod,
} from '../models/Finance';
import Bovine from '../models/Bovine';
import { ensureError } from '../utils/errorUtils';

// ============================================================================
// DTOs y filtros
// ============================================================================

export interface CreateTransactionDTO {
    transactionType: TransactionType;
    category: IncomeCategory | ExpenseCategory;
    title: string;
    description?: string;
    amount: number;
    currency?: string;
    paymentMethod: PaymentMethod;
    status?: TransactionStatus;
    transactionDate: Date;
    dueDate?: Date;
    location?: any;
    bovineId?: string;
    eventId?: string;
    ranchId: string;
    contactInfo?: any;
    invoiceInfo?: any;
    budgetInfo?: any;
    tags?: string[];
    attachments?: string[];
    notes?: string;
}

export interface UpdateTransactionDTO extends Partial<CreateTransactionDTO> {
    id: string;
}

export interface TransactionFilters {
    ranchId?: string;
    bovineId?: string;
    eventId?: string;
    transactionType?: TransactionType;
    category?: string;
    status?: TransactionStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
}

export interface FinancialSummary {
    period: { startDate: Date; endDate: Date };
    totals: {
        income: number;
        expense: number;
        net: number;
    };
    byCategory: {
        [category: string]: number;
    };
    byType: {
        [TransactionType.INCOME]: number;
        [TransactionType.EXPENSE]: number;
    };
}

export interface VeterinaryCosts {
    total: number;
    byCategory: Record<string, number>;
    byBovine: Array<{ bovineId: string; earTag?: string; total: number }>;
    monthlyTrend: Array<{ month: string; amount: number }>;
}

export interface ROIAnalysis {
    period: { startDate: Date; endDate: Date };
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    roi: number; // (netProfit / totalExpenses) * 100 or something similar
    breakdown: {
        incomeByCategory: Record<string, number>;
        expensesByCategory: Record<string, number>;
    };
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class FinanceService {
    private readonly context = 'FinanceService';

    constructor(
        private financeModel: typeof Finance,
        private bovineModel: typeof Bovine,
        private notificationService?: any // opcional
    ) { }

    // ==========================================================================
    // CRUD
    // ==========================================================================

    /**
     * Crea una nueva transacción financiera.
     */
    async createTransaction(
        data: CreateTransactionDTO,
        userId: string,
        transaction?: Transaction
    ): Promise<Finance> {
        const t = transaction || await sequelize.transaction();
        const isOwnTransaction = !transaction;
        const startTime = Date.now();

        try {
            // Validar campos requeridos
            if (!data.ranchId) throw new ValidationError('ranchId es requerido');
            if (!data.transactionType) throw new ValidationError('transactionType es requerido');
            if (!data.category) throw new ValidationError('category es requerido');
            if (!data.amount || data.amount <= 0) throw new ValidationError('amount debe ser mayor a 0');
            if (!data.transactionDate) throw new ValidationError('transactionDate es requerido');

            // Si se proporciona bovineId, verificar que existe
            if (data.bovineId) {
                const bovine = await this.bovineModel.findByPk(data.bovineId, { transaction: t });
                if (!bovine) throw new ValidationError(`Bovino con ID ${data.bovineId} no encontrado`);
            }

            const transactionData: Omit<FinanceCreationAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> = {
                ...data,
                currency: data.currency || 'MXN',
                status: data.status || TransactionStatus.PENDING,
                createdBy: userId,
                isActive: true,
                isRecurring: false,
                isApproved: false,
            };

            const finance = await this.financeModel.create(transactionData as any, { transaction: t });

            if (isOwnTransaction) await t.commit();

            logger.info(`Transacción creada: ${finance.id}`, this.context, {
                transactionId: finance.id,
                amount: finance.amount,
                type: finance.transactionType,
                userId,
                durationMs: Date.now() - startTime,
            });

            return finance;
        } catch (error) {
            if (isOwnTransaction) await t.rollback();
            logger.error('Error creando transacción', this.context, { data }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene una transacción por ID.
     */
    async getTransactionById(id: string): Promise<Finance | null> {
        return await this.financeModel.findByPk(id);
    }

    /**
     * Lista transacciones según filtros.
     */
    async getTransactions(filters: TransactionFilters): Promise<{ rows: Finance[]; count: number }> {
        try {
            const where: WhereOptions = {};

            if (filters.ranchId) where.ranchId = filters.ranchId;
            if (filters.bovineId) where.bovineId = filters.bovineId;
            if (filters.eventId) where.eventId = filters.eventId;
            if (filters.transactionType) where.transactionType = filters.transactionType;
            if (filters.category) where.category = filters.category;
            if (filters.status) where.status = filters.status;
            if (filters.startDate || filters.endDate) {
                where.transactionDate = {};
                if (filters.startDate) where.transactionDate[Op.gte] = filters.startDate;
                if (filters.endDate) where.transactionDate[Op.lte] = filters.endDate;
            }

            const limit = filters.limit || 50;
            const offset = filters.offset || 0;
            let order: any = [['transactionDate', 'DESC']];
            if (filters.orderBy) {
                order = [[filters.orderBy, filters.orderDirection || 'DESC']];
            }

            const { rows, count } = await this.financeModel.findAndCountAll({
                where,
                limit,
                offset,
                order,
            });

            return { rows, count };
        } catch (error) {
            logger.error('Error listando transacciones', this.context, { filters }, ensureError(error));
            throw error;
        }
    }

    /**
     * Actualiza una transacción existente.
     */
    async updateTransaction(
        id: string,
        data: UpdateTransactionDTO,
        userId: string,
        transaction?: Transaction
    ): Promise<Finance> {
        const t = transaction || await sequelize.transaction();
        const isOwnTransaction = !transaction;
        const startTime = Date.now();

        try {
            const finance = await this.financeModel.findByPk(id, { transaction: t });
            if (!finance) throw new ValidationError(`Transacción con ID ${id} no encontrada`);

            // Si se actualiza bovineId, validar existencia
            if (data.bovineId && data.bovineId !== finance.bovineId) {
                const bovine = await this.bovineModel.findByPk(data.bovineId, { transaction: t });
                if (!bovine) throw new ValidationError(`Bovino con ID ${data.bovineId} no encontrado`);
            }

            await finance.update({ ...data, updatedBy: userId }, { transaction: t });

            if (isOwnTransaction) await t.commit();

            logger.info(`Transacción actualizada: ${id}`, this.context, {
                transactionId: id,
                userId,
                durationMs: Date.now() - startTime,
            });

            return finance;
        } catch (error) {
            if (isOwnTransaction) await t.rollback();
            logger.error(`Error actualizando transacción ${id}`, this.context, { data }, ensureError(error));
            throw error;
        }
    }

    /**
     * Elimina (soft delete) una transacción.
     */
    async deleteTransaction(id: string, userId: string, transaction?: Transaction): Promise<void> {
        const t = transaction || await sequelize.transaction();
        const isOwnTransaction = !transaction;
        const startTime = Date.now();

        try {
            const finance = await this.financeModel.findByPk(id, { transaction: t });
            if (!finance) throw new ValidationError(`Transacción con ID ${id} no encontrada`);

            await finance.destroy({ transaction: t });

            if (isOwnTransaction) await t.commit();

            logger.info(`Transacción eliminada: ${id}`, this.context, {
                transactionId: id,
                userId,
                durationMs: Date.now() - startTime,
            });
        } catch (error) {
            if (isOwnTransaction) await t.rollback();
            logger.error(`Error eliminando transacción ${id}`, this.context, { id }, ensureError(error));
            throw error;
        }
    }

    // ==========================================================================
    // MÉTRICAS Y REPORTES
    // ==========================================================================

    /**
     * Obtiene un resumen financiero para un rancho en un período.
     */
    async getFinancialSummary(
        ranchId: string,
        startDate: Date,
        endDate: Date
    ): Promise<FinancialSummary> {
        try {
            const where: WhereOptions = {
                ranchId,
                transactionDate: { [Op.between]: [startDate, endDate] },
            };

            const transactions = await this.financeModel.findAll({ where });

            let totalIncome = 0;
            let totalExpense = 0;
            const byCategory: Record<string, number> = {};

            for (const t of transactions) {
                if (t.transactionType === TransactionType.INCOME) {
                    totalIncome += t.amount;
                } else if (t.transactionType === TransactionType.EXPENSE) {
                    totalExpense += t.amount;
                }
                // Agrupar por categoría (puede ser income o expense)
                const cat = t.category;
                byCategory[cat] = (byCategory[cat] || 0) + t.amount;
            }

            return {
                period: { startDate, endDate },
                totals: {
                    income: totalIncome,
                    expense: totalExpense,
                    net: totalIncome - totalExpense,
                },
                byCategory,
                byType: {
                    [TransactionType.INCOME]: totalIncome,
                    [TransactionType.EXPENSE]: totalExpense,
                },
            };
        } catch (error) {
            logger.error('Error obteniendo resumen financiero', this.context, { ranchId, startDate, endDate }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene los costos veterinarios para un rancho en un período.
     * Asume que las categorías de gastos veterinarios son: ExpenseCategory.VETERINARY_SERVICES,
     * ExpenseCategory.MEDICATION, ExpenseCategory.VACCINATION, etc.
     */
    async getVeterinaryCosts(
        ranchId: string,
        startDate: Date,
        endDate: Date
    ): Promise<VeterinaryCosts> {
        try {
            const veterinaryCategories = [
                ExpenseCategory.VETERINARY_SERVICES,
                ExpenseCategory.MEDICATION,
                ExpenseCategory.VACCINATION,
            ];

            const where: WhereOptions = {
                ranchId,
                transactionType: TransactionType.EXPENSE,
                category: { [Op.in]: veterinaryCategories },
                transactionDate: { [Op.between]: [startDate, endDate] },
            };

            const transactions = await this.financeModel.findAll({
                where,
                include: [{ model: this.bovineModel, as: 'bovine', attributes: ['earTag', 'name'] }],
            });

            let total = 0;
            const byCategory: Record<string, number> = {};
            const byBovineMap = new Map<string, { bovineId: string; earTag?: string; total: number }>();

            for (const t of transactions) {
                total += t.amount;
                byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;

                if (t.bovineId) {
                    const existing = byBovineMap.get(t.bovineId);
                    if (existing) {
                        existing.total += t.amount;
                    } else {
                        byBovineMap.set(t.bovineId, {
                            bovineId: t.bovineId,
                            earTag: (t as any).bovine?.earTag,
                            total: t.amount,
                        });
                    }
                }
            }

            const byBovine = Array.from(byBovineMap.values()).sort((a, b) => b.total - a.total);

            // Tendencia mensual
            const monthlyTrend = await this.getMonthlyTrend(ranchId, startDate, endDate, veterinaryCategories);

            return {
                total,
                byCategory,
                byBovine,
                monthlyTrend,
            };
        } catch (error) {
            logger.error('Error obteniendo costos veterinarios', this.context, { ranchId, startDate, endDate }, ensureError(error));
            throw error;
        }
    }

    /**
     * Análisis de retorno de inversión (ROI) para un rancho en un período.
     * ROI = (Ingresos - Gastos) / Gastos * 100
     */
    async getROIAnalysis(ranchId: string, startDate: Date, endDate: Date): Promise<ROIAnalysis> {
        try {
            const where: WhereOptions = {
                ranchId,
                transactionDate: { [Op.between]: [startDate, endDate] },
            };

            const transactions = await this.financeModel.findAll({ where });

            let totalRevenue = 0;
            let totalExpenses = 0;
            const incomeByCategory: Record<string, number> = {};
            const expensesByCategory: Record<string, number> = {};

            for (const t of transactions) {
                if (t.transactionType === TransactionType.INCOME) {
                    totalRevenue += t.amount;
                    incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
                } else if (t.transactionType === TransactionType.EXPENSE) {
                    totalExpenses += t.amount;
                    expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
                }
            }

            const netProfit = totalRevenue - totalExpenses;
            const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
            const roi = totalExpenses > 0 ? (netProfit / totalExpenses) * 100 : 0;

            return {
                period: { startDate, endDate },
                totalRevenue,
                totalExpenses,
                netProfit,
                profitMargin,
                roi,
                breakdown: {
                    incomeByCategory,
                    expensesByCategory,
                },
            };
        } catch (error) {
            logger.error('Error obteniendo análisis ROI', this.context, { ranchId, startDate, endDate }, ensureError(error));
            throw error;
        }
    }

    // ==========================================================================
    // UTILIDADES PRIVADAS
    // ==========================================================================

    /**
     * Calcula la tendencia mensual de un conjunto de transacciones (por categorías).
     */
    private async getMonthlyTrend(
        ranchId: string,
        startDate: Date,
        endDate: Date,
        categories: string[]
    ): Promise<Array<{ month: string; amount: number }>> {
        const results = await this.financeModel.findAll({
            attributes: [
                [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('transaction_date')), 'month'],
                [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
            ],
            where: {
                ranchId,
                transactionType: TransactionType.EXPENSE,
                category: { [Op.in]: categories },
                transactionDate: { [Op.between]: [startDate, endDate] },
            },
            group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('transaction_date'))],
            order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('transaction_date')), 'ASC']],
            raw: true,
        });

        return (results as any[]).map((row) => ({
            month: new Date(row.month).toISOString().slice(0, 7),
            amount: parseFloat(row.total),
        }));
    }
}