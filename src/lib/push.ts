/**
 * Push Notification Service — FCM (Firebase Cloud Messaging)
 *
 * Architecture:
 *  1. Client registers FCM token on login → POST /api/profile/push-token
 *  2. Token is stored in UserPushToken table (userId, token, platform)
 *  3. On server events (announcements, etc.), sendPushNotification() looks up
 *     all active tokens for the target users and batches FCM requests.
 *
 * Production setup:
 *  - Set FIREBASE_SERVICE_ACCOUNT env var with the JSON of your Firebase
 *    service account credentials.
 *  - Install firebase-admin: npm install firebase-admin
 *  - Uncomment the FCM implementation below.
 *
 * Current state: stub that logs the payload (safe for dev/CI).
 */

export interface PushPayload {
  userIds: string[]
  title: string
  body: string
  /** Extra key-value pairs forwarded to the client app (deep-link routing, etc.) */
  data?: Record<string, string>
}

export async function sendPushNotification(payload: PushPayload): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    // Dev: just log so we can verify the payload without real FCM credentials
    console.log('[push:dev]', JSON.stringify({ userIds: payload.userIds.length, title: payload.title }))
    return
  }

  // ── Production FCM implementation ─────────────────────────────────────────
  // Uncomment and install firebase-admin when FIREBASE_SERVICE_ACCOUNT is set.
  //
  // import { prisma } from '@/lib/prisma'
  // import { initializeApp, getApps, cert } from 'firebase-admin/app'
  // import { getMessaging } from 'firebase-admin/messaging'
  //
  // if (!getApps().length) {
  //   initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) })
  // }
  //
  // const tokens = await prisma.userPushToken.findMany({
  //   where: { userId: { in: payload.userIds }, active: true },
  //   select: { token: true },
  // })
  //
  // if (!tokens.length) return
  //
  // const tokenList = tokens.map((t) => t.token)
  // const CHUNK = 500  // FCM multicast limit
  //
  // for (let i = 0; i < tokenList.length; i += CHUNK) {
  //   const chunk = tokenList.slice(i, i + CHUNK)
  //   await getMessaging().sendEachForMulticast({
  //     tokens: chunk,
  //     notification: { title: payload.title, body: payload.body },
  //     data: payload.data ?? {},
  //     android: { priority: 'high' },
  //     apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  //   })
  // }
}
