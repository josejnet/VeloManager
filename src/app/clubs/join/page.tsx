'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Input'
import { THEMES } from '@/lib/themes'
import { Trophy, Plus, Search, Users, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

export default function JoinClubPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'join' | 'create'>('join')
  const [clubs, setClubs] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const [createForm, setCreateForm] = useState({
    name: '', slogan: '', sport: '', colorTheme: 'blue', logoUrl: '',
  })

  const fetchClubs = async () => {
    const res = await fetch(`/api/clubs/public?search=${search}`)
    if (res.ok) setClubs((await res.json()).data ?? [])
  }

  useEffect(() => { if (tab === 'join') fetchClubs() }, [tab, search])

  const joinClub = async (clubId: string) => {
    setLoading(true)
    const res = await fetch(`/api/clubs/${clubId}/members`, { method: 'POST' })
    setLoading(false)
    if (res.ok) { toast.success('Solicitud enviada. Espera la aprobación del administrador.'); router.push('/socio') }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  const createClub = async () => {
    if (!createForm.name || !createForm.sport) return toast.error('Nombre y deporte son obligatorios')
    setLoading(true)
    const res = await fetch('/api/clubs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createForm),
    })
    setLoading(false)
    if (res.ok) { toast.success('¡Club creado!'); router.push('/admin') }
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Clube</h1>
        </div>

        <div className="flex justify-end mb-4">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>

        <Card>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
            <button onClick={() => setTab('join')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${tab === 'join' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              <Users className="h-4 w-4" /> Unirse a un club
            </button>
            <button onClick={() => setTab('create')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${tab === 'create' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              <Plus className="h-4 w-4" /> Crear mi club
            </button>
          </div>

          {tab === 'join' && (
            <div className="space-y-4">
              <Input
                placeholder="Buscar club por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {clubs.length === 0 ? (
                  <p className="text-sm text-gray-400 py-8 text-center">No se encontraron clubs</p>
                ) : (
                  clubs.map((club: any) => (
                    <div key={club.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center">
                          <Trophy className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{club.name}</p>
                          <p className="text-xs text-gray-400">{club.sport} · {club._count?.memberships ?? 0} socios</p>
                        </div>
                      </div>
                      <Button size="sm" loading={loading} onClick={() => joinClub(club.id)}>
                        Solicitar entrada
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'create' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Nombre del club *" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
                <Input label="Slogan / Lema" value={createForm.slogan} onChange={(e) => setCreateForm({ ...createForm, slogan: e.target.value })} />
                <Input label="Deporte *" value={createForm.sport} onChange={(e) => setCreateForm({ ...createForm, sport: e.target.value })} />
                <Input label="URL del logo" value={createForm.logoUrl} onChange={(e) => setCreateForm({ ...createForm, logoUrl: e.target.value })} />
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Color del club</p>
                <div className="grid grid-cols-4 gap-2">
                  {Object.values(THEMES).map((theme) => (
                    <button key={theme.key} onClick={() => setCreateForm({ ...createForm, colorTheme: theme.key })}
                      className={`p-2 rounded-xl border-2 text-left transition-all ${createForm.colorTheme === theme.key ? 'border-blue-500' : 'border-gray-100'}`}>
                      <div className="h-6 rounded-lg mb-1" style={{ background: `rgb(${theme.primary})` }} />
                      <p className="text-xs font-medium text-gray-700 truncate">{theme.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Button className="w-full" size="lg" loading={loading} onClick={createClub}>
                Crear club y convertirme en Admin
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
