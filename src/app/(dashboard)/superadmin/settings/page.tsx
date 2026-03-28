'use client'

import { useState, useEffect } from 'react'
import { Mail, MailX, Settings, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface PlatformConfig {
  emailNotificationsEnabled: boolean
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function SuperAdminSettingsPage() {
  const [config, setConfig] = useState<PlatformConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/superadmin/config')
      .then((r) => r.json())
      .then((d) => setConfig(d.data))
      .catch(() => toast.error('Error al cargar la configuración'))
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (key: keyof PlatformConfig, value: boolean) => {
    if (!config) return
    setSaving(true)
    const optimistic = { ...config, [key]: value }
    setConfig(optimistic)
    try {
      const res = await fetch('/api/superadmin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      setConfig(data.data)
      toast.success('Configuración guardada')
    } catch (e) {
      setConfig(config) // revert
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-5 w-5 text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900">Configuración de la plataforma</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {/* Header */}
        <div className="px-5 py-4">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Notificaciones
          </p>
        </div>

        {/* Email toggle */}
        <div className="px-5 py-4 flex items-center justify-between gap-6">
          <div className="flex items-start gap-3">
            {loading ? (
              <Loader2 className="h-5 w-5 text-gray-300 mt-0.5 animate-spin" />
            ) : config?.emailNotificationsEnabled ? (
              <Mail className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
            ) : (
              <MailX className="h-5 w-5 text-gray-300 mt-0.5 shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">
                Notificaciones por email
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Activa el envío del resumen semanal y alertas de pago por correo electrónico.
                Desactivado por defecto — actívalo cuando tengas configurado el proveedor de email.
              </p>
              {!loading && !config?.emailNotificationsEnabled && (
                <p className="text-xs text-amber-600 mt-1 font-medium">
                  Desactivado — los emails no se envían
                </p>
              )}
              {!loading && config?.emailNotificationsEnabled && (
                <p className="text-xs text-green-600 mt-1 font-medium">
                  Activo — el resumen semanal y alertas se envían por email
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="h-6 w-11 bg-gray-100 rounded-full animate-pulse shrink-0" />
          ) : (
            <Toggle
              checked={config?.emailNotificationsEnabled ?? false}
              onChange={(v) => handleToggle('emailNotificationsEnabled', v)}
              disabled={saving}
            />
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3 px-1">
        Esta configuración afecta a toda la plataforma. Los cambios se aplican inmediatamente.
      </p>
    </div>
  )
}
