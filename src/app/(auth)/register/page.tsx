'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Trophy } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) return toast.error('Las contraseñas no coinciden')
    if (form.password.length < 8) return toast.error('La contraseña debe tener al menos 8 caracteres')

    setLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
    })
    setLoading(false)

    if (!res.ok) {
      const d = await res.json()
      return toast.error(d.error ?? 'Error al registrarse')
    }

    toast.success('Cuenta creada. Iniciando sesión...')
    await signIn('credentials', { email: form.email, password: form.password, redirect: false })
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Clube</h1>
            <p className="text-sm text-gray-400">Crea tu cuenta gratuita</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Input label="Nombre completo" placeholder="Ana García" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Email" type="email" placeholder="tu@email.com" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input label="Contraseña" type="password" placeholder="Mínimo 8 caracteres" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <Input label="Confirmar contraseña" type="password" placeholder="••••••••" value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Crear cuenta
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
