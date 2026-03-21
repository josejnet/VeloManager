'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, MemberStatusBadge, QuotaStatusBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { fmtDate, fmtCurrency } from '@/lib/utils'
import { Check, X, Plus, User } from 'lucide-react'
import toast from 'react-hot-toast'
import type { MemberWithUser, PaginatedResponse } from '@/types'

export default function MembersPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState<string>('')
  const [status, setStatus] = useState<string>('APPROVED')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaginatedResponse<MemberWithUser> | null>(null)
  const [loading, setLoading] = useState(false)
  const [quotaModal, setQuotaModal] = useState<{ open: boolean; membershipId: string; memberName: string }>({ open: false, membershipId: '', memberName: '' })
  const [quotaForm, setQuotaForm] = useState({ year: new Date().getFullYear(), amount: '' })

  // Get clubId from membership
  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1')
      .then((r) => r.json())
      .then((d) => { if (d.data?.[0]) setClubId(d.data[0].id) })
  }, [session])

  const fetchMembers = useCallback(async () => {
    if (!clubId) return
    setLoading(true)
    const res = await fetch(`/api/clubs/${clubId}/members?status=${status}&page=${page}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [clubId, status, page])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const updateStatus = async (memberId: string, newStatus: string) => {
    const res = await fetch(`/api/clubs/${clubId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) { toast.success('Estado actualizado'); fetchMembers() }
    else toast.error('Error al actualizar')
  }

  const assignQuota = async () => {
    if (!quotaForm.amount) return toast.error('Introduce un importe')
    const res = await fetch(`/api/clubs/${clubId}/accounting/quotas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        membershipId: quotaModal.membershipId,
        year: quotaForm.year,
        amount: parseFloat(quotaForm.amount),
      }),
    })
    if (res.ok) { toast.success('Cuota asignada'); setQuotaModal({ ...quotaModal, open: false }); fetchMembers() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Gestión de Socios" clubId={clubId} />
      <main className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Socios</CardTitle>
            <div className="flex gap-2">
              {['APPROVED', 'PENDING', 'SUSPENDED', 'REJECTED'].map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatus(s); setPage(1) }}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${status === s ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {s === 'APPROVED' ? 'Activos' : s === 'PENDING' ? 'Pendientes' : s === 'SUSPENDED' ? 'Suspendidos' : 'Rechazados'}
                </button>
              ))}
            </div>
          </CardHeader>

          {loading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
          ) : !data?.data.length ? (
            <p className="text-sm text-gray-400 py-8 text-center">Sin resultados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2.5 font-medium">Socio</th>
                    <th className="text-left py-2.5 font-medium">Estado</th>
                    <th className="text-left py-2.5 font-medium">Desde</th>
                    <th className="text-left py-2.5 font-medium">Cuotas</th>
                    <th className="text-right py-2.5 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.data.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{m.user.name}</p>
                            <p className="text-xs text-gray-400">{m.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3"><MemberStatusBadge status={m.status} /></td>
                      <td className="py-3 text-gray-500">{m.joinedAt ? fmtDate(m.joinedAt) : '—'}</td>
                      <td className="py-3">
                        {m.quotas.length === 0
                          ? <span className="text-gray-400">Sin cuotas</span>
                          : m.quotas.slice(0, 2).map((q) => (
                              <QuotaStatusBadge key={q.id} status={q.status} />
                            ))}
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-1">
                          {m.status === 'PENDING' && (
                            <>
                              <Button size="sm" variant="primary" onClick={() => updateStatus(m.id, 'APPROVED')}>
                                <Check className="h-3 w-3" /> Aprobar
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => updateStatus(m.id, 'REJECTED')}>
                                <X className="h-3 w-3" /> Rechazar
                              </Button>
                            </>
                          )}
                          {m.status === 'APPROVED' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setQuotaModal({ open: true, membershipId: m.id, memberName: m.user.name })}
                              >
                                <Plus className="h-3 w-3" /> Cuota
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => updateStatus(m.id, 'SUSPENDED')}>
                                Suspender
                              </Button>
                            </>
                          )}
                          {m.status === 'SUSPENDED' && (
                            <Button size="sm" variant="primary" onClick={() => updateStatus(m.id, 'APPROVED')}>
                              Reactivar
                            </Button>
                          )}
                        </div>
                      </td>
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
            </div>
          )}
        </Card>
      </main>

      <Modal
        open={quotaModal.open}
        onClose={() => setQuotaModal({ ...quotaModal, open: false })}
        title={`Asignar cuota — ${quotaModal.memberName}`}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Año"
            type="number"
            value={quotaForm.year}
            onChange={(e) => setQuotaForm({ ...quotaForm, year: parseInt(e.target.value) })}
          />
          <Input
            label="Importe (€)"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={quotaForm.amount}
            onChange={(e) => setQuotaForm({ ...quotaForm, amount: e.target.value })}
          />
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={assignQuota}>Asignar cuota</Button>
            <Button variant="outline" className="flex-1" onClick={() => setQuotaModal({ ...quotaModal, open: false })}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
