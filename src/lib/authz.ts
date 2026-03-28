/**
 * authz.ts — Phase 2 authorization helpers
 *
 * Uses the new PlatformRole + ClubRole columns (added in Phase 2 migration).
 * Always queries DB — never trusts the JWT for role decisions.
 *
 * Drop-in replacements for the functions in club-access.ts:
 *   requireAuth()        → same signature, uses platformRole
 *   requireClubAccess()  → same signature, uses clubRole
 *   requireSuperAdmin()  → same signature, uses platformRole
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { PlatformRole, ClubRole } from '@prisma/client'

// ─── Return types ─────────────────────────────────────────────────────────────

export type AuthResult =
  | { ok: true; userId: string; platformRole: PlatformRole }
  | { ok: false; response: Response }

export type ClubAccessResult =
  | { ok: true; userId: string; clubId: string; platformRole: PlatformRole; clubRole: ClubRole; membershipId: string }
  | { ok: false; response: Response }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function unauth(): { ok: false; response: Response } {
  return { ok: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
}

function forbidden(): { ok: false; response: Response } {
  return { ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
}

// ─── requireAuth ──────────────────────────────────────────────────────────────

/** Verify the caller is authenticated. Always queries DB for platformRole. */
export async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return unauth()

  const userId = (session.user as { id: string }).id
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, platformRole: true },
  })
  if (!user) return unauth()

  return { ok: true, userId: user.id, platformRole: user.platformRole }
}

// ─── requireSuperAdmin ────────────────────────────────────────────────────────

/** Verify the caller has SUPER_ADMIN platform role. */
export async function requireSuperAdmin(): Promise<AuthResult> {
  const auth = await requireAuth()
  if (!auth.ok) return auth
  if (auth.platformRole !== 'SUPER_ADMIN') return forbidden()
  return auth
}

// ─── requireClubAccess ────────────────────────────────────────────────────────

/**
 * Verify the caller is an approved member of clubId with at least minClubRole.
 * SUPER_ADMIN bypasses membership check (they can access all clubs).
 */
export async function requireClubAccess(
  clubId: string,
  minClubRole: ClubRole = 'MEMBER'
): Promise<ClubAccessResult> {
  const auth = await requireAuth()
  if (!auth.ok) return auth

  // Super Admin bypasses club membership requirement
  if (auth.platformRole === 'SUPER_ADMIN') {
    return {
      ok: true,
      userId: auth.userId,
      clubId,
      platformRole: auth.platformRole,
      clubRole: 'ADMIN', // treat as admin within any club
      membershipId: '',
    }
  }

  const membership = await prisma.clubMembership.findUnique({
    where: { userId_clubId: { userId: auth.userId, clubId } },
    select: { id: true, status: true, clubRole: true },
  })

  if (!membership || membership.status !== 'APPROVED') return forbidden()

  if (!hasMinClubRole(membership.clubRole, minClubRole)) return forbidden()

  return {
    ok: true,
    userId: auth.userId,
    clubId,
    platformRole: auth.platformRole,
    clubRole: membership.clubRole,
    membershipId: membership.id,
  }
}

// ─── Role hierarchy ───────────────────────────────────────────────────────────

const CLUB_ROLE_LEVEL: Record<ClubRole, number> = {
  ADMIN: 2,
  MEMBER: 1,
}

function hasMinClubRole(actual: ClubRole, required: ClubRole): boolean {
  return CLUB_ROLE_LEVEL[actual] >= CLUB_ROLE_LEVEL[required]
}
