import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/authz'
import { ok } from '@/lib/utils'

// POST /api/notifications/read-all — mark all of user's notifications as read
export async function POST(_req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  await prisma.notification.updateMany({
    where: { userId: auth.userId, read: false },
    data: { read: true },
  })

  return ok({ success: true })
}
