'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { THEMES, getThemeVars, themeVarsToStyle } from '@/lib/themes'
import toast from 'react-hot-toast'

type Visibility = 'PUBLIC' | 'PRIVATE' | 'HIDDEN'
type JoinPolicy = 'OPEN' | 'REQUEST' | 'INVITE_ONLY'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')
  const [form, setForm] = useState({ name: '', slogan: '', sport: '', colorTheme: 'blue', logoUrl: '' })
  const [access, setAccess] = useState<{
    visibility: Visibility
    joinPolicy: JoinPolicy
    autoApprove: boolean
    inviteLinksEnabled: boolean
    defaultInviteExpiryDays: number | null
    defaultInviteMaxUses: number | null
  }>({
    visibility: 'PUBLIC',
    joinPolicy: 'REQUEST',
    autoApprove: false,
    inviteLinksEnabled: true,
    defaultInviteExpiryDays: 7,
    defaultInviteMaxUses: 1,
  })
  const [loading, setLoading] = useState(false)
  const [accessLoading, setAccessLoading] = useState(false)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1').then((r) => r.json()).then((d) => {
      if (d.data?.[0]) {
        const club = d.data[0]
        setClubId(club.id)
        setForm({ name: club.name ?? '', slogan: club.slogan ?? '', sport: club.sport ?? '', colorTheme: club.colorTheme ?? 'blue', logoUrl: club.logoUrl ?? '' })
        setAccess({
          visibility: club.visibility ?? 'PUBLIC',
          joinPolicy: club.joinPolicy ?? 'REQUEST',
          autoApprove: club.autoApprove ?? false,
          inviteLinksEnabled: club.inviteLinksEnabled ?? true,
          defaultInviteExpiryDays: club.defaultInviteExpiryDays ?? 7,
          defaultInviteMaxUses: club.defaultInviteMaxUses ?? 1,
        })
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

  const saveAccess = async () => {
    setAccessLoading(true)
    const res = await fetch(`/api/clubs/${clubId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(access),
    })
    if (res.ok) toast.success('Configuración de acceso guardada')
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
    setAccessLoading(false)
  }

  const visibilityOptions: { value: Visibility; label: string; desc: string }[] = [
    { value: 'PUBLIC', label: 'Público', desc: 'Aparece en el directorio de clubes. Cualquiera puede solicitar acceso.' },
    { value: 'PRIVATE', label: 'Privado', desc: 'Aparece en el directorio, pero requiere invitación o aprobación manual.' },
    { value: 'HIDDEN', label: 'Oculto', desc: 'No aparece en el directorio. Solo accesible por enlace directo.' },
  ]

  const joinPolicyOptions: { value: JoinPolicy; label: string; desc: string }[] = [
    { value: 'OPEN', label: 'Abierto', desc: 'Cualquier persona puede unirse (con aprobación automática si está activa).' },
    { value: 'REQUEST', label: 'Solicitud', desc: 'Los usuarios solicitan acceso y el administrador aprueba manualmente.' },
    { value: 'INVITE_ONLY', label: 'Solo por invitación', desc: 'Únicamente usuarios con una invitación válida pueden unirse.' },
  ]

  return (
    <div className="flex flex-col flex-1 overflow-auto" style={themeVarsToStyle(getThemeVars(form.colorTheme))}>
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
          <div className="flex justify-end pt-4">
            <Button onClick={save} loading={loading}>Guardar cambios</Button>
          </div>
        </Card>

        {/* Color theme */}
        <Card>
          <CardHeader><CardTitle>Paleta de colores</CardTitle></CardHeader>
          <div className="grid grid-cols-4 gap-3">
            {Object.values(THEMES).map((theme) => {
              const selected = form.colorTheme === theme.key
              return (
                <button key={theme.key} onClick={() => setForm({ ...form, colorTheme: theme.key })}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${selected ? 'border-primary shadow-md' : 'border-gray-100 hover:border-gray-300'}`}>
                  <div className="h-8 w-full rounded-lg mb-2" style={{ background: `rgb(${theme.primary})` }} />
                  <p className="text-xs font-semibold text-gray-900">{theme.label}</p>
                  <p className="text-xs text-gray-400">{theme.sport}</p>
                </button>
              )
            })}
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={save} loading={loading}>Guardar colores</Button>
          </div>
        </Card>

        {/* Access control */}
        <Card>
          <CardHeader><CardTitle>Control de acceso</CardTitle></CardHeader>
          <div className="space-y-6">

            {/* Visibility */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Visibilidad del club</p>
              <div className="space-y-2">
                {visibilityOptions.map((opt) => (
                  <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${access.visibility === opt.value ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="visibility" value={opt.value} checked={access.visibility === opt.value}
                      onChange={() => setAccess({ ...access, visibility: opt.value })}
                      className="mt-0.5 accent-primary" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Join policy */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Política de entrada</p>
              <div className="space-y-2">
                {joinPolicyOptions.map((opt) => (
                  <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${access.joinPolicy === opt.value ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="joinPolicy" value={opt.value} checked={access.joinPolicy === opt.value}
                      onChange={() => setAccess({ ...access, joinPolicy: opt.value, autoApprove: opt.value !== 'OPEN' ? false : access.autoApprove })}
                      className="mt-0.5 accent-primary" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Auto-approve (only relevant when OPEN) */}
            {access.joinPolicy === 'OPEN' && (
              <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-gray-300">
                <input type="checkbox" checked={access.autoApprove}
                  onChange={(e) => setAccess({ ...access, autoApprove: e.target.checked })}
                  className="accent-primary" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Aprobación automática</p>
                  <p className="text-xs text-gray-500">Los usuarios que soliciten acceso entran directamente sin revisión manual.</p>
                </div>
              </label>
            )}

            {/* Invite links */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Invitaciones</p>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-gray-300 mb-3">
                <input type="checkbox" checked={access.inviteLinksEnabled}
                  onChange={(e) => setAccess({ ...access, inviteLinksEnabled: e.target.checked })}
                  className="accent-primary" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Permitir enlaces y códigos de invitación</p>
                  <p className="text-xs text-gray-500">Los administradores pueden generar enlaces públicos y códigos de acceso.</p>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Expiración por defecto (días)"
                  type="number"
                  min={1}
                  max={365}
                  placeholder="7"
                  value={access.defaultInviteExpiryDays ?? ''}
                  onChange={(e) => setAccess({ ...access, defaultInviteExpiryDays: parseInt(e.target.value) || null })}
                />
                <Input
                  label="Usos por defecto"
                  type="number"
                  min={1}
                  placeholder="1"
                  value={access.defaultInviteMaxUses ?? ''}
                  onChange={(e) => setAccess({ ...access, defaultInviteMaxUses: parseInt(e.target.value) || null })}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={saveAccess} loading={accessLoading}>Guardar configuración de acceso</Button>
          </div>
        </Card>

      </main>
    </div>
  )
}
