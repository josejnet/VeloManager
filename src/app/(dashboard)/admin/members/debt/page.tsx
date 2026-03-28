'use client'
import { useState, useEffect, useCallback } from 'react'
import { useClub } from '@/context/ClubContext'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { fmtCurrency } from '@/lib/utils'
import { AlertTriangle, Send, User } from 'lucide-react'
import toast from 'react-hot-toast'

interface DebtMember {
  userId: string
  name: string
  email: string
  unpaidQuotasCount: number
  unpaidQuotasAmount: number
  unpaidOrdersCount: number
  unpaidOrdersAmount: number
  totalDebt: number
}

interface DebtSummary {
  data: DebtMember[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  totals: {
    totalQuotaDebt: number
    totalOrderDebt: number
    grandTotal: number
  }
}

const PAGE_SIZE = 20

export default function MembersDebtPage() {
  const { clubId } = useClub()
  const [summary, setSummary] = useState<DebtSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [sendingReminder, setSendingReminder] = useState<Record<string, boolean>>({})
  const [page, setPage] = useState(1)

  const fetchDebt = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/debt-summary?pageSize=100`)
      if (res.ok) {
        const d: DebtSummary = await res.json()
        setSummary(d)
      }
    } finally {
      setLoading(false)
    }
  }, [clubId])

  useEffect(() => { fetchDebt() }, [fetchDebt])

  const sendReminder = async (member: DebtMember) => {
    setSendingReminder((prev) => ({ ...prev, [member.userId]: true }))
    try {
      const res = await fetch(`/api/clubs/${clubId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientIds: [member.userId],
          subject: 'Recordatorio de pago pendiente',
          body: `Hola ${member.name},\n\nTe recordamos que tienes pagos pendientes en el club:\n\n${
            member.unpaidQuotasCount > 0
              ? `• ${member.unpaidQuotasCount} cuota(s) sin abonar: ${fmtCurrency(member.unpaidQuotasAmount)}\n`
              : ''
          }${
            member.unpaidOrdersCount > 0
              ? `• ${member.unpaidOrdersCount} pedido(s) sin pagar: ${fmtCurrency(member.unpaidOrdersAmount)}\n`
              : ''
          }\nTotal pendiente: ${fmtCurrency(member.totalDebt)}\n\nPor favor, regulariza tu situación lo antes posible.\n\nGracias.`,
        }),
      })
      if (res.ok) {
        toast.success(`Recordatorio enviado a ${member.name}`)
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Error al enviar recordatorio')
      }
    } finally {
      setSendingReminder((prev) => ({ ...prev, [member.userId]: false }))
    }
  }

  // Pagination
  const allMembers = summary?.data ?? []
  const totalPages = summary?.totalPages ?? 1
  const pagedMembers = allMembers

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Deudas de socios" />
      <main className="flex-1 p-6 space-y-4">

        {/* Summary card */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="flex items-center gap-3 !p-4">
              <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Deuda total</p>
                <p className="text-lg font-bold text-gray-900">{fmtCurrency(summary.totals.grandTotal)}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3 !p-4">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Socios con deuda</p>
                <p className="text-lg font-bold text-gray-900">{summary.total ?? allMembers.length}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3 !p-4">
              <div>
                <p className="text-xs text-gray-500">Deuda por cuotas</p>
                <p className="text-lg font-bold text-amber-600">{fmtCurrency(summary.totals.totalQuotaDebt)}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3 !p-4">
              <div>
                <p className="text-xs text-gray-500">Deuda por pedidos</p>
                <p className="text-lg font-bold text-red-500">{fmtCurrency(summary.totals.totalOrderDebt)}</p>
              </div>
            </Card>
          </div>
        )}

        {/* Debt table */}
        <Card>
          <CardHeader>
            <CardTitle>Socios con deuda pendiente</CardTitle>
            <p className="text-sm text-gray-400">{allMembers.length} socio(s)</p>
          </CardHeader>

          {loading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
          ) : allMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <AlertTriangle className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">No hay deudas pendientes</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2.5 font-medium">Socio</th>
                    <th className="text-right py-2.5 font-medium">Cuotas imp.</th>
                    <th className="text-right py-2.5 font-medium">Importe cuotas</th>
                    <th className="text-right py-2.5 font-medium">Pedidos imp.</th>
                    <th className="text-right py-2.5 font-medium">Importe pedidos</th>
                    <th className="text-right py-2.5 font-medium">Total deuda</th>
                    <th className="text-right py-2.5 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pagedMembers.map((m) => (
                    <tr key={m.userId} className="hover:bg-gray-50">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{m.name}</p>
                            <p className="text-xs text-gray-400">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        {m.unpaidQuotasCount > 0 ? (
                          <span className="text-amber-600 font-medium">{m.unpaidQuotasCount}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right text-amber-600">
                        {m.unpaidQuotasAmount > 0 ? fmtCurrency(m.unpaidQuotasAmount) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 text-right">
                        {m.unpaidOrdersCount > 0 ? (
                          <span className="text-red-500 font-medium">{m.unpaidOrdersCount}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right text-red-500">
                        {m.unpaidOrdersAmount > 0 ? fmtCurrency(m.unpaidOrdersAmount) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 text-right">
                        <span className="font-semibold text-gray-900">{fmtCurrency(m.totalDebt)}</span>
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          loading={sendingReminder[m.userId]}
                          onClick={() => sendReminder(m)}
                          title="Enviar recordatorio de pago"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Recordatorio
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={page}
                totalPages={totalPages}
                total={allMembers.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
