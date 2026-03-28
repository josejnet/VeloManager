import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { writeAudit, AUDIT } from '@/lib/audit'
import { ok, err, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

const CreateVoteSchema = z.object({
  title: z.string().min(3).max(300),
  description: z.string().max(1000).optional(),
  options: z.array(z.string().min(1).max(200)).min(2).max(10),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
})

// Derives the display status of a vote based on fields + current time
export function voteStatus(vote: { active: boolean; startsAt: Date | null; endsAt: Date | null }): 'scheduled' | 'active' | 'closed' {
  if (!vote.active) return 'closed'
  const now = new Date()
  if (vote.startsAt && vote.startsAt > now) return 'scheduled'
  if (vote.endsAt && vote.endsAt <= now) return 'closed'
  return 'active'
}

// GET /api/clubs/[clubId]/votes
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  // active=false → return all (admin view); default → only active+scheduled (socio view)
  const allVotes = req.nextUrl.searchParams.get('active') === 'false'

  const where = allVotes
    ? { clubId: params.clubId }
    : { clubId: params.clubId, active: true }

  const [votes, total] = await Promise.all([
    prisma.vote.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        options: {
          include: { _count: { select: { responses: true } } },
          orderBy: { order: 'asc' },
        },
        _count: { select: { responses: true } },
      },
    }),
    prisma.vote.count({ where }),
  ])

  // Inject per-user voting status + computed status string
  const userId = access.userId
  const votesWithUserStatus = await Promise.all(
    votes.map(async (vote) => {
      const userResponse = await prisma.voteResponse.findUnique({
        where: { voteId_userId: { voteId: vote.id, userId } },
        select: { optionId: true },
      })
      return {
        ...vote,
        status: voteStatus(vote),
        userVoted: !!userResponse,
        userOptionId: userResponse?.optionId ?? null,
      }
    })
  )

  return ok(buildPaginatedResponse(votesWithUserStatus, total, page, pageSize))
}

// POST /api/clubs/[clubId]/votes — admin creates a vote
export async function POST(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const body = await req.json().catch(() => null)
  const parsed = CreateVoteSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  if (parsed.data.startsAt && parsed.data.endsAt) {
    if (new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) {
      return err('La fecha de cierre debe ser posterior a la de inicio')
    }
  }

  const vote = await prisma.vote.create({
    data: {
      clubId: params.clubId,
      title: parsed.data.title,
      description: parsed.data.description,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      options: {
        create: parsed.data.options.map((text, order) => ({ text, order })),
      },
    },
    include: { options: true },
  })

  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: AUDIT.VOTE_CREATED,
    entity: 'Vote',
    entityId: vote.id,
    details: { title: vote.title, options: parsed.data.options.length },
  })

  // Notify all approved members — link is club-scoped for correct navigation
  const members = await prisma.clubMembership.findMany({
    where: { clubId: params.clubId, status: 'APPROVED', clubRole: 'MEMBER' },
    select: { userId: true },
  })
  if (members.length > 0) {
    await prisma.notification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        clubId: params.clubId,
        title: 'Nueva votación disponible',
        message: `Hay una nueva votación: "${vote.title}". ¡Tu voto cuenta!`,
        link: `/clubs/${params.clubId}/socio/votes`,
      })),
    })
  }

  return ok(vote, 201)
}
