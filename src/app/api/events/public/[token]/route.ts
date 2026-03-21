import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/utils'

// GET /api/events/public/[token] — no auth required, public event view
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const event = await prisma.clubEvent.findUnique({
    where: { shareToken: params.token },
    include: {
      club: { select: { id: true, name: true, logoUrl: true, sport: true, colorTheme: true } },
      attachments: { select: { id: true, name: true, url: true, mimeType: true, size: true } },
      _count: { select: { attendees: true } },
    },
  })

  if (!event || !event.published) return err('Evento no encontrado o no disponible', 404)

  return ok({
    id: event.id,
    title: event.title,
    description: event.description,
    type: event.type,
    location: event.location,
    startAt: event.startAt,
    endAt: event.endAt,
    allDay: event.allDay,
    maxAttendees: event.maxAttendees,
    imageUrl: event.imageUrl,
    attendeesCount: event._count.attendees,
    attachments: event.attachments,
    club: event.club,
  })
}
