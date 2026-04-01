'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { THEMES, getThemeVars, themeVarsToStyle } from '@/lib/themes'
import { Download, Upload, Copy, Check, ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'

type Visibility = 'PUBLIC' | 'PRIVATE' | 'HIDDEN'
type JoinPolicy = 'OPEN' | 'REQUEST' | 'INVITE_ONLY'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [clubId, setClubId] = useState('')
  const [form, setForm] = useState({ name: '', slogan: '', sport: '', colorTheme: 'blue', logoUrl: '', primaryColor: '', secondaryColor: '' })
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

  // Logo upload
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoFileRef = useRef<HTMLInputElement>(null)

  // CSV import
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const csvFileRef = useRef<HTMLInputElement>(null)

  // Password generator
  const [passwordCount, setPasswordCount] = useState(10)
  const [generatedPasswords, setGeneratedPasswords] = useState<string[]>([])
  const [passwordsCopied, setPasswordsCopied] = useState(false)

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/clubs?pageSize=1').then((r) => r.json()).then((d) => {
      if (d.data?.[0]) {
        const club = d.data[0]
        setClubId(club.id)
        setForm({ name: club.name ?? '', slogan: club.slogan ?? '', sport: club.sport ?? '', colorTheme: club.colorTheme ?? 'blue', logoUrl: club.logoUrl ?? '', primaryColor: club.primaryColor ?? '', secondaryColor: club.secondaryColor ?? '' })
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
    const payload = {
      ...form,
      primaryColor: /^#[0-9a-fA-F]{6}$/.test(form.primaryColor) ? form.primaryColor : null,
      secondaryColor: /^#[0-9a-fA-F]{6}$/.test(form.secondaryColor) ? form.secondaryColor : null,
    }
    const res = await fetch(`/api/clubs/${clubId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (res.ok) toast.success('Configuración guardada')
    else { const d = await res.json(); toast.error(d.error ?? 'Error') }
    setLoading(false)
  }

  const uploadLogo = async () => {
    if (!logoFile) return
    setLogoUploading(true)
    const fd = new FormData()
    fd.append('file', logoFile)
    const res = await fetch(`/api/upload/logo?clubId=${clubId}`, { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      setForm((f) => ({ ...f, logoUrl: data.url }))
      setLogoFile(null)
      if (logoFileRef.current) logoFileRef.current.value = ''
      toast.success('Logo subido correctamente')
    } else if (res.status === 501) {
      toast.error('Cloudinary no configurado. Introduce la URL del logo manualmente.')
    } else {
      toast.error(data.error ?? 'Error al subir el logo')
    }
    setLogoUploading(false)
  }

  const downloadCsvTemplate = async () => {
    const res = await fetch(`/api/clubs/${clubId}/member-profiles/template?format=csv`)
    if (!res.ok) { toast.error('Error al descargar la plantilla'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_socios.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCsvImport = async () => {
    if (!csvFile) return
    setCsvImporting(true)
    const formData = new FormData()
    formData.append('file', csvFile)
    const res = await fetch(`/api/clubs/${clubId}/member-profiles/import`, {
      method: 'POST',
      body: formData,
    })
    setCsvImporting(false)
    if (res.ok) {
      const d = await res.json()
      const result = d.data ?? d
      toast.success(`Importados: ${result.imported}, omitidos: ${result.skipped}, errores: ${result.errors?.length ?? 0}`)
      setCsvFile(null)
      if (csvFileRef.current) csvFileRef.current.value = ''
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Error al importar')
    }
  }

  const generatePasswords = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const count = Math.min(Math.max(1, passwordCount), 200)
    const passwords = Array.from({ length: count }, () =>
      Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    )
    setGeneratedPasswords(passwords)
    setPasswordsCopied(false)
  }

  const copyPasswords = () => {
    navigator.clipboard.writeText(generatedPasswords.join('\n'))
    setPasswordsCopied(true)
    toast.success('Contraseñas copiadas')
    setTimeout(() => setPasswordsCopied(false), 2000)
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

  const liveThemeStyle = themeVarsToStyle(getThemeVars(form.colorTheme, form.primaryColor || null, form.secondaryColor || null))

  return (
    <div className="flex flex-col flex-1 overflow-auto" style={liveThemeStyle}>
      <Header title="Configuración del Club" clubId={clubId} />
      <main className="flex-1 p-6 space-y-6">

        {/* Basic info */}
        <Card>
          <CardHeader><CardTitle>Información básica</CardTitle></CardHeader>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre del club" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Slogan / Lema" value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} />
            <Input label="Deporte" value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} />
            {/* Logo field: file upload + URL manual fallback */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo del club</label>
              <div className="flex gap-4 items-start">
                {/* Preview */}
                <div className="flex-shrink-0 h-16 w-16 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                  {form.logoUrl
                    ? <img src={form.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                    : <ImageIcon className="h-7 w-7 text-gray-300" />
                  }
                </div>
                <div className="flex-1 space-y-2">
                  {/* File picker */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="cursor-pointer">
                      <input
                        ref={logoFileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                      />
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors cursor-pointer">
                        <Upload className="h-3.5 w-3.5" /> Subir imagen
                      </span>
                    </label>
                    {logoFile && (
                      <>
                        <span className="text-xs text-gray-500 truncate max-w-[160px]">{logoFile.name}</span>
                        <Button size="sm" onClick={uploadLogo} loading={logoUploading}>
                          Subir
                        </Button>
                      </>
                    )}
                  </div>
                  {/* URL manual fallback */}
                  <Input
                    value={form.logoUrl}
                    onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                    placeholder="…o pega aquí una URL externa (https://...)"
                  />
                  <p className="text-xs text-gray-400">PNG · JPG · WebP · SVG · máx. 2 MB · fondo transparente recomendado</p>
                </div>
              </div>
            </div>
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
          {/* Custom hex color pickers */}
          <div className="mt-5 border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Color personalizado</p>
            <p className="text-xs text-gray-400 mb-3">
              Si defines un color primario, tendrá prioridad sobre la paleta seleccionada. Déjalo en blanco para usar la paleta.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Color primario</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.primaryColor || '#3b82f6'}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border border-gray-200 p-0.5"
                  />
                  <input
                    type="text"
                    value={form.primaryColor}
                    placeholder="#rrggbb  (vacío = paleta)"
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                  {form.primaryColor && (
                    <button
                      onClick={() => setForm({ ...form, primaryColor: '' })}
                      className="text-xs text-gray-400 hover:text-red-500 px-1"
                      title="Limpiar color personalizado"
                    >✕</button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Color secundario</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.secondaryColor || '#0ea5e9'}
                    onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border border-gray-200 p-0.5"
                  />
                  <input
                    type="text"
                    value={form.secondaryColor}
                    placeholder="#rrggbb  (vacío = paleta)"
                    onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                  {form.secondaryColor && (
                    <button
                      onClick={() => setForm({ ...form, secondaryColor: '' })}
                      className="text-xs text-gray-400 hover:text-red-500 px-1"
                      title="Limpiar color personalizado"
                    >✕</button>
                  )}
                </div>
              </div>
            </div>
            {(form.primaryColor || form.secondaryColor) && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                <div className="flex gap-1.5">
                  {form.primaryColor && <span className="w-5 h-5 rounded-full border border-gray-200 inline-block" style={{ background: form.primaryColor }} />}
                  {form.secondaryColor && <span className="w-5 h-5 rounded-full border border-gray-200 inline-block" style={{ background: form.secondaryColor }} />}
                </div>
                Preview en vivo activo — los cambios se reflejan en la UI al instante
              </div>
            )}
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

        {/* Socios tools */}
        <Card>
          <CardHeader><CardTitle>Socios</CardTitle></CardHeader>
          <div className="space-y-6">

            {/* CSV import */}
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">Importar socios desde CSV</p>
              <p className="text-xs text-gray-500 mb-3">
                Descarga la plantilla CSV, rellénala y súbela para importar múltiples socios a la vez.
              </p>
              <Button variant="outline" size="sm" onClick={downloadCsvTemplate} disabled={!clubId}>
                <Download className="h-4 w-4" /> Descargar plantilla CSV
              </Button>

              <div className="mt-4">
                <p className="text-xs font-medium text-gray-600 mb-2">Subir archivo CSV</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="cursor-pointer">
                    <input
                      ref={csvFileRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                    />
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors cursor-pointer">
                      <Upload className="h-4 w-4" /> Seleccionar archivo
                    </span>
                  </label>
                  {csvFile && (
                    <span className="text-sm text-gray-600">{csvFile.name}</span>
                  )}
                </div>
                {csvFile && (
                  <div className="mt-3">
                    <Button onClick={handleCsvImport} loading={csvImporting} disabled={csvImporting}>
                      <Upload className="h-4 w-4" /> {csvImporting ? 'Importando...' : 'Importar socios'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-800 mb-1">Generador de contraseñas</p>
              <p className="text-xs text-gray-500 mb-3">
                Genera contraseñas aleatorias de 8 caracteres alfanuméricos para asignar a los socios.
              </p>
              <div className="flex items-end gap-3 flex-wrap">
                <div className="w-28">
                  <Input
                    label="Cantidad"
                    type="number"
                    min={1}
                    max={200}
                    value={passwordCount}
                    onChange={(e) => setPasswordCount(parseInt(e.target.value) || 1)}
                  />
                </div>
                <Button onClick={generatePasswords}>Generar contraseñas</Button>
                {generatedPasswords.length > 0 && (
                  <Button variant="outline" onClick={copyPasswords}>
                    {passwordsCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {passwordsCopied ? 'Copiadas' : 'Copiar todo'}
                  </Button>
                )}
              </div>
              {generatedPasswords.length > 0 && (
                <div className="mt-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="grid grid-cols-4 gap-1">
                    {generatedPasswords.map((p, i) => (
                      <span key={i} className="font-mono text-xs text-gray-700 bg-white px-2 py-1 rounded border border-gray-100">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

      </main>
    </div>
  )
}
