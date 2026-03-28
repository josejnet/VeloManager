import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { ok, err } from '@/lib/utils'

const CreateAttachmentSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  url: z.string().url('URL inválida'),
  size: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
})

// GET /api/clubs/[clubId]/events/[eventId]/attachments
export async function GET(
  _req: NextRequest,
  { params }: { params: { clubId: string; eventId: string } }
) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const event = await prisma.clubEvent.findFirst({
    where: { id: params.eventId, clubId: params.clubId },
    select: { published: true },
  })
  if (!event) return err('Evento no encontrado', 404)

  const isAdmin = access.clubRole === 'ADMIN' || access.platformRole === 'SUPER_ADMIN'
  if (!event.published && !isAdmin) return err('Evento no encontrado', 404)

  const attachments = await prisma.eventAttachment.findMany({
    where: { eventId: params.eventId },
    orderBy: { createdAt: 'asc' },
  })

  return ok(attachments)
}

// POST /api/clubs/[clubId]/events/[eventId]/attachments
export async function POST(
  req: NextRequest,
  { params }: { params: { clubId: string; eventId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const event = await prisma.clubEvent.findFirst({
    where: { id: params.eventId, clubId: params.clubId },
  })
  if (!event) return err('Evento no encontrado', 404)

  const body = await req.json().catch(() => null)
  const parsed = CreateAttachmentSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message, 400)

  const attachment = await prisma.eventAttachment.create({
    data: {
      eventId: params.eventId,
      clubId: params.clubId,
      name: parsed.data.name,
      url: parsed.data.url,
      size: parsed.data.size ?? null,
      mimeType: parsed.data.mimeType ?? null,
      uploadedById: access.userId,
    },
  })

  return ok(attachment, 201)
}
