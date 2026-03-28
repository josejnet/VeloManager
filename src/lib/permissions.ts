/**
 * permissions.ts — RBAC contextual por club
 *
 * Diseñado para ser extensible: añadir un nuevo rol (TREASURER, COACH...)
 * es añadir una entrada en PERMISSIONS. No hay que cambiar nada más.
 *
 * IMPORTANTE: can() es solo para UI. Las APIs validan independientemente
 * con requireClubAccess() en authz.ts.
 */

export type ClubRole = 'ADMIN' | 'MEMBER'

export type Action =
  // ── Lectura básica ────────────────────────────────────────────────
  | 'club:read'
  | 'events:read'
  | 'votes:read'
  | 'messages:read'
  | 'announcements:read'
  | 'purchases:read'
  | 'notifications:read'
  // ── Participación de socio ────────────────────────────────────────
  | 'events:attend'
  | 'votes:vote'
  | 'purchases:order'
  | 'tickets:create'
  // ── Gestión (solo ADMIN por ahora) ────────────────────────────────
  | 'members:manage'
  | 'members:view_directory'
  | 'members:view_debt'
  | 'events:create'
  | 'votes:create'
  | 'announcements:create'
  | 'messages:broadcast'
  | 'purchases:manage'
  | 'accounting:read'
  | 'accounting:write'
  | 'audit:read'
  | 'settings:write'

export const PERMISSIONS: Record<ClubRole, Action[]> = {
  MEMBER: [
    'club:read',
    'events:read',   'events:attend',
    'votes:read',    'votes:vote',
    'messages:read',
    'announcements:read',
    'purchases:read', 'purchases:order',
    'notifications:read',
    'tickets:create',
  ],
  ADMIN: [
    // Todo lo que puede un MEMBER
    'club:read',
    'events:read',   'events:attend',
    'votes:read',    'votes:vote',
    'messages:read',
    'announcements:read',
    'purchases:read', 'purchases:order',
    'notifications:read',
    'tickets:create',
    // Más gestión
    'members:manage',
    'members:view_directory',
    'members:view_debt',
    'events:create',
    'votes:create',
    'announcements:create',
    'messages:broadcast',
    'purchases:manage',
    'accounting:read',
    'accounting:write',
    'audit:read',
    'settings:write',
  ],
}

/** Comprueba si un rol tiene permiso para una acción. Uso: solo UI. */
export function can(role: ClubRole | null | undefined, action: Action): boolean {
  if (!role) return false
  return PERMISSIONS[role]?.includes(action) ?? false
}

/** Lista de acciones que requieren al menos rol ADMIN en el club. */
export const ADMIN_ACTIONS = new Set<Action>([
  'members:manage',
  'members:view_directory',
  'members:view_debt',
  'events:create',
  'votes:create',
  'announcements:create',
  'messages:broadcast',
  'purchases:manage',
  'accounting:read',
  'accounting:write',
  'audit:read',
  'settings:write',
])
