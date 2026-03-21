import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'

const PatchEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.enum(['TRAINING', 'RACE', 'SOCIAL', 'MEETING', 'TRIP', 'OTHER']).optional(),
  location: z.string().nullable().optional(),
  startAt: z.string().optional(),
  endAt: z.string().nullable().optional(),
  allDay: z.boolean().optional(),
  maxAttendees: z.number().int().positive().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  published: z.boolean().optional(),
})

// GET /api/clubs/[clubId]/events/[eventId]
export async function GET(
  _req: NextRequest,
  { params }: { params: { clubId: string; eventId: string } }
) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const event = await prisma.clubEvent.findFirst({
    where: { id: params.eventId, clubId: params.clubId },
    include: {
      _count: { select: { attendees: true } },
      attendees: {
        where: { userId: access.userId },
        select: { status: true },
        take: 1,
      },
      attachments: { select: { id: true, name: true, url: true, mimeType: true, size: true } },
    },
  })

  if (!event) return err('Evento no encontrado', 404)

  // Hide unpublished events from non-admins
  const isAdmin = access.role === 'CLUB_ADMIN' || access.role === 'SUPER_ADMIN'
  if (!event.published && !isAdmin) return err('Evento no encontrado', 404)

  return ok({
    ...event,
    attendeesCount: event._count.attendees,
    myStatus: event.attendees[0]?.status ?? null,
    attachments: event.attachments,
  })
}

// PATCH /api/clubs/[clubId]/events/[eventId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { clubId: string; eventId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const event = await prisma.clubEvent.findFirst({
    where: { id: params.eventId, clubId: params.clubId },
  })
  if (!event) return err('Evento no encontrado', 404)

  const body = await req.json().catch(() => null)
  const parsed = PatchEventSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.startAt) data.startAt = new Date(parsed.data.startAt)
  if (parsed.data.endAt) data.endAt = new Date(parsed.data.endAt)
  else if (parsed.data.endAt === null) data.endAt = null

  const wasPublished = event.published
  const updated = await prisma.clubEvent.update({
    where: { id: params.eventId },
    data,
    include: { _count: { select: { attendees: true } } },
  })

  // If event just became published, notify members
  if (!wasPublished && updated.published) {
    const memberships = await prisma.clubMembership.findMany({
      where: { clubId: params.clubId, status: 'APPROVED' },
      select: { userId: true },
    })
    if (memberships.length > 0) {
      await prisma.notification.createMany({
        data: memberships.map((m) => ({
          userId: m.userId,
          clubId: params.clubId,
          title: 'Nuevo evento',
          message: `Se ha publicado un nuevo evento: ${updated.title}`,
          link: `/clubs/${params.clubId}/events/${updated.id}`,
        })),
        skipDuplicates: true,
      })
    }
  }

  return ok({ ...updated, attendeesCount: updated._count.attendees })
}

// DELETE /api/clubs/[clubId]/events/[eventId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { clubId: string; eventId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const event = await prisma.clubEvent.findFirst({
    where: { id: params.eventId, clubId: params.clubId },
  })
  if (!event) return err('Evento no encontrado', 404)

  await prisma.clubEvent.delete({ where: { id: params.eventId } })
  return ok({ success: true })
}
