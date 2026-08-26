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
 * - `banner` is a wide crop for cards and thumbnails. Since a portrait poster
 *   loses most of its height to that crop, the admin picks which band of the
 *   image survives — from three presets, previewed at the real card size.
 *   An earlier version let them click a crosshair anywhere on the image, but
 *   the preview was a different shape from the actual crop, so the click was
 *   guesswork; presets plus a true-to-life preview remove the guessing.
 * - `poster` is the full 9:16 artwork shown uncropped beside the registration
 *   form. Nothing is cropped, so there is nothing to choose.
 */

// Only the vertical band is offered. A wide crop of a portrait poster keeps
// the full width already, so the horizontal axis has nothing to decide.
const FOCUS_PRESETS = [
  { label: 'Top', value: '50% 0%' },
  { label: 'Middle', value: '50% 50%' },
  { label: 'Bottom', value: '50% 100%' },
]

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

  const focusable = variant === 'banner' && Boolean(positionName)

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

  return (
    <div className="flex flex-col gap-2">
      <label className="label">{label}</label>
      <input type="hidden" name={name} value={url} />
      {positionName && <input type="hidden" name={positionName} value={position} />}

      {preview ? (
        <div className="flex flex-col gap-3">
          {/* The whole image, uncropped, so the admin can see what they picked. */}
          <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-sunken)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="mx-auto max-h-56 w-auto object-contain" />

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
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => {
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

          {focusable && !pending && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-sunken)] p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">
                Cards show a wide slice of this image. Pick which part to keep:
              </p>

              {/* Each option is its own live preview at the real card crop, so
                  what the admin clicks is literally what members will see. */}
              <div className="grid grid-cols-3 gap-2">
                {FOCUS_PRESETS.map((preset) => {
                  const active = position === preset.value
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setPosition(preset.value)}
                      className={`overflow-hidden rounded-lg border-2 text-left transition-colors ${
                        active
                          ? 'border-[var(--accent)]'
                          : 'border-transparent hover:border-[var(--border-strong)]'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt=""
                        style={{ objectPosition: preset.value }}
                        className="h-16 w-full object-cover"
                      />
                      <span
                        className={`block px-1 py-1 text-center text-xs font-bold ${
                          active ? 'text-[var(--accent)]' : 'text-[var(--text-faint)]'
                        }`}
                      >
                        {preset.label}
                      </span>
                    </button>
                  )
                })}
              </div>
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

      {hint && <p className="text-xs text-[var(--text-faint)]">{hint}</p>}

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
