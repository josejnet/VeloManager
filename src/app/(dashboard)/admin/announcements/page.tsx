'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { fmtDate } from '@/lib/utils'
import { Plus, Pin, Paperclip, FileText, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AnnouncementsPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({
    title: '', body: '', imageUrl: '', pinned: false,
    expiresAt: '',
    files: [] as { name: string; url: string }[],
  })
  const [newFile, setNewFile] = useState({ name: '', url: '' })

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1').then((r) => r.json()).then((d) => { if (d.data?.[0]) setClubId(d.data[0].id) })
  }, [session])

  const fetch_ = useCallback(async () => {
    if (!clubId) return
    const res = await fetch(`/api/clubs/${clubId}/announcements?page=${page}`)
    if (res.ok) setData(await res.json())
  }, [clubId, page])

  useEffect(() => { fetch_() }, [fetch_])

  const create = async () => {
    if (!form.title || !form.body) return toast.error('Título y contenido son obligatorios')
    const payload: any = {
      title: form.title, body: form.body, pinned: form.pinned,
      ...(form.imageUrl && { imageUrl: form.imageUrl }),
      ...(form.expiresAt && { expiresAt: new Date(form.expiresAt).toISOString() }),
      ...(form.files.length && { files: form.files }),
    }
    const res = await fetch(`/api/clubs/${clubId}/announcements`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (res.ok) { toast.success('Anuncio publicado'); setModal(false); fetch_() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este anuncio?')) return
    await fetch(`/api/clubs/${clubId}/announcements/${id}`, { method: 'DELETE' })
    toast.success('Anuncio eliminado')
    fetch_()
  }

  const addFile = () => {
    if (!newFile.name || !newFile.url) return
    setForm({ ...form, files: [...form.files, newFile] })
    setNewFile({ name: '', url: '' })
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Anuncios y Noticias" clubId={clubId} />
      <main className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Tablón de anuncios</CardTitle>
            <Button size="sm" onClick={() => setModal(true)}><Plus className="h-4 w-4" />Nuevo anuncio</Button>
          </CardHeader>

          {!data ? <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p> : data.data?.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Sin anuncios publicados</p>
          ) : (
            <div className="space-y-4">
              {data.data?.map((a: any) => (
                <div key={a.id} className={`border rounded-xl p-4 ${a.pinned ? 'border-primary/30 bg-primary/5' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {a.pinned && <Pin className="h-4 w-4 text-primary" />}
                        <p className="font-semibold text-gray-900">{a.title}</p>
                        {a.expiresAt && <Badge variant="warning">Expira {fmtDate(a.expiresAt)}</Badge>}
                      </div>
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{a.body}</p>
                      {a.sharedFiles?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {a.sharedFiles.map((f: any) => (
                            <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors">
                              <Paperclip className="h-3.5 w-3.5" /> {f.name}
                            </a>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-2">{fmtDate(a.publishAt)}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} />
            </div>
          )}
        </Card>
      </main>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo anuncio" size="lg">
        <div className="space-y-4">
          <Input label="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contenido *</label>
            <textarea rows={5}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="URL imagen (opcional)" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
            <Input label="Expira el (opcional)" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
            <Pin className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-gray-700">Fijar en la parte superior</span>
          </label>

          {/* Files */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Archivos adjuntos</p>
            {form.files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2 mb-1">
                <FileText className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-medium">{f.name}</span>
                <button className="ml-auto text-red-400" onClick={() => setForm({ ...form, files: form.files.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <div className="flex gap-2 mt-1">
              <input className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg" placeholder="Nombre del archivo"
                value={newFile.name} onChange={(e) => setNewFile({ ...newFile, name: e.target.value })} />
              <input className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg" placeholder="URL del archivo"
                value={newFile.url} onChange={(e) => setNewFile({ ...newFile, url: e.target.value })} />
              <Button size="sm" variant="outline" onClick={addFile}><Plus className="h-3 w-3" /></Button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={create}>Publicar anuncio</Button>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
