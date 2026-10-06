'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  VIDEO_BUCKET,
  VIDEO_MIME_TYPES,
  formatDuration,
  isMemberAnswers,
  isVideoAnswer,
  memberLabel,
  type Answer,
  type Answers,
  type FormField,
  type MemberAnswers,
  type VideoAnswer,
} from '@/lib/formFields'

/**
 * Renders an event's custom registration questions. Controlled: the parent
 * holds the answers and sends them to the server action, which validates them
 * again — the checks here are for the user's benefit, not for trust.
 */
export default function FormFieldsInput({
  fields,
  answers,
  onChange,
  eventId,
  userId,
  maxUploadMb,
  onUploadingChange,
  idPrefix = 'q',
}: {
  fields: FormField[]
  answers: Answers
  onChange: (answers: Answers) => void
  eventId: string
  userId: string
  /** The event's limit for every video question. */
  maxUploadMb: number
  onUploadingChange?: (uploading: boolean) => void
  /** Keeps input ids and radio groups apart when the same questions repeat per member. */
  idPrefix?: string
}) {
  const set = (id: string, value: Answer | undefined) => {
    const next = { ...answers }
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) delete next[id]
    else next[id] = value
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        const value = answers[field.id]
        const text = typeof value === 'string' ? value : ''
        const inputId = `${idPrefix}-${field.id}`
        return (
          <div key={field.id} className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="label">
              {field.label}
              {field.required && <span className="ml-1 text-[var(--accent)]">*</span>}
            </label>
            {field.help && <p className="-mt-0.5 text-xs text-[var(--text-faint)]">{field.help}</p>}

            {field.type === 'long' ? (
              <textarea
                id={inputId}
                rows={4}
                maxLength={5000}
                required={field.required}
                value={text}
                onChange={(e) => set(field.id, e.target.value)}
                className="field"
              />
            ) : field.type === 'select' ? (
              <select
                id={inputId}
                required={field.required}
                value={text}
                onChange={(e) => set(field.id, e.target.value)}
                className="field"
              >
                <option value="">Choose…</option>
                {field.options!.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : field.type === 'radio' || field.type === 'checkboxes' ? (
              <div className="flex flex-col gap-2">
                {field.options!.map((o) => {
                  const picked = Array.isArray(value) && !isMemberAnswers(value) ? (value as string[]) : []
                  const checked = field.type === 'radio' ? text === o : picked.includes(o)
                  return (
                    <label key={o} className="flex items-center gap-2.5 text-sm text-[var(--text)]">
                      <input
                        type={field.type === 'radio' ? 'radio' : 'checkbox'}
                        name={inputId}
                        checked={checked}
                        onChange={(e) => {
                          if (field.type === 'radio') set(field.id, o)
                          else set(field.id, e.target.checked ? [...picked, o] : picked.filter((p) => p !== o))
                        }}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                      {o}
                    </label>
                  )
                })}
              </div>
            ) : field.type === 'members' ? (
              <MembersInput
                field={field}
                value={isMemberAnswers(value) ? value : []}
                onChange={(v) => set(field.id, v)}
                eventId={eventId}
                userId={userId}
                maxUploadMb={maxUploadMb}
              />
            ) : field.type === 'video' ? (
              <VideoInput
                field={field}
                value={isVideoAnswer(value) ? value : null}
                onChange={(v) => set(field.id, v ?? undefined)}
                eventId={eventId}
                userId={userId}
                maxUploadMb={maxUploadMb}
                onUploadingChange={onUploadingChange}
              />
            ) : (
              <input
                id={inputId}
                type={
                  field.type === 'number'
                    ? 'number'
                    : field.type === 'email'
                      ? 'email'
                      : field.type === 'phone'
                        ? 'tel'
                        : field.type === 'date'
                          ? 'date'
                          : 'text'
                }
                inputMode={field.type === 'url' ? 'url' : undefined}
                maxLength={field.type === 'short' ? 300 : undefined}
                required={field.required}
                value={text}
                onChange={(e) => set(field.id, e.target.value)}
                placeholder={field.type === 'url' ? 'https://…' : undefined}
                className="field"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Reads a local video's length before uploading, so a too-long one never leaves the device. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(video.duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable'))
    }
    video.src = url
  })
}

const EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
}

