import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Trophy, Users, Wallet, ShoppingBag, Vote, ShieldCheck, ArrowRight } from 'lucide-react'

export default async function LandingPage() {
  const session = await getServerSession(authOptions)

  if (session?.user) {
    const role = (session.user as { role: string }).role
    if (role === 'SUPER_ADMIN') redirect('/superadmin')

    const userId = (session.user as { id: string }).id
    const membership = await prisma.clubMembership.findFirst({
      where: { userId, status: 'APPROVED' },
      select: { role: true },
    })
    if (membership) redirect('/socio')

    // Authenticated but no club yet
    redirect('/clubs/join')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">Clube</span>
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
            Iniciar sesión
          </Link>
          <Link href="/register" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Registro gratis
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-8">
          <span className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
          Plataforma SaaS para clubes deportivos
        </div>
        <h1 className="text-6xl font-extrabold text-gray-900 leading-tight mb-6">
          Gestiona tu club<br />
          <span className="text-blue-600">con total control</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          Contabilidad, socios, compras conjuntas y votaciones en una sola plataforma.
          Diseñada para que los administradores tengan visibilidad total y los socios, autonomía.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-lg">
            Crear un club gratis <ArrowRight className="h-5 w-5" />
          </Link>
          <Link href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-lg border border-gray-200">
            Ya tengo cuenta
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-3 gap-6">
          {[
            { icon: Wallet, title: 'Contabilidad real', desc: 'Libro de bancos unificado. Cada cuota pagada o factura aprobada actualiza el saldo automáticamente.', color: 'bg-green-50 text-green-600' },
            { icon: Users, title: 'Gestión de socios', desc: 'Onboarding con aprobación, cuotas anuales, historial de deudas y notificaciones automáticas.', color: 'bg-blue-50 text-blue-600' },
            { icon: ShoppingBag, title: 'Compras conjuntas', desc: 'Crea campañas de equipación. Los socios eligen talla y cantidad. Exporta el listado de producción con un clic.', color: 'bg-orange-50 text-orange-600' },
            { icon: Vote, title: 'Votaciones democráticas', desc: 'Un socio, un voto. Resultados en tiempo real con gráficos. Sistema cerrado para garantizar integridad.', color: 'bg-purple-50 text-purple-600' },
            { icon: ShieldCheck, title: 'Auditoría inmutable', desc: 'Registro de todos los eventos críticos: quién aprobó qué, cuándo y con qué datos.', color: 'bg-red-50 text-red-600' },
            { icon: Trophy, title: 'Multi-club', desc: 'Arquitectura multi-tenant. Cada club tiene sus datos 100% aislados. Escala a 100+ clubs sin cambios.', color: 'bg-yellow-50 text-yellow-600' },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className={`h-11 w-11 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
