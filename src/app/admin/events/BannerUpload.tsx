'use client'

import { useRef, useState, useTransition } from 'react'
import { uploadEventBanner } from '../actions'

/**
 * Replaces the old plain "paste a URL" field. Uploads straight to storage and
 * keeps the resulting public URL in a hidden `bannerUrl` input, so the rest
 * of EventForm — and createEvent/updateEvent — are unchanged.
 */
export default function BannerUpload({ defaultUrl }: { defaultUrl?: string }) {
  const [url, setUrl] = useState(defaultUrl ?? '')
  const [preview, setPreview] = useState(defaultUrl ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)

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
    <div className="flex flex-col gap-1.5">
      <label className="label">Banner image (optional)</label>
      <input type="hidden" name="bannerUrl" value={url} />

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
        className={`relative flex h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed transition-colors ${
          dragOver ? 'border-[var(--accent)] bg-[var(--accent)]/8' : 'border-[var(--border)] bg-[var(--bg-sunken)]'
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}

        {(pending || !preview) && (
          <div
            className={`relative flex flex-col items-center gap-1 px-4 text-center ${
              preview ? 'rounded-lg bg-black/60 px-4 py-3' : ''
            }`}
          >
            <p className="text-sm font-semibold text-white">
              {pending ? 'Uploading…' : 'Click or drag an image here'}
            </p>
            {!pending && <p className="text-xs text-[var(--text-faint)]">JPEG, PNG, WebP or GIF, up to 5MB</p>}
          </div>
        )}

        {preview && !pending && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setUrl('')
              setPreview('')
              setError(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
            className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-black/80"
          >
            Remove
          </button>
        )}
      </div>

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
