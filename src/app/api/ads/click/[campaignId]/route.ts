import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAdEvent } from '@/lib/ad-engine'

// GET /api/ads/click/[campaignId]?clubId=
//
// Redirect proxy — records the click BEFORE redirecting the user to the
// advertiser URL, ensuring no data loss when the user leaves the site.
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } },
) {
  const { campaignId } = params
  const clubId = req.nextUrl.searchParams.get('clubId') ?? undefined

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: { linkUrl: true, status: true },
  })

  // If campaign doesn't exist or was completed, redirect to base URL
  if (!campaign) {
    return Response.redirect(new URL('/', req.url), 302)
  }

  const session = await getServerSession(authOptions)
  const userId = session?.user ? (session.user as { id: string }).id : undefined

  // Record click synchronously before redirect (spec requirement: no data loss)
  await recordAdEvent(campaignId, 'CLICK', userId, clubId)

  return Response.redirect(campaign.linkUrl, 302)
}
