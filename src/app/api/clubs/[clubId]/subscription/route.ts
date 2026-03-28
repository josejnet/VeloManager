import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess, requireSuperAdmin } from '@/lib/authz'
import { ok, err } from '@/lib/utils'
import { PLAN_MEMBER_LIMITS } from '@/lib/modules'
import type { SubscriptionPlan } from '@prisma/client'

// GET /api/clubs/[clubId]/subscription
// Returns the club's ClubSubscription (plan, memberLimit, validFrom, validTo) + actual member count
export async function GET(_req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const [subscription, memberCount] = await Promise.all([
    prisma.clubSubscription.findUnique({
      where: { clubId: params.clubId },
      select: {
        id: true,
        plan: true,
        memberLimit: true,
        validFrom: true,
        validTo: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.clubMembership.count({
      where: { clubId: params.clubId, status: 'APPROVED' },
    }),
  ])

  if (!subscription) {
    return ok({
      plan: 'FREE' as SubscriptionPlan,
      memberLimit: PLAN_MEMBER_LIMITS.FREE,
      memberCount,
    })
  }

  return ok({ ...subscription, memberCount })
}

const UpdateSubscriptionSchema = z.object({
  plan: z.enum(['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE']).optional(),
  memberLimit: z.number().int().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
  validTo: z.string().datetime().nullable().optional(),
})

// PATCH /api/clubs/[clubId]/subscription — SuperAdmin only
export async function PATCH(req: NextRequest, { params }: { params: { clubId: string } }) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  if (!body) return err('Body inválido')

  const parsed = UpdateSubscriptionSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { plan, memberLimit, notes, validTo } = parsed.data

  const effectivePlan = plan as SubscriptionPlan | undefined

  // If plan provided and memberLimit not explicitly set, use the plan's default limit
  const effectiveMemberLimit =
    memberLimit !== undefined
      ? memberLimit
      : effectivePlan !== undefined
      ? PLAN_MEMBER_LIMITS[effectivePlan]
      : undefined

  const subscription = await prisma.clubSubscription.upsert({
    where: { clubId: params.clubId },
    update: {
      ...(effectivePlan !== undefined && { plan: effectivePlan }),
      ...(effectiveMemberLimit !== undefined && { memberLimit: effectiveMemberLimit }),
      ...(notes !== undefined && { notes }),
      ...(validTo !== undefined && { validTo: validTo ? new Date(validTo) : null }),
    },
    create: {
      clubId: params.clubId,
      plan: effectivePlan ?? 'FREE',
      memberLimit: effectiveMemberLimit ?? PLAN_MEMBER_LIMITS.FREE,
      notes: notes ?? null,
      validTo: validTo ? new Date(validTo) : null,
    },
  })

  return ok(subscription)
}
