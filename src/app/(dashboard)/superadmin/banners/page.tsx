'use client'
import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { fmtDateTime } from '@/lib/utils'
import { Plus, Eye, MousePointer, Power, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const TARGET_OPTIONS = [
  { value: 'ALL', label: 'Todos los usuarios' },
  { value: 'SPORT', label: 'Por deporte' },
  { value: 'PROVINCE', label: 'Por provincia' },
  { value: 'LOCALITY', label: 'Por localidad' },
  { value: 'CLUB', label: 'Clubs específicos' },
]

export default function SuperAdminBannersPage() {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({
    title: '', body: '', imageUrl: '', linkUrl: '', linkLabel: '',
    targetType: 'ALL', targetSport: '', targetProvince: '', targetLocality: '',
    expiresAt: '', active: true,
  })

  const fetch_ = useCallback(async () => {
    const res = await fetch(`/api/superadmin/banners?page=${page}&active=false`)
    if (res.ok) setData(await res.json())
  }, [page])

  useEffect(() => { fetch_() }, [fetch_])

  const create = async () => {
    if (!form.title || !form.body) return toast.error('Título y contenido son obligatorios')
    const payload: any = {
      title: form.title, body: form.body, active: form.active, targetType: form.targetType,
      ...(form.imageUrl && { imageUrl: form.imageUrl }),
      ...(form.linkUrl && { linkUrl: form.linkUrl }),
      ...(form.linkLabel && { linkLabel: form.linkLabel }),
      ...(form.targetSport && { targetSport: form.targetSport }),
      ...(form.targetProvince && { targetProvince: form.targetProvince }),
      ...(form.targetLocality && { targetLocality: form.targetLocality }),
      ...(form.expiresAt && { expiresAt: new Date(form.expiresAt).toISOString() }),
    }
    const res = await fetch('/api/superadmin/banners', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (res.ok) { toast.success('Banner creado'); setModal(false); fetch_() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const toggle = async (id: string, active: boolean) => {
    await fetch(`/api/superadmin/banners/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !active }),
    })
    fetch_()
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este banner?')) return
    await fetch(`/api/superadmin/banners/${id}`, { method: 'DELETE' })
    toast.success('Banner eliminado')
    fetch_()
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Gestión de Banners" />
      <main className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Banners de plataforma</CardTitle>
            <Button size="sm" onClick={() => setModal(true)}><Plus className="h-4 w-4" />Nuevo banner</Button>
          </CardHeader>
          <p className="text-xs text-gray-400 mb-4">
            Los banners aparecen como una franja discreta en los dashboards de los usuarios según la segmentación configurada.
          </p>

          {!data ? <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p> : (
            <div className="space-y-3">
              {data.data?.map((b: any) => (
                <div key={b.id} className={`border rounded-xl p-4 ${b.active ? 'border-green-100 bg-green-50/30' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{b.title}</p>
                        <Badge variant={b.active ? 'success' : 'default'}>{b.active ? 'Activo' : 'Inactivo'}</Badge>
                        <Badge variant="default">{b.targetType}</Badge>
                        {b.targetSport && <Badge variant="info">{b.targetSport}</Badge>}
                        {b.targetProvince && <Badge variant="purple">{b.targetProvince}</Badge>}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{b.body}</p>
                      {b.expiresAt && <p className="text-xs text-gray-400 mt-1">Expira: {fmtDateTime(b.expiresAt)}</p>}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{b.viewCount}</span>
                        <span className="flex items-center gap-1"><MousePointer className="h-3 w-3" />{b.clickCount}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => toggle(b.id, b.active)}>
                          <Power className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(b.id)}>
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} />}
            </div>
          )}
        </Card>
      </main>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo banner" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input label="Texto del enlace" value={form.linkLabel} onChange={(e) => setForm({ ...form, linkLabel: e.target.value })} />
          </div>
          <Input label="Mensaje *" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="URL imagen (opcional)" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
            <Input label="URL enlace (opcional)" value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Segmentación" value={form.targetType}
              onChange={(e) => setForm({ ...form, targetType: e.target.value })}
              options={TARGET_OPTIONS} />
            <Input label="Caduca el (opcional)" type="datetime-local" value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
          {form.targetType === 'SPORT' && <Input label="Deporte (ej: Ciclismo)" value={form.targetSport} onChange={(e) => setForm({ ...form, targetSport: e.target.value })} />}
          {form.targetType === 'PROVINCE' && <Input label="Provincia (ej: Madrid)" value={form.targetProvince} onChange={(e) => setForm({ ...form, targetProvince: e.target.value })} />}
          {form.targetType === 'LOCALITY' && <Input label="Localidad" value={form.targetLocality} onChange={(e) => setForm({ ...form, targetLocality: e.target.value })} />}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={create}>Crear banner</Button>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
