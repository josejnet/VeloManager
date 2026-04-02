'use client'
import { SWRConfig } from 'swr'
import toast from 'react-hot-toast'

const swrFetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })

/**
 * Global SWR configuration for the entire dashboard.
 * Centralises defaults so individual pages don't need to repeat them.
 *
 * dedupingInterval: 10s  — evita re-fetch si el mismo key se monta en < 10s
 * revalidateOnFocus: false  — no re-fetch al volver al tab (causa flickering inútil)
 * revalidateOnReconnect: false  — no re-fetch automático al reconectar (controlado por usuario)
 * keepPreviousData: true  — muestra datos anteriores mientras carga nuevos (evita flash de vacío)
 * errorRetryCount: 3  — limita reintentos automáticos en caso de error de red
 */
export function SWRConfigProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        keepPreviousData: true,
        dedupingInterval: 10_000,
        errorRetryCount: 3,
        onError: () => toast.error('Error de red. Reintentando…'),
      }}
    >
      {children}
    </SWRConfig>
  )
}
