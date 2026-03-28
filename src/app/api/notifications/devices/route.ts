import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'

// POST /api/notifications/devices — register/update a device FCM token
export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const { fcmToken, platform } = body as { fcmToken?: string; platform?: string }

  if (!fcmToken || typeof fcmToken !== 'string') {
    return err('fcmToken is required', 400)
  }

  const validPlatforms = ['web', 'android', 'ios']
  if (!platform || !validPlatforms.includes(platform)) {
    return err('platform must be one of: web, android, ios', 400)
  }

  const userAgent = req.headers.get('user-agent') ?? undefined

  const device = await prisma.userDevice.upsert({
    where: { fcmToken },
    create: {
      userId: auth.userId,
      fcmToken,
      platform,
      userAgent,
      lastSeen: new Date(),
    },
    update: {
      userId: auth.userId,
      platform,
      userAgent,
      lastSeen: new Date(),
    },
  })

  return ok(device, 201)
}

// DELETE /api/notifications/devices — unregister a device FCM token
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const { fcmToken } = body as { fcmToken?: string }

  if (!fcmToken || typeof fcmToken !== 'string') {
    return err('fcmToken is required', 400)
  }

  const device = await prisma.userDevice.findUnique({
    where: { fcmToken },
    select: { userId: true },
  })

  if (!device) {
    return err('Device not found', 404)
  }

  if (device.userId !== auth.userId) {
    return err('Forbidden', 403)
  }

  await prisma.userDevice.delete({ where: { fcmToken } })

  return ok({ success: true })
}
