'use client'
import { useState, useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'

interface Banner {
  id: string
  title: string
  body: string
  imageUrl?: string
  linkUrl?: string
  linkLabel?: string
}

export function PlatformBannerStrip({ clubId }: { clubId?: string }) {
  const [banners, setBanners] = useState<Banner[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const url = clubId ? `/api/banners?clubId=${clubId}` : '/api/banners'
    fetch(url)
      .then((r) => r.json())
      .then((d) => setBanners(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [clubId])

  const visible = banners.filter((b) => !dismissed.has(b.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-1.5 px-6 pt-3">
      {visible.map((banner) => (
        <div
          key={banner.id}
          className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl text-sm"
          onClick={() => {
            fetch(`/api/superadmin/banners/${banner.id}`, {
              method: 'POST', body: JSON.stringify({ type: 'view' })
            }).catch(() => {})
          }}
        >
          {banner.imageUrl && (
            <img src={banner.imageUrl} alt="" className="h-8 w-8 rounded-lg object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-primary mr-2">{banner.title}</span>
            <span className="text-gray-600">{banner.body}</span>
          </div>
          {banner.linkUrl && (
            <a
              href={banner.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary font-medium hover:underline flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                fetch(`/api/superadmin/banners/${banner.id}`, {
                  method: 'POST', body: JSON.stringify({ type: 'click' })
                }).catch(() => {})
              }}
            >
              {banner.linkLabel ?? 'Más info'} <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setDismissed((prev) => new Set(Array.from(prev).concat(banner.id))) }}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
