'use client'
import { useState, useEffect, useCallback } from 'react'
import { useClub } from '@/context/ClubContext'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, QuotaStatusBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { fmtCurrency, fmtDate } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, Plus, FileText, Check,
  Tag, Zap, Receipt, Package, User, Wrench, RotateCcw,
  Wallet, AlertCircle, Upload, Pencil,
} from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'ledger' | 'invoices' | 'quotas'

const SOURCE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  FEE:        { label: 'Cuota',    icon: <User className="h-3 w-3" />,     color: 'bg-blue-50 text-blue-600' },
  EVENT:      { label: 'Evento',   icon: <Zap className="h-3 w-3" />,      color: 'bg-purple-50 text-purple-600' },
  ORDER:      { label: 'Pedido',   icon: <Package className="h-3 w-3" />,  color: 'bg-orange-50 text-orange-600' },
  INVOICE:    { label: 'Factura',  icon: <Receipt className="h-3 w-3" />,  color: 'bg-red-50 text-red-600' },
  MANUAL:     { label: 'Manual',   icon: <Wrench className="h-3 w-3" />,   color: 'bg-gray-100 text-gray-600' },
  ADJUSTMENT: { label: 'Ajuste',   icon: <RotateCcw className="h-3 w-3" />, color: 'bg-yellow-50 text-yellow-700' },
}

export default function AccountingPage() {
  const { clubId } = useClub()
  const [tab, setTab] = useState<Tab>('ledger')

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Contabilidad" />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {(['ledger', 'invoices', 'quotas'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'ledger' ? 'Libro de bancos' : t === 'invoices' ? 'Facturas' : 'Cuotas'}
            </button>
          ))}
        </div>

        {clubId && tab === 'ledger'   && <BankLedger clubId={clubId} />}
        {clubId && tab === 'invoices' && <InvoicesPanel clubId={clubId} />}
        {clubId && tab === 'quotas'   && <QuotasPanel clubId={clubId} />}
      </main>
    </div>
  )
}

// ── Bank Ledger ───────────────────────────────────────────────────────────────

