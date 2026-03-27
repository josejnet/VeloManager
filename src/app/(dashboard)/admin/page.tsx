import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { fmtCurrency, fmtDate } from '@/lib/utils'
import { Users, Wallet, ShoppingBag, Vote, TrendingUp, TrendingDown, Clock } from 'lucide-react'

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id: string }).id

  const membership = await prisma.clubMembership.findFirst({
    where: { userId, status: 'APPROVED', role: 'CLUB_ADMIN' },
    include: { club: { include: { bankAccount: true } } },
  })

  if (!membership) redirect('/login')

  const { club } = membership
  const clubId = club.id

  const [
    membersCount,
    pendingMembers,
    bankAccount,
    recentTransactions,
    openWindows,
    activeVotes,
    pendingInvoices,
  ] = await Promise.all([
    prisma.clubMembership.count({ where: { clubId, status: 'APPROVED' } }),
    prisma.clubMembership.count({ where: { clubId, status: 'PENDING' } }),
    prisma.bankAccount.findUnique({ where: { clubId } }),
    prisma.transaction.findMany({
      where: { clubId },
      take: 5,
      orderBy: { date: 'desc' },
      include: { incomeCategory: true, expenseCategory: true },
    }),
    prisma.purchaseWindow.count({ where: { clubId, status: 'OPEN' } }),
    prisma.vote.count({ where: { clubId, active: true } }),
    prisma.invoice.count({ where: { clubId, approved: false } }),
  ])

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title={`Dashboard — ${club.name}`} />

      <main className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            title="Socios activos"
            value={membersCount}
            subtitle={pendingMembers > 0 ? `${pendingMembers} pendientes de aprobación` : undefined}
            icon={Users}
            color="blue"
          />
          <StatCard
            title="Saldo bancario"
            value={fmtCurrency(bankAccount?.balance ?? 0)}
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
        {(pendingMembers > 0 || pendingInvoices > 0) && (
          <div className="flex gap-3">
            {pendingMembers > 0 && (
              <a href="/admin/members?status=PENDING"
                className="flex items-center gap-2 px-4 py-2.5 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700 hover:bg-yellow-100 transition-colors">
                <Clock className="h-4 w-4" />
                <strong>{pendingMembers}</strong> solicitudes de membresía pendientes
              </a>
            )}
            {pendingInvoices > 0 && (
              <a href="/admin/accounting?tab=invoices"
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700 hover:bg-orange-100 transition-colors">
                <Clock className="h-4 w-4" />
                <strong>{pendingInvoices}</strong> facturas pendientes de aprobación
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
                        {tx.incomeCategory?.name ?? tx.expenseCategory?.name ?? '—'} · {fmtDate(tx.date)}
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
      </main>
    </div>
  )
}
