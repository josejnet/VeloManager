import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { recordAdEvent } from '@/lib/ad-engine'

// POST /api/ads/track
// Body: { campaignId, clubId?, eventType: 'IMPRESSION' | 'CLICK' }
// Fire-and-forget from the client — errors are silently swallowed.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { campaignId, clubId, eventType } = body

    if (!campaignId || !['IMPRESSION', 'CLICK'].includes(eventType)) {
      return NextResponse.json({ ok: false })
    }

    const session = await getServerSession(authOptions)
    const userId = session?.user ? (session.user as { id: string }).id : undefined

    await recordAdEvent(campaignId, eventType, userId, clubId ?? undefined)
    return NextResponse.json({ ok: true })
  } catch {
    // Never surface errors to the client
    return NextResponse.json({ ok: false })
  }
}