function VideoInput({
  field,
  value,
  onChange,
  eventId,
  userId,
  maxUploadMb,
  onUploadingChange,
}: {
  field: FormField
  value: VideoAnswer | null
  onChange: (value: VideoAnswer | null) => void
  eventId: string
  userId: string
  maxUploadMb: number
  onUploadingChange?: (uploading: boolean) => void
}) {
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const maxBytes = maxUploadMb * 1024 * 1024

  const pick = async (file: File | undefined) => {
    setError(null)
    if (!file) return
    if (!VIDEO_MIME_TYPES.includes(file.type)) return setError('Use an MP4, WebM, MOV or MKV video.')
    if (file.size > maxBytes) return setError(`That video is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${maxUploadMb} MB.`)

    let durationSec: number
    try {
      durationSec = await readDuration(file)
    } catch {
      return setError('Could not read that video. Try exporting it as MP4.')
    }
    if (!Number.isFinite(durationSec) || durationSec > field.maxDurationSec! + 1) {
      return setError(`That video is ${formatDuration(durationSec)} — the limit is ${formatDuration(field.maxDurationSec!)}.`)
    }

    // Straight from the browser to Supabase Storage: a video is far larger
    // than a server action request may be. The path must start with
    // <event>/<own user id>/ — 0013's storage policy refuses anything else.
    const path = `${eventId}/${userId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`
    setStatus('Uploading… keep this page open.')
    onUploadingChange?.(true)
    const supabase = createClient()
    const { error: uploadError } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    })
    onUploadingChange?.(false)
    setStatus(null)
    if (uploadError) return setError(`Upload failed: ${uploadError.message}`)

    onChange({ path, name: file.name, size: file.size, durationSec: Math.round(durationSec) })
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[var(--border-strong)] p-4">
      {value ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-[var(--success)]">✓ Uploaded</span>
          <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">
            {value.name} · {(value.size / 1024 / 1024).toFixed(1)} MB · {formatDuration(value.durationSec)}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs font-semibold text-[var(--text-faint)] hover:text-[var(--danger)]"
          >
            Replace
          </button>
        </div>
      ) : (
        <input
          type="file"
          accept={VIDEO_MIME_TYPES.join(',')}
          disabled={Boolean(status)}
          onChange={(e) => pick(e.target.files?.[0])}
          className="text-sm text-[var(--text-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
      )}
      <p className="text-xs text-[var(--text-faint)]">
        Up to {maxUploadMb} MB and {formatDuration(field.maxDurationSec!)}. MP4, WebM, MOV or MKV.
      </p>
      {status && <p className="text-xs font-semibold text-[var(--accent)]">{status}</p>}
      {error && <p className="text-xs font-semibold text-[var(--danger)]">{error}</p>}
    </div>
  )
}

/**
 * "Team members": one card per member, Member 1 being the leader. Cards up to
 * the minimum are always there and required; the rest are added on demand up
 * to the maximum. Each card asks the same sub-questions, rendered by the
 * same component this file exports.
 */
function MembersInput({
  field,
  value,
  onChange,
  eventId,
  userId,
  maxUploadMb,
}: {
  field: FormField
  value: MemberAnswers
  onChange: (value: MemberAnswers) => void
  eventId: string
  userId: string
  maxUploadMb: number
}) {
  const min = field.minMembers ?? 1
  const max = field.maxMembers ?? min
  const [count, setCount] = useState(Math.min(max, Math.max(min, value.length)))

  const setMember = (index: number, answers: Answers) => {
    const next = [...value]
    while (next.length <= index) next.push({})
    next[index] = answers as Record<string, string | string[]>
    onChange(next)
  }
  const removeLast = () => {
    onChange(value.slice(0, count - 1))
    setCount(count - 1)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[var(--text-faint)]">
        {min === max ? `${min} members` : `${min}–${max} members`} · the first {min === 1 ? 'member is' : `${min} are`}{' '}
        required.
      </p>
      {Array.from({ length: count }, (_, i) => {
        const entry = value[i] ?? {}
        // An optional member becomes subject to the required questions as soon
        // as anything is filled in — the same rule validateAnswers applies.
        const started = Object.values(entry).some((v) => (Array.isArray(v) ? v.length > 0 : String(v ?? '').trim()))
        const enforce = i < min || started
        return (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-sunken)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-white">
                {memberLabel(i)}
                {i < min ? (
                  <span className="ml-2 text-xs font-semibold text-[var(--accent)]">Required</span>
                ) : (
                  <span className="ml-2 text-xs font-normal text-[var(--text-faint)]">Optional</span>
                )}
              </p>
              {i === count - 1 && i >= min && (
                <button
                  type="button"
                  onClick={removeLast}
                  className="text-xs font-semibold text-[var(--text-faint)] hover:text-[var(--danger)]"
                >
                  Remove
                </button>
              )}
            </div>
            <FormFieldsInput
              fields={(field.fields ?? []).map((f) => ({ ...f, required: enforce && f.required }))}
              answers={entry as Answers}
              onChange={(a) => setMember(i, a)}
              eventId={eventId}
              userId={userId}
              maxUploadMb={maxUploadMb}
              idPrefix={`${field.id}-m${i}`}
            />
          </div>
        )
      })}
      {count < max && (
        <button type="button" onClick={() => setCount(count + 1)} className="btn btn-ghost self-start !py-2 !text-sm">
          + Add member {count + 1}
        </button>
      )}
    </div>
  )
}
