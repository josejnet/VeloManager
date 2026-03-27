'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { THEMES, getThemeVars } from '@/lib/themes'
import { Info, Paintbrush, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')
  const [form, setForm] = useState({
    name: '',
    slogan: '',
    sport: '',
    colorTheme: 'blue',
    logoUrl: '',
    primaryColor: '',   // custom hex, e.g. "#2563eb"
    secondaryColor: '', // custom hex, e.g. "#0ea5e9"
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1').then((r) => r.json()).then((d) => {
      if (d.data?.[0]) {
        const club = d.data[0]
        setClubId(club.id)
        setForm({
          name: club.name ?? '',
          slogan: club.slogan ?? '',
          sport: club.sport ?? '',
          colorTheme: club.colorTheme ?? 'blue',
          logoUrl: club.logoUrl ?? '',
          primaryColor: club.primaryColor ?? '',
          secondaryColor: club.secondaryColor ?? '',
        })
      }
    })
  }, [session])

  const save = async () => {
    setLoading(true)
    const payload: Record<string, any> = {
      name: form.name,
      slogan: form.slogan,
      sport: form.sport,
      colorTheme: form.colorTheme,
      logoUrl: form.logoUrl || null,
      primaryColor: form.primaryColor || null,
      secondaryColor: form.secondaryColor || null,
    }
    const res = await fetch(`/api/clubs/${clubId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) toast.success('Configuración guardada — recarga para ver los nuevos colores')
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
    setLoading(false)
  }

  const clearCustomColors = () => setForm({ ...form, primaryColor: '', secondaryColor: '' })

  // Preview the current branding live
  const previewVars = getThemeVars(form.colorTheme, form.primaryColor || null, form.secondaryColor || null)
  const hasCustomColors = !!form.primaryColor

  return (
    <div className="flex flex-col flex-1 overflow-auto" style={{ cssText: previewVars } as React.CSSProperties}>
      <Header title="Configuración del Club" clubId={clubId} />
      <main className="flex-1 p-6 space-y-6">

        {/* ── Basic info ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>Información básica</CardTitle></CardHeader>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre del club" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Slogan / Lema" value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} />
            <Input label="Deporte" value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} />
            <Input label="URL del logo" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
          </div>
          {form.logoUrl && (
            <div className="mt-4 flex items-center gap-4">
              <img src={form.logoUrl} alt="Logo preview" className="h-14 w-14 rounded-xl object-cover border border-gray-200" />
              <p className="text-xs text-gray-400">Vista previa del logo</p>
            </div>
          )}
        </Card>

        {/* ── Predefined themes ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Paleta predefinida</CardTitle>
            {hasCustomColors && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                Los colores personalizados tienen prioridad
              </span>
            )}
          </CardHeader>
          <div className="grid grid-cols-4 gap-3">
            {Object.values(THEMES).map((theme) => {
              const selected = form.colorTheme === theme.key && !hasCustomColors
              return (
                <button
                  key={theme.key}
                  onClick={() => setForm({ ...form, colorTheme: theme.key, primaryColor: '', secondaryColor: '' })}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${selected ? 'border-primary shadow-md' : 'border-gray-100 hover:border-gray-300'}`}
                >
                  <div className="h-8 w-full rounded-lg mb-2" style={{ background: `rgb(${theme.primary})` }} />
                  <p className="text-xs font-semibold text-gray-900">{theme.label}</p>
                  <p className="text-xs text-gray-400">{theme.sport}</p>
                </button>
              )
            })}
          </div>
        </Card>

        {/* ── Custom brand colors ────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Paintbrush className="h-4 w-4 text-primary" />
              <CardTitle>Colores personalizados de marca</CardTitle>
            </div>
            {hasCustomColors && (
              <Button size="sm" variant="outline" onClick={clearCustomColors}>
                <RotateCcw className="h-3.5 w-3.5" />
                Usar paleta predefinida
              </Button>
            )}
          </CardHeader>

          <p className="text-sm text-gray-500 mb-4">
            Define los colores exactos de tu club. Si los rellenas, tendrán prioridad sobre la paleta predefinida
            y se aplicarán en toda la interfaz (botones, sidebar, headers, badges…).
          </p>

          <div className="grid grid-cols-2 gap-6">
            {/* Primary color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color primario</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primaryColor || '#2563eb'}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  className="h-10 w-10 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                />
                <input
                  type="text"
                  placeholder="#2563eb"
                  value={form.primaryColor}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '' || /^#[0-9a-fA-F]{0,6}$/.test(v)) {
                      setForm({ ...form, primaryColor: v })
                    }
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              {form.primaryColor && (
                <div
                  className="mt-2 h-8 rounded-lg flex items-center justify-center text-white text-xs font-semibold"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  Botones · Sidebar · Badges
                </div>
              )}
            </div>

            {/* Secondary color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color secundario</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.secondaryColor || form.primaryColor || '#0ea5e9'}
                  onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                  className="h-10 w-10 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                />
                <input
                  type="text"
                  placeholder="#0ea5e9"
                  value={form.secondaryColor}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '' || /^#[0-9a-fA-F]{0,6}$/.test(v)) {
                      setForm({ ...form, secondaryColor: v })
                    }
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              {form.secondaryColor && (
                <div
                  className="mt-2 h-8 rounded-lg flex items-center justify-center text-white text-xs font-semibold"
                  style={{ backgroundColor: form.secondaryColor }}
                >
                  Acentos · Highlights
                </div>
              )}
            </div>
          </div>

          {/* Live preview bar */}
          {hasCustomColors && (
            <div className="mt-5 p-4 rounded-xl border border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Vista previa de la marca</p>
              <div className="flex items-center gap-3 flex-wrap">
                <div
                  className="h-9 px-4 rounded-lg flex items-center text-white text-sm font-semibold"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  Botón primario
                </div>
                <div
                  className="h-9 px-4 rounded-lg border-2 text-sm font-semibold"
                  style={{ borderColor: form.primaryColor, color: form.primaryColor }}
                >
                  Botón outline
                </div>
                <div
                  className="h-9 w-9 rounded-lg"
                  style={{ backgroundColor: form.primaryColor }}
                />
                {form.secondaryColor && (
                  <div
                    className="h-9 w-9 rounded-lg"
                    style={{ backgroundColor: form.secondaryColor }}
                  />
                )}
                <span className="text-xs text-gray-400">Toda la interfaz usará estos colores</span>
              </div>
            </div>
          )}
        </Card>

        <div className="flex justify-end">
          <Button onClick={save} loading={loading} size="lg">Guardar cambios</Button>
        </div>
      </main>
    </div>
  )
}
