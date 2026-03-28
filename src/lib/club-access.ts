// Shim: re-export from authz.ts for backwards compatibility with main-branch routes
export { requireAuth, requireSuperAdmin, requireClubAccess } from '@/lib/authz'
export type { AuthResult, ClubAccessResult } from '@/lib/authz'
