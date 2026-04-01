import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { ok, err } from '@/lib/utils'
import { applyRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Entities whose payment status history we support
const VALID_ENTITY_TYPES = ['MemberQuota', 'EventPayment', 'OrderPayment'] as const
type EntityType = (typeof VALID_ENTITY_TYPES)[number]

// Actions we consider "status transitions" for the timeline
const STATUS_ACTIONS = new Set([
  'QUOTA_PAID',
  'QUOTA_REVERTED',
  'QUOTA_CREATED',
  'QUOTA_REFUNDED',
  'EVENT_PAYMENT_RECORDED',
  'EVENT_PAYMENT_REFUNDED',
  'ORDER_PAYMENT_RECORDED',
  'ORDER_PAYMENT_REFUNDED',
  'PAYMENT_STATUS_CHANGED',
  'MOVEMENT_ADJUSTED',
])

/**
 * GET /api/clubs/[clubId]/accounting/payments/[entityType]/[entityId]/history
 *
 * Returns the AuditLog-based status timeline for a specific payment entity.
 * entityType: MemberQuota | EventPayment | OrderPayment
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { clubId: string; entityType: string; entityId: string } },
) {
  const limited = applyRateLimit(req)
  if (limited) return limited

  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  if (!VALID_ENTITY_TYPES.includes(params.entityType as EntityType)) {
    return err(`entityType debe ser uno de: ${VALID_ENTITY_TYPES.join(', ')}`)
  }

  const entries = await prisma.auditLog.findMany({
    where: {
      clubId: params.clubId,
      entity: params.entityType,
      entityId: params.entityId,
    },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  })

  const timeline = entries.map((e) => ({
    id: e.id,
    action: e.action,
    isStatusChange: STATUS_ACTIONS.has(e.action),
    details: e.details,
    performedBy: {
      id: e.userId,
      name: e.user.name,
      email: e.user.email,
    },
    createdAt: e.createdAt,
  }))

  return ok({ entityType: params.entityType, entityId: params.entityId, timeline })
}
