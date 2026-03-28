'use client'
import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Select } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { fmtDate } from '@/lib/utils'
import { Search, Users, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SuperAdminUsersPage() {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const fetch_ = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), ...(search && { search }), ...(roleFilter && { role: roleFilter }) })
    const res = await fetch(`/api/superadmin/users?${params}`)
    if (res.ok) setData(await res.json())
  }, [page, search, roleFilter])

  useEffect(() => { fetch_() }, [fetch_])

  const updateRole = async (userId: string, role: string) => {
    const res = await fetch(`/api/superadmin/users?userId=${userId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platformRole: role }),
    })
    if (res.ok) { toast.success('Rol actualizado'); fetch_() }
    else toast.error('Error')
  }

  const roleOptions = [
    { value: '', label: 'Todos los roles' },
    { value: 'SUPER_ADMIN', label: 'Super Admin' },
    { value: 'USER', label: 'Usuario' },
  ]

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Gestión de Usuarios" />
      <main className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Usuarios de la plataforma</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Buscar usuario..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                />
              </div>
              <Select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }} options={roleOptions} />
            </div>
          </CardHeader>

          {!data ? <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p> : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2.5 font-medium">Usuario</th>
                    <th className="text-left py-2.5 font-medium">Rol global</th>
                    <th className="text-left py-2.5 font-medium">Clubs</th>
                    <th className="text-left py-2.5 font-medium">Registrado</th>
                    <th className="text-right py-2.5 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.data?.map((user: any) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                        {(user.province || user.locality) && (
                          <p className="text-xs text-gray-400">{[user.locality, user.province].filter(Boolean).join(', ')}</p>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge variant={user.platformRole === 'SUPER_ADMIN' ? 'danger' : 'default'}>
                          {user.platformRole}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.memberships?.slice(0, 3).map((m: any) => (
                            <span key={m.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-0.5">
                              <Building2 className="h-3 w-3" />{m.club.name}
                            </span>
                          ))}
                          {user.memberships?.length > 3 && (
                            <span className="text-xs text-gray-400">+{user.memberships.length - 3} más</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-gray-500">{fmtDate(user.createdAt)}</td>
                      <td className="py-3 text-right">
                        {user.platformRole !== 'SUPER_ADMIN' && (
                          <select
                            value={user.platformRole}
                            onChange={(e) => updateRole(user.id, e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                          >
                            <option value="USER">Usuario</option>
                            <option value="SUPER_ADMIN">SuperAdmin</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} />
            </>
          )}
        </Card>
      </main>
    </div>
  )
}
