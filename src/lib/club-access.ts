/**
 * Club access helpers — used inside API routes to enforce multi-tenant isolation.
 *
 * RULE: Every API route that touches club data MUST call one of these helpers
 * before touching Prisma. This guarantees:
 *  1. The requesting user belongs to the club.
 *  2. The user has the required role inside that club.
 *  3. The club actually exists (no phantom clubId attacks).
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole, MembershipStatus } from '@prisma/client'

export type ClubAccessResult =
  | { ok: true; userId: string; clubId: string; role: UserRole; membershipId: string }
  | { ok: false; response: Response }

/**
 * Verify the caller is an approved member of the club with at least `minRole`.
 * Hierarchy: SUPER_ADMIN > CLUB_ADMIN > SOCIO
 */
export async function requireClubAccess(
  clubId: string,
  minRole: UserRole = 'SOCIO'
): Promise<ClubAccessResult> {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return { ok: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const userId = (session.user as { id: string }).id
  const globalRole = (session.user as { role: string }).role as UserRole

  // Super Admin bypasses club membership check — always re-verify from DB to prevent
  // stale JWT tokens granting SUPER_ADMIN access after role was downgraded
  if (globalRole === 'SUPER_ADMIN') {
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    if (dbUser?.role !== 'SUPER_ADMIN') {
      return { ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
    }
    return { ok: true, userId, clubId, role: 'SUPER_ADMIN', membershipId: '' }
  }

  const membership = await prisma.clubMembership.findUnique({
    where: { userId_clubId: { userId, clubId } },
    select: { id: true, status: true, role: true },
  })

  if (!membership || membership.status !== 'APPROVED') {
    return { ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  if (!hasMinRole(membership.role, minRole)) {
    return { ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return {
    ok: true,
    userId,
    clubId,
    role: membership.role,
    membershipId: membership.id,
  }
}

/** Check the session exists (any authenticated user). */
export async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { ok: false as const, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const userId = (session.user as { id: string }).id
  const role = (session.user as { role: string }).role as UserRole
  return { ok: true as const, userId, role }
}

/** Super Admin only. Always re-verifies role from DB to prevent stale JWT escalation. */
export async function requireSuperAdmin() {
  const auth = await requireAuth()
  if (!auth.ok) return auth
  if (auth.role !== 'SUPER_ADMIN') {
    return { ok: false as const, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  // Re-verify from DB — JWT may be stale after role change
  const dbUser = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } })
  if (dbUser?.role !== 'SUPER_ADMIN') {
    return { ok: false as const, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return auth
}

// ─── Role hierarchy ───────────────────────────────────────────────────────

const ROLE_LEVEL: Record<UserRole, number> = {
  SUPER_ADMIN: 3,
  CLUB_ADMIN: 2,
  SOCIO: 1,
}

function hasMinRole(actual: UserRole, required: UserRole): boolean {
  return ROLE_LEVEL[actual] >= ROLE_LEVEL[required]
}
