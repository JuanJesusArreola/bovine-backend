// routes/vaccination.routes.ts
// ============================================================================
// VACCINATION ROUTES
// ============================================================================
// Endpoints anidados bajo /api/bovines:
//   GET  /:id/vaccinations          → historial de vacunas del bovino
//   POST /:id/vaccinations          → registrar nueva vacuna
//   GET  /:id/vaccination-status    → estado actual derivado
//
// Endpoint global:
//   DELETE /api/vaccinations/:vaccinationId
//
// Este archivo expone DOS routers porque atienden prefijos distintos.
// ============================================================================

import { Router } from 'express';
import { vaccinationController } from '../controllers/vaccination.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { UserRole } from '../models/User';
import {
  createVaccinationSchema,
  listVaccinationsSchema,
  getVaccinationStatusSchema,
  deleteVaccinationSchema,
  updateVaccinationSchema,
  runValidation,
} from '../validators';

// ============================================================================
// Router 1: bajo /api/bovines
// ============================================================================
export const vaccinationBovineNestedRouter = Router();

vaccinationBovineNestedRouter.use(authenticateToken);

/**
 * GET /api/bovines/:id/vaccinations
 * Lista vacunas del bovino con filtros y paginación.
 */
vaccinationBovineNestedRouter.get(
  '/:id/vaccinations',
  ...listVaccinationsSchema,
  runValidation,
  vaccinationController.listByBovine
);

/**
 * POST /api/bovines/:id/vaccinations
 * Registra una nueva vacuna para el bovino. Requiere veterinario o gerente.
 */
vaccinationBovineNestedRouter.post(
  '/:id/vaccinations',
  authorizeRoles(
    UserRole.SUPER_ADMIN,
    UserRole.OWNER,
    UserRole.RANCH_MANAGER,
    UserRole.MANAGER,
    UserRole.VETERINARIAN
  ),
  ...createVaccinationSchema,
  runValidation,
  vaccinationController.create
);

/**
 * GET /api/bovines/:id/vaccination-status
 * Devuelve el snapshot derivado del estado de vacunación del bovino.
 */
vaccinationBovineNestedRouter.get(
  '/:id/vaccination-status',
  ...getVaccinationStatusSchema,
  runValidation,
  vaccinationController.getStatus
);

/**
 * GET /api/bovines/:id/protection
 * Estado de protección por enfermedad (derivado de vacunas × catálogo).
 */
vaccinationBovineNestedRouter.get(
  '/:id/protection',
  ...getVaccinationStatusSchema,
  runValidation,
  vaccinationController.getProtection
);

/**
 * GET /api/bovines/:id/vaccination-schedule   (V-05)
 * Calendario sugerido del bovino según edad/sexo/raza.
 */
vaccinationBovineNestedRouter.get(
  '/:id/vaccination-schedule',
  ...getVaccinationStatusSchema,
  runValidation,
  vaccinationController.getSuggestedSchedule
);

// ============================================================================
// Router 2: bajo /api/vaccinations (acciones globales)
// ============================================================================
export const vaccinationGlobalRouter = Router();

vaccinationGlobalRouter.use(authenticateToken);

/**
 * PATCH /api/vaccinations/:vaccinationId  (V-04)
 * Edita una vacuna existente y recalcula el estado del bovino.
 */
vaccinationGlobalRouter.patch(
  '/:vaccinationId',
  authorizeRoles(
    UserRole.SUPER_ADMIN,
    UserRole.OWNER,
    UserRole.RANCH_MANAGER,
    UserRole.MANAGER,
    UserRole.VETERINARIAN
  ),
  ...updateVaccinationSchema,
  runValidation,
  vaccinationController.update
);

/**
 * DELETE /api/vaccinations/:vaccinationId
 * Elimina (soft) una vacuna y recalcula el cache de estado del bovino.
 */
vaccinationGlobalRouter.delete(
  '/:vaccinationId',
  authorizeRoles(
    UserRole.SUPER_ADMIN,
    UserRole.OWNER,
    UserRole.RANCH_MANAGER,
    UserRole.VETERINARIAN
  ),
  ...deleteVaccinationSchema,
  runValidation,
  vaccinationController.delete
);

export default vaccinationBovineNestedRouter;
