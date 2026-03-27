'use client'
import { useState, useCallback } from 'react'
import { useClub } from '@/context/ClubContext'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { fmtCurrency, fmtDate } from '@/lib/utils'
import { TrendingUp, TrendingDown, Plus, FileText, Check } from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'ledger' | 'invoices' | 'quotas'

export default function AccountingPage() {
  const { clubId } = useClub()
  const [tab, setTab] = useState<Tab>('ledger')

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Contabilidad" />
      <main className="flex-1 p-6 space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {(['ledger', 'invoices', 'quotas'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'ledger' ? 'Libro de bancos' : t === 'invoices' ? 'Facturas' : 'Cuotas'}
            </button>
          ))}
        </div>

        {clubId && tab === 'ledger' && <BankLedger clubId={clubId} />}
        {clubId && tab === 'invoices' && <InvoicesPanel clubId={clubId} />}
        {clubId && tab === 'quotas' && <QuotasPanel clubId={clubId} />}
      </main>
    </div>
  )
}

// ── Bank Ledger ──────────────────────────────────────────────────────────────

function BankLedger({ clubId }: { clubId: string }) {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ type: 'INCOME', amount: '', description: '', date: new Date().toISOString().slice(0, 10), categoryId: '' })
  const [categories, setCategories] = useState<{ income: any[]; expense: any[] }>({ income: [], expense: [] })

  const fetch_ = useCallback(async () => {
    const url = `/api/clubs/${clubId}/accounting/bank?page=${page}${filter ? `&type=${filter}` : ''}`
    const res = await fetch(url)
    if (res.ok) setData(await res.json())
  }, [clubId, page, filter])

  useEffect(() => { fetch_() }, [fetch_])

  useEffect(() => {
    fetch(`/api/clubs/${clubId}`)
      .then((r) => r.json())
      .then((d) => setCategories({ income: d.incomeCategories ?? [], expense: d.expenseCategories ?? [] }))
  }, [clubId])

  const submit = async () => {
    const body: any = { type: form.type, amount: parseFloat(form.amount), description: form.description, date: form.date }
    if (form.type === 'INCOME' && form.categoryId) body.incomeCategoryId = form.categoryId
    if (form.type === 'EXPENSE' && form.categoryId) body.expenseCategoryId = form.categoryId
    const res = await fetch(`/api/clubs/${clubId}/accounting/transactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (res.ok) { toast.success('Movimiento registrado'); setModal(false); fetch_() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const catOptions = [
    { value: '', label: 'Sin categoría' },
    ...(form.type === 'INCOME' ? categories.income : categories.expense).map((c: any) => ({ value: c.id, label: c.name })),
  ]

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Libro de Bancos</CardTitle>
          {data && (
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {fmtCurrency(data.bankAccount?.balance ?? 0)}
              <span className="text-sm font-normal text-gray-400 ml-2">saldo actual</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1">
            {[{ v: '', l: 'Todo' }, { v: 'INCOME', l: 'Ingresos' }, { v: 'EXPENSE', l: 'Gastos' }].map(({ v, l }) => (
              <button key={v} onClick={() => { setFilter(v); setPage(1) }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === v ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                {l}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setModal(true)}><Plus className="h-4 w-4" />Nuevo</Button>
        </div>
      </CardHeader>

      {!data ? <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2.5 font-medium">Fecha</th>
                  <th className="text-left py-2.5 font-medium">Descripción</th>
                  <th className="text-left py-2.5 font-medium">Categoría</th>
                  <th className="text-right py-2.5 font-medium">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.ledger?.data?.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="py-3 text-gray-500">{fmtDate(tx.date)}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${tx.type === 'INCOME' ? 'bg-green-50' : 'bg-red-50'}`}>
                          {tx.type === 'INCOME'
                            ? <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                            : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                        </div>
                        <span className="text-gray-900">{tx.description}</span>
                      </div>
                    </td>
                    <td className="py-3 text-gray-500 text-xs">
                      {tx.incomeCategory?.name ?? tx.expenseCategory?.name ?? '—'}
                    </td>
                    <td className={`py-3 text-right font-semibold ${tx.type === 'INCOME' ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}{fmtCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.ledger && (
            <Pagination
              page={data.ledger.page}
              totalPages={data.ledger.totalPages}
              total={data.ledger.total}
              pageSize={data.ledger.pageSize}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Registrar movimiento" size="sm">
        <div className="space-y-4">
          <Select label="Tipo" value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value, categoryId: '' })}
            options={[{ value: 'INCOME', label: 'Ingreso' }, { value: 'EXPENSE', label: 'Gasto' }]} />
          <Input label="Importe (€)" type="number" step="0.01" value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Input label="Descripción" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Fecha" type="date" value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select label="Categoría" value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            options={catOptions} />
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={submit}>Guardar</Button>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}

// ── Invoices Panel ─────────────────────────────────────────────────────────

function InvoicesPanel({ clubId }: { clubId: string }) {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('false') // pending by default
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ amount: '', description: '', supplier: '', fileUrl: '', date: new Date().toISOString().slice(0, 10) })
  const [confirmApprove, setConfirmApprove] = useState<{ open: boolean; invoiceId: string; supplier: string; amount: number } | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    const res = await fetch(`/api/clubs/${clubId}/accounting/invoices?page=${page}&approved=${filter}`)
    if (res.ok) setData(await res.json())
  }, [clubId, page, filter])

  useEffect(() => { fetch_() }, [fetch_])

  const approve = async (invoiceId: string) => {
    setApprovingId(invoiceId)
    const res = await fetch(`/api/clubs/${clubId}/accounting/invoices/${invoiceId}`, { method: 'POST' })
    setApprovingId(null)
    if (res.ok) { toast.success('Factura aprobada — saldo actualizado'); setConfirmApprove(null); fetch_() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const create = async () => {
    const res = await fetch(`/api/clubs/${clubId}/accounting/invoices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    })
    if (res.ok) { toast.success('Factura registrada'); setModal(false); fetch_() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facturas de proveedores</CardTitle>
        <div className="flex gap-2">
          <div className="flex gap-1">
            {[{ v: 'false', l: 'Pendientes' }, { v: 'true', l: 'Aprobadas' }].map(({ v, l }) => (
              <button key={v} onClick={() => { setFilter(v); setPage(1) }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === v ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                {l}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setModal(true)}><Plus className="h-4 w-4" />Nueva factura</Button>
        </div>
      </CardHeader>

      {!data ? <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p> : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left py-2.5 font-medium">Fecha</th>
                <th className="text-left py-2.5 font-medium">Proveedor</th>
                <th className="text-left py-2.5 font-medium">Descripción</th>
                <th className="text-right py-2.5 font-medium">Importe</th>
                <th className="text-right py-2.5 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.data?.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="py-3 text-gray-500">{fmtDate(inv.date)}</td>
                  <td className="py-3 font-medium">{inv.supplier}</td>
                  <td className="py-3 text-gray-600">{inv.description}</td>
                  <td className="py-3 text-right font-semibold">{fmtCurrency(inv.amount)}</td>
                  <td className="py-3 text-right">
                    {!inv.approved ? (
                      <Button size="sm" variant="primary" disabled={approvingId === inv.id} onClick={() => setConfirmApprove({ open: true, invoiceId: inv.id, supplier: inv.supplier, amount: inv.amount })}>
                        <Check className="h-3 w-3" /> Aprobar
                      </Button>
                    ) : (
                      <Badge variant="success">Aprobada</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} />}
        </>
      )}

      {/* Confirm approve invoice modal */}
      {confirmApprove && (
        <Modal open={confirmApprove.open} onClose={() => setConfirmApprove(null)} title="Aprobar factura" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              ¿Confirmas la aprobación de la factura de <span className="font-semibold">{confirmApprove.supplier}</span> por <span className="font-semibold">{fmtCurrency(confirmApprove.amount)}</span>?
              El importe se descontará del saldo del club automáticamente.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" variant="primary" disabled={approvingId === confirmApprove.invoiceId} onClick={() => approve(confirmApprove.invoiceId)}>
                {approvingId === confirmApprove.invoiceId ? 'Aprobando...' : 'Sí, aprobar factura'}
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => setConfirmApprove(null)}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Registrar factura" size="sm">
        <div className="space-y-4">
          <Input label="Proveedor" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          <Input label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Importe (€)" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input label="URL del archivo (opcional)" value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} hint="PDF/Imagen hospedado externamente" />
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={create}>Guardar</Button>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}

// ── Quotas Panel ─────────────────────────────────────────────────────────────

function QuotasPanel({ clubId }: { clubId: string }) {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [payingId, setPayingId] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    const res = await fetch(`/api/clubs/${clubId}/accounting/quotas?page=${page}`)
    if (res.ok) setData(await res.json())
  }, [clubId, page])

  useEffect(() => { fetch_() }, [fetch_])

  const markPaid = async (quotaId: string) => {
    setPayingId(quotaId)
    const res = await fetch(`/api/clubs/${clubId}/accounting/quotas`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quotaId }),
    })
    setPayingId(null)
    if (res.ok) { toast.success('Cuota marcada como pagada — saldo actualizado'); fetch_() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Cuotas anuales</CardTitle></CardHeader>
      {!data ? <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p> : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left py-2.5 font-medium">Socio</th>
                <th className="text-left py-2.5 font-medium">Año</th>
                <th className="text-left py-2.5 font-medium">Importe</th>
                <th className="text-left py-2.5 font-medium">Estado</th>
                <th className="text-right py-2.5 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.data?.map((q: any) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="py-3">
                    <p className="font-medium">{q.membership?.user?.name}</p>
                    <p className="text-xs text-gray-400">{q.membership?.user?.email}</p>
                  </td>
                  <td className="py-3">{q.year}</td>
                  <td className="py-3 font-semibold">{fmtCurrency(q.amount)}</td>
                  <td className="py-3">
                    <Badge variant={q.status === 'PAID' ? 'success' : q.status === 'OVERDUE' ? 'danger' : 'warning'}>
                      {q.status === 'PAID' ? 'Pagada' : q.status === 'OVERDUE' ? 'Vencida' : 'Pendiente'}
                    </Badge>
                  </td>
                  <td className="py-3 text-right">
                    {q.status !== 'PAID' && (
                      <Button size="sm" disabled={payingId === q.id} onClick={() => markPaid(q.id)}>
                        <Check className="h-3 w-3" /> {payingId === q.id ? 'Procesando...' : 'Marcar pagada'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} />}
        </>
      )}
    </Card>
  )
}
