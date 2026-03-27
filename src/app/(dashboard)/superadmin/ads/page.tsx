'use client'
import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { fmtDate } from '@/lib/utils'
import {
  Plus, Play, Pause, BarChart2, Trash2, Megaphone,
  Target, TrendingUp, MousePointerClick, Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'

type Status = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
type Placement = 'DASHBOARD' | 'EVENTS' | 'CHECKOUT'
type BudgetType = 'IMPRESSIONS' | 'CLICKS'

interface Campaign {
  id: string
  advertiserName: string
  title: string
  description: string | null
  imageUrl: string | null
  linkUrl: string
  ctaText: string
  sportTypes: string[]
  provinces: string[]
  localities: string[]
  budgetType: BudgetType
  budgetLimit: number
  budgetUsed: number
  placement: Placement
  status: Status
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  impressions: number
  clicks: number
  ctr: number
}

interface Analytics {
  campaign: { title: string; budgetLimit: number; budgetUsed: number; budgetType: BudgetType }
  totals: { impressions: number; clicks: number; ctr: number }
  series: { date: string; impressions: number; clicks: number }[]
}

const STATUS_LABELS: Record<Status, string> = {
  DRAFT: 'Borrador', ACTIVE: 'Activa', PAUSED: 'Pausada', COMPLETED: 'Completada',
}
const STATUS_VARIANTS: Record<Status, 'default' | 'success' | 'warning' | 'info'> = {
  DRAFT: 'default', ACTIVE: 'success', PAUSED: 'warning', COMPLETED: 'info',
}
const PLACEMENT_LABELS: Record<Placement, string> = {
  DASHBOARD: 'Dashboard', EVENTS: 'Eventos', CHECKOUT: 'Post-pedido',
}

const EMPTY_FORM = {
  advertiserName: '', title: '', description: '', imageUrl: '', linkUrl: '',
  ctaText: 'Ver más', sportTypes: '', provinces: '', localities: '',
  budgetType: 'IMPRESSIONS' as BudgetType, budgetLimit: '1000',
  placement: 'DASHBOARD' as Placement, status: 'DRAFT' as Status,
  startsAt: '', endsAt: '',
}

export default function SuperAdminAdsPage() {
  const [data, setData] = useState<{ data: Campaign[]; total: number; page: number; totalPages: number } | null>(null)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [analyticsModal, setAnalyticsModal] = useState(false)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    const res = await fetch(`/api/superadmin/ads?page=${page}`)
    if (res.ok) setData(await res.json())
  }, [page])

  useEffect(() => { fetch_() }, [fetch_])

  const create = async () => {
    if (!form.advertiserName || !form.title || !form.linkUrl || !form.budgetLimit) {
      return toast.error('Anunciante, título, URL y presupuesto son obligatorios')
    }
    setSaving(true)
    const res = await fetch('/api/superadmin/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        sportTypes: form.sportTypes ? form.sportTypes.split(',').map((s) => s.trim()).filter(Boolean) : [],
        provinces: form.provinces ? form.provinces.split(',').map((s) => s.trim()).filter(Boolean) : [],
        localities: form.localities ? form.localities.split(',').map((s) => s.trim()).filter(Boolean) : [],
        budgetLimit: parseInt(form.budgetLimit),
        imageUrl: form.imageUrl || undefined,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Campaña creada')
      setModal(false)
      setForm(EMPTY_FORM)
      fetch_()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Error')
    }
  }

  const toggleStatus = async (c: Campaign) => {
    const next: Status = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    const res = await fetch(`/api/superadmin/ads/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) {
      toast.success(next === 'ACTIVE' ? 'Campaña activada' : 'Campaña pausada')
      fetch_()
    } else toast.error('Error al actualizar')
  }

  const deleteCampaign = async (id: string) => {
    const res = await fetch(`/api/superadmin/ads/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Campaña eliminada')
      setDeleteId(null)
      fetch_()
    } else toast.error('Error al eliminar')
  }

  const openAnalytics = async (id: string) => {
    setAnalyticsLoading(true)
    setAnalyticsModal(true)
    setAnalytics(null)
    const res = await fetch(`/api/superadmin/ads/${id}/analytics?days=30`)
    if (res.ok) setAnalytics(await res.json())
    else toast.error('Error al cargar analytics')
    setAnalyticsLoading(false)
  }

  const fi = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [field]: e.target.value })

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Publicidad y Patrocinios" />
      <main className="flex-1 p-6 space-y-4">

        {/* Stats bar */}
        {data && (
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total campañas', value: data.total, icon: Megaphone, color: 'text-primary' },
              { label: 'Activas', value: data.data.filter((c) => c.status === 'ACTIVE').length, icon: Play, color: 'text-green-600' },
              { label: 'Impresiones', value: data.data.reduce((s, c) => s + c.impressions, 0).toLocaleString(), icon: Eye, color: 'text-blue-600' },
              { label: 'Clics totales', value: data.data.reduce((s, c) => s + c.clicks, 0).toLocaleString(), icon: MousePointerClick, color: 'text-purple-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-gray-50 ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-xl font-bold text-gray-900">{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Campañas publicitarias</CardTitle>
            <Button size="sm" onClick={() => setModal(true)}>
              <Plus className="h-4 w-4" /> Nueva campaña
            </Button>
          </CardHeader>

          {!data ? (
            <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
          ) : data.data.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <Megaphone className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Sin campañas creadas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.data.map((c) => {
                const budgetPct = Math.min(100, (c.budgetUsed / c.budgetLimit) * 100)
                return (
                  <div key={c.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{c.title}</p>
                          <Badge variant={STATUS_VARIANTS[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                          <Badge variant="default">{PLACEMENT_LABELS[c.placement]}</Badge>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{c.advertiserName}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{c.impressions} imp.</span>
                          <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" />{c.clicks} clics</span>
                          <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{c.ctr.toFixed(1)}% CTR</span>
                          {(c.sportTypes.length > 0 || c.provinces.length > 0) && (
                            <span className="flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {[...c.sportTypes, ...c.provinces].join(', ')}
                            </span>
                          )}
                        </div>
                        {/* Budget progress */}
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                            <span>Presupuesto usado: {c.budgetUsed}/{c.budgetLimit} {c.budgetType === 'CLICKS' ? 'clics' : 'imp.'}</span>
                            <span>{budgetPct.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${budgetPct >= 90 ? 'bg-red-400' : budgetPct >= 60 ? 'bg-amber-400' : 'bg-green-400'}`}
                              style={{ width: `${budgetPct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => openAnalytics(c.id)}>
                          <BarChart2 className="h-3.5 w-3.5" /> Métricas
                        </Button>
                        {c.status !== 'COMPLETED' && (
                          <Button
                            size="sm"
                            variant={c.status === 'ACTIVE' ? 'outline' : 'primary'}
                            onClick={() => toggleStatus(c)}
                          >
                            {c.status === 'ACTIVE' ? <><Pause className="h-3.5 w-3.5" /> Pausar</> : <><Play className="h-3.5 w-3.5" /> Activar</>}
                          </Button>
                        )}
                        <Button size="sm" variant="danger" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={10} onPageChange={setPage} />
            </div>
          )}
        </Card>
      </main>

      {/* Create campaign modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva campaña publicitaria" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Anunciante" placeholder="Decathlon, Garmin…" value={form.advertiserName} onChange={fi('advertiserName')} />
            <Input label="Título del anuncio" value={form.title} onChange={fi('title')} />
          </div>
          <Input label="Descripción (opcional)" value={form.description} onChange={fi('description')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="URL de destino" placeholder="https://…" value={form.linkUrl} onChange={fi('linkUrl')} />
            <Input label="URL de imagen (opcional)" placeholder="https://…" value={form.imageUrl} onChange={fi('imageUrl')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Texto del botón CTA" value={form.ctaText} onChange={fi('ctaText')} />
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1.5">Placement</p>
              <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl" value={form.placement} onChange={fi('placement')}>
                <option value="DASHBOARD">Dashboard (banner principal)</option>
                <option value="EVENTS">Eventos (integrado en lista)</option>
                <option value="CHECKOUT">Post-pedido (checkout)</option>
              </select>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" /> Segmentación
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Deportes" placeholder="cycling, padel, running" hint="Separados por coma. Vacío = global." value={form.sportTypes} onChange={fi('sportTypes')} />
              <Input label="Provincias" placeholder="Madrid, Barcelona" hint="Vacío = todas." value={form.provinces} onChange={fi('provinces')} />
              <Input label="Localidades" placeholder="Getafe, Alcalá…" hint="Vacío = todas." value={form.localities} onChange={fi('localities')} />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Presupuesto</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1.5">Tipo</p>
                <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl" value={form.budgetType} onChange={fi('budgetType')}>
                  <option value="IMPRESSIONS">Por impresiones</option>
                  <option value="CLICKS">Por clics</option>
                </select>
              </div>
              <Input label="Límite" type="number" min="1" value={form.budgetLimit} onChange={fi('budgetLimit')} />
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1.5">Estado inicial</p>
                <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl" value={form.status} onChange={fi('status')}>
                  <option value="DRAFT">Borrador</option>
                  <option value="ACTIVE">Activa</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Input label="Fecha inicio (opcional)" type="datetime-local" value={form.startsAt} onChange={fi('startsAt')} />
              <Input label="Fecha fin (opcional)" type="datetime-local" value={form.endsAt} onChange={fi('endsAt')} />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={create} disabled={saving}>
              {saving ? 'Guardando...' : 'Crear campaña'}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* Analytics modal */}
      <Modal open={analyticsModal} onClose={() => setAnalyticsModal(false)} title="Métricas de campaña" size="xl">
        {analyticsLoading ? (
          <p className="text-sm text-gray-400 text-center py-8">Cargando métricas...</p>
        ) : analytics && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Impresiones', value: analytics.totals.impressions.toLocaleString(), icon: Eye, color: 'text-blue-600 bg-blue-50' },
                { label: 'Clics', value: analytics.totals.clicks.toLocaleString(), icon: MousePointerClick, color: 'text-purple-600 bg-purple-50' },
                { label: 'CTR', value: `${analytics.totals.ctr.toFixed(2)}%`, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className={`inline-flex p-2 rounded-lg ${color} mb-2`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Budget progress */}
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Presupuesto consumido</span>
                <span className="font-semibold">
                  {analytics.campaign.budgetUsed}/{analytics.campaign.budgetLimit} {analytics.campaign.budgetType === 'CLICKS' ? 'clics' : 'impresiones'}
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, (analytics.campaign.budgetUsed / analytics.campaign.budgetLimit) * 100)}%` }}
                />
              </div>
            </div>

            {/* Daily series table */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Actividad diaria (últimos 30 días)</h3>
              <div className="overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-100 text-xs text-gray-500">
                      <th className="text-left py-2 font-medium">Fecha</th>
                      <th className="text-right py-2 font-medium">Impresiones</th>
                      <th className="text-right py-2 font-medium">Clics</th>
                      <th className="text-right py-2 font-medium">CTR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {analytics.series.filter((d) => d.impressions > 0 || d.clicks > 0).reverse().map((d) => (
                      <tr key={d.date} className="hover:bg-gray-50">
                        <td className="py-2 text-gray-600">{d.date}</td>
                        <td className="py-2 text-right font-medium">{d.impressions}</td>
                        <td className="py-2 text-right font-medium">{d.clicks}</td>
                        <td className="py-2 text-right text-gray-500">
                          {d.impressions > 0 ? `${((d.clicks / d.impressions) * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm delete */}
      {deleteId && (
        <Modal open onClose={() => setDeleteId(null)} title="Eliminar campaña" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              ¿Seguro que quieres eliminar esta campaña? Se perderán todas sus métricas históricas.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" variant="danger" onClick={() => deleteCampaign(deleteId)}>Eliminar</Button>
              <Button className="flex-1" variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
