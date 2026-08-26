'use client'

import { useRef, useState, useTransition } from 'react'
import { uploadEventBanner } from '../actions'

/**
 * Replaces the old plain "paste a URL" fields. Uploads straight to storage and
 * keeps the resulting public URL in a hidden input, so the rest of EventForm —
 * and createEvent/updateEvent — only ever see a string.
 *
 * Two shapes, because the two images do different jobs:
 *
 * - `banner` is a wide crop for cards and thumbnails, so it also lets the admin
 *   click the preview to set a focal point (a CSS object-position written to a
 *   second hidden input). Without it every crop is dead-centre, which cut the
 *   prize text off a portrait poster like CODECADE's.
 * - `poster` is the full 9:16 artwork shown uncropped beside the registration
 *   form. Nothing is cropped, so there is no focal point to choose.
 */
export default function ImageUpload({
  name,
  label,
  hint,
  variant = 'banner',
  defaultUrl,
  positionName,
  defaultPosition,
}: {
  name: string
  label: string
  hint?: string
  variant?: 'banner' | 'poster'
  defaultUrl?: string
  positionName?: string
  defaultPosition?: string
}) {
  const [url, setUrl] = useState(defaultUrl ?? '')
  const [preview, setPreview] = useState(defaultUrl ?? '')
  const [position, setPosition] = useState(defaultPosition ?? '50% 50%')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const focusable = variant === 'banner' && Boolean(positionName)
  const frame = variant === 'poster' ? 'aspect-[9/16] max-w-[13rem]' : 'h-40'

  function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setPosition('50% 50%')

    // Show the picked image immediately — the network upload can take a
    // moment, and there is no reason to make the admin stare at a blank box.
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('file', file)
      const result = await uploadEventBanner(formData)
      URL.revokeObjectURL(localPreview)
      if ('error' in result) {
        setError(result.error)
        setPreview(url)
        return
      }
      setUrl(result.url)
      setPreview(result.url)
    })
  }

  function pickFocus(e: React.MouseEvent<HTMLDivElement>) {
    if (!focusable) return
    const box = previewRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    setPosition(`${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`)
  }

  const [posX, posY] = position.split(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <label className="label">{label}</label>
      <input type="hidden" name={name} value={url} />
      {positionName && <input type="hidden" name={positionName} value={position} />}

      {preview ? (
        <div
          ref={previewRef}
          onClick={pickFocus}
          className={`relative w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-sunken)] ${frame} ${
            focusable ? 'cursor-crosshair' : ''
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt=""
            style={variant === 'banner' ? { objectPosition: position } : undefined}
            className={`absolute inset-0 h-full w-full ${variant === 'poster' ? 'object-contain' : 'object-cover'}`}
          />

          {focusable && !pending && (
            <div
              className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
              style={{ left: posX, top: posY }}
            />
          )}

          {pending && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <p className="text-sm font-semibold text-white">Uploading…</p>
            </div>
          )}

          {!pending && (
            <div className="absolute right-2 top-2 flex gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  inputRef.current?.click()
                }}
                className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-black/80"
              >
                Change
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setUrl('')
                  setPreview('')
                  setPosition('50% 50%')
                  setError(null)
                  if (inputRef.current) inputRef.current.value = ''
                }}
                className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-black/80"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFile(e.dataTransfer.files?.[0])
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 text-center transition-colors ${frame} ${
            dragOver ? 'border-[var(--accent)] bg-[var(--accent)]/8' : 'border-[var(--border)] bg-[var(--bg-sunken)]'
          }`}
        >
          <p className="text-sm font-semibold text-white">Click or drag an image here</p>
          <p className="text-xs text-[var(--text-faint)]">JPEG, PNG, WebP or GIF, up to 5MB</p>
        </div>
      )}

      {focusable && preview && !pending ? (
        <p className="text-xs text-[var(--text-faint)]">
          Click the image to choose what stays visible when it&apos;s cropped into a card or thumbnail.
        </p>
      ) : (
        hint && <p className="text-xs text-[var(--text-faint)]">{hint}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {error && <p className="text-xs font-semibold text-[var(--danger)]">{error}</p>}
    </div>
  )
}
