import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/club-access'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

// GET /api/superadmin/users — full user list with their memberships
export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const search = req.nextUrl.searchParams.get('search')
  const role = req.nextUrl.searchParams.get('role')

  const where = {
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ]
    } : {}),
    ...(role ? { role: role as 'SUPER_ADMIN' | 'CLUB_ADMIN' | 'SOCIO' } : {}),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        province: true,
        locality: true,
        createdAt: true,
        _count: { select: { memberships: { where: { status: 'APPROVED' } } } },
        memberships: {
          where: { status: 'APPROVED' },
          include: { club: { select: { id: true, name: true, sport: true } } },
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  return ok(buildPaginatedResponse(users, total, page, pageSize))
}

// PATCH /api/superadmin/users/[userId] — update role or suspend
const UpdateUserSchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'CLUB_ADMIN', 'SOCIO']).optional(),
})

export async function PATCH(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return err('userId requerido')

  const body = await req.json().catch(() => null)
  const parsed = UpdateUserSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const updated = await prisma.user.update({
    where: { id: userId },
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true },
  })

  return ok(updated)
}
