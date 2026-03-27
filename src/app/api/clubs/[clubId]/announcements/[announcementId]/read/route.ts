/**
 * POST /api/clubs/[clubId]/announcements/[announcementId]/read
 *
 * Marks an announcement as read/confirmed by the current user.
 * Idempotent: calling it twice for the same announcement is safe.
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'

export async function POST(
  _req: NextRequest,
  { params }: { params: { clubId: string; announcementId: string } }
) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  // Verify the announcement belongs to this club
  const announcement = await prisma.clubAnnouncement.findFirst({
    where: { id: params.announcementId, clubId: params.clubId },
    select: { id: true },
  })
  if (!announcement) return err('Anuncio no encontrado', 404)

  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId: params.announcementId, userId: access.userId } },
    update: {},
    create: {
      announcementId: params.announcementId,
      userId: access.userId,
      clubId: params.clubId,
    },
  })

  return ok({ confirmed: true })
}