function BankLedger({ clubId }: { clubId: string }) {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [catModal, setCatModal] = useState(false)
  const [importModal, setImportModal] = useState(false)
  const [categories, setCategories] = useState<{ income: any[]; expense: any[] }>({ income: [], expense: [] })
  const [form, setForm] = useState({ type: 'INCOME', amount: '', description: '', date: new Date().toISOString().slice(0, 10), categoryId: '' })
  const [catForm, setCatForm] = useState({ name: '', type: 'INCOME', color: '#10b981' })
  const [editCatModal, setEditCatModal] = useState<{ open: boolean; movementId: string; currentCategoryId: string; type: string } | null>(null)
  const [editCatValue, setEditCatValue] = useState('')
  const [savingCat, setSavingCat] = useState(false)
  const [markInvoiceModal, setMarkInvoiceModal] = useState<{ open: boolean; movementId: string; description: string } | null>(null)
  const [invoiceSupplier, setInvoiceSupplier] = useState('')
  const [markingInvoice, setMarkingInvoice] = useState(false)

  const loadLedger = useCallback(async () => {
    let url = `/api/clubs/${clubId}/accounting/bank?page=${page}`
    if (typeFilter)   url += `&type=${typeFilter}`
    if (sourceFilter) url += `&source=${sourceFilter}`
    const res = await fetch(url)
    if (res.ok) setData(await res.json())
  }, [clubId, page, typeFilter, sourceFilter])

  const loadCategories = useCallback(async () => {
    const res = await fetch(`/api/clubs/${clubId}/accounting/categories`)
    if (res.ok) {
      const d = await res.json()
      setCategories({ income: d.income ?? [], expense: d.expense ?? [] })
    }
  }, [clubId])

  useEffect(() => { loadLedger() }, [loadLedger])
  useEffect(() => { loadCategories() }, [loadCategories])

  const submitMovement = async () => {
    if (!form.amount || !form.description) return toast.error('Completa todos los campos')
    const body: any = { type: form.type, amount: parseFloat(form.amount), description: form.description, date: form.date }
    if (form.categoryId) body.categoryId = form.categoryId
    const res = await fetch(`/api/clubs/${clubId}/accounting/transactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (res.ok) { toast.success('Movimiento registrado'); setModal(false); loadLedger() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const submitCategory = async () => {
    if (!catForm.name) return toast.error('Nombre requerido')
    const res = await fetch(`/api/clubs/${clubId}/accounting/categories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm),
    })
    if (res.ok) { toast.success('Categoría creada'); setCatModal(false); loadCategories() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const deleteCategory = async (id: string) => {
    const res = await fetch(`/api/clubs/${clubId}/accounting/categories?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Categoría eliminada'); loadCategories() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const saveMovementCategory = async () => {
    if (!editCatModal) return
    setSavingCat(true)
    const res = await fetch(`/api/clubs/${clubId}/accounting/movements/${editCatModal.movementId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_category', categoryId: editCatValue || null }),
    })
    setSavingCat(false)
    if (res.ok) { toast.success('Categoría actualizada'); setEditCatModal(null); loadLedger() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const saveMarkAsInvoice = async () => {
    if (!markInvoiceModal) return
    setMarkingInvoice(true)
    const res = await fetch(`/api/clubs/${clubId}/accounting/movements/${markInvoiceModal.movementId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_invoice', supplier: invoiceSupplier || undefined }),
    })
    setMarkingInvoice(false)
    if (res.ok) { toast.success('Movimiento marcado como factura'); setMarkInvoiceModal(null); loadLedger() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const catOptions = [
    { value: '', label: 'Sin categoría' },
    ...(form.type === 'INCOME' ? categories.income : categories.expense).map((c: any) => ({ value: c.id, label: c.name })),
  ]

  const balance = data?.bankAccount?.balance ?? 0
  const yearIncome = data?.bankAccount?.yearIncome ?? 0
  const yearExpense = data?.bankAccount?.yearExpense ?? 0
  const currentYear = data?.bankAccount?.currentYear ?? new Date().getFullYear()

  return (
    <>
      {/* Balance summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 mb-1">Saldo actual</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{fmtCurrency(balance)}</p>
          <p className="text-xs text-gray-400 mt-1">Calculado del libro de cuentas</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 mb-1">Ingresos {currentYear}</p>
          <p className="text-2xl font-bold text-green-600">{fmtCurrency(yearIncome)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 mb-1">Gastos {currentYear}</p>
          <p className="text-2xl font-bold text-red-500">{fmtCurrency(yearExpense)}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Libro de Bancos</CardTitle>
          <div className="flex gap-2 flex-wrap">
            {/* Type filter */}
            <div className="flex gap-1">
              {[{ v: '', l: 'Todo' }, { v: 'INCOME', l: 'Ingresos' }, { v: 'EXPENSE', l: 'Gastos' }].map(({ v, l }) => (
                <button key={v} onClick={() => { setTypeFilter(v); setPage(1) }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${typeFilter === v ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {l}
                </button>
              ))}
            </div>
            {/* Source filter */}
            <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1) }}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600">
              <option value="">Todos los orígenes</option>
              {Object.entries(SOURCE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={() => setCatModal(true)}><Tag className="h-4 w-4" />Categorías</Button>
            <Button size="sm" variant="outline" onClick={() => setImportModal(true)}><FileText className="h-4 w-4" />Importar movimientos</Button>
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
                    <th className="text-left py-2.5 font-medium">Origen</th>
                    <th className="text-left py-2.5 font-medium">Descripción</th>
                    <th className="text-left py-2.5 font-medium">Categoría</th>
                    <th className="text-right py-2.5 font-medium">Importe</th>
                    <th className="text-right py-2.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.ledger?.data?.map((mv: any) => {
                    const src = SOURCE_META[mv.source] ?? SOURCE_META.MANUAL
                    const canEdit = true
                    const canMarkInvoice = mv.type === 'EXPENSE' && !['FEE', 'EVENT', 'ORDER', 'INVOICE'].includes(mv.source)
                    return (
                      <tr key={mv.id} className="hover:bg-gray-50">
                        <td className="py-3 text-gray-500 whitespace-nowrap">{fmtDate(mv.date)}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${src.color}`}>
                            {src.icon}{src.label}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded ${mv.type === 'INCOME' ? 'bg-green-50' : 'bg-red-50'}`}>
                              {mv.type === 'INCOME'
                                ? <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                                : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                            </div>
                            <span className="text-gray-900">{mv.description}</span>
                          </div>
                        </td>
                        <td className="py-3 text-gray-500 text-xs">
                          <button
                            onClick={() => { setEditCatModal({ open: true, movementId: mv.id, currentCategoryId: mv.category?.id ?? '', type: mv.type }); setEditCatValue(mv.category?.id ?? '') }}
                            className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                          >
                            {mv.category?.name ?? <span className="text-gray-300">Sin categoría</span>}
                            <Pencil className="h-3 w-3 opacity-50" />
                          </button>
                        </td>
                        <td className={`py-3 text-right font-semibold ${mv.type === 'INCOME' ? 'text-green-600' : 'text-red-500'}`}>
                          {mv.type === 'INCOME' ? '+' : '-'}{fmtCurrency(mv.amount)}
                        </td>
                        <td className="py-3 text-right">
                          {canMarkInvoice && (
                            <button
                              title="Marcar como factura"
                              onClick={() => { setMarkInvoiceModal({ open: true, movementId: mv.id, description: mv.description }); setInvoiceSupplier('') }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Receipt className="h-3 w-3" /> Factura
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {data.ledger?.data?.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">Sin movimientos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {data.ledger && (
              <Pagination page={data.ledger.page} totalPages={data.ledger.totalPages} total={data.ledger.total} pageSize={data.ledger.pageSize} onPageChange={setPage} />
            )}
          </>
        )}
      </Card>

      {/* New movement modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Registrar movimiento manual" size="sm">
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-xl flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">Los movimientos son permanentes. Para corregir un error, crea un movimiento de ajuste opuesto.</p>
          </div>
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
            <Button className="flex-1" onClick={submitMovement}>Guardar</Button>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* Import movements modal */}
      <ImportMovementsModal open={importModal} onClose={() => setImportModal(false)} clubId={clubId} onSuccess={() => { setImportModal(false); loadLedger() }} />

      {/* Edit category on movement */}
      {editCatModal && (
        <Modal open={editCatModal.open} onClose={() => setEditCatModal(null)} title="Editar categoría del movimiento" size="sm">
          <div className="space-y-4">
            <Select
              label="Categoría"
              value={editCatValue}
              onChange={(e) => setEditCatValue(e.target.value)}
              options={[
                { value: '', label: 'Sin categoría' },
                ...(editCatModal.type === 'INCOME' ? categories.income : categories.expense).map((c: any) => ({ value: c.id, label: c.name })),
              ]}
            />
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" disabled={savingCat} onClick={saveMovementCategory}>
                {savingCat ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setEditCatModal(null)}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Mark movement as invoice */}
      {markInvoiceModal && (
        <Modal open={markInvoiceModal.open} onClose={() => setMarkInvoiceModal(null)} title="Marcar como factura" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Este gasto se convertirá en una factura aprobada visible en la pestaña Facturas.
            </p>
            <Input
              label="Proveedor"
              placeholder={markInvoiceModal.description}
              value={invoiceSupplier}
              onChange={(e) => setInvoiceSupplier(e.target.value)}
              hint="Deja vacío para usar la descripción del movimiento"
            />
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" variant="primary" disabled={markingInvoice} onClick={saveMarkAsInvoice}>
                {markingInvoice ? 'Procesando...' : 'Confirmar'}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setMarkInvoiceModal(null)}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Categories management modal */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title="Categorías de movimientos" size="sm">
        <div className="space-y-4">
          <div className="space-y-2">
            {[...categories.income, ...categories.expense].length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin categorías</p>
            ) : (
              [...categories.income.map((c: any) => ({ ...c, type: 'INCOME' })), ...categories.expense.map((c: any) => ({ ...c, type: 'EXPENSE' }))].map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 border border-gray-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color ?? '#6b7280' }} />
                    <span className="text-sm font-medium text-gray-900">{c.name}</span>
                    <Badge variant={c.type === 'INCOME' ? 'success' : 'danger'}>{c.type === 'INCOME' ? 'Ingreso' : 'Gasto'}</Badge>
                  </div>
                  <button onClick={() => deleteCategory(c.id)} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Nueva categoría</p>
            <Input label="Nombre" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Tipo" value={catForm.type}
                onChange={(e) => setCatForm({ ...catForm, type: e.target.value })}
                options={[{ value: 'INCOME', label: 'Ingreso' }, { value: 'EXPENSE', label: 'Gasto' }]} />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Color</label>
                <input type="color" value={catForm.color}
                  onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
                  className="h-9 w-full rounded-lg border border-gray-200 cursor-pointer" />
              </div>
            </div>
            <Button className="w-full" onClick={submitCategory}><Plus className="h-4 w-4" />Crear categoría</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ── Invoices Panel ────────────────────────────────────────────────────────────

function InvoicesPanel({ clubId }: { clubId: string }) {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('false')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ amount: '', description: '', supplier: '', fileUrl: '', date: new Date().toISOString().slice(0, 10) })
  const [confirmApprove, setConfirmApprove] = useState<{ open: boolean; invoiceId: string; supplier: string; amount: number } | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/clubs/${clubId}/accounting/invoices?page=${page}&approved=${filter}`)
    if (res.ok) setData(await res.json())
  }, [clubId, page, filter])

  useEffect(() => { load() }, [load])

  const approve = async (invoiceId: string) => {
    setApprovingId(invoiceId)
    const res = await fetch(`/api/clubs/${clubId}/accounting/invoices/${invoiceId}`, { method: 'POST' })
    setApprovingId(null)
    if (res.ok) { toast.success('Factura aprobada — movimiento registrado en libro de cuentas'); setConfirmApprove(null); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const create = async () => {
    const res = await fetch(`/api/clubs/${clubId}/accounting/invoices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    })
    if (res.ok) { toast.success('Factura registrada'); setModal(false); load() }
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
                <th className="text-right py-2.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.data?.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="py-3 text-gray-500">{fmtDate(inv.date)}</td>
                  <td className="py-3 font-medium">{inv.supplier}</td>
                  <td className="py-3 text-gray-600">{inv.description}</td>
                  <td className="py-3 text-right font-semibold text-red-600">-{fmtCurrency(inv.amount)}</td>
                  <td className="py-3 text-right">
                    {!inv.approved ? (
                      <Button size="sm" variant="primary" disabled={approvingId === inv.id}
                        onClick={() => setConfirmApprove({ open: true, invoiceId: inv.id, supplier: inv.supplier, amount: inv.amount })}>
                        <Check className="h-3 w-3" /> Aprobar
                      </Button>
                    ) : (
                      <Badge variant="success">Aprobada</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {data.data?.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-gray-400">Sin facturas</td></tr>
              )}
            </tbody>
          </table>
          {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} />}
        </>
      )}

      {confirmApprove && (
        <Modal open={confirmApprove.open} onClose={() => setConfirmApprove(null)} title="Aprobar factura" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              ¿Confirmas la aprobación de la factura de <span className="font-semibold">{confirmApprove.supplier}</span> por{' '}
              <span className="font-semibold">{fmtCurrency(confirmApprove.amount)}</span>?
              Se registrará un gasto en el libro de bancos automáticamente.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" variant="primary" disabled={approvingId === confirmApprove.invoiceId}
                onClick={() => approve(confirmApprove.invoiceId)}>
                {approvingId === confirmApprove.invoiceId ? 'Aprobando...' : 'Sí, aprobar'}
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

// ── Quotas Panel ──────────────────────────────────────────────────────────────

function QuotasPanel({ clubId }: { clubId: string }) {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [payingId, setPayingId] = useState<string | null>(null)
  const [revertingId, setRevertingId] = useState<string | null>(null)
  const [createModal, setCreateModal] = useState(false)
  const [bulkModal, setBulkModal] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [form, setForm] = useState({ membershipId: '', year: new Date().getFullYear(), amount: '', dueDate: '' })
  const [bulkForm, setBulkForm] = useState({ year: new Date().getFullYear(), amount: '', dueDate: '' })

  const load = useCallback(async () => {
    let url = `/api/clubs/${clubId}/accounting/quotas?page=${page}`
    if (statusFilter) url += `&status=${statusFilter}`
    if (yearFilter) url += `&year=${yearFilter}`
    const res = await fetch(url)
    if (res.ok) setData(await res.json())
  }, [clubId, page, statusFilter, yearFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch(`/api/clubs/${clubId}/members?status=APPROVED&pageSize=200`)
      .then((r) => r.json())
      .then((d) => setMembers(d.data ?? []))
  }, [clubId])

  const revertQuota = async (quotaId: string) => {
    setRevertingId(quotaId)
    const res = await fetch(`/api/clubs/${clubId}/accounting/quotas?quotaId=${quotaId}`, {
      method: 'DELETE',
    })
    setRevertingId(null)
    if (res.ok) { toast.success('Cuota revertida — movimiento de anulación registrado'); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const markPaid = async (quotaId: string) => {
    setPayingId(quotaId)
    const res = await fetch(`/api/clubs/${clubId}/accounting/quotas`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_paid', quotaId }),
    })
    setPayingId(null)
    if (res.ok) { toast.success('Cuota pagada — ingreso registrado en el libro de bancos'); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const createQuota = async () => {
    if (!form.membershipId || !form.amount) return toast.error('Completa todos los campos')
    const res = await fetch(`/api/clubs/${clubId}/accounting/quotas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, year: Number(form.year), amount: parseFloat(form.amount), dueDate: form.dueDate || undefined }),
    })
    if (res.ok) { toast.success('Cuota asignada'); setCreateModal(false); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const generateBulk = async () => {
    if (!bulkForm.amount) return toast.error('Indica el importe')
    const res = await fetch(`/api/clubs/${clubId}/accounting/fees`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: Number(bulkForm.year), amount: parseFloat(bulkForm.amount), dueDate: bulkForm.dueDate || undefined }),
    })
    const d = await res.json()
    if (res.ok) { toast.success(d.message ?? 'Cuotas generadas'); setBulkModal(false); load() }
    else { toast.error(d.error ?? 'Error') }
  }

  const pendingCount = data?.data?.filter((q: any) => q.status !== 'PAID').length ?? 0

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Cuotas anuales</CardTitle>
          {pendingCount > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">{pendingCount} cuota{pendingCount > 1 ? 's' : ''} pendiente{pendingCount > 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Filters */}
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600">
            <option value="">Todos los estados</option>
            <option value="PENDING">Pendientes</option>
            <option value="PAID">Pagadas</option>
            <option value="OVERDUE">Vencidas</option>
          </select>
          <select value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1) }}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-600">
            <option value="">Todos los años</option>
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={() => setBulkModal(true)}><Zap className="h-4 w-4" />Generar masivo</Button>
          <Button size="sm" onClick={() => setCreateModal(true)}><Plus className="h-4 w-4" />Asignar cuota</Button>
        </div>
      </CardHeader>

      {!data ? <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p> : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left py-2.5 font-medium">Socio</th>
                <th className="text-left py-2.5 font-medium">Año</th>
                <th className="text-left py-2.5 font-medium">Vencimiento</th>
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
                  <td className="py-3 text-gray-500 text-xs">
                    {q.dueDate ? fmtDate(q.dueDate) : '—'}
                  </td>
                  <td className="py-3 font-semibold">{fmtCurrency(q.amount)}</td>
                  <td className="py-3"><QuotaStatusBadge status={q.status} /></td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {q.status !== 'PAID' && (
                        <Button size="sm" disabled={payingId === q.id} onClick={() => markPaid(q.id)}>
                          <Check className="h-3 w-3" /> {payingId === q.id ? 'Procesando...' : 'Marcar pagada'}
                        </Button>
                      )}
                      {q.status === 'PAID' && (
                        <Button size="sm" variant="outline" disabled={revertingId === q.id} onClick={() => revertQuota(q.id)}>
                          <RotateCcw className="h-3 w-3" /> {revertingId === q.id ? 'Revirtiendo...' : 'Revertir'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data.data?.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">Sin cuotas registradas</td></tr>
              )}
            </tbody>
          </table>
          {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} />}
        </>
      )}

      {/* Assign individual quota modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Asignar cuota a socio" size="sm">
        <div className="space-y-4">
          <Select label="Socio" value={form.membershipId}
            onChange={(e) => setForm({ ...form, membershipId: e.target.value })}
            options={[
              { value: '', label: 'Selecciona un socio' },
              ...members.map((m: any) => ({ value: m.id, label: `${m.user?.name} (${m.user?.email})` })),
            ]} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Año" type="number" value={form.year}
              onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })} />
            <Input label="Importe (€)" type="number" step="0.01" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <Input label="Fecha de vencimiento (opcional)" type="date" value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={createQuota}>Asignar</Button>
            <Button variant="outline" className="flex-1" onClick={() => setCreateModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* Bulk generate modal */}
      <Modal open={bulkModal} onClose={() => setBulkModal(false)} title="Generar cuotas masivas" size="sm">
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
            Genera automáticamente una cuota para todos los socios aprobados que aún no tengan cuota del año indicado. La operación es idempotente.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Año" type="number" value={bulkForm.year}
              onChange={(e) => setBulkForm({ ...bulkForm, year: parseInt(e.target.value) })} />
            <Input label="Importe por socio (€)" type="number" step="0.01" value={bulkForm.amount}
              onChange={(e) => setBulkForm({ ...bulkForm, amount: e.target.value })} />
          </div>
          <Input label="Fecha de vencimiento (opcional)" type="date" value={bulkForm.dueDate}
            onChange={(e) => setBulkForm({ ...bulkForm, dueDate: e.target.value })} />
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={generateBulk}><Zap className="h-4 w-4" />Generar</Button>
            <Button variant="outline" className="flex-1" onClick={() => setBulkModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}

