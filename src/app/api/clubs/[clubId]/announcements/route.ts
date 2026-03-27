import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'
import { sendPushNotification } from '@/lib/push'

const CreateAnnouncementSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().min(1),
  imageUrl: z.string().url().optional(),
  pinned: z.boolean().default(false),
  priority: z.enum(['NORMAL', 'EMERGENCY']).default('NORMAL'),
  requiresConfirmation: z.boolean().default(false),
  // null = all club members; a valid event id = only attendees of that event
  targetEventId: z.string().cuid().optional().nullable(),
  publishAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  files: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    size: z.number().int().optional(),
    mimeType: z.string().optional(),
  })).optional(),
})

// GET /api/clubs/[clubId]/announcements
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const now = new Date()

  const where = {
    clubId: params.clubId,
    publishAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  }

  const [announcements, total] = await Promise.all([
    prisma.clubAnnouncement.findMany({
      where,
      skip,
      take,
      orderBy: [{ pinned: 'desc' }, { priority: 'desc' }, { publishAt: 'desc' }],
      include: {
        sharedFiles: true,
        _count: { select: { reads: true } },
      },
    }),
    prisma.clubAnnouncement.count({ where }),
  ])

  return ok(buildPaginatedResponse(announcements, total, page, pageSize))
}

// POST /api/clubs/[clubId]/announcements
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = CreateAnnouncementSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { files, targetEventId, ...data } = parsed.data

  const announcement = await prisma.clubAnnouncement.create({
    data: {
      clubId: params.clubId,
      authorId: access.userId,
      ...data,
      targetEventId: targetEventId ?? null,
      publishAt: data.publishAt ? new Date(data.publishAt) : new Date(),
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      sharedFiles: files?.length ? {
        create: files.map((f) => ({
          clubId: params.clubId,
          uploadedBy: access.userId,
          name: f.name,
          url: f.url,
          size: f.size,
          mimeType: f.mimeType,
        })),
      } : undefined,
    },
    include: { sharedFiles: true },
  })

  // ── Determine target audience ────────────────────────────────────────────
  let targetUserIds: string[] = []

  if (targetEventId) {
    // Segmented: only attendees of the specified event
    const attendees = await prisma.eventAttendee.findMany({
      where: { eventId: targetEventId, clubId: params.clubId, status: 'GOING' },
      select: { userId: true },
    })
    targetUserIds = attendees.map((a) => a.userId)
  } else {
    // Broadcast: all approved members of the club
    const members = await prisma.clubMembership.findMany({
      where: { clubId: params.clubId, status: 'APPROVED' },
      select: { userId: true },
    })
    targetUserIds = members.map((m) => m.userId)
  }

  if (targetUserIds.length > 0) {
    // ── In-app notifications ───────────────────────────────────────────────
    const isEmergency = data.priority === 'EMERGENCY'
    const notifTitle = isEmergency
      ? `🚨 ${data.title}`
      : data.pinned
        ? `📌 ${data.title}`
        : data.title

    await prisma.notification.createMany({
      data: targetUserIds.map((userId) => ({
        userId,
        clubId: params.clubId,
        title: notifTitle,
        message: isEmergency
          ? 'Comunicado urgente del club. Requiere tu atención inmediata.'
          : 'Hay un nuevo anuncio del club. Toca para leer.',
        link: `/socio`,
      })),
    })

    // ── Push notifications (FCM) ──────────────────────────────────────────
    // Fired for EMERGENCY announcements or those that require confirmation.
    // sendPushNotification is a fire-and-forget stub; replace with real FCM
    // credentials via FIREBASE_SERVICE_ACCOUNT env var in production.
    if (isEmergency || data.requiresConfirmation) {
      await sendPushNotification({
        userIds: targetUserIds,
        title: notifTitle,
        body: isEmergency
          ? '⚠️ Comunicado urgente. Abre la app para confirmar.'
          : `${data.title} — Toca para confirmar lectura.`,
        data: {
          type: 'ANNOUNCEMENT',
          announcementId: announcement.id,
          clubId: params.clubId,
          priority: data.priority,
          requiresConfirmation: String(data.requiresConfirmation),
        },
      })
    }
  }

  return ok(announcement, 201)
}
