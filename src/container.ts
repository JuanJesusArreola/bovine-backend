//Servicios
import { FileService } from './services/file';
import { StorageService } from './services/StorageService';
import { RanchManagementService } from './services/ranch/RanchManagementService';
import { RanchCoreService } from './services/ranch/RanchService';
import { RanchLegalService } from './services/ranch/RanchLegalService';
import { RanchOperationsService } from './services/ranch/RanchOperationsService';
import { ProductionService } from './services/production';
import { ReproductionService } from './services/reproduction';
import { notificationService } from './services/NotificationService';
import { ReportsService } from './services/report';
import { HealthRecordService } from './services/health/HealthRecordService';
import { LaboratoryService } from './services/health/LaboratoryService';
import { TreatmentService } from './services/health/TreatmentService';
import { DiagnosisService } from './services/health/DiagnosisService';
import { FinanceService } from './services/FinanceService';
import { InventoryService } from './services/InventoryService';

//Modelos
import Production from './models/Production';
import Bovine from './models/Bovine';
import Reproduction from './models/Reproduction';
import Medication from './models/Medication';
import Finance from './models/Finance';
import InventoryMovement from './models/InventoryMovement';
import PurchaseOrder from './models/PurchaseOrder';
import Supplier from './models/Supplier';
import Inventory from './models/Inventory';

//Exportaciones
export const fileService = new FileService();
export const storageService = new StorageService();
export const ranchCoreService = new RanchCoreService();
export const ranchLegalService = new RanchLegalService();
export const productionService = new ProductionService(Production, Bovine, notificationService);
export const reproductionService = new ReproductionService(Reproduction, Bovine, notificationService);
export const ranchOperationsService = new RanchOperationsService();
export const ranchManagementService = new RanchManagementService();
export const healthRecordService = new HealthRecordService();
export const laboratoryService = new LaboratoryService();
export const inventoryService = new InventoryService(Inventory, InventoryMovement, PurchaseOrder, Supplier, Medication);
export const treatmentService = new TreatmentService(inventoryService);
export const diagnosisService = new DiagnosisService();
export const financeService = new FinanceService(Finance, Bovine);
export const reportsService = new ReportsService(
  ranchCoreService,
  ranchOperationsService,
  productionService,
  reproductionService,
  healthRecordService,
  laboratoryService,
  treatmentService,
  diagnosisService,
  financeService,
  inventoryService
);

