import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

const CreateEventSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio'),
  description: z.string().optional().nullable(),
  type: z.enum(['TRAINING', 'RACE', 'SOCIAL', 'MEETING', 'TRIP', 'OTHER']).default('OTHER'),
  location: z.string().optional().nullable(),
  startAt: z.string().min(1, 'La fecha de inicio es obligatoria'),
  endAt: z.string().optional().nullable(),
  allDay: z.boolean().default(false),
  maxAttendees: z.number().int().positive().optional().nullable(),
  price: z.number().positive().optional().nullable(),  // null = free event
  imageUrl: z.string().url().optional().nullable(),
  published: z.boolean().default(true),
})

// GET /api/clubs/[clubId]/events
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const upcoming = req.nextUrl.searchParams.get('upcoming') === 'true'
  const typeFilter = req.nextUrl.searchParams.get('type')

  // Admins see all events; regular socios only see published
  const isAdmin = access.role === 'CLUB_ADMIN' || access.role === 'SUPER_ADMIN'

  const where: Record<string, unknown> = {
    clubId: params.clubId,
    ...(!isAdmin ? { published: true } : {}),
    ...(upcoming ? { startAt: { gte: new Date() } } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
  }

  const [events, total] = await Promise.all([
    prisma.clubEvent.findMany({
      where,
      skip,
      take,
      orderBy: { startAt: 'asc' },
      include: {
        _count: { select: { attendees: true } },
        attendees: {
          where: { userId: access.userId },
          select: { status: true },
          take: 1,
        },
      },
    }),
    prisma.clubEvent.count({ where }),
  ])

  return ok(buildPaginatedResponse(events, total, page, pageSize))
}

// POST /api/clubs/[clubId]/events
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = CreateEventSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const event = await prisma.clubEvent.create({
    data: {
      clubId: params.clubId,
      authorId: access.userId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      location: parsed.data.location ?? null,
      startAt: new Date(parsed.data.startAt),
      endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : null,
      allDay: parsed.data.allDay,
      maxAttendees: parsed.data.maxAttendees ?? null,
      price: parsed.data.price ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      published: parsed.data.published,
    },
    include: { _count: { select: { attendees: true } } },
  })

  // Notify club members when event is published
  if (event.published) {
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
          message: `Se ha publicado un nuevo evento: ${event.title}`,
          link: `/clubs/${params.clubId}/events/${event.id}`,
        })),
        skipDuplicates: true,
      })
    }
  }

  return ok(event, 201)
}
