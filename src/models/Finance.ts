import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';
import { LocationData } from './Bovine';

// Enums para transacciones financieras
export enum TransactionType {
  INCOME = 'INCOME',           // Ingreso
  EXPENSE = 'EXPENSE',         // Gasto
  TRANSFER = 'TRANSFER',       // Transferencia
  ADJUSTMENT = 'ADJUSTMENT'    // Ajuste contable
}

export enum IncomeCategory {
  CATTLE_SALE = 'CATTLE_SALE',                 // Venta de ganado
  MILK_PRODUCTION = 'MILK_PRODUCTION',         // Producción de leche
  MEAT_PRODUCTION = 'MEAT_PRODUCTION',         // Producción de carne
  BREEDING_SERVICES = 'BREEDING_SERVICES',     // Servicios de reproducción
  RENTAL_INCOME = 'RENTAL_INCOME',             // Ingresos por alquiler
  GOVERNMENT_SUBSIDIES = 'GOVERNMENT_SUBSIDIES', // Subsidios gubernamentales
  INSURANCE_CLAIMS = 'INSURANCE_CLAIMS',       // Reclamaciones de seguro
  CONSULTATION_SERVICES = 'CONSULTATION_SERVICES', // Servicios de consultoría
  EQUIPMENT_SALE = 'EQUIPMENT_SALE',           // Venta de equipo
  OTHER_INCOME = 'OTHER_INCOME'                // Otros ingresos
}

export enum ExpenseCategory {
  FEED_PURCHASE = 'FEED_PURCHASE',             // Compra de alimento
  VETERINARY_SERVICES = 'VETERINARY_SERVICES', // Servicios veterinarios
  MEDICATION = 'MEDICATION',                   // Medicamentos
  VACCINATION = 'VACCINATION',                 // Vacunaciones
  CATTLE_PURCHASE = 'CATTLE_PURCHASE',         // Compra de ganado
  EQUIPMENT_PURCHASE = 'EQUIPMENT_PURCHASE',   // Compra de equipo
  FACILITY_MAINTENANCE = 'FACILITY_MAINTENANCE', // Mantenimiento de instalaciones
  LABOR_COSTS = 'LABOR_COSTS',                 // Costos de mano de obra
  UTILITIES = 'UTILITIES',                     // Servicios públicos
  FUEL_COSTS = 'FUEL_COSTS',                   // Combustible
  INSURANCE_PREMIUMS = 'INSURANCE_PREMIUMS',   // Primas de seguro
  TRANSPORTATION = 'TRANSPORTATION',           // Transporte
  PROPERTY_TAXES = 'PROPERTY_TAXES',           // Impuestos sobre la propiedad
  LICENSING_FEES = 'LICENSING_FEES',           // Tarifas de licencias
  PROFESSIONAL_SERVICES = 'PROFESSIONAL_SERVICES', // Servicios profesionales
  MARKETING_ADVERTISING = 'MARKETING_ADVERTISING', // Marketing y publicidad
  OFFICE_SUPPLIES = 'OFFICE_SUPPLIES',         // Suministros de oficina
  TECHNOLOGY_SOFTWARE = 'TECHNOLOGY_SOFTWARE', // Tecnología y software
  RESEARCH_DEVELOPMENT = 'RESEARCH_DEVELOPMENT', // Investigación y desarrollo
  OTHER_EXPENSES = 'OTHER_EXPENSES'            // Otros gastos
}

export enum PaymentMethod {
  CASH = 'CASH',                    // Efectivo
  BANK_TRANSFER = 'BANK_TRANSFER', // Transferencia bancaria
  CHECK = 'CHECK',                  // Cheque
  CREDIT_CARD = 'CREDIT_CARD',     // Tarjeta de crédito
  DEBIT_CARD = 'DEBIT_CARD',       // Tarjeta de débito
  DIGITAL_WALLET = 'DIGITAL_WALLET', // Billetera digital
  CRYPTOCURRENCY = 'CRYPTOCURRENCY', // Criptomoneda
  BARTER = 'BARTER',               // Trueque
  CREDIT_NOTE = 'CREDIT_NOTE',     // Nota de crédito
  OTHER = 'OTHER'                   // Otro método
}

