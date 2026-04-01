/**
 * In-memory sliding window rate limiter (serverless-compatible per-instance).
 * Uses a Map keyed by identifier (e.g. IP), storing request timestamps.
 *
 * Note: In a multi-instance deployment each instance tracks independently —
 * this is an intentional trade-off for zero-dependency rate limiting.
 * For strict global limits use an external store (Redis/Upstash).
 */

interface Window {
  timestamps: number[]
}

const store = new Map<string, Window>()

/**
 * Check whether the given identifier has exceeded the rate limit.
 *
 * @param identifier  Unique key (e.g. IP address or `${userId}:${route}`)
 * @param limit       Max requests allowed within `windowMs`
 * @param windowMs    Window size in milliseconds (default: 60_000 = 1 min)
 * @returns           `{ allowed: boolean, remaining: number, resetAt: number }`
 */
export function rateLimit(
  identifier: string,
  limit = 30,
  windowMs = 60_000,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const cutoff = now - windowMs

  let entry = store.get(identifier)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(identifier, entry)
  }

  // Evict timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0]
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldest + windowMs,
    }
  }

  entry.timestamps.push(now)
  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    resetAt: now + windowMs,
  }
}

/**
 * Extract the client IP from a Next.js Request object.
 * Falls back through x-forwarded-for → x-real-ip → "unknown".
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = request.headers.get('x-real-ip')
  return realIp ?? 'unknown'
}

/**
 * Apply rate limiting and return a 429 Response if exceeded.
 * Returns `null` if the request is allowed.
 *
 * Usage:
 *   const limited = applyRateLimit(request)
 *   if (limited) return limited
 */
export function applyRateLimit(
  request: Request,
  limit = 30,
  windowMs = 60_000,
): Response | null {
  const ip = getClientIp(request)
  const result = rateLimit(ip, limit, windowMs)

  if (!result.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.resetAt),
        },
      },
    )
  }

  return null
}
