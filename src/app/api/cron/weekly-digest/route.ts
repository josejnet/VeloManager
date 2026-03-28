import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { weeklyDigestEmail } from '@/lib/email/digest'
import type { NotificationType } from '@prisma/client'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date()
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Find users who have email digest enabled for at least one notification type
  const usersWithEmailEnabled = await prisma.notificationPreference.findMany({
    where: {
      email: true,
      type: { in: ['PAYMENT_DUE', 'EVENT_REMINDER', 'PURCHASE_UPDATE'] as NotificationType[] },
    },
    select: { userId: true },
    distinct: ['userId'],
  })

  const eligibleUserIds = [...new Set(usersWithEmailEnabled.map((p) => p.userId))]

  if (eligibleUserIds.length === 0) {
    return Response.json({ sent: 0, skipped: 0 })
  }

  const users = await prisma.user.findMany({
    where: { id: { in: eligibleUserIds } },
    select: { id: true, email: true, name: true },
  })

  let sent = 0
  let skipped = 0

  for (const user of users) {
    try {
      // Get user's club memberships
      const memberships = await prisma.clubMembership.findMany({
        where: { userId: user.id, status: 'APPROVED' },
        select: {
          clubId: true,
          club: { select: { name: true } },
        },
      })

      if (memberships.length === 0) {
        skipped++
        continue
      }

      const clubIds = memberships.map((m) => m.clubId)
      const primaryClub = memberships[0].club

      // Gather pending/overdue quotas
      const overdueQuotas = await prisma.memberQuota.findMany({
        where: {
          membership: { userId: user.id },
          OR: [
            { status: 'OVERDUE' },
            { status: 'PENDING', dueDate: { lt: now } },
          ],
        },
        select: { year: true, amount: true },
        take: 5,
      })

      // Gather upcoming events in next 7 days
      const upcomingEvents = await prisma.clubEvent.findMany({
        where: {
          clubId: { in: clubIds },
          startAt: { gte: now, lte: nextWeek },
          published: true,
          attendees: { some: { userId: user.id, status: 'GOING' } },
        },
        select: { title: true, startAt: true, location: true },
        orderBy: { startAt: 'asc' },
        take: 5,
      })

      // Gather pending orders
      const pendingOrders = await prisma.order.findMany({
        where: {
          userId: user.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        select: {
          status: true,
          purchaseWindow: { select: { name: true } },
        },
        take: 5,
      })

      // Skip if nothing to report
      if (overdueQuotas.length === 0 && upcomingEvents.length === 0 && pendingOrders.length === 0) {
        skipped++
        continue
      }

      const baseUrl = process.env.NEXTAUTH_URL ?? 'https://app.velomanager.com'

      const orderStatusLabels: Record<string, string> = {
        PENDING: 'Pendiente',
        PAID: 'Pagado',
        CONFIRMED: 'Confirmado',
        DELIVERED: 'Entregado',
        CANCELLED: 'Cancelado',
      }

      const { subject, html } = weeklyDigestEmail({
        userName: user.name,
        clubName: primaryClub.name,
        pendingQuotas: overdueQuotas.map((q) => ({
          period: String(q.year),
          amount: `${Number(q.amount).toFixed(2)} €`,
        })),
        upcomingEvents: upcomingEvents.map((e) => ({
          title: e.title,
          date: e.startAt.toLocaleString('es-ES', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          }),
          location: e.location ?? undefined,
        })),
        pendingOrders: pendingOrders.map((o) => ({
          windowTitle: o.purchaseWindow.name,
          status: orderStatusLabels[o.status] ?? o.status,
        })),
        dashboardUrl: baseUrl,
      })

      await sendEmail({ to: user.email, subject, html })
      sent++
    } catch (error) {
      console.error(`[weekly-digest] Failed to send digest to user ${user.id}:`, error)
      skipped++
    }
  }

  return Response.json({ sent, skipped })
}
