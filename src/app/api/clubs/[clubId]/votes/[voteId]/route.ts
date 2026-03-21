import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err } from '@/lib/utils'

const RespondSchema = z.object({ optionId: z.string() })

// POST /api/clubs/[clubId]/votes/[voteId] — cast a vote
export async function POST(
  req: NextRequest,
  { params }: { params: { clubId: string; voteId: string } }
) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const vote = await prisma.vote.findFirst({
    where: { id: params.voteId, clubId: params.clubId, active: true },
    include: { options: { select: { id: true } } },
  })
  if (!vote) return err('Votación no encontrada o cerrada', 404)

  const body = await req.json().catch(() => null)
  const parsed = RespondSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const validOption = vote.options.some((o) => o.id === parsed.data.optionId)
  if (!validOption) return err('Opción no válida', 400)

  const existing = await prisma.voteResponse.findUnique({
    where: { voteId_userId: { voteId: params.voteId, userId: access.userId } },
  })
  if (existing) return err('Ya has votado en esta encuesta', 409)

  const response = await prisma.voteResponse.create({
    data: {
      voteId: params.voteId,
      userId: access.userId,
      clubId: params.clubId,
      optionId: parsed.data.optionId,
    },
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.VOTE_CAST,
    entity: 'Vote',
    entityId: params.voteId,
    details: { voteTitle: vote.title },
  })

  return ok(response, 201)
}

// PATCH /api/clubs/[clubId]/votes/[voteId] — close vote (admin)
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { clubId: string; voteId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'CLUB_ADMIN')
  if (!access.ok) return access.response

  const vote = await prisma.vote.findFirst({
    where: { id: params.voteId, clubId: params.clubId },
  })
  if (!vote) return err('Votación no encontrada', 404)

  const updated = await prisma.vote.update({
    where: { id: params.voteId },
    data: { active: false, closedAt: new Date() },
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.VOTE_CLOSED,
    entity: 'Vote',
    entityId: params.voteId,
    details: { title: vote.title },
  })

  return ok(updated)
}
