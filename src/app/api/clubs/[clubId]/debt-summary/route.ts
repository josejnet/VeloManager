import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireClubAccess } from '@/lib/authz'
import { ok, getPaginationParams, buildPaginatedResponse } from '@/lib/utils'

// GET /api/clubs/[clubId]/debt-summary
// Returns paginated list of members with outstanding debts (unpaid quotas + pending/processing orders)
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const access = await requireClubAccess(params.clubId, 'ADMIN')
  if (!access.ok) return access.response

  const { page, pageSize, skip, take } = getPaginationParams(req.nextUrl.searchParams)

  // Fetch all approved memberships with their unpaid quotas
  const memberships = await prisma.clubMembership.findMany({
    where: { clubId: params.clubId, status: 'APPROVED' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      quotas: {
        where: { status: { in: ['PENDING', 'OVERDUE'] } },
        select: { amount: true },
      },
    },
  })

  // Fetch pending/processing orders per user in this club
  const pendingOrders = await prisma.order.findMany({
    where: {
      clubId: params.clubId,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: {
      userId: true,
      totalAmount: true,
      status: true,
    },
  })

  // Group order amounts and counts by userId
  const orderDataByUser: Record<string, { total: number; count: number }> = {}
  for (const order of pendingOrders) {
    const prev = orderDataByUser[order.userId] ?? { total: 0, count: 0 }
    orderDataByUser[order.userId] = {
      total: prev.total + Number(order.totalAmount),
      count: prev.count + 1,
    }
  }

  // Build full debt summary and filter out zero-debt members
  const allRows = memberships
    .map((m) => {
      const totalQuotasDebt = m.quotas.reduce((sum, q) => sum + Number(q.amount), 0)
      const orderData = orderDataByUser[m.user.id] ?? { total: 0, count: 0 }
      const totalOrdersDebt = orderData.total
      const totalDebt = totalQuotasDebt + totalOrdersDebt
      return {
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        unpaidQuotasAmount: totalQuotasDebt,
        unpaidOrdersAmount: totalOrdersDebt,
        totalDebt,
        unpaidQuotasCount: m.quotas.length,
        unpaidOrdersCount: orderData.count,
      }
    })
    .filter((r) => r.totalDebt > 0)
    .sort((a, b) => b.totalDebt - a.totalDebt)

  const total = allRows.length
  const paginatedRows = allRows.slice(skip, skip + take)

  const totalQuotaDebt = allRows.reduce((sum, r) => sum + r.unpaidQuotasAmount, 0)
  const totalOrderDebt = allRows.reduce((sum, r) => sum + r.unpaidOrdersAmount, 0)
  const grandTotal = totalQuotaDebt + totalOrderDebt

  return ok({
    ...buildPaginatedResponse(paginatedRows, total, page, pageSize),
    totals: { totalQuotaDebt, totalOrderDebt, grandTotal },
  })
}
