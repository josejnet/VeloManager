/**
 * Ad-Engine — selects the best matching campaign for a given club/user context.
 *
 * Selection algorithm:
 * 1. PREMIUM/ENTERPRISE clubs are ad-free → return null immediately.
 * 2. Query all ACTIVE campaigns for the requested placement that are within
 *    their scheduling window.
 * 3. Filter in JS by targeting rules (sport, province, locality, budget).
 * 4. Rank by budget-remaining ratio (highest remaining = highest priority).
 * 5. Return the winner or null.
 */
import { prisma } from '@/lib/prisma'
import type { AdPlacement } from '@prisma/client'

// Plans that enjoy an ad-free experience
const AD_FREE_PLANS = new Set(['PREMIUM', 'ENTERPRISE'])

export interface ServedAd {
  id: string
  advertiserName: string
  title: string
  description: string | null
  imageUrl: string | null
  linkUrl: string
  ctaText: string
}

interface AdContext {
  clubId: string
  userId?: string
  placement: AdPlacement
}

export async function serveAd(ctx: AdContext): Promise<ServedAd | null> {
  // ── 1. Plan check ────────────────────────────────────────────────────────
  const subscription = await prisma.clubSubscription.findUnique({
    where: { clubId: ctx.clubId },
    select: { plan: true },
  })
  if (subscription && AD_FREE_PLANS.has(subscription.plan)) return null

  // ── 2. Club context ──────────────────────────────────────────────────────
  const club = await prisma.club.findUnique({
    where: { id: ctx.clubId },
    select: { sport: true, province: true, locality: true },
  })
  if (!club) return null

  const now = new Date()

  // ── 3. Fetch candidate campaigns ─────────────────────────────────────────
  const candidates = await prisma.adCampaign.findMany({
    where: {
      status: 'ACTIVE',
      placement: ctx.placement,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    select: {
      id: true,
      advertiserName: true,
      title: true,
      description: true,
      imageUrl: true,
      linkUrl: true,
      ctaText: true,
      sportTypes: true,
      provinces: true,
      localities: true,
      budgetLimit: true,
      budgetUsed: true,
      budgetType: true,
    },
  })

  // ── 4. Targeting filter ──────────────────────────────────────────────────
  const matching = candidates.filter((c) => {
    // Budget exhausted
    if (c.budgetUsed >= c.budgetLimit) return false
    // Sport: empty = global; otherwise club sport must be in the list
    if (c.sportTypes.length > 0 && !c.sportTypes.includes(club.sport)) return false
    // Province: empty = global
    if (c.provinces.length > 0) {
      if (!club.province || !c.provinces.includes(club.province)) return false
    }
    // Locality: empty = global
    if (c.localities.length > 0) {
      if (!club.locality || !c.localities.includes(club.locality)) return false
    }
    return true
  })

  if (matching.length === 0) return null

  // ── 5. Rank by budget-remaining ratio ────────────────────────────────────
  matching.sort((a, b) => {
    const ratioA = (a.budgetLimit - a.budgetUsed) / a.budgetLimit
    const ratioB = (b.budgetLimit - b.budgetUsed) / b.budgetLimit
    return ratioB - ratioA
  })

  const { id, advertiserName, title, description, imageUrl, linkUrl, ctaText } = matching[0]
  return { id, advertiserName, title, description, imageUrl, linkUrl, ctaText }
}

/**
 * Records an ad event and updates budget counters.
 * Used by both the impression-tracking endpoint and the click-redirect route.
 */
export async function recordAdEvent(
  campaignId: string,
  eventType: 'IMPRESSION' | 'CLICK',
  userId?: string,
  clubId?: string,
) {
  // Insert analytic row
  await prisma.adAnalytic.create({
    data: { campaignId, eventType, userId, clubId },
  })

  // Increment budgetUsed based on budget type
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: { budgetType: true, budgetUsed: true, budgetLimit: true },
  })
  if (!campaign) return

  const shouldCount =
    (campaign.budgetType === 'CLICKS' && eventType === 'CLICK') ||
    (campaign.budgetType === 'IMPRESSIONS' && eventType === 'IMPRESSION')

  if (shouldCount) {
    const updated = await prisma.adCampaign.update({
      where: { id: campaignId },
      data: { budgetUsed: { increment: 1 } },
      select: { budgetUsed: true, budgetLimit: true },
    })
    // Auto-complete when budget is exhausted
    if (updated.budgetUsed >= updated.budgetLimit) {
      await prisma.adCampaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED' },
      })
    }
  }
}
