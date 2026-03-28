'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { QuotaStatusBadge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { fmtCurrency, fmtDate } from '@/lib/utils'
import { Wallet, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

export default function SocioQuotasPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1')
      .then((r) => r.json())
      .then((d) => { if (d.data?.[0]) setClubId(d.data[0].id) })
  }, [session])

  const load = useCallback(async () => {
    if (!clubId) return
    // Admin quota endpoint filtered by user's own membership
    // We fetch all quotas and let the server filter by userId via SOCIO role
    const res = await fetch(`/api/clubs/${clubId}/accounting/quotas?page=${page}&pageSize=20`)
    if (res.ok) setData(await res.json())
  }, [clubId, page])

  useEffect(() => { load() }, [load])

  const quotas: any[] = data?.data ?? []
  const pendingCount = quotas.filter((q) => q.status !== 'PAID').length
  const paidCount = quotas.filter((q) => q.status === 'PAID').length
  const totalPaid = quotas.filter((q) => q.status === 'PAID').reduce((s: number, q: any) => s + Number(q.amount), 0)
  const totalPending = quotas.filter((q) => q.status !== 'PAID').reduce((s: number, q: any) => s + Number(q.amount), 0)

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Mis cuotas" clubId={clubId} />
      <main className="flex-1 p-6 space-y-4">

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-50">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Pagadas</p>
              <p className="text-lg font-bold text-gray-900">{paidCount}</p>
              <p className="text-xs text-green-600 font-medium">{fmtCurrency(totalPaid)}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Pendientes</p>
              <p className="text-lg font-bold text-gray-900">{pendingCount}</p>
              <p className="text-xs text-amber-600 font-medium">{fmtCurrency(totalPending)}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50">
              <Wallet className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Total histórico</p>
              <p className="text-lg font-bold text-gray-900">{quotas.length}</p>
              <p className="text-xs text-blue-600 font-medium">{fmtCurrency(totalPaid + totalPending)}</p>
            </div>
          </div>
        </div>

        {/* Pending alert */}
        {pendingCount > 0 && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Tienes {pendingCount} cuota{pendingCount > 1 ? 's' : ''} pendiente{pendingCount > 1 ? 's' : ''} de pago
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                El pago se realiza directamente al club. Contacta al administrador para gestionar el pago.
              </p>
            </div>
          </div>
        )}

        {/* Quotas list */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de cuotas</CardTitle>
          </CardHeader>

          {!data ? (
            <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
          ) : quotas.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No tienes cuotas asignadas</p>
          ) : (
            <>
              <div className="space-y-2">
                {quotas.map((q: any) => (
                  <div
                    key={q.id}
                    className={`flex items-center justify-between p-4 rounded-xl border ${
                      q.status === 'PAID'
                        ? 'border-green-100 bg-green-50/50'
                        : q.status === 'OVERDUE'
                        ? 'border-red-100 bg-red-50/50'
                        : 'border-gray-100 bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        q.status === 'PAID' ? 'bg-green-100' : q.status === 'OVERDUE' ? 'bg-red-100' : 'bg-amber-100'
                      }`}>
                        {q.status === 'PAID'
                          ? <CheckCircle className="h-4 w-4 text-green-600" />
                          : q.status === 'OVERDUE'
                          ? <AlertTriangle className="h-4 w-4 text-red-500" />
                          : <Clock className="h-4 w-4 text-amber-500" />}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Cuota {q.year}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {q.dueDate && (
                            <p className="text-xs text-gray-400">Vence: {fmtDate(q.dueDate)}</p>
                          )}
                          {q.paidAt && (
                            <p className="text-xs text-gray-400">Pagada: {fmtDate(q.paidAt)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-gray-900">{fmtCurrency(q.amount)}</p>
                      <QuotaStatusBadge status={q.status} />
                    </div>
                  </div>
                ))}
              </div>
              {data && (
                <Pagination
                  page={data.page}
                  totalPages={data.totalPages}
                  total={data.total}
                  pageSize={data.pageSize}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </Card>
      </main>
    </div>
  )
}
