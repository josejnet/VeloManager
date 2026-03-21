import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'

const AttendSchema = z.object({
  status: z.enum(['GOING', 'NOT_GOING', 'MAYBE']),
  note: z.string().optional().nullable(),
})

// GET /api/clubs/[clubId]/events/[eventId]/attend
// Returns the current user's attendance status for this event
export async function GET(
  _req: NextRequest,
  { params }: { params: { clubId: string; eventId: string } }
) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const event = await prisma.clubEvent.findFirst({
    where: { id: params.eventId, clubId: params.clubId },
  })
  if (!event) return err('Evento no encontrado', 404)

  const attendee = await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId: params.eventId, userId: access.userId } },
  })

  return ok({ status: attendee?.status ?? null, note: attendee?.note ?? null })
}

// POST /api/clubs/[clubId]/events/[eventId]/attend
// Set (or update) the current user's RSVP status
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

  // Check capacity if maxAttendees is set and user wants to attend
  if (parsed.data.status === 'GOING' && event.maxAttendees !== null) {
    const currentCount = await prisma.eventAttendee.count({
      where: { eventId: params.eventId, status: 'GOING' },
    })
    const existing = await prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId: params.eventId, userId: access.userId } },
    })
    // Only block if user is not already marked as GOING
    if ((!existing || existing.status !== 'GOING') && currentCount >= event.maxAttendees) {
      return err('El evento ha alcanzado su aforo máximo', 409)
    }
  }

  const attendee = await prisma.eventAttendee.upsert({
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

  return ok(attendee)
}
