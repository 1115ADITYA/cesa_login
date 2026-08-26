'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { uploadEventBanner } from '../actions'
import CropStage from './CropStage'
import { BANNER_ASPECT } from '@/lib/events'

/**
 * Replaces the old plain "paste a URL" fields. Uploads straight to storage and
 * keeps the resulting public URL in a hidden input, so the rest of EventForm —
 * and createEvent/updateEvent — only ever see a string.
 *
 * Two shapes, because the two images do different jobs:
 *
 * - `banner` is the wide crop shown on cards. Picking a file opens a real crop
 *   frame (drag, zoom, thirds guides) and what gets uploaded is the cropped
 *   JPEG. Two earlier attempts stored a CSS object-position instead — first a
 *   click-anywhere crosshair, then Top/Middle/Bottom presets — and both made
 *   the admin guess at a crop they could not actually see themselves make.
 * - `poster` is the full artwork shown uncropped beside the registration form,
 *   so it is uploaded exactly as chosen.
 */

export default function ImageUpload({
  name,
  label,
  hint,
  variant = 'banner',
  defaultUrl,
  positionName,
}: {
  name: string
  label: string
  hint?: string
  variant?: 'banner' | 'poster'
  defaultUrl?: string
  positionName?: string
}) {
  const [url, setUrl] = useState(defaultUrl ?? '')
  const [preview, setPreview] = useState(defaultUrl ?? '')
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Object URLs are revoked on replacement and on unmount rather than straight
  // after load — the crop stage keeps reading the same src while it is open.
  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc)
    }
  }, [cropSrc])

  function upload(file: File | Blob, filename: string) {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('file', new File([file], filename, { type: file.type || 'image/jpeg' }))
      const result = await uploadEventBanner(formData)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setUrl(result.url)
      setPreview(result.url)
    })
  }

  function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)

    if (variant === 'banner') {
      // Straight into the crop frame; nothing is uploaded until it is framed.
      if (cropSrc) URL.revokeObjectURL(cropSrc)
      setCropSrc(URL.createObjectURL(file))
      return
    }

    setPreview(URL.createObjectURL(file))
    upload(file, file.name)
  }

  const clear = () => {
    setUrl('')
    setPreview('')
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="label">{label}</label>
      <input type="hidden" name={name} value={url} />
      {/* The crop is baked into the file now, so nothing needs re-positioning
          at render time. Kept so the column stays populated and valid. */}
      {positionName && <input type="hidden" name={positionName} value="50% 50%" />}

      {cropSrc ? (
        <CropStage
          src={cropSrc}
          aspect={BANNER_ASPECT}
          onCancel={() => {
            URL.revokeObjectURL(cropSrc)
            setCropSrc(null)
            if (inputRef.current) inputRef.current.value = ''
          }}
          onCropped={(blob) => {
            setPreview(URL.createObjectURL(blob))
            upload(blob, 'banner.jpg')
            URL.revokeObjectURL(cropSrc)
            setCropSrc(null)
          }}
        />
      ) : preview ? (
        <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-sunken)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt=""
            className={
              variant === 'poster' ? 'mx-auto max-h-56 w-auto object-contain' : 'w-full object-cover'
            }
            style={variant === 'banner' ? { aspectRatio: String(BANNER_ASPECT) } : undefined}
          />

          {pending && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <p className="text-sm font-semibold text-white">Uploading…</p>
            </div>
          )}

          {!pending && (
            <div className="absolute right-2 top-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-black/80"
              >
                {variant === 'banner' ? 'Replace & recrop' : 'Change'}
              </button>
              <button
                type="button"
                onClick={clear}
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
          className={`flex h-40 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 text-center transition-colors ${
            dragOver ? 'border-[var(--accent)] bg-[var(--accent)]/8' : 'border-[var(--border)] bg-[var(--bg-sunken)]'
          }`}
        >
          <p className="text-sm font-semibold text-white">Click or drag an image here</p>
          <p className="text-xs text-[var(--text-faint)]">JPEG, PNG, WebP or GIF, up to 5MB</p>
        </div>
      )}

      {hint && !cropSrc && <p className="text-xs text-[var(--text-faint)]">{hint}</p>}

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
