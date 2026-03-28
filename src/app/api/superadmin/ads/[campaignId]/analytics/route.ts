import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/club-access'
import { ok, err } from '@/lib/utils'
import { subDays, format, eachDayOfInterval } from 'date-fns'

// GET /api/superadmin/ads/[campaignId]/analytics?days=30
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } },
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: params.campaignId },
    select: { id: true, title: true, budgetLimit: true, budgetUsed: true, budgetType: true },
  })
  if (!campaign) return err('Campaña no encontrada', 404)

  const days = Math.min(parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10), 90)
  const since = subDays(new Date(), days)

  // Aggregate by day
  const rows = await prisma.adAnalytic.findMany({
    where: { campaignId: params.campaignId, timestamp: { gte: since } },
    select: { eventType: true, timestamp: true },
    orderBy: { timestamp: 'asc' },
  })

  // Build a day-by-day series filled with zeroes
  const interval = eachDayOfInterval({ start: since, end: new Date() })
  const dayMap: Record<string, { date: string; impressions: number; clicks: number }> = {}
  for (const d of interval) {
    const key = format(d, 'yyyy-MM-dd')
    dayMap[key] = { date: key, impressions: 0, clicks: 0 }
  }
  for (const row of rows) {
    const key = format(new Date(row.timestamp), 'yyyy-MM-dd')
    if (dayMap[key]) {
      if (row.eventType === 'IMPRESSION') dayMap[key].impressions++
      else dayMap[key].clicks++
    }
  }

  const series = Object.values(dayMap)
  const totalImpressions = series.reduce((s, d) => s + d.impressions, 0)
  const totalClicks = series.reduce((s, d) => s + d.clicks, 0)
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  return ok({
    campaign,
    totals: { impressions: totalImpressions, clicks: totalClicks, ctr },
    series,
  })
}
