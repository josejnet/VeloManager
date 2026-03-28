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
})

// GET /api/clubs/[clubId]/votes
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)
  const activeOnly = req.nextUrl.searchParams.get('active') !== 'false'

  const where = {
    clubId: params.clubId,
    ...(activeOnly ? { active: true } : {}),
  }

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

  // For SOCIO, inject whether the user has already voted
  const userId = access.userId
  const votesWithUserStatus = await Promise.all(
    votes.map(async (vote) => {
      const userResponse = await prisma.voteResponse.findUnique({
        where: { voteId_userId: { voteId: vote.id, userId } },
        select: { optionId: true },
      })
      return {
        ...vote,
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

  const vote = await prisma.vote.create({
    data: {
      clubId: params.clubId,
      title: parsed.data.title,
      description: parsed.data.description,
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

  // Notify all members
  const members = await prisma.clubMembership.findMany({
    where: { clubId: params.clubId, status: 'APPROVED', role: 'SOCIO' },
    select: { userId: true },
  })
  if (members.length > 0) {
    await prisma.notification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        clubId: params.clubId,
        title: 'Nueva votación disponible',
        message: `Hay una nueva votación: "${vote.title}". ¡Tu voto cuenta!`,
        link: '/socio/votes',
      })),
    })
  }

  return ok(vote, 201)
}
