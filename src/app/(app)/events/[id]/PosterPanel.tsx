'use client'

import { useEffect, useState } from 'react'

/**
 * The poster, with a focus overlay instead of a link out.
 *
 * It used to be an <a> straight to the storage URL, which dumped the reader on
 * a bare CDN page with no way back but the back button. Nothing was leaked by
 * that — the bucket refuses anonymous writes and lists, and the URL is already
 * in the page for the <img> to render at all — it was simply a dead end
 * dressed as a feature.
 */
export default function PosterPanel({ src, title }: { src: string; title: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    // The page behind must not scroll while the overlay owns the screen.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass group block w-full overflow-hidden p-2 text-left lg:sticky lg:top-6"
      >
        {/* 9:16 slot, and object-contain inside it — the whole poster stays
            visible because the detail someone came for (prizes, venue, rules)
            might sit in any corner of it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`${title} poster`} className="aspect-[9/16] w-full rounded-xl object-contain" />
        <p className="px-2 py-2 text-center text-xs text-[var(--text-faint)] transition-colors group-hover:text-[var(--text-muted)]">
          Tap to enlarge
        </p>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} poster`}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-white transition-colors hover:bg-white/20"
          >
            ✕
          </button>

          {/* Sized to the viewport rather than the image's natural pixels, so a
              tall poster is readable on a laptop without any scrolling. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`${title} poster`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full cursor-default rounded-lg object-contain"
          />
        </div>
      )}
    </>
  )
}
