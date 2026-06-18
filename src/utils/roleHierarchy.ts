// utils/roleHierarchy.ts
// ============================================================================
// Jerarquía de asignación de roles (única fuente de verdad).
//
// Define qué roles puede ASIGNAR cada rol solicitante, tanto al crear un
// usuario (POST /api/admin/users) como al editarlo (PUT /api/users/:id).
// Centralizar esto evita que la creación y la edición tengan reglas distintas
// (lo que permitía escalar a SUPER_ADMIN vía edición).
// ============================================================================
import { UserRole } from '../models/User';

export const ROLE_CREATION_HIERARCHY: Record<string, UserRole[]> = {
    [UserRole.SUPER_ADMIN]: [
        UserRole.SUPER_ADMIN,
        UserRole.OWNER,
        UserRole.RANCH_MANAGER,
        UserRole.MANAGER,
        UserRole.VETERINARIAN,
        UserRole.WORKER,
        UserRole.VIEWER
    ],
    [UserRole.OWNER]: [
        UserRole.RANCH_MANAGER,
        UserRole.MANAGER,
        UserRole.VETERINARIAN,
        UserRole.WORKER,
        UserRole.VIEWER
    ]
};

/**
 * Indica si `requesterRole` tiene permiso para asignar `targetRole`.
 */
export function canAssignRole(
    requesterRole: UserRole | string | undefined,
    targetRole: UserRole
): boolean {
    if (!requesterRole) return false;
    const allowed = ROLE_CREATION_HIERARCHY[requesterRole];
    return !!allowed && allowed.includes(targetRole);
}
