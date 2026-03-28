/**
 * Firebase Admin SDK wrapper for push notifications.
 * Initializes lazily as a singleton.
 */

import { prisma } from '@/lib/prisma'

let firebaseApp: import('firebase-admin/app').App | null = null

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    return null
  }

  const { initializeApp, getApps, cert } = require('firebase-admin/app')

  const existing = getApps()
  if (existing.length > 0) {
    firebaseApp = existing[0]
    return firebaseApp
  }

  firebaseApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })

  return firebaseApp
}

async function handleInvalidToken(token: string) {
  try {
    await prisma.userDevice.deleteMany({ where: { fcmToken: token } })
  } catch {
    // Ignore deletion errors
  }
}

export async function sendPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const app = getFirebaseApp()

  if (!app) {
    console.log('[Push - DEV] sendPush', { token: token.slice(0, 20) + '...', title, body, data })
    return
  }

  const { getMessaging } = require('firebase-admin/messaging')
  try {
    await getMessaging(app).send({
      token,
      notification: { title, body },
      data,
    })
  } catch (error: unknown) {
    const err = error as { code?: string }
    if (err?.code === 'messaging/registration-token-not-registered') {
      await handleInvalidToken(token)
    } else {
      console.error('[Push] sendPush error:', err)
    }
  }
}

// Compatibility interface used by announcements route and other callers
export interface PushPayload {
  userIds: string[]
  title: string
  body: string
  data?: Record<string, string>
}

/**
 * sendPushNotification: looks up FCM tokens for the given userIds and sends
 * a multicast push notification. Compatible with the original stub interface.
 */
export async function sendPushNotification(payload: PushPayload): Promise<void> {
  const devices = await prisma.userDevice.findMany({
    where: { userId: { in: payload.userIds } },
    select: { fcmToken: true },
  })
  const tokens = devices.map((d) => d.fcmToken).filter((t): t is string => !!t)
  if (tokens.length === 0) return
  await sendPushMulticast(tokens, payload.title, payload.body, payload.data)
}

export async function sendPushMulticast(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (tokens.length === 0) return

  const app = getFirebaseApp()

  if (!app) {
    console.log('[Push - DEV] sendPushMulticast', {
      tokenCount: tokens.length,
      title,
      body,
      data,
    })
    return
  }

  const { getMessaging } = require('firebase-admin/messaging')
  const messaging = getMessaging(app)

  // Firebase allows max 500 tokens per multicast
  const chunks: string[][] = []
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500))
  }

  for (const chunk of chunks) {
    try {
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data,
      })

      // Collect invalid tokens for cleanup
      const invalidTokens: string[] = []
      response.responses.forEach((r: { success: boolean; error?: { code?: string } }, idx: number) => {
        if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(chunk[idx])
        }
      })

      if (invalidTokens.length > 0) {
        await prisma.userDevice.deleteMany({
          where: { fcmToken: { in: invalidTokens } },
        })
      }
    } catch (error) {
      console.error('[Push] sendPushMulticast error:', error)
    }
  }
}
