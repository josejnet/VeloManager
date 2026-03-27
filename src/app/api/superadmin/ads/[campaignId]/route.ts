import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'

const UpdateCampaignSchema = z.object({
  advertiserName: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  imageUrl: z.string().url().nullable().optional().or(z.literal('')),
  linkUrl: z.string().url().optional(),
  ctaText: z.string().max(60).optional(),
  sportTypes: z.array(z.string()).optional(),
  provinces: z.array(z.string()).optional(),
  localities: z.array(z.string()).optional(),
  budgetType: z.enum(['IMPRESSIONS', 'CLICKS']).optional(),
  budgetLimit: z.number().int().min(1).optional(),
  placement: z.enum(['DASHBOARD', 'EVENTS', 'CHECKOUT']).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
})

// PATCH /api/superadmin/ads/[campaignId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { campaignId: string } },
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const existing = await prisma.adCampaign.findUnique({ where: { id: params.campaignId } })
  if (!existing) return err('Campaña no encontrada', 404)

  const body = await req.json().catch(() => null)
  const parsed = UpdateCampaignSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { imageUrl, startsAt, endsAt, ...rest } = parsed.data

  const updated = await prisma.adCampaign.update({
    where: { id: params.campaignId },
    data: {
      ...rest,
      ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
      ...(startsAt !== undefined ? { startsAt: startsAt ? new Date(startsAt) : null } : {}),
      ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}),
    },
  })

  return ok(updated)
}

// DELETE /api/superadmin/ads/[campaignId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { campaignId: string } },
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const existing = await prisma.adCampaign.findUnique({ where: { id: params.campaignId } })
  if (!existing) return err('Campaña no encontrada', 404)

  await prisma.adCampaign.delete({ where: { id: params.campaignId } })
  return ok({ deleted: true })
}
