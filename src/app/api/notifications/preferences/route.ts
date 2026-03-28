import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/authz'
import { ok, err } from '@/lib/utils'
import type { NotificationType } from '@prisma/client'

const ALL_TYPES: NotificationType[] = [
  'EVENT_REMINDER',
  'PAYMENT_DUE',
  'PAYMENT_RECEIVED',
  'NEW_MEMBER',
  'TICKET_REPLY',
  'SYSTEM',
  'PURCHASE_UPDATE',
]

const DEFAULT_PREFERENCES: Record<NotificationType, { inApp: boolean; push: boolean; email: boolean }> = {
  EVENT_REMINDER: { inApp: true, push: true, email: false },
  PAYMENT_DUE: { inApp: true, push: true, email: false },
  PAYMENT_RECEIVED: { inApp: true, push: true, email: false },
  NEW_MEMBER: { inApp: true, push: true, email: false },
  TICKET_REPLY: { inApp: true, push: true, email: false },
  SYSTEM: { inApp: true, push: true, email: false },
  PURCHASE_UPDATE: { inApp: true, push: true, email: false },
}

// GET /api/notifications/preferences — return user's preferences for all 7 types
export async function GET(_req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const existingPrefs = await prisma.notificationPreference.findMany({
    where: { userId: auth.userId },
  })

  const prefMap = new Map(existingPrefs.map((p) => [p.type, p]))

  const preferences = ALL_TYPES.map((type) => {
    const existing = prefMap.get(type)
    const defaults = DEFAULT_PREFERENCES[type]
    return {
      type,
      inApp: existing?.inApp ?? defaults.inApp,
      push: existing?.push ?? defaults.push,
      email: existing?.email ?? defaults.email,
    }
  })

  return ok({ preferences })
}

// POST /api/notifications/preferences — upsert preferences
export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  if (!Array.isArray(body)) {
    return err('Body must be an array of preferences', 400)
  }

  const updates = body as {
    type: NotificationType
    inApp?: boolean
    push?: boolean
    email?: boolean
  }[]

  const validTypes = new Set<string>(ALL_TYPES)
  for (const update of updates) {
    if (!update.type || !validTypes.has(update.type)) {
      return err(`Invalid notification type: ${update.type}`, 400)
    }
  }

  const upserts = updates.map((update) => {
    const defaults = DEFAULT_PREFERENCES[update.type]
    return prisma.notificationPreference.upsert({
      where: { userId_type: { userId: auth.userId, type: update.type } },
      create: {
        userId: auth.userId,
        type: update.type,
        inApp: update.inApp ?? defaults.inApp,
        push: update.push ?? defaults.push,
        email: update.email ?? defaults.email,
      },
      update: {
        ...(update.inApp !== undefined ? { inApp: update.inApp } : {}),
        ...(update.push !== undefined ? { push: update.push } : {}),
        ...(update.email !== undefined ? { email: update.email } : {}),
      },
    })
  })

  const results = await Promise.all(upserts)

  return ok({ preferences: results })
}
