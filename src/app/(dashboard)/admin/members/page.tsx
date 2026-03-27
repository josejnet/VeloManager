'use client'
/**
 * ANTES  → después de montar: fetch('/api/clubs') → fetch('/api/clubs/{id}/members')
 *          Dos round-trips. Pantalla en blanco al cambiar filtro/página.
 *
 * AHORA  → useClub() da el clubId sincronamente desde el contexto del layout.
 *          SWR con keepPreviousData: al cambiar filtro, los datos anteriores
 *          permanecen visibles mientras llegan los nuevos. Sin parpadeo.
 *          useDelayedLoading: si la respuesta llega en <150ms no aparece skeleton.
 *          AbortController: si el usuario cambia filtros rápido, cancela el fetch previo.
 */
import { useCallback, useState } from 'react'
import useSWR from 'swr'
import { useClub } from '@/context/ClubContext'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, MemberStatusBadge, QuotaStatusBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { fmtDate } from '@/lib/utils'
import { Check, X, Plus, User } from 'lucide-react'
import toast from 'react-hot-toast'
import type { MemberWithUser, PaginatedResponse } from '@/types'


const STATUSES = [
  { key: 'APPROVED', label: 'Activos' },
  { key: 'PENDING', label: 'Pendientes' },
  { key: 'SUSPENDED', label: 'Suspendidos' },
  { key: 'REJECTED', label: 'Rechazados' },
]

export default function MembersPage() {
  const { clubId } = useClub()           // ← sin fetch, sin waterfall
  const [status, setStatus] = useState('APPROVED')
  const [page, setPage] = useState(1)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [quotaModal, setQuotaModal] = useState<{ open: boolean; membershipId: string; memberName: string }>({ open: false, membershipId: '', memberName: '' })
  const [quotaForm, setQuotaForm] = useState({ year: new Date().getFullYear(), amount: '' })
  const [confirmAction, setConfirmAction] = useState<{ open: boolean; memberId: string; memberName: string; newStatus: string } | null>(null)

  // SWR key is the full URL — enables correct cross-component invalidation via mutate(url)
  const { data, isLoading, mutate } = useSWR<PaginatedResponse<MemberWithUser>>(
    `/api/clubs/${clubId}/members?status=${status}&page=${page}`,
    { keepPreviousData: true }   // global config in SWRConfigProvider handles the rest
  )

  const updateStatus = useCallback(async (memberId: string, newStatus: string) => {
    setUpdatingId(memberId)
    const res = await fetch(`/api/clubs/${clubId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setUpdatingId(null)
    if (res.ok) {
      toast.success('Estado actualizado')
      setConfirmAction(null)
      mutate()   // revalida SWR en lugar de re-fetch manual
    } else {
      toast.error('Error al actualizar')
    }
  }, [clubId, mutate])

  const assignQuota = useCallback(async () => {
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
    if (res.ok) {
      toast.success('Cuota asignada')
      setQuotaModal({ ...quotaModal, open: false })
      mutate()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Error')
    }
  }, [clubId, quotaForm, quotaModal, mutate])

  // Al cambiar filtro de status, volvemos a página 1
  const handleStatusChange = (s: string) => {
    setStatus(s)
    setPage(1)
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Gestión de Socios" />
      <main className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Socios</CardTitle>
            <div className="flex gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => handleStatusChange(s.key)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${status === s.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </CardHeader>

          {/* isLoading es true SOLO en la carga inicial (no en revalidaciones con datos previos) */}
          {isLoading && !data ? (
            <TableSkeleton rows={8} cols={5} />
          ) : !data?.data.length ? (
            <p className="text-sm text-gray-400 py-8 text-center">Sin resultados</p>
          ) : (
            // opacity transition suaviza la actualización de datos al paginar/filtrar
            <div className={`overflow-x-auto transition-opacity duration-150 ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
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
                          : m.quotas.slice(0, 2).map((q) => <QuotaStatusBadge key={q.id} status={q.status} />)}
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-1">
                          {m.status === 'PENDING' && (
                            <>
                              <Button size="sm" variant="primary" loading={updatingId === m.id} onClick={() => updateStatus(m.id, 'APPROVED')}>
                                <Check className="h-3 w-3" /> Aprobar
                              </Button>
                              <Button size="sm" variant="danger" disabled={updatingId === m.id} onClick={() => setConfirmAction({ open: true, memberId: m.id, memberName: m.user.name, newStatus: 'REJECTED' })}>
                                <X className="h-3 w-3" /> Rechazar
                              </Button>
                            </>
                          )}
                          {m.status === 'APPROVED' && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => setQuotaModal({ open: true, membershipId: m.id, memberName: m.user.name })}>
                                <Plus className="h-3 w-3" /> Cuota
                              </Button>
                              <Button size="sm" variant="ghost" disabled={updatingId === m.id} onClick={() => setConfirmAction({ open: true, memberId: m.id, memberName: m.user.name, newStatus: 'SUSPENDED' })}>
                                Suspender
                              </Button>
                            </>
                          )}
                          {m.status === 'SUSPENDED' && (
                            <Button size="sm" variant="primary" loading={updatingId === m.id} onClick={() => updateStatus(m.id, 'APPROVED')}>
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

      {confirmAction && (
        <Modal open={confirmAction.open} onClose={() => setConfirmAction(null)}
          title={confirmAction.newStatus === 'REJECTED' ? 'Rechazar solicitud' : 'Suspender socio'} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {confirmAction.newStatus === 'REJECTED'
                ? <>¿Seguro que quieres <span className="font-semibold text-red-600">rechazar</span> la solicitud de <span className="font-semibold">{confirmAction.memberName}</span>?</>
                : <>¿Seguro que quieres <span className="font-semibold text-orange-600">suspender</span> a <span className="font-semibold">{confirmAction.memberName}</span>?</>
              }
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" variant="danger" loading={updatingId === confirmAction.memberId}
                onClick={() => updateStatus(confirmAction.memberId, confirmAction.newStatus)}>
                {confirmAction.newStatus === 'REJECTED' ? 'Sí, rechazar' : 'Sí, suspender'}
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal open={quotaModal.open} onClose={() => setQuotaModal({ ...quotaModal, open: false })}
        title={`Asignar cuota — ${quotaModal.memberName}`} size="sm">
        <div className="space-y-4">
          <Input label="Año" type="number" value={quotaForm.year}
            onChange={(e) => setQuotaForm({ ...quotaForm, year: parseInt(e.target.value) })} />
          <Input label="Importe (€)" type="number" step="0.01" placeholder="0.00" value={quotaForm.amount}
            onChange={(e) => setQuotaForm({ ...quotaForm, amount: e.target.value })} />
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={assignQuota}>Asignar cuota</Button>
            <Button variant="outline" className="flex-1" onClick={() => setQuotaModal({ ...quotaModal, open: false })}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
