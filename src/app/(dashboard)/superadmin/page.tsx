import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { fmtCurrency, fmtDate } from '@/lib/utils'
import { Building2, Users, ShoppingBag, Activity } from 'lucide-react'

export default async function SuperAdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as { role: string }).role !== 'SUPER_ADMIN') {
    redirect('/login')
  }

  const [totalClubs, totalUsers, totalMembers, totalOrders, recentClubs] = await Promise.all([
    prisma.club.count(),
    prisma.user.count(),
    prisma.clubMembership.count({ where: { status: 'APPROVED' } }),
    prisma.order.count({ where: { status: { not: 'CANCELLED' } } }),
    prisma.club.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        bankAccount: true,
        _count: { select: { memberships: { where: { status: 'APPROVED' } } } },
      },
    }),
  ])

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Panel Super Admin" clubId="" />
      <main className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <StatCard title="Clubs activos" value={totalClubs} icon={Building2} color="blue" />
          <StatCard title="Usuarios totales" value={totalUsers} icon={Users} color="green" />
          <StatCard title="Membresías activas" value={totalMembers} icon={Activity} color="orange" />
          <StatCard title="Pedidos procesados" value={totalOrders} icon={ShoppingBag} color="purple" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Clubs recientes</CardTitle>
            <span className="text-xs text-gray-400">Total: {totalClubs} clubs</span>
          </CardHeader>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left py-2.5 font-medium">Club</th>
                <th className="text-left py-2.5 font-medium">Deporte</th>
                <th className="text-right py-2.5 font-medium">Socios</th>
                <th className="text-right py-2.5 font-medium">Saldo banco</th>
                <th className="text-right py-2.5 font-medium">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentClubs.map((club) => (
                <tr key={club.id} className="hover:bg-gray-50">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{club.name}</p>
                        {club.slogan && <p className="text-xs text-gray-400">{club.slogan}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-gray-600">{club.sport}</td>
                  <td className="py-3 text-right font-medium">{club._count.memberships}</td>
                  <td className="py-3 text-right font-semibold">
                    {club.bankAccount ? fmtCurrency(club.bankAccount.balance) : '—'}
                  </td>
                  <td className="py-3 text-right text-gray-500">{fmtDate(club.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>
    </div>
  )
}
