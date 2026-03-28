import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createNotificationForMany } from '@/lib/notification-service'
import type { CreateNotificationInput } from '@/lib/notification-service'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date()

  // Find all overdue quotas or pending quotas with a past due date
  const overdueQuotas = await prisma.memberQuota.findMany({
    where: {
      OR: [
        { status: 'OVERDUE' },
        {
          status: 'PENDING',
          dueDate: { lt: now },
        },
      ],
    },
    include: {
      membership: {
        select: {
          userId: true,
          clubId: true,
          club: { select: { name: true } },
        },
      },
    },
  })

  // Group by userId → collect quota info
  const userQuotasMap = new Map<
    string,
    {
      userId: string
      clubId: string
      clubName: string
      count: number
    }
  >()

  for (const quota of overdueQuotas) {
    const userId = quota.membership.userId
    const clubId = quota.membership.clubId
    const clubName = quota.membership.club.name
    const existing = userQuotasMap.get(userId)
    if (existing) {
      existing.count++
    } else {
      userQuotasMap.set(userId, { userId, clubId, clubName, count: 1 })
    }
  }

  const inputs: CreateNotificationInput[] = []

  for (const { userId, clubId, clubName, count } of userQuotasMap.values()) {
    inputs.push({
      userId,
      clubId,
      type: 'PAYMENT_DUE',
      title: 'Tienes cuotas pendientes',
      message:
        count === 1
          ? `Tienes 1 cuota pendiente de pago en ${clubName}.`
          : `Tienes ${count} cuotas pendientes de pago en ${clubName}.`,
      link: '/socio/cuotas',
      metadata: { clubId, overdueCount: count },
    })
  }

  if (inputs.length > 0) {
    await createNotificationForMany(inputs)
  }

  return Response.json({ processed: inputs.length })
}