export enum TransactionStatus {
  PENDING = 'PENDING',         // Pendiente
  COMPLETED = 'COMPLETED',     // Completada
  CANCELLED = 'CANCELLED',     // Cancelada
  FAILED = 'FAILED',           // Fallida
  REFUNDED = 'REFUNDED',       // Reembolsada
  PARTIAL = 'PARTIAL',         // Parcial
  OVERDUE = 'OVERDUE'          // Vencida
}

export enum RecurrenceFrequency {
  NONE = 'NONE',         // Sin recurrencia
  DAILY = 'DAILY',       // Diaria
  WEEKLY = 'WEEKLY',     // Semanal
  MONTHLY = 'MONTHLY',   // Mensual
  QUARTERLY = 'QUARTERLY', // Trimestral
  YEARLY = 'YEARLY'      // Anual
}

export enum BudgetStatus {
  ACTIVE = 'ACTIVE',       // Activo
  INACTIVE = 'INACTIVE',   // Inactivo
  EXCEEDED = 'EXCEEDED',   // Excedido
  COMPLETED = 'COMPLETED'  // Completado
}

// Interface para información del contacto/proveedor
export interface ContactInfo {
  name: string;                    // Nombre del contacto
  email?: string;                  // Email
  phone?: string;                  // Teléfono
  address?: string;                // Dirección
  taxId?: string;                  // RFC o ID fiscal
  bankAccount?: string;            // Cuenta bancaria
  notes?: string;                  // Notas del contacto
}

// Interface para información de facturación
export interface InvoiceInfo {
  invoiceNumber?: string;          // Número de factura
  invoiceDate?: Date;              // Fecha de factura
  dueDate?: Date;                  // Fecha de vencimiento
  taxAmount?: number;              // Monto de impuestos
  taxRate?: number;                // Tasa de impuesto
  discountAmount?: number;         // Descuento aplicado
  discountPercentage?: number;     // Porcentaje de descuento
  subtotal?: number;               // Subtotal antes de impuestos
  totalAmount?: number;            // Monto total final
  isPaid?: boolean;                // Si está pagada
  paidDate?: Date;                 // Fecha de pago
}

// Interface para información de presupuesto
export interface BudgetInfo {
  budgetId?: string;               // ID del presupuesto
  budgetCategory?: string;         // Categoría del presupuesto
  budgetPeriod?: string;           // Período del presupuesto
  allocatedAmount?: number;        // Monto asignado
  spentAmount?: number;            // Monto gastado
  remainingAmount?: number;        // Monto restante
  percentageUsed?: number;         // Porcentaje utilizado
}

// Interface para información de amortización
export interface AmortizationInfo {
  asset?: string;                  // Activo a amortizar
  totalCost?: number;              // Costo total
  usefulLife?: number;             // Vida útil en años
  monthlyAmortization?: number;    // Amortización mensual
  accumulatedAmortization?: number; // Amortización acumulada
  bookValue?: number;              // Valor en libros
}

// Interface para análisis financiero
export interface FinancialAnalysis {
  roi?: number;                    // Retorno de inversión
  profitMargin?: number;           // Margen de ganancia
  costPerAnimal?: number;          // Costo por animal
  revenuePerAnimal?: number;       // Ingreso por animal
  breakEvenPoint?: number;         // Punto de equilibrio
  cashFlow?: number;               // Flujo de caja
  trend?: 'INCREASING' | 'DECREASING' | 'STABLE'; // Tendencia
}

// Interface para configuración de recurrencia
export interface RecurrenceConfig {
  frequency: RecurrenceFrequency;  // Frecuencia
  interval?: number;               // Intervalo personalizado
  endDate?: Date;                  // Fecha de fin
  maxOccurrences?: number;         // Máximo número de ocurrencias
  nextDueDate?: Date;              // Próxima fecha de vencimiento
  reminderDays?: number;           // Días de recordatorio
}

