'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { WindowStatusBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { fmtCurrency, fmtDate } from '@/lib/utils'
import { Plus, Play, Square, Download, Package, ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'windows' | 'products'

export default function PurchasesPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1').then((r) => r.json()).then((d) => { if (d.data?.[0]) setClubId(d.data[0].id) })
  }, [session])

  const [tab, setTab] = useState<Tab>('windows')

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Compras Conjuntas" clubId={clubId} />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button onClick={() => setTab('windows')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'windows' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            Campañas
          </button>
          <button onClick={() => setTab('products')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'products' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            Catálogo de productos
          </button>
        </div>
        {clubId && tab === 'windows' && <WindowsPanel clubId={clubId} />}
        {clubId && tab === 'products' && <ProductsPanel clubId={clubId} />}
      </main>
    </div>
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
    const res = await fetch(`/api/clubs/${clubId}/purchases/windows/${windowId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    if (res.ok) { toast.success(status === 'OPEN' ? 'Campaña abierta' : 'Campaña cerrada'); fetch_() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
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
                    <Button size="sm" variant={w.status === 'OPEN' ? 'danger' : 'primary'} onClick={() => toggleStatus(w.id, w.status)}>
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

      {/* Create modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva campaña" size="md">
        <div className="space-y-4">
          <Input label="Nombre de la campaña" placeholder="Ej: Equipación 2026" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Productos incluidos</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
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
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={create}>Crear campaña</Button>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* Export modal */}
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
    if (res.ok) { toast.success('Producto creado'); setModal(false); fetch_() }
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
                {p.imageUrl
                  ? <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                  : <Package className="h-10 w-10 text-gray-300" />}
              </div>
              <div className="p-3">
                <p className="font-semibold text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-primary">{fmtCurrency(p.price)}</span>
                  {p.totalStock && <span className="text-xs text-gray-400">Stock: {p.totalStock}</span>}
                </div>
                {p.availableSizes?.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">Tallas: {p.availableSizes.join(', ')}</p>
                )}
              </div>
            </div>
          ))}
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
          <Input label="Tallas disponibles" placeholder="XS, S, M, L, XL" value={form.availableSizes}
            hint="Separadas por comas" onChange={(e) => setForm({ ...form, availableSizes: e.target.value })} />
          <Input label="URL de imagen" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={create}>Crear producto</Button>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
