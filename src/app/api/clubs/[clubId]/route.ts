import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

const UpdateClubSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slogan: z.string().max(200).optional(),
  sport: z.string().optional(),
  colorTheme: z.string().optional(),
  logoUrl: z.union([z.string().url(), z.literal('')]).optional().nullable().transform(v => v === '' ? null : v),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  // Access control
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'HIDDEN']).optional(),
  joinPolicy: z.enum(['OPEN', 'REQUEST', 'INVITE_ONLY']).optional(),
  autoApprove: z.boolean().optional(),
  inviteLinksEnabled: z.boolean().optional(),
  defaultInviteExpiryDays: z.number().int().min(1).max(365).nullable().optional(),
  defaultInviteMaxUses: z.number().int().min(1).max(10000).nullable().optional(),
})

// GET /api/clubs/[clubId]
export async function GET(_req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const club = await prisma.club.findUnique({
    where: { id: params.clubId },
    include: {
      bankAccount: true,
      ledgerCategories: true,
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
  const access = await requireClubAccess(params.clubId, 'ADMIN')
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
