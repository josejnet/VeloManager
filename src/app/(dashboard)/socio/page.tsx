import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Badge, QuotaStatusBadge, OrderStatusBadge } from '@/components/ui/Badge'
import { fmtCurrency, fmtDate } from '@/lib/utils'
import { Wallet, ShoppingBag, Vote, Trophy } from 'lucide-react'

export default async function SocioDashboard() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id: string }).id

  const membership = await prisma.clubMembership.findFirst({
    where: { userId, status: 'APPROVED' },
    include: {
      club: true,
      quotas: { orderBy: { year: 'desc' }, take: 3 },
    },
  })

  if (!membership) redirect('/login')

  const { club } = membership
  const clubId = club.id

  const [myOrders, activeVotes, openWindows] = await Promise.all([
    prisma.order.findMany({
      where: { userId, clubId, status: { not: 'CANCELLED' } },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { purchaseWindow: true, items: { include: { product: { select: { name: true } } } } },
    }),
    prisma.vote.count({ where: { clubId, active: true } }),
    prisma.purchaseWindow.count({ where: { clubId, status: 'OPEN' } }),
  ])

  const totalDebt = myOrders
    .filter((o) => o.status === 'PENDING')
    .reduce((s, o) => s + Number(o.totalAmount), 0)

  const pendingQuotas = membership.quotas.filter((q) => q.status !== 'PAID')

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title={`Bienvenido, ${(session.user as { name?: string }).name}`} clubId={clubId} />

      <main className="flex-1 p-6 space-y-6">
        {/* Club header */}
        <div className="bg-primary rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <Trophy className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{club.name}</h2>
              {club.slogan && <p className="text-white/80 text-sm mt-0.5">{club.slogan}</p>}
              <p className="text-white/60 text-xs mt-1">{club.sport}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard title="Deuda pendiente" value={fmtCurrency(totalDebt)} icon={Wallet} color="orange"
            subtitle={totalDebt > 0 ? 'En pedidos confirmados' : 'Sin deudas pendientes'} />
          <StatCard title="Votaciones activas" value={activeVotes} icon={Vote} color="purple" />
          <StatCard title="Campañas abiertas" value={openWindows} icon={ShoppingBag} color="blue" />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Quotas */}
          <Card>
            <CardHeader>
              <CardTitle>Mis cuotas</CardTitle>
              <a href="/socio" className="text-xs text-primary hover:underline">Ver historial</a>
            </CardHeader>
            {membership.quotas.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Sin cuotas asignadas</p>
            ) : (
              <div className="space-y-2">
                {membership.quotas.map((q) => (
                  <div key={q.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Cuota {q.year}</p>
                      <p className="text-xs text-gray-400">{fmtCurrency(q.amount)}</p>
                    </div>
                    <QuotaStatusBadge status={q.status} />
                  </div>
                ))}
                {pendingQuotas.length > 0 && (
                  <p className="text-xs text-orange-500 font-medium pt-1">
                    {pendingQuotas.length} cuota(s) pendiente(s) de pago
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Recent orders */}
          <Card>
            <CardHeader>
              <CardTitle>Mis pedidos</CardTitle>
              <a href="/socio/purchases" className="text-xs text-primary hover:underline">Ver todos</a>
            </CardHeader>
            {myOrders.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Sin pedidos aún</p>
            ) : (
              <div className="space-y-2">
                {myOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{order.purchaseWindow.name}</p>
                      <p className="text-xs text-gray-400">
                        {order.items.length} artículo(s) · {fmtDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{fmtCurrency(order.totalAmount)}</p>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  )
}
