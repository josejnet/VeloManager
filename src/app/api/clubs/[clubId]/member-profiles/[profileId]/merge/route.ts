import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { ok, err } from '@/lib/utils'
import { writeAudit } from '@/lib/audit'

const MergeSchema = z.object({
  targetUserId: z.string().min(1, 'targetUserId es obligatorio'),
})

// POST /api/clubs/[clubId]/member-profiles/[profileId]/merge
export async function POST(
  req: NextRequest,
  { params }: { params: { clubId: string; profileId: string } }
) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  // 1. Find the profile
  const profile = await prisma.clubMemberProfile.findFirst({
    where: { id: params.profileId, clubId: params.clubId },
  })
  if (!profile) return err('Perfil no encontrado', 404)

  // 2. Parse and validate body
  const body = await req.json().catch(() => null)
  const parsed = MergeSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0].message)

  const { targetUserId } = parsed.data

  // 3. Find the target user
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true },
  })
  if (!targetUser) return err('Usuario destino no encontrado', 404)

  // 4. Check if targetUser has an approved membership in this club
  const membership = await prisma.clubMembership.findUnique({
    where: { userId_clubId: { userId: targetUserId, clubId: params.clubId } },
    select: { id: true, status: true },
  })

  const newMembershipId = membership?.status === 'APPROVED' ? membership.id : null

  // 5. Update profile
  const updated = await prisma.clubMemberProfile.update({
    where: { id: params.profileId },
    data: {
      userId: targetUser.id,
      membershipId: newMembershipId,
      status: 'LINKED',
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      membership: { select: { id: true, status: true, role: true } },
    },
  })

  // 6. Write audit log
  await writeAudit({
    clubId: params.clubId,
    userId: access.userId,
    action: 'MEMBER_PROFILE_MERGED',
    entity: 'ClubMemberProfile',
    entityId: params.profileId,
    details: {
      targetUserId,
      targetUserEmail: targetUser.email,
      membershipId: newMembershipId,
      previousUserId: profile.userId,
    },
  })

  return ok(updated)
}