// ── Import Movements Modal ────────────────────────────────────────────────────

type MovementCsvRow = {
  fecha: string
  descripcion: string
  importe: string
  tipo: string
  categoria: string
}

function parseMovementsCsv(text: string): MovementCsvRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  return lines.slice(1).map((line) => {
    const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''))
    return {
      fecha: parts[0] ?? '',
      descripcion: parts[1] ?? '',
      importe: parts[2] ?? '',
      tipo: parts[3] ?? '',
      categoria: parts[4] ?? '',
    }
  }).filter((r) => r.descripcion || r.importe)
}

function ImportMovementsModal({ open, onClose, clubId, onSuccess }: {
  open: boolean
  onClose: () => void
  clubId: string
  onSuccess: () => void
}) {
  const [rows, setRows] = useState<MovementCsvRow[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [importing, setImporting] = useState(false)

  const downloadTemplate = () => {
    const csv = [
      'fecha,descripcion,importe,tipo,categoria',
      `${new Date().toISOString().slice(0, 10)},Ejemplo ingreso,150.00,INCOME,`,
      `${new Date().toISOString().slice(0, 10)},Ejemplo gasto,75.50,EXPENSE,Material`,
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_movimientos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      // Fallback to windows-1252 if UTF-8 produced replacement chars (Excel exports)
      if (text.includes('\uFFFD')) {
        const r2 = new FileReader()
        r2.onload = (ev2) => { setRows(parseMovementsCsv(ev2.target?.result as string)); setProgress(null) }
        r2.readAsText(file, 'windows-1252')
      } else {
        setRows(parseMovementsCsv(text))
        setProgress(null)
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleImport = async () => {
    if (!rows.length) return
    setImporting(true)
    setProgress({ done: 0, total: rows.length })
    let succeeded = 0
    let failed = 0
    let firstError = ''

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const res = await fetch(`/api/clubs/${clubId}/accounting/movements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: row.descripcion,
            amount: parseFloat(row.importe),
            type: row.tipo.toUpperCase().trim(),
            date: row.fecha.trim(),
            // omit categoryId — zod .optional() accepts undefined, not null
          }),
        })
        if (res.ok) {
          succeeded++
        } else {
          failed++
          if (!firstError) {
            const d = await res.json().catch(() => ({}))
            firstError = d.error ?? `Error HTTP ${res.status}`
          }
        }
      } catch {
        failed++
      }
      setProgress({ done: i + 1, total: rows.length })
    }

    setImporting(false)
    if (succeeded > 0) {
      toast.success(`${succeeded} movimientos importados correctamente`)
    }
    if (failed > 0) {
      toast.error(`${failed} fallidos${firstError ? `: ${firstError}` : ''}`, { duration: 6000 })
    }
    if (succeeded > 0) onSuccess()
  }

  const handleClose = () => {
    if (importing) return
    setRows([])
    setProgress(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Importar movimientos desde CSV" size="md">
      <div className="space-y-4">
        <div className="p-3 bg-blue-50 rounded-xl flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-700 space-y-0.5">
            <p>Descarga la plantilla, rellénala y súbela para importar movimientos en bloque.</p>
            <p>Campos: <strong>fecha</strong> (YYYY-MM-DD), <strong>descripcion</strong>, <strong>importe</strong>, <strong>tipo</strong> (INCOME o EXPENSE), <strong>categoria</strong> (opcional).</p>
          </div>
        </div>

        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
        >
          <FileText className="h-3.5 w-3.5" /> Descargar plantilla CSV
        </button>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Subir archivo CSV</label>
          <input
            type="file"
            accept=".csv"
            disabled={importing}
            onChange={handleFileUpload}
            className="block text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer disabled:opacity-50"
          />
        </div>

        {rows.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-600">{rows.length} movimientos listos para importar</p>

            <div className="overflow-x-auto rounded-xl border border-gray-100 max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2 px-3 font-medium">Fecha</th>
                    <th className="text-left py-2 px-3 font-medium">Descripción</th>
                    <th className="text-left py-2 px-3 font-medium">Importe</th>
                    <th className="text-left py-2 px-3 font-medium">Tipo</th>
                    <th className="text-left py-2 px-3 font-medium">Categoría</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-1.5 px-3 text-gray-500">{row.fecha}</td>
                      <td className="py-1.5 px-3 text-gray-900">{row.descripcion}</td>
                      <td className={`py-1.5 px-3 font-medium ${row.tipo.toUpperCase() === 'INCOME' ? 'text-green-600' : 'text-red-500'}`}>
                        {row.tipo.toUpperCase() === 'INCOME' ? '+' : '-'}{row.importe}
                      </td>
                      <td className="py-1.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${row.tipo.toUpperCase() === 'INCOME' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                          {row.tipo.toUpperCase() === 'INCOME' ? 'Ingreso' : 'Gasto'}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-gray-400">{row.categoria || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {progress && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Importando...</span>
                  <span>{progress.done} / {progress.total}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                disabled={importing}
                onClick={handleImport}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="h-4 w-4" />
                {importing ? `Importando ${progress?.done ?? 0}/${progress?.total ?? rows.length}...` : `Importar ${rows.length} movimientos`}
              </button>
              <button
                disabled={importing}
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {rows.length === 0 && (
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={handleClose} className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cerrar
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
