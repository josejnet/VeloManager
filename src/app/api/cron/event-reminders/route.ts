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

  // 24h reminder: events starting between now+23h and now+25h
  const reminder24hFrom = new Date(now.getTime() + 23 * 60 * 60 * 1000)
  const reminder24hTo = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  // 2h reminder: events starting between now+1h50m and now+2h10m
  const reminder2hFrom = new Date(now.getTime() + 110 * 60 * 1000)
  const reminder2hTo = new Date(now.getTime() + 130 * 60 * 1000)

  const [events24h, events2h] = await Promise.all([
    prisma.clubEvent.findMany({
      where: {
        startAt: { gte: reminder24hFrom, lte: reminder24hTo },
        published: true,
      },
      include: {
        attendees: {
          where: { status: 'GOING' },
          select: { userId: true },
        },
        club: { select: { name: true } },
      },
    }),
    prisma.clubEvent.findMany({
      where: {
        startAt: { gte: reminder2hFrom, lte: reminder2hTo },
        published: true,
      },
      include: {
        attendees: {
          where: { status: 'GOING' },
          select: { userId: true },
        },
        club: { select: { name: true } },
      },
    }),
  ])

  const inputs: CreateNotificationInput[] = []

  for (const event of events24h) {
    const eventDate = event.startAt.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    for (const attendee of event.attendees) {
      inputs.push({
        userId: attendee.userId,
        clubId: event.clubId,
        type: 'EVENT_REMINDER',
        title: `Recordatorio: ${event.title}`,
        message: `El evento comienza mañana a las ${eventDate}${event.location ? ` en ${event.location}` : ''}.`,
        link: `/events/${event.id}`,
        metadata: { eventId: event.id, reminderType: '24h' },
      })
    }
  }

  for (const event of events2h) {
    const eventDate = event.startAt.toLocaleString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })
    for (const attendee of event.attendees) {
      inputs.push({
        userId: attendee.userId,
        clubId: event.clubId,
        type: 'EVENT_REMINDER',
        title: `¡Empieza en 2 horas! ${event.title}`,
        message: `El evento comienza hoy a las ${eventDate}${event.location ? ` en ${event.location}` : ''}.`,
        link: `/events/${event.id}`,
        metadata: { eventId: event.id, reminderType: '2h' },
      })
    }
  }

  if (inputs.length > 0) {
    await createNotificationForMany(inputs)
  }

  return Response.json({ processed: inputs.length })
}
