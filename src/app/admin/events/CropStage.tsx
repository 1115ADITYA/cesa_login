'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Drag-to-pan, zoom, fixed-aspect crop window. Produces a genuinely cropped
 * JPEG rather than a CSS object-position hint, so what the admin frames here
 * is exactly the file that gets stored and served.
 *
 * Deliberately no dependency: react-easy-crop and friends bring a lot of
 * surface for what is one transform and one canvas draw.
 *
 * Only ever fed a freshly-picked local file (an object: URL), never an image
 * already on Supabase storage — drawing a cross-origin image to a canvas
 * taints it and toBlob() then throws. Re-cropping means picking the file
 * again, which is why the caller keeps a "Change" button.
 */

const OUTPUT_WIDTH = 1600
const HANDLE_SIZE = 1.6 // how far past "cover" the zoom slider may go

export default function CropStage({
  src,
  aspect,
  onCancel,
  onCropped,
}: {
  src: string
  /** width / height of the crop window, e.g. 16/9 */
  aspect: number
  onCancel: () => void
  onCropped: (blob: Blob) => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  // null means "not moved yet" — the centred position is then derived below
  // rather than written by an effect, so there is no first-paint flash at the
  // top-left corner before a correction lands.
  const [moved, setMoved] = useState<{ x: number; y: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  // Measure the viewport once it is laid out, and again if the window resizes —
  // every coordinate below is in its CSS pixels.
  useEffect(() => {
    const measure = () => {
      const el = viewportRef.current
      if (el) setViewport({ w: el.clientWidth, h: el.clientHeight })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Scale at which the image exactly covers the window; zoom multiplies it.
  const coverScale = natural && viewport ? Math.max(viewport.w / natural.w, viewport.h / natural.h) : 1
  const scale = coverScale * zoom

  /** Keeps the image covering the window — no empty gutters, ever. */
  const clamp = useCallback(
    (next: { x: number; y: number }, s: number) => {
      if (!natural || !viewport) return next
      const minX = viewport.w - natural.w * s
      const minY = viewport.h - natural.h * s
      return {
        x: Math.min(0, Math.max(minX, next.x)),
        y: Math.min(0, Math.max(minY, next.y)),
      }
    },
    [natural, viewport],
  )

  const offset =
    moved ??
    (natural && viewport
      ? { x: (viewport.w - natural.w * scale) / 2, y: (viewport.h - natural.h * scale) / 2 }
      : { x: 0, y: 0 })
  const setOffset = setMoved

  // Zooming about the centre of the window, so the framing does not lurch.
  const applyZoom = (nextZoom: number) => {
    if (!natural || !viewport) return setZoom(nextZoom)
    const nextScale = coverScale * nextZoom
    const cx = viewport.w / 2
    const cy = viewport.h / 2
    const ratio = nextScale / scale
    const next = { x: cx - (cx - offset.x) * ratio, y: cy - (cy - offset.y) * ratio }
    setZoom(nextZoom)
    setOffset(clamp(next, nextScale))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    setOffset(clamp({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) }, scale))
  }
  const endDrag = () => {
    drag.current = null
  }

  const apply = async () => {
    const img = imgRef.current
    if (!img || !natural || !viewport) return
    setBusy(true)
    try {
      // Window rect back into the image's own pixel space.
      const sx = -offset.x / scale
      const sy = -offset.y / scale
      const sw = viewport.w / scale
      const sh = viewport.h / scale

      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_WIDTH
      canvas.height = Math.round(OUTPUT_WIDTH / aspect)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
      if (!blob) throw new Error('Could not render the crop')
      onCropped(blob)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-sunken)] p-3">
      <p className="text-xs font-semibold text-[var(--text-muted)]">
        Drag to reposition, zoom to fill. Everything inside the frame is kept.
      </p>

      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ aspectRatio: String(aspect) }}
        className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-lg bg-black active:cursor-grabbing"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) => {
            const el = e.currentTarget
            setNatural({ w: el.naturalWidth, h: el.naturalHeight })
          }}
          style={
            natural
              ? {
                  width: natural.w * scale,
                  height: natural.h * scale,
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                }
              : { visibility: 'hidden' }
          }
          className="absolute left-0 top-0 max-w-none origin-top-left"
        />

        {/* Thirds guides, drawn over the image so the frame reads as a frame. */}
        <div className="pointer-events-none absolute inset-0 border border-white/25">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/15" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/15" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/15" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/15" />
        </div>
      </div>

      <label className="flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-faint)]">Zoom</span>
        <input
          type="range"
          min={1}
          max={HANDLE_SIZE + 1.4}
          step={0.01}
          value={zoom}
          onChange={(e) => applyZoom(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-[var(--accent)]"
        />
      </label>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-ghost !px-3 !py-2 !text-xs">
          Cancel
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={busy || !natural}
          className="btn btn-primary !px-3 !py-2 !text-xs"
        >
          {busy ? 'Cropping…' : 'Apply crop'}
        </button>
      </div>
    </div>
  )
}
