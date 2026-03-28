/**
 * Central notification dispatch service.
 * This is the ONLY place that creates Notification records and dispatches push/email.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendPushMulticast } from '@/lib/push'
import type { NotificationType, Notification } from '@prisma/client'

export interface CreateNotificationInput {
  userId: string
  clubId?: string
  type: NotificationType
  title: string
  message: string
  link?: string
  metadata?: Record<string, unknown>
}

const DEFAULT_PREFERENCES = {
  inApp: true,
  push: true,
  email: false,
}

/**
 * Creates a notification for a single user.
 * Checks preferences, writes to DB if inApp enabled, sends push if push enabled.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification | null> {
  const { userId, clubId, type, title, message, link, metadata } = input

  // Fetch user's preference for this notification type
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId_type: { userId, type } },
  })

  const inApp = pref?.inApp ?? DEFAULT_PREFERENCES.inApp
  const push = pref?.push ?? DEFAULT_PREFERENCES.push

  let notification: Notification | null = null

  if (inApp) {
    notification = await prisma.notification.create({
      data: {
        userId,
        clubId: clubId ?? null,
        type,
        title,
        message,
        link: link ?? null,
        metadata: metadata !== undefined ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })
  }

  if (push) {
    const devices = await prisma.userDevice.findMany({
      where: { userId },
      select: { fcmToken: true },
    })

    const tokens = devices.map((d) => d.fcmToken)
    if (tokens.length > 0) {
      await sendPushMulticast(tokens, title, message, {
        ...(link ? { link } : {}),
        type,
      })
    }
  }

  return notification
}

/**
 * Batch version of createNotification.
 * Uses createMany for in-app notifications and multicast for push.
 */
export async function createNotificationForMany(
  inputs: CreateNotificationInput[]
): Promise<void> {
  if (inputs.length === 0) return

  // Group by type to batch preference lookups
  const userIds = [...new Set(inputs.map((i) => i.userId))]
  const types = [...new Set(inputs.map((i) => i.type))] as NotificationType[]

  // Fetch all relevant preferences in one query
  const prefs = await prisma.notificationPreference.findMany({
    where: {
      userId: { in: userIds },
      type: { in: types },
    },
  })

  // Build a lookup map: "userId:type" -> preference
  const prefMap = new Map<string, { inApp: boolean; push: boolean }>()
  for (const pref of prefs) {
    prefMap.set(`${pref.userId}:${pref.type}`, { inApp: pref.inApp, push: pref.push })
  }

  const inAppInputs: CreateNotificationInput[] = []
  const pushInputs: CreateNotificationInput[] = []

  for (const input of inputs) {
    const key = `${input.userId}:${input.type}`
    const pref = prefMap.get(key) ?? DEFAULT_PREFERENCES
    if (pref.inApp) inAppInputs.push(input)
    if (pref.push) pushInputs.push(input)
  }

  // Bulk insert in-app notifications
  if (inAppInputs.length > 0) {
    await prisma.notification.createMany({
      data: inAppInputs.map((i) => ({
        userId: i.userId,
        clubId: i.clubId ?? null,
        type: i.type,
        title: i.title,
        message: i.message,
        link: i.link ?? null,
        metadata: i.metadata !== undefined ? (i.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      })),
    })
  }

  // Send push notifications
  if (pushInputs.length > 0) {
    const pushUserIds = [...new Set(pushInputs.map((i) => i.userId))]
    const devices = await prisma.userDevice.findMany({
      where: { userId: { in: pushUserIds } },
      select: { userId: true, fcmToken: true },
    })

    // Group tokens by userId
    const tokensByUser = new Map<string, string[]>()
    for (const device of devices) {
      const existing = tokensByUser.get(device.userId) ?? []
      existing.push(device.fcmToken)
      tokensByUser.set(device.userId, existing)
    }

    // Group push inputs by title+message+type for batching
    const batchMap = new Map<string, { tokens: string[]; input: CreateNotificationInput }>()
    for (const input of pushInputs) {
      const key = `${input.type}:${input.title}:${input.message}`
      const existing = batchMap.get(key)
      const userTokens = tokensByUser.get(input.userId) ?? []
      if (existing) {
        existing.tokens.push(...userTokens)
      } else {
        batchMap.set(key, { tokens: [...userTokens], input })
      }
    }

    for (const { tokens, input } of batchMap.values()) {
      if (tokens.length > 0) {
        await sendPushMulticast(tokens, input.title, input.message, {
          ...(input.link ? { link: input.link } : {}),
          type: input.type,
        })
      }
    }
  }
}

/**
 * Notify all APPROVED CLUB_ADMIN members of a club.
 */
export async function notifyClubAdmins(
  clubId: string,
  input: Omit<CreateNotificationInput, 'userId'>
): Promise<void> {
  const memberships = await prisma.clubMembership.findMany({
    where: { clubId, clubRole: 'ADMIN', status: 'APPROVED' },
    select: { userId: true },
  })

  const inputs: CreateNotificationInput[] = memberships.map((m) => ({
    ...input,
    userId: m.userId,
    clubId,
  }))

  await createNotificationForMany(inputs)
}

/**
 * Notify all SUPER_ADMIN users.
 */
export async function notifySuperAdmins(
  input: Omit<CreateNotificationInput, 'userId' | 'clubId'>
): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { platformRole: 'SUPER_ADMIN' },
    select: { id: true },
  })

  const inputs: CreateNotificationInput[] = admins.map((a) => ({
    ...input,
    userId: a.id,
  }))

  await createNotificationForMany(inputs)
}
