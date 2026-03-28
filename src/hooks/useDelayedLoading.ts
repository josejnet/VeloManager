import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * useDelayedLoading — eliminates "flash of loading state" for fast requests.
 *
 * Only shows the loading indicator if the request is still pending after
 * `delayMs` milliseconds (default 150ms). For fast connections this
 * means users almost never see a loader — the content just appears.
 *
 * USAGE:
 *   const { isLoading, setLoading } = useDelayedLoading()
 *   setLoading(true)
 *   const data = await fetch(...)
 *   setLoading(false)
 *   if (isLoading) return <Skeleton />
 */
export function useDelayedLoading(delayMs = 150) {
  const [loading, setLoadingRaw] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setLoading = useCallback((value: boolean) => {
    setLoadingRaw(value)
    if (value) {
      timer.current = setTimeout(() => setIsLoading(true), delayMs)
    } else {
      if (timer.current) clearTimeout(timer.current)
      setIsLoading(false)
    }
  }, [delayMs])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return { isLoading, loading, setLoading }
}
