import { useState, useEffect, useRef } from 'react'

/**
 * useDelayedLoading — eliminates "flash of loading state" for fast requests.
 *
 * PROBLEM:
 *   A fetch that completes in 80ms still triggers:
 *     render(loading=false) → render(loading=true) → render(loading=false)
 *   The middle render causes a visible flicker ("Cargando...") even though
 *   the data arrived almost instantly.
 *
 * SOLUTION:
 *   Only show the loading indicator if the request is still pending after
 *   `delayMs` milliseconds (default 150ms). For fast connections this
 *   means users almost never see a loader — the content just appears.
 *
 * USAGE:
 *   const { isLoading, setLoading } = useDelayedLoading()
 *
 *   const fetchData = async () => {
 *     setLoading(true)
 *     const res = await fetch(...)
 *     setData(await res.json())
 *     setLoading(false)
 *   }
 *
 *   // Use isLoading (not the raw loading flag) for rendering:
 *   if (isLoading) return <Skeleton />
 */
export function useDelayedLoading(delayMs = 150) {
  const [loading, setLoadingRaw] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setLoading = (value: boolean) => {
    setLoadingRaw(value)
    if (value) {
      // Only show the loader after delayMs
      timer.current = setTimeout(() => setIsLoading(true), delayMs)
    } else {
      if (timer.current) clearTimeout(timer.current)
      setIsLoading(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return { isLoading, loading, setLoading }
}
