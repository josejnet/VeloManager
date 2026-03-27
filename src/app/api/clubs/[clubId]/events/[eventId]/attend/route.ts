import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const AttendSchema = z.object({
  status: z.enum(['GOING', 'NOT_GOING', 'MAYBE']),
  note: z.string().optional().nullable(),
})

// GET /api/clubs/[clubId]/events/[eventId]/attend
// Returns the current user's attendance status and pending payment (if any)
export async function GET(
  _req: NextRequest,
  { params }: { params: { clubId: string; eventId: string } }
) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const event = await prisma.clubEvent.findFirst({
    where: { id: params.eventId, clubId: params.clubId },
    select: { id: true, price: true },
  })
  if (!event) return err('Evento no encontrado', 404)

  const [attendee, payment] = await Promise.all([
    prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId: params.eventId, userId: access.userId } },
    }),
    prisma.eventPayment.findUnique({
      where: { eventId_userId: { eventId: params.eventId, userId: access.userId } },
    }),
  ])

  return ok({
    status: attendee?.status ?? null,
    note: attendee?.note ?? null,
    payment: payment ?? null,
  })
}

// POST /api/clubs/[clubId]/events/[eventId]/attend
// Set (or update) the current user's RSVP status.
// If the event has a price and status = GOING → creates/updates EventPayment(PENDING).
// If status = NOT_GOING → cancels any pending EventPayment.
export async function POST(
  req: NextRequest,
  { params }: { params: { clubId: string; eventId: string } }
) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const event = await prisma.clubEvent.findFirst({
    where: { id: params.eventId, clubId: params.clubId, published: true },
  })
  if (!event) return err('Evento no encontrado', 404)

  const body = await req.json().catch(() => null)
  const parsed = AttendSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  // Check capacity if going
  if (parsed.data.status === 'GOING' && event.maxAttendees !== null) {
    const currentCount = await prisma.eventAttendee.count({
      where: { eventId: params.eventId, status: 'GOING' },
    })
    const existing = await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId: params.eventId, userId: access.userId } },
    })
    if ((!existing || existing.status !== 'GOING') && currentCount >= event.maxAttendees) {
      return err('El evento ha alcanzado su aforo máximo', 409)
    }
  }

  // For paid events: guard against paying when not GOING
  const isPaidEvent = event.price !== null && Number(event.price) > 0
  const existingPayment = isPaidEvent
    ? await prisma.eventPayment.findUnique({
        where: { eventId_userId: { eventId: params.eventId, userId: access.userId } },
      })
    : null

  // Block: if user already paid, they can't withdraw
  if (existingPayment?.status === 'PAID' && parsed.data.status !== 'GOING') {
    return err('Ya has pagado este evento. Contacta al administrador para gestionar la devolución.', 409)
  }

  // Atomic: update attendance + manage EventPayment
  const [attendee, payment] = await prisma.$transaction(async (tx) => {
    const att = await tx.eventAttendee.upsert({
      where: { eventId_userId: { eventId: params.eventId, userId: access.userId } },
      create: {
        eventId: params.eventId,
        userId: access.userId,
        clubId: params.clubId,
        status: parsed.data.status,
        note: parsed.data.note ?? null,
      },
      update: {
        status: parsed.data.status,
        note: parsed.data.note ?? null,
        respondedAt: new Date(),
      },
    })

    let pmt = existingPayment

    if (isPaidEvent) {
      if (parsed.data.status === 'GOING' && existingPayment?.status !== 'PAID') {
        // Create or reset to PENDING
        pmt = await tx.eventPayment.upsert({
          where: { eventId_userId: { eventId: params.eventId, userId: access.userId } },
          create: {
            eventId: params.eventId,
            userId: access.userId,
            clubId: params.clubId,
            amount: event.price!,
            status: 'PENDING',
          },
          update: {
            status: 'PENDING',
            paidAt: null,
          },
        })
      } else if (parsed.data.status === 'NOT_GOING' && existingPayment?.status === 'PENDING') {
        // Cancel pending payment
        pmt = await tx.eventPayment.update({
          where: { eventId_userId: { eventId: params.eventId, userId: access.userId } },
          data: { status: 'CANCELLED' },
        })
      }
    }

    return [att, pmt]
  })

  return ok({ attendee, payment })
}
