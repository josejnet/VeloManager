'use client'
/**
 * AdSlot — Native ad component, visually integrated with the club's theme.
 *
 * Self-fetching: given a clubId and placement it calls /api/ads/serve,
 * tracks the impression on mount, and routes clicks through the server-side
 * redirect proxy /api/ads/click/[id] to guarantee analytics data integrity.
 *
 * Returns null (renders nothing) when:
 *  - No matching campaign is found
 *  - Club is on a PREMIUM/ENTERPRISE (ad-free) plan
 *  - The API request fails
 */
import { useEffect, useState } from 'react'
import { ExternalLink, Megaphone } from 'lucide-react'
import type { AdPlacement } from '@prisma/client'

interface AdData {
  id: string
  advertiserName: string
  title: string
  description: string | null
  imageUrl: string | null
  linkUrl: string
  ctaText: string
}

interface AdSlotProps {
  clubId: string
  placement: AdPlacement
  className?: string
}

export function AdSlot({ clubId, placement, className }: AdSlotProps) {
  const [ad, setAd] = useState<AdData | null | 'loading'>('loading')

  useEffect(() => {
    fetch(`/api/ads/serve?clubId=${encodeURIComponent(clubId)}&placement=${placement}`)
      .then((r) => r.json())
      .then((data) => {
        const served: AdData | null = data.ad ?? null
        setAd(served)
        // Track impression fire-and-forget — errors are non-critical
        if (served) {
          fetch('/api/ads/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId: served.id, clubId, eventType: 'IMPRESSION' }),
          }).catch(() => {})
        }
      })
      .catch(() => setAd(null))
  }, [clubId, placement])

  // Don't render anything while loading or when there's no ad
  if (ad === 'loading' || ad === null) return null

  // Click goes through the server-side redirect proxy — analytics recorded
  // before the user reaches the advertiser URL
  const clickUrl = `/api/ads/click/${ad.id}?clubId=${encodeURIComponent(clubId)}`

  if (placement === 'DASHBOARD') {
    return (
      <div className={`relative rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden ${className ?? ''}`}>
        <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full border border-gray-100">
          <Megaphone className="h-2.5 w-2.5" />
          Patrocinado
        </span>

        {ad.imageUrl && (
          <div className="h-28 overflow-hidden">
            <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
            {ad.advertiserName}
          </p>
          <h4 className="text-sm font-semibold text-gray-900 leading-snug">{ad.title}</h4>
          {ad.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ad.description}</p>
          )}
          <a
            href={clickUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:opacity-90 transition-opacity"
          >
            {ad.ctaText}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    )
  }

  if (placement === 'EVENTS') {
    // Inline native card — blends with the events list
    return (
      <div className={`relative rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden ${className ?? ''}`}>
        <span className="absolute top-2 right-3 text-[10px] font-medium text-primary/60">
          Patrocinado
        </span>
        <div className="flex items-start gap-4 p-4">
          {ad.imageUrl ? (
            <img
              src={ad.imageUrl}
              alt={ad.title}
              className="h-14 w-14 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Megaphone className="h-6 w-6 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70 mb-0.5">
              {ad.advertiserName}
            </p>
            <h4 className="text-sm font-semibold text-gray-900 leading-snug">{ad.title}</h4>
            {ad.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{ad.description}</p>
            )}
          </div>
          <a
            href={clickUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:opacity-90 transition-opacity"
          >
            {ad.ctaText}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    )
  }

  // CHECKOUT — high-attention placement after order confirmation
  return (
    <div className={`relative rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-white overflow-hidden ${className ?? ''}`}>
      <span className="absolute top-2 right-3 text-[10px] font-medium text-primary/50">
        Patrocinado
      </span>
      <div className="p-5 text-center">
        {ad.imageUrl && (
          <img
            src={ad.imageUrl}
            alt={ad.title}
            className="h-20 w-full object-cover rounded-xl mb-3"
          />
        )}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/60 mb-1">
          {ad.advertiserName}
        </p>
        <h4 className="text-sm font-bold text-gray-900">{ad.title}</h4>
        {ad.description && (
          <p className="text-xs text-gray-500 mt-1">{ad.description}</p>
        )}
        <a
          href={clickUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-xl bg-primary text-white hover:opacity-90 transition-opacity"
        >
          {ad.ctaText}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}
