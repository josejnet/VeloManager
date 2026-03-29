'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { fmtDateTime } from '@/lib/utils'
import { Send, Plus, Users, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

type RecipientMode = 'ALL' | 'MULTIPLE' | 'ONE'

interface Member { id: string; name: string; email: string }

export default function MessagesAdminPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('ALL')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [form, setForm] = useState({ subject: '', body: '' })

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1').then((r) => r.json()).then((d) => { if (d.data?.[0]) setClubId(d.data[0].id) })
  }, [session])

  const fetch_ = useCallback(async () => {
    if (!clubId) return
    const res = await fetch(`/api/clubs/${clubId}/messages?page=${page}`)
    if (res.ok) setData(await res.json())
  }, [clubId, page])

  useEffect(() => { fetch_() }, [fetch_])

  // Load members when modal opens
  useEffect(() => {
    if (!modal || !clubId || members.length > 0) return
    fetch(`/api/clubs/${clubId}/members?pageSize=500`)
      .then((r) => r.json())
      .then((d) => {
        const list: Member[] = (d.data ?? []).map((m: any) => ({
          id: m.userId ?? m.user?.id ?? m.id,
          name: m.user?.name ?? m.name ?? '',
          email: m.user?.email ?? m.email ?? '',
        }))
        setMembers(list)
      })
  }, [modal, clubId, members.length])

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const openModal = () => {
    setForm({ subject: '', body: '' })
    setRecipientMode('ALL')
    setSelectedIds([])
    setModal(true)
  }

  const send = async () => {
    if (!form.subject || !form.body) return toast.error('Asunto y mensaje son obligatorios')

    let payload: Record<string, unknown> = { subject: form.subject, body: form.body, sendEmail: false }

    if (recipientMode === 'ALL') {
      payload.targetRole = 'ALL'
    } else if (recipientMode === 'MULTIPLE' || recipientMode === 'ONE') {
      if (selectedIds.length === 0) return toast.error('Selecciona al menos un destinatario')
      payload.recipientIds = selectedIds
    }

    const res = await fetch(`/api/clubs/${clubId}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (res.ok) {
      const d = await res.json()
      toast.success(`Mensaje enviado a ${d._count?.recipients ?? 0} destinatarios`)
      setModal(false)
      fetch_()
    } else {
      const d = await res.json(); toast.error(d.error ?? 'Error')
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Mensajería interna" clubId={clubId} />
      <main className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Mensajes enviados</CardTitle>
            <Button size="sm" onClick={openModal}><Plus className="h-4 w-4" />Nuevo mensaje</Button>
          </CardHeader>

          {!data ? <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p> : (
            <div className="space-y-3">
              {data.data?.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">Sin mensajes enviados</p>
              ) : (
                data.data?.map((msg: any) => (
                  <div key={msg.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{msg.subject}</p>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                          <Users className="h-3 w-3" />
                          {msg._count?.recipients} destinatarios ·
                          {msg.sentAt && ` Enviado ${fmtDateTime(msg.sentAt)}`}
                        </p>
                      </div>
                      <Badge variant="success" className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> Enviado
                      </Badge>
                    </div>
                  </div>
                ))
              )}
              {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={setPage} />}
            </div>
          )}
        </Card>
      </main>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo mensaje" size="lg">
        <div className="space-y-4">
          {/* Recipient mode */}
          <Select
            label="Destinatarios"
            value={recipientMode}
            onChange={(e) => { setRecipientMode(e.target.value as RecipientMode); setSelectedIds([]) }}
            options={[
              { value: 'ALL', label: 'Todos los socios' },
              { value: 'MULTIPLE', label: 'Varios socios' },
              { value: 'ONE', label: 'Un socio específico' },
            ]}
          />

          {/* Single member picker */}
          {recipientMode === 'ONE' && (
            <Select
              label="Selecciona el socio"
              value={selectedIds[0] ?? ''}
              onChange={(e) => setSelectedIds(e.target.value ? [e.target.value] : [])}
              options={[
                { value: '', label: '— Elige un socio —' },
                ...members.map((m) => ({ value: m.id, label: `${m.name} (${m.email})` })),
              ]}
            />
          )}

          {/* Multi member picker */}
          {recipientMode === 'MULTIPLE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Selecciona socios <span className="text-gray-400 font-normal">({selectedIds.length} seleccionados)</span>
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {members.length === 0 && (
                  <p className="text-sm text-gray-400 p-3 text-center">Cargando socios...</p>
                )}
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(m.id)}
                      onChange={() => toggleId(m.id)}
                      className="accent-primary"
                    />
                    <span className="text-sm text-gray-900">{m.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{m.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <Input label="Asunto" placeholder="Asunto del mensaje" value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              rows={6}
              placeholder="Escribe el mensaje aquí..."
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={send}><Send className="h-4 w-4" />Enviar mensaje</Button>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
