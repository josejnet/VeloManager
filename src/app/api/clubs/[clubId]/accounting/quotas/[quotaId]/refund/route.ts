import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'
import { applyRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const RefundSchema = z.object({
  note: z.string().max(500).optional(),
})

/**
 * POST /api/clubs/[clubId]/accounting/quotas/[quotaId]/refund
 *
 * Refunds a PAID quota:
 * - Sets status → REFUNDED, records refundedAt + refundNote
 * - Creates an ADJUSTMENT BankMovement (EXPENSE) to reverse the original income
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { clubId: string; quotaId: string } },
) {
  const limited = applyRateLimit(req)
  if (limited) return limited

  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => ({}))
  const parsed = RefundSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const quota = await prisma.memberQuota.findFirst({
    where: { id: params.quotaId, clubId: params.clubId },
    include: {
      membership: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  })

  if (!quota) return err('Cuota no encontrada', 404)
  if (quota.status !== 'PAID') return err('Solo se pueden devolver cuotas en estado PAGADO')

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    // Update quota status
    await tx.memberQuota.update({
      where: { id: quota.id },
      data: {
        status: 'REFUNDED',
        refundedAt: now,
        refundNote: parsed.data.note ?? null,
      },
    })

    // Create reversal ADJUSTMENT BankMovement
    // Use ADJUSTMENT source with a unique sourceId to avoid dedup conflicts
    const sourceId = `refund:quota:${quota.id}`
    const existing = await tx.bankMovement.findUnique({
      where: { source_sourceId: { source: 'ADJUSTMENT', sourceId } },
      select: { id: true },
    })

    if (!existing) {
      const bankAccount = await tx.bankAccount.findUnique({
        where: { clubId: params.clubId },
        select: { id: true },
      })
      if (!bankAccount) throw new Error('No bank account found')

      await tx.bankMovement.create({
        data: {
          clubId: params.clubId,
          type: 'EXPENSE',
          amount: quota.amount,
          description: `Devolución cuota ${quota.year} — ${quota.membership.user.name ?? quota.membership.user.email}${parsed.data.note ? ` (${parsed.data.note})` : ''}`,
          source: 'ADJUSTMENT',
          sourceId,
          date: now,
        },
      })
    }
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.QUOTA_REFUNDED,
    entity: 'MemberQuota',
    entityId: quota.id,
    details: { year: quota.year, amount: quota.amount.toString(), note: parsed.data.note },
  })

  return ok({ success: true, quotaId: quota.id })
}
