import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/club-access'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

const CreateCampaignSchema = z.object({
  advertiserName: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  linkUrl: z.string().url(),
  ctaText: z.string().max(60).default('Ver más'),
  // Targeting
  sportTypes: z.array(z.string()).default([]),
  provinces: z.array(z.string()).default([]),
  localities: z.array(z.string()).default([]),
  // Budget
  budgetType: z.enum(['IMPRESSIONS', 'CLICKS']).default('IMPRESSIONS'),
  budgetLimit: z.number().int().min(1),
  // Placement
  placement: z.enum(['DASHBOARD', 'EVENTS', 'CHECKOUT']).default('DASHBOARD'),
  // Status & scheduling
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']).default('DRAFT'),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
})

// GET /api/superadmin/ads
export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const statusFilter = req.nextUrl.searchParams.get('status')
  const placementFilter = req.nextUrl.searchParams.get('placement')

  const where: Record<string, unknown> = {}
  if (statusFilter) where.status = statusFilter
  if (placementFilter) where.placement = placementFilter

  const [campaigns, total] = await Promise.all([
    prisma.adCampaign.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { analytics: true } },
      },
    }),
    prisma.adCampaign.count({ where }),
  ])

  // Enrich with impression/click counts
  const ids = campaigns.map((c) => c.id)
  const [impressions, clicks] = await Promise.all([
    prisma.adAnalytic.groupBy({
      by: ['campaignId'],
      where: { campaignId: { in: ids }, eventType: 'IMPRESSION' },
      _count: true,
    }),
    prisma.adAnalytic.groupBy({
      by: ['campaignId'],
      where: { campaignId: { in: ids }, eventType: 'CLICK' },
      _count: true,
    }),
  ])

  const impMap = Object.fromEntries(impressions.map((r) => [r.campaignId, r._count]))
  const clkMap = Object.fromEntries(clicks.map((r) => [r.campaignId, r._count]))

  const enriched = campaigns.map((c) => ({
    ...c,
    impressions: impMap[c.id] ?? 0,
    clicks: clkMap[c.id] ?? 0,
    ctr: impMap[c.id] ? ((clkMap[c.id] ?? 0) / impMap[c.id]) * 100 : 0,
  }))

  return ok(buildPaginatedResponse(enriched, total, page, pageSize))
}

// POST /api/superadmin/ads
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = CreateCampaignSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { imageUrl, startsAt, endsAt, ...rest } = parsed.data

  const campaign = await prisma.adCampaign.create({
    data: {
      ...rest,
      imageUrl: imageUrl || null,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
    },
  })

  return ok(campaign, 201)
}
