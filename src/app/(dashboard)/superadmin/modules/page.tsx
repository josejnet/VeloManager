'use client'
import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'
import { Plus, Puzzle, Trash2, Edit } from 'lucide-react'

interface PlatformModule {
  id: string
  key: string
  name: string
  description: string | null
  icon: string | null
  includedInPlans: string[]
  createdAt: string
}

const PLANS = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE']

export default function SuperAdminModulesPage() {
  const [modules, setModules] = useState<PlatformModule[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ key: '', name: '', description: '', icon: '', includedInPlans: [] as string[] })

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/superadmin/modules')
    if (res.ok) setModules((await res.json()).data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.key || !form.name) return toast.error('Clave y nombre son obligatorios')
    const res = await fetch('/api/superadmin/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, defaultForPlans: form.includedInPlans }),
    })
    if (res.ok) { toast.success('Módulo creado'); setModal(false); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este módulo?')) return
    await fetch(`/api/superadmin/modules/${id}`, { method: 'DELETE' })
    toast.success('Módulo eliminado')
    load()
  }

  const togglePlan = (plan: string) => {
    const has = form.includedInPlans.includes(plan)
    setForm({ ...form, includedInPlans: has ? form.includedInPlans.filter(p => p !== plan) : [...form.includedInPlans, plan] })
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Módulos de plataforma" />
      <main className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Módulos disponibles</CardTitle>
            <Button size="sm" onClick={() => setModal(true)}><Plus className="h-4 w-4" />Nuevo módulo</Button>
          </CardHeader>

          {loading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Cargando...</p>
          ) : modules.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No hay módulos registrados</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 pb-4">
              {modules.map((m) => (
                <div key={m.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Puzzle className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{m.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{m.key}</p>
                      </div>
                    </div>
                    <button onClick={() => remove(m.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {m.description && <p className="text-xs text-gray-500 mt-2">{m.description}</p>}
                  <div className="flex gap-1 mt-3 flex-wrap">
                    {m.includedInPlans.map(p => (
                      <Badge key={p} variant={p === 'FREE' ? 'default' : p === 'PRO' ? 'info' : p === 'PREMIUM' ? 'warning' : 'success'}>
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo módulo">
        <div className="space-y-4">
          <Input label="Clave técnica *" placeholder="e.g. events_calendar" value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value })} />
          <Input label="Nombre *" placeholder="Calendario de eventos" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Descripción" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Icono (nombre lucide-react)" placeholder="Calendar" value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Disponible en planes</p>
            <div className="flex gap-2 flex-wrap">
              {PLANS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlan(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    form.includedInPlans.includes(p)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={create}>Crear módulo</Button>
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
