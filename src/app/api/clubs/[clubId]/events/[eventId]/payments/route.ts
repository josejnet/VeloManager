import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// GET /api/clubs/[clubId]/events/[eventId]/payments
// Admin: list all EventPayments for this event with member details
export async function GET(
  _req: NextRequest,
  { params }: { params: { clubId: string; eventId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const event = await prisma.clubEvent.findFirst({
    where: { id: params.eventId, clubId: params.clubId },
    select: { id: true, title: true, price: true },
  })
  if (!event) return err('Evento no encontrado', 404)

  const payments = await prisma.eventPayment.findMany({
    where: { eventId: params.eventId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const summary = {
    total: payments.length,
    paid: payments.filter((p) => p.status === 'PAID').length,
    pending: payments.filter((p) => p.status === 'PENDING').length,
    cancelled: payments.filter((p) => p.status === 'CANCELLED').length,
    totalCollected: payments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount), 0),
  }

  return ok({ event, payments, summary })
}
