'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { WindowStatusBadge, OrderStatusBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { fmtCurrency, fmtDate } from '@/lib/utils'
import { Plus, Play, Square, Download, Package, ShoppingBag, CreditCard, CheckCircle, Truck, X } from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'windows' | 'orders' | 'products'

export default function PurchasesPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')
  const [tab, setTab] = useState<Tab>('windows')
  const [pendingOrderCount, setPendingOrderCount] = useState(0)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1').then((r) => r.json()).then((d) => { if (d.data?.[0]) setClubId(d.data[0].id) })
  }, [session])

  useEffect(() => {
    if (!clubId) return
    fetch(`/api/clubs/${clubId}/orders?status=PENDING&pageSize=1`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setPendingOrderCount(d.total ?? 0) })
  }, [clubId])

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'windows', label: 'Campañas' },
    { key: 'orders', label: 'Pedidos', badge: pendingOrderCount },
    { key: 'products', label: 'Catálogo' },
  ]

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Compras Conjuntas" clubId={clubId} />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {tabs.map(({ key, label, badge }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              {label}
              {badge != null && badge > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          ))}
        </div>
        {clubId && tab === 'windows' && <WindowsPanel clubId={clubId} />}
        {clubId && tab === 'orders' && <OrdersPanel clubId={clubId} onOrderChange={() => {
          fetch(`/api/clubs/${clubId}/orders?status=PENDING&pageSize=1`)
            .then((r) => r.ok ? r.json() : null)
            .then((d) => { if (d) setPendingOrderCount(d.total ?? 0) })
        }} />}
        {clubId && tab === 'products' && <ProductsPanel clubId={clubId} />}
      </main>
    </div>
  )
}

// ── Orders Panel ──────────────────────────────────────────────────────────────

