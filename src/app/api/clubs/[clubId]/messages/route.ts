import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { sendEmail, clubMessageEmail } from '@/lib/email'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'
import type { UserRole } from '@prisma/client'

const CreateMessageSchema = z.object({
  subject: z.string().min(1).max(300),
  body: z.string().min(1),
  // Either targetRole (broadcast) or specific userIds
  targetRole: z.enum(['CLUB_ADMIN', 'SOCIO', 'ALL']).optional(),
  recipientIds: z.array(z.string()).optional(),
  sendEmail: z.boolean().default(true),
})

// GET /api/clubs/[clubId]/messages — list sent messages (admin)
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)

  const [messages, total] = await Promise.all([
    prisma.clubMessage.findMany({
      where: { clubId: params.clubId },
      skip, take,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true } },
        _count: { select: { recipients: true } },
      },
    }),
    prisma.clubMessage.count({ where: { clubId: params.clubId } }),
  ])

  return ok(buildPaginatedResponse(messages, total, page, pageSize))
}

// POST /api/clubs/[clubId]/messages — create and send message
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = CreateMessageSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const club = await prisma.club.findUnique({ where: { id: params.clubId }, select: { name: true, id: true } })
  if (!club) return err('Club no encontrado', 404)

  const sender = await prisma.user.findUnique({ where: { id: access.userId }, select: { name: true } })

  // Determine recipients
  let recipientUserIds: string[] = []

  if (parsed.data.targetRole) {
    const roleFilter = parsed.data.targetRole === 'ALL'
      ? {}
      : { role: parsed.data.targetRole as UserRole }

    const memberships = await prisma.clubMembership.findMany({
      where: { clubId: params.clubId, status: 'APPROVED', ...roleFilter },
      select: { userId: true, user: { select: { email: true, name: true } } },
    })
    recipientUserIds = memberships.map((m) => m.userId)

    // Send emails
    if (parsed.data.sendEmail) {
      const { subject, html } = clubMessageEmail(
        club.name, sender?.name ?? 'Admin',
        parsed.data.subject, parsed.data.body,
        `${process.env.NEXTAUTH_URL}/socio`
      )
      // batch send (max 50/request in most providers)
      const emails = memberships.map((m) => (m.user as { email: string }).email)
      for (let i = 0; i < emails.length; i += 50) {
        await sendEmail({ to: emails.slice(i, i + 50), subject, html })
      }
    }
  } else if (parsed.data.recipientIds?.length) {
    recipientUserIds = parsed.data.recipientIds
  } else {
    return err('Debes especificar destinatarios')
  }

  const message = await prisma.clubMessage.create({
    data: {
      clubId: params.clubId,
      senderId: access.userId,
      subject: parsed.data.subject,
      body: parsed.data.body,
      targetRole: parsed.data.targetRole === 'ALL' ? null : (parsed.data.targetRole as UserRole | null ?? null),
      status: 'SENT',
      sentAt: new Date(),
      recipients: {
        create: recipientUserIds.map((userId) => ({ userId })),
      },
    },
    include: { _count: { select: { recipients: true } } },
  })

  // In-app notifications
  if (recipientUserIds.length > 0) {
    await prisma.notification.createMany({
      data: recipientUserIds.map((userId) => ({
        userId,
        clubId: params.clubId,
        title: `Nuevo mensaje: ${parsed.data.subject}`,
        message: `${sender?.name ?? 'Admin'} te ha enviado un mensaje.`,
        link: '/socio',
      })),
      skipDuplicates: true,
    })
  }

  return ok(message, 201)
}