// Atributos del modelo Finance
export interface FinanceAttributes {
  id: string;
  transactionType: TransactionType;        // Tipo de transacción
  category: IncomeCategory | ExpenseCategory; // Categoría específica
  title: string;                           // Título de la transacción
  description?: string;                    // Descripción detallada
  amount: number;                          // Monto de la transacción
  currency: string;                        // Moneda (ISO 4217)
  exchangeRate?: number;                   // Tipo de cambio (si aplica)
  baseAmount?: number;                     // Monto en moneda base
  paymentMethod: PaymentMethod;            // Método de pago
  status: TransactionStatus;               // Estado de la transacción
  transactionDate: Date;                   // Fecha de la transacción
  dueDate?: Date;                          // Fecha de vencimiento
  completedDate?: Date;                    // Fecha de completación
  location?: LocationData;                 // Ubicación de la transacción
  bovineId?: string;                       // ID del bovino relacionado
  eventId?: string;                        // ID del evento relacionado
  ranchId?: string;                         // ID de la finca
  contactInfo?: ContactInfo;               // Información del contacto
  invoiceInfo?: InvoiceInfo;               // Información de facturación
  budgetInfo?: BudgetInfo;                 // Información de presupuesto
  amortizationInfo?: AmortizationInfo;     // Información de amortización
  financialAnalysis?: FinancialAnalysis;   // Análisis financiero
  recurrence?: RecurrenceConfig;           // Configuración de recurrencia
  parentTransactionId?: string;            // ID de transacción padre
  relatedTransactions?: string[];          // IDs de transacciones relacionadas
  tags?: string[];                         // Etiquetas para categorización
  attachments?: string[];                  // URLs de archivos adjuntos
  photos?: string[];                       // URLs de fotos/recibos
  notes?: string;                          // Notas adicionales
  internalNotes?: string;                  // Notas internas
  isRecurring: boolean;                    // Si es recurrente
  isApproved: boolean;                     // Si está aprobada
  approvedBy?: string;                     // ID del usuario que aprobó
  approvedDate?: Date;                     // Fecha de aprobación
  isActive: boolean;                       // Si está activa
  fiscalYear?: number;                     // Año fiscal
  fiscalPeriod?: string;                   // Período fiscal
  costCenter?: string;                     // Centro de costo
  project?: string;                        // Proyecto relacionado
  createdBy: string;                       // ID del usuario que creó
  updatedBy?: string;                      // ID del usuario que actualizó
 
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

// Atributos opcionales al crear una nueva transacción
export interface FinanceCreationAttributes 
  extends Optional<FinanceAttributes, 
    'id' | 'description' | 'exchangeRate' | 'baseAmount' | 'dueDate' | 
    'completedDate' | 'location' | 'bovineId' | 'eventId' | 'ranchId' | 
    'contactInfo' | 'invoiceInfo' | 'budgetInfo' | 'amortizationInfo' | 
    'financialAnalysis' | 'recurrence' | 'parentTransactionId' | 
    'relatedTransactions' | 'tags' | 'attachments' | 'photos' | 'notes' | 
    'internalNotes' | 'approvedBy' | 'approvedDate' | 'fiscalYear' | 
    'fiscalPeriod' | 'costCenter' | 'project' | 'updatedBy' | 'deletedAt'
  > {}

// Clase del modelo Finance
class Finance extends Model<FinanceAttributes, FinanceCreationAttributes> 
  implements FinanceAttributes {
  public id!: string;
  public transactionType!: TransactionType;
  public category!: IncomeCategory | ExpenseCategory;
  public title!: string;
  public description?: string;
  public amount!: number;
  public currency!: string;
  public exchangeRate?: number;
  public baseAmount?: number;
  public paymentMethod!: PaymentMethod;
  public status!: TransactionStatus;
  public transactionDate!: Date;
  public dueDate?: Date;
  public completedDate?: Date;
  public location?: LocationData;
  public bovineId?: string;
  public eventId?: string;
  public ranchId?: string;
  public contactInfo?: ContactInfo;
  public invoiceInfo?: InvoiceInfo;
  public budgetInfo?: BudgetInfo;
  public amortizationInfo?: AmortizationInfo;
  public financialAnalysis?: FinancialAnalysis;
  public recurrence?: RecurrenceConfig;
  public parentTransactionId?: string;
  public relatedTransactions?: string[];
  public tags?: string[];
  public attachments?: string[];
  public photos?: string[];
  public notes?: string;
  public internalNotes?: string;
  public isRecurring!: boolean;
  public isApproved!: boolean;
  public approvedBy?: string;
  public approvedDate?: Date;
  public isActive!: boolean;
  public fiscalYear?: number;
  public fiscalPeriod?: string;
  public costCenter?: string;
  public project?: string;
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;

  // Métodos de instancia

  /**
   * Obtiene el monto en la moneda base de la empresa
   * @param baseCurrency Moneda base de la empresa
   * @returns Monto convertido a moneda base
   */
  public getBaseAmount(baseCurrency: string = 'MXN'): number {
    if (this.currency === baseCurrency) {
      return this.amount;
    }
    if (this.baseAmount) {
      return this.baseAmount;
    }
    if (this.exchangeRate) {
      return this.amount * this.exchangeRate;
    }
    return this.amount; // Fallback
  }

  /**
   * Verifica si la transacción está vencida
   * @returns True si está vencida
   */
  public isOverdue(): boolean {
    if (!this.dueDate || this.status === TransactionStatus.COMPLETED) {
      return false;
    }
    return new Date() > new Date(this.dueDate);
  }

  /**
   * Calcula los días hasta el vencimiento
   * @returns Días hasta vencimiento (negativo si ya venció)
   */
  public getDaysUntilDue(): number | null {
    if (!this.dueDate) return null;
    const now = new Date();
    const due = new Date(this.dueDate);
    const diffTime = due.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Obtiene el tipo de transacción en español
   * @returns Tipo de transacción traducido
   */
  public getTransactionTypeLabel(): string {
    const labels = {
      [TransactionType.INCOME]: 'Ingreso',
      [TransactionType.EXPENSE]: 'Gasto',
      [TransactionType.TRANSFER]: 'Transferencia',
      [TransactionType.ADJUSTMENT]: 'Ajuste'
    };
    return labels[this.transactionType];
  }

  /**
   * Obtiene la categoría en español
   * @returns Categoría traducida
   */
  public getCategoryLabel(): string {
    const incomeLabels = {
      [IncomeCategory.CATTLE_SALE]: 'Venta de Ganado',
      [IncomeCategory.MILK_PRODUCTION]: 'Producción de Leche',
      [IncomeCategory.MEAT_PRODUCTION]: 'Producción de Carne',
      [IncomeCategory.BREEDING_SERVICES]: 'Servicios de Reproducción',
      [IncomeCategory.RENTAL_INCOME]: 'Ingresos por Alquiler',
      [IncomeCategory.GOVERNMENT_SUBSIDIES]: 'Subsidios Gubernamentales',
      [IncomeCategory.INSURANCE_CLAIMS]: 'Reclamaciones de Seguro',
      [IncomeCategory.CONSULTATION_SERVICES]: 'Servicios de Consultoría',
      [IncomeCategory.EQUIPMENT_SALE]: 'Venta de Equipo',
      [IncomeCategory.OTHER_INCOME]: 'Otros Ingresos'
    };

    const expenseLabels = {
      [ExpenseCategory.FEED_PURCHASE]: 'Compra de Alimento',
      [ExpenseCategory.VETERINARY_SERVICES]: 'Servicios Veterinarios',
      [ExpenseCategory.MEDICATION]: 'Medicamentos',
      [ExpenseCategory.VACCINATION]: 'Vacunaciones',
      [ExpenseCategory.CATTLE_PURCHASE]: 'Compra de Ganado',
      [ExpenseCategory.EQUIPMENT_PURCHASE]: 'Compra de Equipo',
      [ExpenseCategory.FACILITY_MAINTENANCE]: 'Mantenimiento de Instalaciones',
      [ExpenseCategory.LABOR_COSTS]: 'Costos de Mano de Obra',
      [ExpenseCategory.UTILITIES]: 'Servicios Públicos',
      [ExpenseCategory.FUEL_COSTS]: 'Combustible',
      [ExpenseCategory.INSURANCE_PREMIUMS]: 'Primas de Seguro',
      [ExpenseCategory.TRANSPORTATION]: 'Transporte',
      [ExpenseCategory.PROPERTY_TAXES]: 'Impuestos sobre la Propiedad',
      [ExpenseCategory.LICENSING_FEES]: 'Tarifas de Licencias',
      [ExpenseCategory.PROFESSIONAL_SERVICES]: 'Servicios Profesionales',
      [ExpenseCategory.MARKETING_ADVERTISING]: 'Marketing y Publicidad',
      [ExpenseCategory.OFFICE_SUPPLIES]: 'Suministros de Oficina',
      [ExpenseCategory.TECHNOLOGY_SOFTWARE]: 'Tecnología y Software',
      [ExpenseCategory.RESEARCH_DEVELOPMENT]: 'Investigación y Desarrollo',
      [ExpenseCategory.OTHER_EXPENSES]: 'Otros Gastos'
    };

    if (this.transactionType === TransactionType.INCOME) {
      return incomeLabels[this.category as IncomeCategory] || 'Categoría Desconocida';
    }
    return expenseLabels[this.category as ExpenseCategory] || 'Categoría Desconocida';
  }

  /**
   * Obtiene el estado en español
   * @returns Estado traducido
   */
  public getStatusLabel(): string {
    const labels = {
      [TransactionStatus.PENDING]: 'Pendiente',
      [TransactionStatus.COMPLETED]: 'Completada',
      [TransactionStatus.CANCELLED]: 'Cancelada',
      [TransactionStatus.FAILED]: 'Fallida',
      [TransactionStatus.REFUNDED]: 'Reembolsada',
      [TransactionStatus.PARTIAL]: 'Parcial',
      [TransactionStatus.OVERDUE]: 'Vencida'
    };
    return labels[this.status];
  }

  /**
   * Obtiene el método de pago en español
   * @returns Método de pago traducido
   */
  public getPaymentMethodLabel(): string {
    const labels = {
      [PaymentMethod.CASH]: 'Efectivo',
      [PaymentMethod.BANK_TRANSFER]: 'Transferencia Bancaria',
      [PaymentMethod.CHECK]: 'Cheque',
      [PaymentMethod.CREDIT_CARD]: 'Tarjeta de Crédito',
      [PaymentMethod.DEBIT_CARD]: 'Tarjeta de Débito',
      [PaymentMethod.DIGITAL_WALLET]: 'Billetera Digital',
      [PaymentMethod.CRYPTOCURRENCY]: 'Criptomoneda',
      [PaymentMethod.BARTER]: 'Trueque',
      [PaymentMethod.CREDIT_NOTE]: 'Nota de Crédito',
      [PaymentMethod.OTHER]: 'Otro'
    };
    return labels[this.paymentMethod];
  }

  /**
   * Verifica si es una transacción médica/veterinaria
   * @returns True si es transacción veterinaria
   */
  public isVeterinaryTransaction(): boolean {
    const veterinaryCategories = [
      ExpenseCategory.VETERINARY_SERVICES,
      ExpenseCategory.MEDICATION,
      ExpenseCategory.VACCINATION
    ];
    return veterinaryCategories.includes(this.category as ExpenseCategory);
  }

  /**
   * Calcula el margen de ganancia (solo para ingresos)
   * @param associatedCosts Costos asociados
   * @returns Margen de ganancia en porcentaje
   */
  public calculateProfitMargin(associatedCosts: number = 0): number | null {
    if (this.transactionType !== TransactionType.INCOME) return null;
    if (this.amount <= associatedCosts) return 0;
    return ((this.amount - associatedCosts) / this.amount) * 100;
  }

  /**
   * Obtiene información del presupuesto
   * @returns Estado del presupuesto
   */
  public getBudgetStatus(): {
    isWithinBudget: boolean;
    percentageUsed: number;
    remainingAmount: number;
  } | null {
    if (!this.budgetInfo?.allocatedAmount) return null;
    
    const percentageUsed = this.budgetInfo.percentageUsed || 0;
    const remainingAmount = this.budgetInfo.remainingAmount || 0;
    
    return {
      isWithinBudget: percentageUsed <= 100,
      percentageUsed,
      remainingAmount
    };
  }

  /**
   * Genera la próxima transacción recurrente
   * @returns Configuración de la próxima transacción
   */
  public generateNextRecurringTransaction(): Partial<FinanceCreationAttributes> | null {
    if (!this.isRecurring || !this.recurrence || this.recurrence.frequency === RecurrenceFrequency.NONE) {
      return null;
    }

    const nextDate = new Date(this.transactionDate);
    
    switch (this.recurrence.frequency) {
      case RecurrenceFrequency.DAILY:
        nextDate.setDate(nextDate.getDate() + (this.recurrence.interval || 1));
        break;
      case RecurrenceFrequency.WEEKLY:
        nextDate.setDate(nextDate.getDate() + (7 * (this.recurrence.interval || 1)));
        break;
      case RecurrenceFrequency.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + (this.recurrence.interval || 1));
        break;
      case RecurrenceFrequency.QUARTERLY:
        nextDate.setMonth(nextDate.getMonth() + (3 * (this.recurrence.interval || 1)));
        break;
      case RecurrenceFrequency.YEARLY:
        nextDate.setFullYear(nextDate.getFullYear() + (this.recurrence.interval || 1));
        break;
      default:
        return null;
    }

    // Verificar límites de recurrencia
    if (this.recurrence.endDate && nextDate > this.recurrence.endDate) {
      return null;
    }

    return {
      transactionType: this.transactionType,
      category: this.category,
      title: this.title,
      description: this.description,
      amount: this.amount,
      currency: this.currency,
      paymentMethod: this.paymentMethod,
      status: TransactionStatus.PENDING,
      transactionDate: nextDate,
      location: this.location,
      bovineId: this.bovineId,
      eventId: this.eventId,
      ranchId: this.ranchId,
      contactInfo: this.contactInfo,
      budgetInfo: this.budgetInfo,
      recurrence: this.recurrence,
      parentTransactionId: this.parentTransactionId || this.id,
      tags: this.tags,
      notes: this.notes,
      isRecurring: true,
      isApproved: false,
      isActive: true,
      costCenter: this.costCenter,
      project: this.project,
      createdBy: this.createdBy
    };
  }

  /**
   * Calcula el retorno de inversión
   * @param investmentAmount Monto de inversión inicial
   * @returns ROI en porcentaje
   */
  public calculateROI(investmentAmount: number): number | null {
    if (this.transactionType !== TransactionType.INCOME || investmentAmount <= 0) {
      return null;
    }
    return ((this.amount - investmentAmount) / investmentAmount) * 100;
  }

  /**
   * Formatea el monto con la moneda
   * @returns Monto formateado con símbolo de moneda
   */
  public getFormattedAmount(): string {
    const currencySymbols: { [key: string]: string } = {
      'MXN': '$',
      'USD': '$',
      'EUR': '€',
      'GBP': '£'
    };
    
    const symbol = currencySymbols[this.currency] || this.currency;
    return `${symbol}${this.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  }
}

// Definición del modelo en Sequelize
Finance.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único de la transacción financiera'
    },
    transactionType: {
      type: DataTypes.ENUM(...Object.values(TransactionType)),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        isValidCategory(value: string) {
          const allCategories = [...Object.values(IncomeCategory), ...Object.values(ExpenseCategory)];
          if (!allCategories.includes(value as any)) {
            throw new Error('Categoría no válida');
          }
        }
      },
      comment: 'Categoría específica de la transacción'
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 200]
      },
      comment: 'Título descriptivo de la transacción'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción detallada de la transacción'
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0.01
      },
      comment: 'Monto de la transacción'
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'MXN',
      validate: {
        len: [3, 3],
        isUppercase: true
      },
      comment: 'Código de moneda ISO 4217'
    },
    exchangeRate: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: true,
      validate: {
        min: 0
      },
      comment: 'Tipo de cambio aplicado'
    },
    baseAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Monto convertido a moneda base'
    },
    paymentMethod: {
      type: DataTypes.ENUM(...Object.values(PaymentMethod)),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(TransactionStatus)),
      allowNull: false,
      defaultValue: TransactionStatus.PENDING,
    },
    transactionDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha y hora de la transacción'
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de vencimiento (para pagos pendientes)'
    },
    completedDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de completación de la transacción'
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Ubicación geográfica donde se realizó la transacción'
    },
    bovineId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'bovines',
        key: 'id'
      },
      comment: 'ID del bovino relacionado con la transacción'
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'events',
        key: 'id'
      },
      comment: 'ID del evento relacionado con la transacción'
    },
    ranchId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID de la finca relacionada'
    },
    contactInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información del contacto/proveedor'
    },
    invoiceInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de facturación'
    },
    budgetInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de presupuesto'
    },
    amortizationInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información de amortización'
    },
    financialAnalysis: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Análisis financiero de la transacción'
    },
    recurrence: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configuración de recurrencia'
    },
    parentTransactionId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'finances',
        key: 'id'
      },
      comment: 'ID de transacción padre (para recurrentes)'
    },
    relatedTransactions: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: true,
      defaultValue: [],
      comment: 'IDs de transacciones relacionadas'
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'Etiquetas para categorización adicional'
    },
    attachments: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de archivos adjuntos'
    },
    photos: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de fotos/recibos'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales de la transacción'
    },
    internalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas internas no visibles para usuarios finales'
    },
    isRecurring: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si la transacción es recurrente'
    },
    isApproved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si la transacción ha sido aprobada'
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que aprobó la transacción'
    },
    approvedDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de aprobación'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si la transacción está activa'
    },
    fiscalYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 2000,
        max: 3000
      },
      comment: 'Año fiscal de la transacción'
    },
    fiscalPeriod: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Período fiscal (Q1, Q2, Q3, Q4, etc.)'
    },
    costCenter: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Centro de costo asignado'
    },
    project: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Proyecto relacionado'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que creó la transacción'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que actualizó la transacción'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de eliminación (soft delete)'
    }
  },
  {
    sequelize,
    modelName: 'Finance',
    tableName: 'finances',
    timestamps: true,
    paranoid: true, // Habilita soft delete
    indexes: [
      // Índices para optimizar consultas
      {
        fields: ['transaction_type']
      },
      {
        fields: ['category']
      },
      {
        fields: ['status']
      },
      {
        fields: ['transaction_date']
      },
      {
        fields: ['due_date']
      },
      {
        fields: ['bovine_id']
      },
      {
        fields: ['event_id']
      },
      {
        fields: ['ranch_id']
      },
      {
        fields: ['created_by']
      },
      {
        fields: ['currency']
      },
      {
        fields: ['is_approved']
      },
      {
        fields: ['is_recurring']
      },
      {
        fields: ['fiscal_year']
      },
      {
        name: 'finances_type_status_date',
        fields: ['transaction_type', 'status', 'transaction_date']
      },
      {
        name: 'finances_category_date',
        fields: ['category', 'transaction_date']
      },
      {
        name: 'finances_amount_currency',
        fields: ['amount', 'currency']
      },
      {
        name: 'finances_location_gin',
        fields: ['location'],
        using: 'gin',
        where: {
          location: {
            [Op.ne]: null
          }
        }
      }
    ],
    hooks: {
      // Hook para establecer fecha de completación
      beforeUpdate: async (finance: Finance) => {
        if (finance.changed('status')) {
          if (finance.status === TransactionStatus.COMPLETED && !finance.completedDate) {
            finance.completedDate = new Date();
          }
          if (finance.status === TransactionStatus.OVERDUE && finance.dueDate) {
            // Lógica adicional para transacciones vencidas
          }
        }
      },

      // Hook para calcular monto base si se proporciona tipo de cambio
      beforeSave: async (finance: Finance) => {
        if (finance.exchangeRate && finance.currency !== 'MXN') {
          finance.baseAmount = finance.amount * finance.exchangeRate;
        }

        // Establecer año fiscal si no se proporciona
        if (!finance.fiscalYear) {
          finance.fiscalYear = new Date(finance.transactionDate).getFullYear();
        }

        // Validar fechas
        if (finance.dueDate && finance.completedDate) {
          if (finance.completedDate > finance.dueDate && finance.status !== TransactionStatus.OVERDUE) {
            // La transacción se completó después del vencimiento
          }
        }
      }
    },
    comment: 'Tabla para el manejo de transacciones financieras relacionadas con el ganado bovino'
  }
);

export default Finance;