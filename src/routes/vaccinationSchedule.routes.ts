// routes/vaccinationSchedule.routes.ts
// ============================================================================
// VACCINATION SCHEDULE ROUTES — calendario base de vacunación (Módulo 11)
// ============================================================================

import { Router } from 'express';
import { body, param } from 'express-validator';
import { vaccinationScheduleController } from '../controllers/vaccinationSchedule.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { sanitizeInput } from '../middleware/validation';
import { runValidation } from '../validators';
import { UserRole } from '../models/User';
import { VaccineType } from '../models/Vaccination';
import { GenderType } from '../models/Bovine';

const router = Router();
router.use(sanitizeInput);
router.use(authenticateToken);

const VACCINE_TYPES = Object.values(VaccineType);
const GENDERS = Object.values(GenderType);
const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.VETERINARIAN] as const;

router.get('/', vaccinationScheduleController.list);

router.post(
  '/',
  authorizeRoles(...ADMIN_ROLES),
  body('vaccineType').isIn(VACCINE_TYPES).withMessage('vaccineType inválido'),
  body('fromAgeMonths').isInt({ min: 0 }).withMessage('fromAgeMonths debe ser entero ≥ 0'),
  body('toAgeMonths').optional({ nullable: true }).isInt({ min: 0 }),
  body('frequencyMonths').optional({ nullable: true }).isInt({ min: 0 }),
  body('isRequired').optional().isBoolean(),
  body('genderFilter').optional({ nullable: true }).isIn(GENDERS),
  body('breedFilter').optional({ nullable: true }).isString().isLength({ max: 100 }),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  runValidation,
  vaccinationScheduleController.create
);

router.patch(
  '/:id',
  authorizeRoles(...ADMIN_ROLES),
  param('id').isUUID(),
  body('vaccineType').optional().isIn(VACCINE_TYPES),
  body('fromAgeMonths').optional().isInt({ min: 0 }),
  body('toAgeMonths').optional({ nullable: true }).isInt({ min: 0 }),
  body('frequencyMonths').optional({ nullable: true }).isInt({ min: 0 }),
  body('isRequired').optional().isBoolean(),
  body('genderFilter').optional({ nullable: true }).isIn(GENDERS),
  body('breedFilter').optional({ nullable: true }).isString().isLength({ max: 100 }),
  body('isActive').optional().isBoolean(),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  runValidation,
  vaccinationScheduleController.update
);

router.delete(
  '/:id',
  authorizeRoles(...ADMIN_ROLES),
  param('id').isUUID(),
  runValidation,
  vaccinationScheduleController.delete
);

export default router;
