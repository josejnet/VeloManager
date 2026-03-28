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
 */
export function SWRConfigProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        revalidateOnFocus: false,
        dedupingInterval: 5_000,
        onError: () => toast.error('Error de red. Reintentando…'),
      }}
    >
      {children}
    </SWRConfig>
  )
}
