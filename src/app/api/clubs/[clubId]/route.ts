import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

const UpdateClubSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slogan: z.string().max(200).optional(),
  sport: z.string().optional(),
  colorTheme: z.string().optional(),
  logoUrl: z.string().url().optional().nullable(),
})

// GET /api/clubs/[clubId]
export async function GET(_req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const club = await prisma.club.findUnique({
    where: { id: params.clubId },
    include: {
      bankAccount: true,
      incomeCategories: true,
      expenseCategories: true,
      sizeGroups: true,
      _count: {
        select: {
          memberships: { where: { status: 'APPROVED' } },
          products: true,
          purchaseWindows: true,
          votes: { where: { active: true } },
        },
      },
    },
  })

  if (!club) return err('Club no encontrado', 404)
  return ok(club)
}

// PATCH /api/clubs/[clubId]
export async function PATCH(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = UpdateClubSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const club = await prisma.club.update({
    where: { id: params.clubId },
    data: parsed.data,
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.CLUB_SETTINGS_UPDATED,
    entity: 'Club',
    entityId: params.clubId,
    details: parsed.data,
  })

  return ok(club)
}
