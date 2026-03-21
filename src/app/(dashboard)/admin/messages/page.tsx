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

export default function MessagesAdminPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ subject: '', body: '', targetRole: 'SOCIO', sendEmail: true })

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

  const send = async () => {
    if (!form.subject || !form.body) return toast.error('Asunto y mensaje son obligatorios')
    const res = await fetch(`/api/clubs/${clubId}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    if (res.ok) {
      const d = await res.json()
      toast.success(`Mensaje enviado a ${d._count?.recipients ?? 0} destinatarios`)
      setModal(false)
      setForm({ subject: '', body: '', targetRole: 'SOCIO', sendEmail: true })
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
            <Button size="sm" onClick={() => setModal(true)}><Plus className="h-4 w-4" />Nuevo mensaje</Button>
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
          <Select label="Destinatarios" value={form.targetRole}
            onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
            options={[
              { value: 'SOCIO', label: 'Todos los socios' },
              { value: 'CLUB_ADMIN', label: 'Solo administradores' },
              { value: 'ALL', label: 'Todos los miembros del club' },
            ]} />
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
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.sendEmail}
              onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })}
              className="rounded" />
            <span className="font-medium text-gray-700">Enviar también por email</span>
            <span className="text-gray-400">(requiere proveedor de email configurado)</span>
          </label>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={send}><Send className="h-4 w-4" />Enviar mensaje</Button>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
