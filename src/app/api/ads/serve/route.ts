import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serveAd } from '@/lib/ad-engine'
import type { AdPlacement } from '@prisma/client'

const VALID_PLACEMENTS = new Set<string>(['DASHBOARD', 'EVENTS', 'CHECKOUT'])

// GET /api/ads/serve?clubId=&placement=
export async function GET(req: NextRequest) {
  const clubId = req.nextUrl.searchParams.get('clubId')
  const placementRaw = req.nextUrl.searchParams.get('placement')

  if (!clubId || !placementRaw || !VALID_PLACEMENTS.has(placementRaw)) {
    return NextResponse.json({ ad: null })
  }

  const session = await getServerSession(authOptions)
  const userId = session?.user ? (session.user as { id: string }).id : undefined

  const ad = await serveAd({ clubId, userId, placement: placementRaw as AdPlacement })
  return NextResponse.json({ ad })
}
