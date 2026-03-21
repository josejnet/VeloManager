'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { THEMES } from '@/lib/themes'
import { getThemeVars } from '@/lib/themes'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')
  const [form, setForm] = useState({ name: '', slogan: '', sport: '', colorTheme: 'blue', logoUrl: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1').then((r) => r.json()).then((d) => {
      if (d.data?.[0]) {
        const club = d.data[0]
        setClubId(club.id)
        setForm({ name: club.name ?? '', slogan: club.slogan ?? '', sport: club.sport ?? '', colorTheme: club.colorTheme ?? 'blue', logoUrl: club.logoUrl ?? '' })
      }
    })
  }, [session])

  const save = async () => {
    setLoading(true)
    const res = await fetch(`/api/clubs/${clubId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    if (res.ok) toast.success('Configuración guardada')
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
    setLoading(false)
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto" style={{ cssText: getThemeVars(form.colorTheme) } as React.CSSProperties}>
      <Header title="Configuración del Club" clubId={clubId} />
      <main className="flex-1 p-6 space-y-6">

        {/* Basic info */}
        <Card>
          <CardHeader><CardTitle>Información básica</CardTitle></CardHeader>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre del club" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Slogan / Lema" value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} />
            <Input label="Deporte" value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} />
            <Input label="URL del logo" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
          </div>
        </Card>

        {/* Color theme */}
        <Card>
          <CardHeader><CardTitle>Paleta de colores</CardTitle></CardHeader>
          <div className="grid grid-cols-4 gap-3">
            {Object.values(THEMES).map((theme) => {
              const selected = form.colorTheme === theme.key
              return (
                <button
                  key={theme.key}
                  onClick={() => setForm({ ...form, colorTheme: theme.key })}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${selected ? 'border-primary shadow-md' : 'border-gray-100 hover:border-gray-300'}`}
                >
                  <div
                    className="h-8 w-full rounded-lg mb-2"
                    style={{ background: `rgb(${theme.primary})` }}
                  />
                  <p className="text-xs font-semibold text-gray-900">{theme.label}</p>
                  <p className="text-xs text-gray-400">{theme.sport}</p>
                </button>
              )
            })}
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={save} loading={loading} size="lg">Guardar cambios</Button>
        </div>
      </main>
    </div>
  )
}
