// routes/vaccineProtection.routes.ts
// ============================================================================
// VACCINE PROTECTION ROUTES — catálogo vacuna ↔ enfermedad
// ============================================================================
//   GET    /api/vaccine-protections           — listar (público autenticado)
//   GET    /api/vaccine-protections/:id        — detalle
//   POST   /api/vaccine-protections            — crear (admin)
//   PATCH  /api/vaccine-protections/:id         — actualizar (admin)
//   DELETE /api/vaccine-protections/:id         — eliminar (admin)
// ============================================================================

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { vaccineProtectionController } from '../controllers/vaccineProtection.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { sanitizeInput } from '../middleware/validation';
import { runValidation } from '../validators';
import { UserRole } from '../models/User';
import { VaccineType } from '../models/Vaccination';

const router = Router();
router.use(sanitizeInput);
router.use(authenticateToken);

const VACCINE_TYPES = Object.values(VaccineType);

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.VETERINARIAN] as const;

// ── Lectura ────────────────────────────────────────────────────────────────────

router.get(
  '/',
  query('vaccineType').optional().isIn(VACCINE_TYPES),
  query('diseaseId').optional().isUUID(),
  query('isActive').optional().isBoolean(),
  runValidation,
  vaccineProtectionController.list
);

router.get(
  '/:id',
  param('id').isUUID().withMessage('id debe ser UUID'),
  runValidation,
  vaccineProtectionController.getById
);

// ── Escritura (admin) ────────────────────────────────────────────────────────

router.post(
  '/',
  authorizeRoles(...ADMIN_ROLES),
  body('vaccineType').isIn(VACCINE_TYPES).withMessage('vaccineType inválido'),
  body('diseaseId').isUUID().withMessage('diseaseId debe ser UUID'),
  body('immunityDurationDays').isInt({ min: 0 }).withMessage('immunityDurationDays debe ser entero ≥ 0'),
  body('dosesForImmunity').optional().isInt({ min: 1 }),
  body('isActive').optional().isBoolean(),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  runValidation,
  vaccineProtectionController.create
);

router.patch(
  '/:id',
  authorizeRoles(...ADMIN_ROLES),
  param('id').isUUID().withMessage('id debe ser UUID'),
  body('immunityDurationDays').optional().isInt({ min: 0 }),
  body('dosesForImmunity').optional().isInt({ min: 1 }),
  body('isActive').optional().isBoolean(),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  runValidation,
  vaccineProtectionController.update
);

router.delete(
  '/:id',
  authorizeRoles(...ADMIN_ROLES),
  param('id').isUUID().withMessage('id debe ser UUID'),
  runValidation,
  vaccineProtectionController.delete
);

export default router;
