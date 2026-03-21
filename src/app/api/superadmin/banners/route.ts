import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/club-access'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

const CreateBannerSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  imageUrl: z.string().url().optional(),
  linkUrl: z.string().url().optional(),
  linkLabel: z.string().max(100).optional(),
  // Targeting
  targetType: z.enum(['ALL', 'CLUB', 'SPORT', 'PROVINCE', 'LOCALITY']).default('ALL'),
  targetSport: z.string().optional(),
  targetProvince: z.string().optional(),
  targetLocality: z.string().optional(),
  targetClubIds: z.array(z.string()).optional(),
  targetRoles: z.array(z.enum(['CLUB_ADMIN', 'SOCIO', 'SUPER_ADMIN'])).optional(),
  // Scheduling
  publishAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  active: z.boolean().default(true),
})

// GET /api/superadmin/banners
export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const activeOnly = req.nextUrl.searchParams.get('active') !== 'false'

  const where = activeOnly ? { active: true } : {}

  const [banners, total] = await Promise.all([
    prisma.platformBanner.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.platformBanner.count({ where }),
  ])

  return ok(buildPaginatedResponse(banners, total, page, pageSize))
}

// POST /api/superadmin/banners
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = CreateBannerSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const banner = await prisma.platformBanner.create({
    data: {
      ...parsed.data,
      publishAt: parsed.data.publishAt ? new Date(parsed.data.publishAt) : new Date(),
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
  })

  return ok(banner, 201)
}
