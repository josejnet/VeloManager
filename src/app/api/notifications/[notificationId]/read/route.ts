import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'

// POST /api/notifications/[notificationId]/read — mark single notification as read
export async function POST(
  _req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { notificationId } = params

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true },
  })

  if (!notification) {
    return err('Notification not found', 404)
  }

  if (notification.userId !== auth.userId) {
    return err('Forbidden', 403)
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  })

  return ok(updated)
}
