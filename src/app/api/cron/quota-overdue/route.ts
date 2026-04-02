import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAudit, AUDIT } from '@/lib/audit'
import { createNotificationForMany } from '@/lib/notification-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/quota-overdue
 *
 * Marks PENDING quotas as OVERDUE when:
 *   dueDate + club.quotaGracePeriodDays <= today
 *
 * Sends a push notification to each affected member.
 * Called daily by Vercel Cron (see vercel.json).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Fetch all clubs with their grace period
  const clubs = await prisma.club.findMany({
    where: { active: true },
    select: { id: true, name: true, quotaGracePeriodDays: true },
  })

  let markedOverdue = 0
  const notifyMap = new Map<string, { clubId: string; clubName: string; years: number[] }>()

  for (const club of clubs) {
    const graceDays = club.quotaGracePeriodDays ?? 7
    // Threshold: quotas whose dueDate + graceDays is in the past
    const threshold = new Date(today)
    threshold.setDate(threshold.getDate() - graceDays)

    const pendingOverdue = await prisma.memberQuota.findMany({
      where: {
        clubId: club.id,
        status: 'PENDING',
        dueDate: { lte: threshold },
      },
      include: {
        membership: { select: { userId: true } },
      },
    })

    if (pendingOverdue.length === 0) continue

    const ids = pendingOverdue.map((q) => q.id)

    await prisma.memberQuota.updateMany({
      where: { id: { in: ids } },
      data: { status: 'OVERDUE' },
    })

    markedOverdue += ids.length

    // Write audit entries
    await Promise.all(
      pendingOverdue.map((q) =>
        writeAudit({
          clubId: club.id,
          userId: 'cron',
          action: AUDIT.PAYMENT_STATUS_CHANGED,
          entity: 'MemberQuota',
          entityId: q.id,
          details: { from: 'PENDING', to: 'OVERDUE', year: q.year, dueDate: q.dueDate?.toISOString() },
        }),
      ),
    )

    // Build notification map: one notification per user per club
    for (const quota of pendingOverdue) {
      const userId = quota.membership.userId
      const key = `${userId}:${club.id}`
      if (!notifyMap.has(key)) {
        notifyMap.set(key, { clubId: club.id, clubName: club.name, years: [] })
      }
      notifyMap.get(key)!.years.push(quota.year)
    }
  }

  // Send push notifications
  for (const [key, { clubId, clubName, years }] of notifyMap) {
    const userId = key.split(':')[0]
    const yearsStr = years.sort((a, b) => a - b).join(', ')
    await createNotificationForMany([
      {
        userId,
        clubId,
        type: 'PAYMENT_DUE',
        title: `Cuota vencida — ${clubName}`,
        message: `Tu${years.length > 1 ? 's cuotas' : ' cuota'} del año ${yearsStr} ${years.length > 1 ? 'han vencido' : 'ha vencido'}. Por favor, realiza el pago a la mayor brevedad.`,
        metadata: { type: 'quota_overdue', years: yearsStr },
      },
    ]).catch((e) => console.error('[quota-overdue cron] notification error', e))
  }

  return Response.json({
    ok: true,
    markedOverdue,
    notificationsSent: notifyMap.size,
    checkedAt: new Date().toISOString(),
  })
}
