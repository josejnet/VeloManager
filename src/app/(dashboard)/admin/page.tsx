import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { fmtCurrency, fmtDate, fmtDateTime } from '@/lib/utils'
import { Users, Wallet, ShoppingBag, Vote, TrendingUp, TrendingDown, Clock, Calendar, AlertCircle, FileText, ClipboardList } from 'lucide-react'

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id: string }).id

  const membership = await prisma.clubMembership.findFirst({
    where: { userId, status: 'APPROVED', clubRole: 'ADMIN' },
    include: { club: { include: { bankAccount: true } } },
  })

  if (!membership) redirect('/login')

  const { club } = membership
  const clubId = club.id

  const [
    membersCount,
    pendingMembersCount,
    incomeAgg,
    expenseAgg,
    recentTransactions,
    openWindows,
    activeVotes,
    pendingInvoices,
    openTickets,
    pendingOrders,
    upcomingEvents,
    pendingMembersList,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.clubMembership.count({ where: { clubId, status: 'APPROVED' } }),
    prisma.clubMembership.count({ where: { clubId, status: 'PENDING' } }),
    prisma.bankMovement.aggregate({ where: { clubId, type: 'INCOME' }, _sum: { amount: true } }),
    prisma.bankMovement.aggregate({ where: { clubId, type: 'EXPENSE' }, _sum: { amount: true } }),
    prisma.bankMovement.findMany({
      where: { clubId },
      take: 5,
      orderBy: { date: 'desc' },
      include: { category: true },
    }),
    prisma.purchaseWindow.count({ where: { clubId, status: 'OPEN' } }),
    prisma.vote.count({ where: { clubId, active: true } }),
    prisma.invoice.count({ where: { clubId, approved: false } }),
    prisma.ticket.count({ where: { clubId, status: { not: 'CLOSED' } } }),
    prisma.order.count({ where: { clubId, status: 'PENDING' } }),
    prisma.clubEvent.findMany({ where: { clubId, startAt: { gte: new Date() } }, orderBy: { startAt: 'asc' }, take: 3, select: { id: true, title: true, startAt: true, location: true } }),
    prisma.clubMembership.findMany({ where: { clubId, status: 'PENDING' }, take: 5, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.auditLog.findMany({ where: { clubId }, take: 8, orderBy: { createdAt: 'desc' }, select: { id: true, action: true, entity: true, createdAt: true, user: { select: { name: true } } } }),
  ])

  const balance = Number(incomeAgg._sum.amount ?? 0) - Number(expenseAgg._sum.amount ?? 0)

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title={`Dashboard — ${club.name}`} />

      <main className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            title="Socios activos"
            value={membersCount}
            subtitle={pendingMembersCount > 0 ? `${pendingMembersCount} pendientes de aprobación` : undefined}
            icon={Users}
            color="blue"
          />
          <StatCard
            title="Saldo bancario"
            value={fmtCurrency(balance)}
            icon={Wallet}
            color="green"
          />
          <StatCard
            title="Campañas abiertas"
            value={openWindows}
            icon={ShoppingBag}
            color="orange"
          />
          <StatCard
            title="Votaciones activas"
            value={activeVotes}
            icon={Vote}
            color="purple"
          />
        </div>

        {/* Alerts row */}
        {(pendingMembersCount > 0 || pendingInvoices > 0 || openTickets > 0 || pendingOrders > 0) && (
          <div className="flex gap-3 flex-wrap">
            {pendingMembersCount > 0 && (
              <a href="/admin/members?status=PENDING"
                className="flex items-center gap-2 px-4 py-2.5 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700 hover:bg-yellow-100 transition-colors">
                <Clock className="h-4 w-4" />
                <strong>{pendingMembersCount}</strong> solicitudes de membresía pendientes
              </a>
            )}
            {pendingInvoices > 0 && (
              <a href="/admin/accounting?tab=invoices"
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700 hover:bg-orange-100 transition-colors">
                <Clock className="h-4 w-4" />
                <strong>{pendingInvoices}</strong> facturas pendientes de aprobación
              </a>
            )}
            {openTickets > 0 && (
              <a href="/admin/support"
                className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 hover:bg-red-100 transition-colors">
                <AlertCircle className="h-4 w-4" />
                <strong>{openTickets}</strong> {openTickets === 1 ? 'ticket abierto' : 'tickets abiertos'}
              </a>
            )}
            {pendingOrders > 0 && (
              <a href="/admin/shop"
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 hover:bg-blue-100 transition-colors">
                <ClipboardList className="h-4 w-4" />
                <strong>{pendingOrders}</strong> {pendingOrders === 1 ? 'pedido pendiente' : 'pedidos pendientes'}
              </a>
            )}
          </div>
        )}

        {/* Recent transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Últimos movimientos</CardTitle>
            <a href="/admin/accounting" className="text-sm text-primary hover:underline">Ver todos</a>
          </CardHeader>
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Sin movimientos registrados</p>
          ) : (
            <div className="space-y-0 divide-y divide-gray-50">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${tx.type === 'INCOME' ? 'bg-green-50' : 'bg-red-50'}`}>
                      {tx.type === 'INCOME'
                        ? <TrendingUp className="h-4 w-4 text-green-600" />
                        : <TrendingDown className="h-4 w-4 text-red-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                      <p className="text-xs text-gray-400">
                        {tx.category?.name ?? '—'} · {fmtDate(tx.date)}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${tx.type === 'INCOME' ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.type === 'INCOME' ? '+' : '-'}{fmtCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Pending members */}
        {pendingMembersList.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Socios pendientes</CardTitle>
              <a href="/admin/members" className="text-sm text-primary hover:underline">Ver todos</a>
            </CardHeader>
            <div className="space-y-0 divide-y divide-gray-50">
              {pendingMembersList.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.user.name}</p>
                    <p className="text-xs text-gray-400">{m.user.email}</p>
                  </div>
                  <span className="text-xs text-gray-400">{fmtDate(m.createdAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Upcoming events */}
        {upcomingEvents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Próximos eventos</CardTitle>
              <a href="/admin/events" className="text-sm text-primary hover:underline">Ver todos</a>
            </CardHeader>
            <div className="space-y-0 divide-y divide-gray-50">
              {upcomingEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 py-3">
                  <div className="p-2 rounded-xl bg-purple-50">
                    <Calendar className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ev.title}</p>
                    <p className="text-xs text-gray-400">
                      {fmtDate(ev.date)}{ev.location ? ` · ${ev.location}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recent audit log */}
        {recentAuditLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Log de actividad reciente</CardTitle>
            </CardHeader>
            <div className="space-y-0 divide-y divide-gray-50">
              {recentAuditLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-gray-50">
                      <FileText className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-2">{log.action}</span>
                        {log.entity}
                      </p>
                      <p className="text-xs text-gray-400">{log.user.name}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-4">{fmtDateTime(log.createdAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
