/**
 * GET /api/clubs/[clubId]/announcements/pending
 *
 * Returns announcements that:
 *  a) The current user has NOT yet confirmed/read (no AnnouncementRead record)
 *  b) Are currently published and not expired
 *  c) Target this user (all-members OR event attendee)
 *
 * Ordered by: EMERGENCY first, then by publishAt desc.
 * Used by the EmergencyAnnouncementModal to know what to show.
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/club-access'
import { ok } from '@/lib/utils'

export async function GET(_req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId)
  if (!access.ok) return access.response

  const now = new Date()
  const userId = access.userId

  // Find event ids this user is attending (for segmented announcements)
  const attendingEventIds = await prisma.eventAttendee.findMany({
    where: { userId, clubId: params.clubId, status: 'GOING' },
    select: { eventId: true },
  }).then((rows) => rows.map((r) => r.eventId))

  // Get already-read announcement ids for this user in this club
  const readIds = await prisma.announcementRead.findMany({
    where: { userId, clubId: params.clubId },
    select: { announcementId: true },
  }).then((rows) => rows.map((r) => r.announcementId))

  const pending = await prisma.clubAnnouncement.findMany({
    where: {
      clubId: params.clubId,
      publishAt: { lte: now },
      id: { notIn: readIds.length ? readIds : ['__none__'] },
      AND: [
        // Must not be expired
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        // Segmentation: targeting all members OR user is attending the target event
        {
          OR: [
            { targetEventId: null },
            ...(attendingEventIds.length
              ? [{ targetEventId: { in: attendingEventIds } }]
              : []),
          ],
        },
      ],
    },
    orderBy: [{ priority: 'desc' }, { publishAt: 'desc' }],
    include: { sharedFiles: true },
    take: 10,
  })

  return ok(pending)
}