function OrdersPanel({ clubId, onOrderChange }: { clubId: string; onOrderChange: () => void }) {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [orderDetail, setOrderDetail] = useState<any>(null)
  const [payModal, setPayModal] = useState<{ orderId: string; memberName: string; amount: number } | null>(null)
  const [payNote, setPayNote] = useState('')

  const fetch_ = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (statusFilter) qs.set('status', statusFilter)
    const res = await fetch(`/api/clubs/${clubId}/orders?${qs}`)
    if (res.ok) setData(await res.json())
  }, [clubId, page, statusFilter])

  useEffect(() => { fetch_() }, [fetch_])

  const doAction = async (orderId: string, action: 'pay' | 'confirm' | 'deliver' | 'cancel', note?: string) => {
    setProcessingId(orderId)
    let res: Response
    if (action === 'pay') {
      res = await fetch(`/api/clubs/${clubId}/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || undefined }),
      })
    } else {
      const statusMap = { confirm: 'CONFIRMED', deliver: 'DELIVERED', cancel: 'CANCELLED' }
      res = await fetch(`/api/clubs/${clubId}/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusMap[action] }),
      })
    }
    setProcessingId(null)
    if (res.ok) {
      toast.success(action === 'pay' ? 'Pago registrado y movimiento bancario creado' : 'Estado actualizado')
      setPayModal(null)
      setPayNote('')
      fetch_()
      onOrderChange()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Error al procesar')
    }
  }

  const statusOptions = [
    { value: '', label: 'Todos los estados' },
    { value: 'PENDING', label: 'Pend. pago' },
    { value: 'PAID', label: 'Pagados' },
    { value: 'CONFIRMED', label: 'Confirmados' },
    { value: 'DELIVERED', label: 'Entregados' },
    { value: 'CANCELLED', label: 'Cancelados' },
  ]

  const totalRevenue = data?.data?.reduce((sum: number, o: any) =>
    ['PAID', 'CONFIRMED', 'DELIVERED'].includes(o.status) ? sum + Number(o.totalAmount) : sum, 0) ?? 0
  const paidCount = data?.data?.filter((o: any) => o.status === 'PAID').length ?? 0
  const pendingCount = data?.data?.filter((o: any) => o.status === 'PENDING').length ?? 0

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-2">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-gray-900">{data?.total ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1">Total pedidos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="text-xs text-gray-500 mt-1">Pend. pago</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-green-600">{fmtCurrency(totalRevenue)}</p>
          <p className="text-xs text-gray-500 mt-1">Recaudado (pagados)</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </CardHeader>

        {!data ? (
          <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
        ) : !data.data?.length ? (
          <p className="text-sm text-gray-400 py-8 text-center">Sin pedidos</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2.5 font-medium">Socio</th>
                  <th className="text-left py-2.5 font-medium">Campaña</th>
                  <th className="text-left py-2.5 font-medium">Importe</th>
                  <th className="text-left py-2.5 font-medium">Estado</th>
                  <th className="text-left py-2.5 font-medium">Fecha</th>
                  <th className="text-right py-2.5 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.data.map((order: any) => (
                  <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setOrderDetail(order)}>
                    <td className="py-3 font-medium text-gray-900">{order.user?.name}</td>
                    <td className="py-3 text-gray-500">{order.purchaseWindow?.name}</td>
                    <td className="py-3 font-semibold">{fmtCurrency(order.totalAmount)}</td>
                    <td className="py-3"><OrderStatusBadge status={order.status} /></td>
                    <td className="py-3 text-gray-400">{fmtDate(order.createdAt)}</td>
                    <td className="py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {order.status === 'PENDING' && (
                          <Button size="sm" variant="primary" disabled={processingId === order.id}
                            onClick={() => setPayModal({ orderId: order.id, memberName: order.user?.name, amount: Number(order.totalAmount) })}>
                            <CreditCard className="h-3 w-3" /> Cobrar
                          </Button>
                        )}
                        {order.status === 'PAID' && (
                          <Button size="sm" variant="outline" disabled={processingId === order.id}
                            onClick={() => doAction(order.id, 'confirm')}>
                            <CheckCircle className="h-3 w-3" /> Confirmar
                          </Button>
                        )}
                        {order.status === 'CONFIRMED' && (
                          <Button size="sm" variant="outline" disabled={processingId === order.id}
                            onClick={() => doAction(order.id, 'deliver')}>
                            <Truck className="h-3 w-3" /> Entregar
                          </Button>
                        )}
                        {['PENDING', 'PAID'].includes(order.status) && (
                          <Button size="sm" variant="ghost" disabled={processingId === order.id}
                            onClick={() => { if (confirm(`¿Cancelar pedido de ${order.user?.name}?`)) doAction(order.id, 'cancel') }}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} />
          </div>
        )}
      </Card>

      {/* Order detail modal */}
      {orderDetail && (
        <Modal open={!!orderDetail} onClose={() => setOrderDetail(null)} title={`Pedido — ${orderDetail.user?.name}`} size="md">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Campaña: <strong>{orderDetail.purchaseWindow?.name}</strong></p>
                <p className="text-sm text-gray-500">Fecha: {fmtDate(orderDetail.createdAt)}</p>
              </div>
              <OrderStatusBadge status={orderDetail.status} />
            </div>
            <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
              <thead className="bg-gray-50">
                <tr className="text-xs text-gray-500">
                  <th className="text-left p-3 font-medium">Producto</th>
                  <th className="text-center p-3 font-medium">Talla</th>
                  <th className="text-center p-3 font-medium">Uds</th>
                  <th className="text-right p-3 font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orderDetail.items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="p-3 font-medium">{item.product?.name}</td>
                    <td className="p-3 text-center text-gray-500">{item.size}</td>
                    <td className="p-3 text-center text-gray-500">{item.quantity}</td>
                    <td className="p-3 text-right font-semibold">{fmtCurrency(Number(item.price) * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="p-3 text-right font-semibold text-gray-700">Total</td>
                  <td className="p-3 text-right font-bold text-primary">{fmtCurrency(orderDetail.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Modal>
      )}

      {/* Pay confirmation modal */}
      {payModal && (
        <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Registrar pago" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Registrar pago de <strong>{fmtCurrency(payModal.amount)}</strong> de <strong>{payModal.memberName}</strong>.
            </p>
            <p className="text-xs text-gray-400 bg-blue-50 border border-blue-100 rounded-lg p-3">
              Se creará automáticamente un ingreso en la contabilidad del club por <strong>{fmtCurrency(payModal.amount)}</strong>.
            </p>
            <Input
              label="Nota (opcional)"
              placeholder="Descripción del movimiento en contabilidad"
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
            />
            <div className="flex gap-2">
              <Button className="flex-1" disabled={processingId === payModal.orderId}
                onClick={() => doAction(payModal.orderId, 'pay', payNote)}>
                {processingId === payModal.orderId ? 'Procesando...' : 'Confirmar pago'}
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => setPayModal(null)}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Windows Panel ─────────────────────────────────────────────────────────────

function WindowsPanel({ clubId }: { clubId: string }) {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [products, setProducts] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', productIds: [] as string[] })
  const [exportData, setExportData] = useState<any>(null)
  const [exportModal, setExportModal] = useState(false)
  const [confirmToggle, setConfirmToggle] = useState<{ open: boolean; windowId: string; name: string; current: string } | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    const res = await fetch(`/api/clubs/${clubId}/purchases/windows?page=${page}`)
    if (res.ok) setData(await res.json())
  }, [clubId, page])

  useEffect(() => { fetch_() }, [fetch_])
  useEffect(() => {
    fetch(`/api/clubs/${clubId}/purchases/products?active=true&pageSize=100`)
      .then((r) => r.json()).then((d) => setProducts(d.data ?? []))
  }, [clubId])

  const create = async () => {
    if (!form.name || form.productIds.length === 0) return toast.error('Nombre y al menos un producto son obligatorios')
    const res = await fetch(`/api/clubs/${clubId}/purchases/windows`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    if (res.ok) { toast.success('Campaña creada'); setModal(false); setForm({ name: '', productIds: [] }); fetch_() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const toggleStatus = async (windowId: string, current: string) => {
    const status = current === 'OPEN' ? 'CLOSED' : 'OPEN'
    setTogglingId(windowId)
    const res = await fetch(`/api/clubs/${clubId}/purchases/windows/${windowId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    setTogglingId(null)
    if (res.ok) {
      toast.success(status === 'OPEN' ? 'Campaña abierta — socios notificados' : 'Campaña cerrada')
      setConfirmToggle(null); fetch_()
    } else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const exportReport = async (windowId: string) => {
    const res = await fetch(`/api/clubs/${clubId}/purchases/windows/${windowId}/export`)
    if (res.ok) { setExportData(await res.json()); setExportModal(true) }
    else toast.error('Error al generar informe')
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Campañas de compra</CardTitle>
          <Button size="sm" onClick={() => setModal(true)}><Plus className="h-4 w-4" />Nueva campaña</Button>
        </CardHeader>
        {!data ? <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p> : (
          <div className="space-y-3">
            {data.data?.map((w: any) => (
              <div key={w.id} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{w.name}</p>
                    <WindowStatusBadge status={w.status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {w.products?.length} productos · {w._count?.orders} pedidos
                    {w.openedAt && ` · Abierta ${fmtDate(w.openedAt)}`}
                    {w.closedAt && ` · Cerrada ${fmtDate(w.closedAt)}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {w.status !== 'CLOSED' && (
                    <Button size="sm" variant={w.status === 'OPEN' ? 'danger' : 'primary'} disabled={togglingId === w.id}
                      onClick={() => setConfirmToggle({ open: true, windowId: w.id, name: w.name, current: w.status })}>
                      {w.status === 'OPEN' ? <><Square className="h-3 w-3" /> Cerrar</> : <><Play className="h-3 w-3" /> Abrir</>}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => exportReport(w.id)}>
                    <Download className="h-3 w-3" /> Informe
                  </Button>
                </div>
              </div>
            ))}
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} />
          </div>
        )}
      </Card>

      {confirmToggle && (
        <Modal open={confirmToggle.open} onClose={() => setConfirmToggle(null)} title={confirmToggle.current === 'OPEN' ? 'Cerrar campaña' : 'Abrir campaña'} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {confirmToggle.current === 'OPEN'
                ? <>¿Seguro que quieres <span className="font-semibold text-red-600">cerrar</span> la campaña <span className="font-semibold">"{confirmToggle.name}"</span>? Los socios no podrán hacer más pedidos.</>
                : <>¿Quieres <span className="font-semibold text-green-600">abrir</span> la campaña <span className="font-semibold">"{confirmToggle.name}"</span>? Los socios recibirán una notificación.</>}
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" variant={confirmToggle.current === 'OPEN' ? 'danger' : 'primary'}
                disabled={togglingId === confirmToggle.windowId}
                onClick={() => toggleStatus(confirmToggle.windowId, confirmToggle.current)}>
                {togglingId === confirmToggle.windowId ? 'Procesando...' : confirmToggle.current === 'OPEN' ? 'Sí, cerrar' : 'Sí, abrir'}
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => setConfirmToggle(null)}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nueva campaña" size="md">
        <div className="space-y-4">
          <Input label="Nombre de la campaña" placeholder="Ej: Equipación 2026" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Productos incluidos</p>
            {products.length === 0
              ? <p className="text-sm text-gray-400">No hay productos activos. Crea productos primero en el catálogo.</p>
              : <div className="space-y-2 max-h-48 overflow-y-auto">
                {products.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 p-2.5 border border-gray-100 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={form.productIds.includes(p.id)}
                      onChange={(e) => setForm({ ...form, productIds: e.target.checked ? [...form.productIds, p.id] : form.productIds.filter((id) => id !== p.id) })} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-gray-400">{fmtCurrency(p.price)} · Tallas: {p.availableSizes?.join(', ')}</p>
                    </div>
                  </label>
                ))}
              </div>}
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={create}>Crear campaña</Button>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={exportModal} onClose={() => setExportModal(false)} title="Informe de producción" size="xl">
        {exportData && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{exportData.totals?.orders}</p>
                <p className="text-xs text-gray-500 mt-1">Pedidos</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{exportData.totals?.items}</p>
                <p className="text-xs text-gray-500 mt-1">Unidades</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{fmtCurrency(exportData.totals?.revenue)}</p>
                <p className="text-xs text-gray-500 mt-1">Total</p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Resumen para proveedor</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2 font-medium">Producto</th>
                  <th className="text-left py-2 font-medium">Talla</th>
                  <th className="text-right py-2 font-medium">Unidades</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {exportData.summary?.map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-2">{r.productName}</td>
                      <td className="py-2">{r.size}</td>
                      <td className="py-2 text-right font-semibold">{r.totalQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

// ── Products Panel ─────────────────────────────────────────────────────────

function ProductsPanel({ clubId }: { clubId: string }) {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', price: '', imageUrl: '', availableSizes: '', totalStock: '' })

  const fetch_ = useCallback(async () => {
    const res = await fetch(`/api/clubs/${clubId}/purchases/products?page=${page}&active=false`)
    if (res.ok) setData(await res.json())
  }, [clubId, page])

  useEffect(() => { fetch_() }, [fetch_])

  const create = async () => {
    const res = await fetch(`/api/clubs/${clubId}/purchases/products`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        price: parseFloat(form.price),
        availableSizes: form.availableSizes.split(',').map((s) => s.trim()).filter(Boolean),
        totalStock: form.totalStock ? parseInt(form.totalStock) : undefined,
      }),
    })
    if (res.ok) { toast.success('Producto creado'); setModal(false); setForm({ name: '', description: '', price: '', imageUrl: '', availableSizes: '', totalStock: '' }); fetch_() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catálogo de productos</CardTitle>
        <Button size="sm" onClick={() => setModal(true)}><Plus className="h-4 w-4" />Nuevo producto</Button>
      </CardHeader>
      {!data ? <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p> : (
        <div className="grid grid-cols-3 gap-4">
          {data.data?.map((p: any) => (
            <div key={p.id} className="border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-36 bg-gray-100 flex items-center justify-center">
                {p.images?.[0]
                  ? <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                  : <Package className="h-10 w-10 text-gray-300" />}
              </div>
              <div className="p-3">
                <p className="font-semibold text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{p.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-primary">{fmtCurrency(p.price)}</span>
                  {p.totalStock && <span className="text-xs text-gray-400">Stock: {p.totalStock}</span>}
                </div>
                {p.availableSizes?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.availableSizes.map((s: string) => (
                      <span key={s} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {!data.data?.length && <p className="col-span-3 text-sm text-gray-400 py-8 text-center">Sin productos. Crea el primer producto para empezar.</p>}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo producto" size="md">
        <div className="space-y-4">
          <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Precio (€)" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <Input label="Stock total (opcional)" type="number" value={form.totalStock} onChange={(e) => setForm({ ...form, totalStock: e.target.value })} />
          </div>
          <Input label="Tallas disponibles" placeholder="XS, S, M, L, XL, XXL"
            value={form.availableSizes} onChange={(e) => setForm({ ...form, availableSizes: e.target.value })}
          />
          <Input label="URL de imagen" placeholder="https://..." value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={create}>Crear producto</Button>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
