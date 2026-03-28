import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

const CreateAnnouncementSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().min(1),
  imageUrl: z.string().url().optional(),
  pinned: z.boolean().default(false),
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
      skip, take,
      orderBy: [{ pinned: 'desc' }, { publishAt: 'desc' }],
      include: { sharedFiles: true },
    }),
    prisma.clubAnnouncement.count({ where }),
  ])

  return ok(buildPaginatedResponse(announcements, total, page, pageSize))
}

// POST /api/clubs/[clubId]/announcements
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = CreateAnnouncementSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { files, ...data } = parsed.data

  const announcement = await prisma.clubAnnouncement.create({
    data: {
      clubId: params.clubId,
      authorId: access.userId,
      ...data,
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

  // Notify members
  const members = await prisma.clubMembership.findMany({
    where: { clubId: params.clubId, status: 'APPROVED', role: 'SOCIO' },
    select: { userId: true },
  })
  if (members.length > 0) {
    await prisma.notification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        clubId: params.clubId,
        title: parsed.data.pinned ? `📌 ${parsed.data.title}` : parsed.data.title,
        message: 'Hay un nuevo anuncio del club. Toca para leer.',
        link: '/socio',
      })),
    })
  }

  return ok(announcement, 201)
}
