'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Trophy, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    if (res.ok) setSent(true)
    else toast.error('Error al enviar el correo')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Recuperar contraseña</h1>
            <p className="text-sm text-gray-400">Club Nexus</p>
          </div>
        </div>

        {sent ? (
          <div className="text-center py-4">
            <p className="text-green-600 font-medium mb-2">¡Correo enviado!</p>
            <p className="text-sm text-gray-500">Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña en los próximos minutos.</p>
            <Link href="/login" className="inline-flex items-center gap-2 mt-6 text-sm text-primary font-medium hover:underline">
              <ArrowLeft className="h-4 w-4" /> Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-gray-500">Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.</p>
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Button type="submit" className="w-full" size="lg" loading={loading}>Enviar enlace</Button>
            <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
