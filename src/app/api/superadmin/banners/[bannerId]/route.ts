import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'

const UpdateSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().optional(),
  imageUrl: z.string().url().nullable().optional(),
  linkUrl: z.string().url().nullable().optional(),
  linkLabel: z.string().optional(),
  active: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  targetSport: z.string().nullable().optional(),
  targetProvince: z.string().nullable().optional(),
  targetLocality: z.string().nullable().optional(),
  targetClubIds: z.array(z.string()).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { bannerId: string } }
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const updated = await prisma.platformBanner.update({
    where: { id: params.bannerId },
    data: {
      ...parsed.data,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    },
  })

  return ok(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { bannerId: string } }
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  await prisma.platformBanner.delete({ where: { id: params.bannerId } })
  return ok({ success: true })
}

// POST .../[bannerId]/track — register a view or click
export async function POST(
  req: NextRequest,
  { params }: { params: { bannerId: string } }
) {
  const body = await req.json().catch(() => ({}))
  const field = body.type === 'click' ? { clickCount: { increment: 1 } } : { viewCount: { increment: 1 } }
  await prisma.platformBanner.update({ where: { id: params.bannerId }, data: field })
  return ok({ success: true })
}
