import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/authz'
import { ok, err } from '@/lib/utils'
import { cookies } from 'next/headers'

// GET /api/dashboard/user
// Single aggregation endpoint for the socio dashboard.
// Returns all data needed in one round-trip.
export async function GET(_req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { userId } = auth

  // Resolve active club from cookie (same logic as dashboard layout)
  const cookieStore = await cookies()
  const activeClubId = cookieStore.get('activeClubId')?.value

  let membership = activeClubId
    ? await prisma.clubMembership.findFirst({
        where: { userId, status: 'APPROVED', clubId: activeClubId },
        orderBy: { joinedAt: 'desc' },
        include: {
          club: {
            select: { id: true, name: true, slogan: true, sport: true, logoUrl: true, colorTheme: true },
          },
        },
      })
    : null

  // Fall back to any approved membership if cookie is stale/missing
  if (!membership) {
    membership = await prisma.clubMembership.findFirst({
      where: { userId, status: 'APPROVED' },
      orderBy: { joinedAt: 'desc' },
      include: {
        club: {
          select: { id: true, name: true, slogan: true, sport: true, logoUrl: true, colorTheme: true },
        },
      },
    })
  }

  if (!membership) return err('No perteneces a ningún club activo', 404)

  const clubId = membership.clubId
  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const [
    quotas,
    orders,
    upcomingEvents,
    activeVotes,
    announcements,
    openPurchaseWindows,
    unreadNotifications,
    eventPayments,
  ] = await Promise.all([
    // All quotas for this membership (recent first)
    prisma.memberQuota.findMany({
      where: { membershipId: membership.id },
      orderBy: { year: 'desc' },
      take: 6,
    }),

    // Recent orders
    prisma.order.findMany({
      where: { userId, clubId, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        purchaseWindow: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),

    // Upcoming published events in next 30 days
    prisma.clubEvent.findMany({
      where: { clubId, published: true, startAt: { gte: now, lte: in30Days } },
      orderBy: { startAt: 'asc' },
      take: 5,
      select: {
        id: true,
        title: true,
        startAt: true,
        location: true,
        type: true,
        price: true,
        attendees: {
          where: { userId },
          select: { status: true },
          take: 1,
        },
      },
    }),

    // Active votes + whether this user has voted + results
    prisma.vote.findMany({
      where: { clubId, active: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        closedAt: true,
        _count: { select: { responses: true } },
        responses: {
          where: { userId },
          select: { id: true, optionId: true },
          take: 1,
        },
        options: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            text: true,
            _count: { select: { responses: true } },
          },
        },
      },
    }),

    // Latest announcements (pinned first)
    prisma.clubAnnouncement.findMany({
      where: { clubId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 3,
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        pinned: true,
      },
    }),

    // Open purchase windows count
    prisma.purchaseWindow.count({ where: { clubId, status: 'OPEN' } }),

    // Unread notifications count
    prisma.notification.count({ where: { userId, read: false } }),

    // Pending event payments
    prisma.eventPayment.findMany({
      where: { userId, clubId, status: 'PENDING' },
      take: 3,
      select: {
        id: true,
        amount: true,
        status: true,
        event: { select: { id: true, title: true, startAt: true } },
      },
    }),
  ])

  // Derive priorities
  const pendingQuotas = quotas.filter((q) => q.status !== 'PAID')
  const unpaidOrders = orders.filter((o) => o.status === 'PENDING')

  const totalPendingAmount =
    pendingQuotas.reduce((s, q) => s + Number(q.amount), 0) +
    unpaidOrders.reduce((s, o) => s + Number(o.totalAmount), 0) +
    eventPayments.reduce((s, p) => s + Number(p.amount), 0)

  return ok({
    club: membership.club,
    membership: {
      id: membership.id,
      role: membership.clubRole,
      joinedAt: membership.joinedAt,
    },
    priorities: {
      pendingQuotas: pendingQuotas.map((q) => ({
        id: q.id,
        year: q.year,
        amount: Number(q.amount),
        status: q.status,
        dueDate: q.dueDate,
      })),
      unpaidOrders: unpaidOrders.map((o) => ({
        id: o.id,
        windowName: o.purchaseWindow.name,
        totalAmount: Number(o.totalAmount),
        createdAt: o.createdAt,
      })),
      unpaidEventPayments: eventPayments.map((p) => ({
        id: p.id,
        eventId: p.event.id,
        eventTitle: p.event.title,
        eventDate: p.event.startAt,
        amount: Number(p.amount),
      })),
    },
    upcomingEvents: upcomingEvents.map((e) => ({
      id: e.id,
      title: e.title,
      startAt: e.startAt,
      location: e.location,
      type: e.type,
      price: e.price ? Number(e.price) : null,
      myAttendanceStatus: e.attendees[0]?.status ?? null,
    })),
    recentOrders: orders.map((o) => ({
      id: o.id,
      windowName: o.purchaseWindow.name,
      totalAmount: Number(o.totalAmount),
      status: o.status,
      itemCount: o._count.items,
      createdAt: o.createdAt,
    })),
    quotas: quotas.map((q) => ({
      id: q.id,
      year: q.year,
      amount: Number(q.amount),
      status: q.status,
      dueDate: q.dueDate,
    })),
    activeVotes: activeVotes.map((v) => {
      const totalResponses = v._count.responses
      const myResponse = v.responses[0] ?? null
      const voteNow = new Date()
      let status: 'scheduled' | 'active' | 'closed'
      if (v.closedAt) {
        status = 'closed'
      } else if (v.startsAt && v.startsAt > voteNow) {
        status = 'scheduled'
      } else if (v.endsAt && v.endsAt < voteNow) {
        status = 'closed'
      } else {
        status = 'active'
      }
      return {
        id: v.id,
        title: v.title,
        status,
        closedAt: v.closedAt,
        endsAt: v.endsAt,
        totalResponses,
        hasVoted: myResponse !== null,
        myOptionId: myResponse?.optionId ?? null,
        options: v.options.map((o) => ({
          id: o.id,
          text: o.text,
          count: o._count.responses,
        })),
      }
    }),
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      createdAt: a.createdAt,
      pinned: a.pinned,
    })),
    stats: {
      unreadNotifications,
      openPurchaseWindows,
      totalPendingAmount,
    },
  })
}
