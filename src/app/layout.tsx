import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { SWRConfigProvider } from '@/components/providers/SWRConfigProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap', preload: false })

export const metadata: Metadata = {
  title: 'Clube — Gestión de Clubes Deportivos',
  description: 'Plataforma SaaS para la gestión integral de clubes deportivos',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <SessionProvider>
          <SWRConfigProvider>
            {children}
          </SWRConfigProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { borderRadius: '10px', fontSize: '14px' },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  )
}
