'use client'
import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { Pagination } from '@/components/ui/Pagination'
import { fmtDate, fmtCurrency } from '@/lib/utils'
import { Building2, Users, ShoppingBag, Activity, Search } from 'lucide-react'

export default function SuperAdminClubsPage() {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const fetch_ = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), ...(search && { search }) })
    const res = await fetch(`/api/superadmin/clubs?${params}`)
    if (res.ok) setData(await res.json())
  }, [page, search])

  useEffect(() => { fetch_() }, [fetch_])

  const stats = data?.globalStats

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Todos los clubs" />
      <main className="flex-1 p-6 space-y-6">

        {/* Global stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4">
            <StatCard title="Clubs registrados" value={stats.totalClubs} icon={Building2} color="blue" />
            <StatCard title="Usuarios totales" value={stats.totalUsers} icon={Users} color="green" />
            <StatCard title="Membresías activas" value={stats.totalMembers} icon={Activity} color="orange" />
            <StatCard title="Pedidos procesados" value={stats.totalOrders} icon={ShoppingBag} color="purple" />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Clubs de la plataforma</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Buscar club..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
          </CardHeader>

          {!data ? (
            <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2.5 font-medium">Club</th>
                    <th className="text-left py-2.5 font-medium">Deporte</th>
                    <th className="text-right py-2.5 font-medium">Socios</th>
                    <th className="text-right py-2.5 font-medium">Productos</th>
                    <th className="text-right py-2.5 font-medium">Votaciones</th>
                    <th className="text-right py-2.5 font-medium">Saldo</th>
                    <th className="text-right py-2.5 font-medium">Creado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.data?.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-gray-400">
                        No se encontraron clubs
                      </td>
                    </tr>
                  )}
                  {data.data?.map((club: any) => (
                    <tr key={club.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{club.name}</p>
                            {club.slogan && <p className="text-xs text-gray-400">{club.slogan}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <Badge variant="default">{club.sport ?? '—'}</Badge>
                      </td>
                      <td className="py-3 text-right font-medium">{club._count.memberships}</td>
                      <td className="py-3 text-right text-gray-600">{club._count.products}</td>
                      <td className="py-3 text-right text-gray-600">{club._count.votes}</td>
                      <td className="py-3 text-right font-semibold">
                        {club.bankAccount ? fmtCurrency(club.bankAccount.balance) : '—'}
                      </td>
                      <td className="py-3 text-right text-gray-500">{fmtDate(club.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                pageSize={data.pageSize}
                onPageChange={setPage}
              />
            </>
          )}
        </Card>
      </main>
    </div>
  )
}
