import { cache } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'

/**
 * React cache() deduplica estas funciones dentro del mismo render pass.
 * Si ClubLayout, AdminGuard y la página llaman a estas funciones con los
 * mismos argumentos, la query de DB se ejecuta UNA sola vez por request.
 *
 * Ref: https://react.dev/reference/react/cache
 */

/** Deduplicates getServerSession across layouts and pages in the same request. */
export const getCachedSession = cache(() => getServerSession(authOptions))

/** Fetches platformRole from DB. At most one query per request. */
export const getCachedUserRole = cache((userId: string) =>
  prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } })
)

/**
 * Fetches the user's approved membership for a specific club, with club data.
 * Cached per (userId, clubId) — runs at most once per request per pair.
 * Used by ClubLayout, AdminGuard, and page-level server components.
 */
export const getCachedMembership = cache((userId: string, clubId: string) =>
  prisma.clubMembership.findFirst({
    where: { userId, clubId, status: 'APPROVED' },
    include: { club: true },
  })
)
