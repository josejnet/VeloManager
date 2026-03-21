'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SuperAdminLoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await signIn('credentials', { ...form, redirect: false })
    setLoading(false)
    if (res?.error) return toast.error('Credenciales incorrectas o acceso denegado')
    // Will be redirected to / which then sends SUPER_ADMIN → /superadmin
    router.push('/superadmin')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 bg-red-600 rounded-xl flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Clube</h1>
            <p className="text-sm text-gray-500">Acceso SuperAdmin</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
            <input
              type="email"
              placeholder="admin@clube.app"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="w-full px-3 py-2.5 text-sm bg-gray-800 border border-gray-700 text-white rounded-lg focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none placeholder-gray-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="w-full px-3 py-2.5 text-sm bg-gray-800 border border-gray-700 text-white rounded-lg focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none placeholder-gray-600"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white border-0"
            size="lg"
            loading={loading}
          >
            Acceder al panel
          </Button>
        </form>

        <p className="text-center text-xs text-gray-600 mt-6">
          Acceso restringido. Solo personal autorizado.
        </p>
      </div>
    </div>
  )
}
