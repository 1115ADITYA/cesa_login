'use client'

import { useState } from 'react'
import {
  DEFAULT_VIDEO_MB,
  FIELD_TYPES,
  MAX_VIDEO_MB,
  MAX_VIDEO_SECONDS,
  hasOptions,
  newFieldId,
  type FieldType,
  type FormField,
} from '@/lib/formFields'

/**
 * Google-Form-style question builder. The whole form travels to the server
 * action as one JSON string in a hidden input, and is re-sanitised there
 * (sanitizeFields) — nothing here is trusted.
 */
export default function FormBuilder({
  name,
  defaultFields,
  defaultMaxUploadMb,
}: {
  name: string
  defaultFields?: FormField[]
  defaultMaxUploadMb?: number
}) {
  const [fields, setFields] = useState<FormField[]>(defaultFields ?? [])
  const [maxUploadMb, setMaxUploadMb] = useState(defaultMaxUploadMb ?? DEFAULT_VIDEO_MB)
  const hasVideo = fields.some((f) => f.type === 'video')

  const update = (id: string, patch: Partial<FormField>) =>
    setFields((all) => all.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  const remove = (id: string) => setFields((all) => all.filter((f) => f.id !== id))
  const move = (index: number, by: number) =>
    setFields((all) => {
      const next = [...all]
      const target = index + by
      if (target < 0 || target >= next.length) return all
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  const add = () => setFields((all) => [...all, { id: newFieldId(), type: 'short', label: '', required: false }])

  const changeType = (field: FormField, type: FieldType) => {
    const patch: Partial<FormField> = { type }
    if (hasOptions(type) && !field.options?.length) patch.options = ['Option 1']
    if (type === 'video') {
      patch.maxDurationSec = field.maxDurationSec ?? 120
    }
    update(field.id, patch)
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={JSON.stringify(fields)} />

      <div>
        <p className="label">Registration form</p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          Extra questions the team leader answers once when registering — like a Google Form. Answers show up under
          each team on the Teams page. Questions without a title are skipped.
        </p>
      </div>

      {fields.map((field, i) => (
        <div key={field.id} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-sunken)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-faint)]">Q{i + 1}</span>
            <select
              value={field.type}
              onChange={(e) => changeType(field, e.target.value as FieldType)}
              className="field !w-auto !py-1.5 !text-sm"
              aria-label="Question type"
            >
              {Object.entries(FIELD_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => update(field.id, { required: e.target.checked })}
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
              Required
            </label>
            <span className="flex-1" />
            <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </IconButton>
            <IconButton label="Move down" disabled={i === fields.length - 1} onClick={() => move(i, 1)}>
              ↓
            </IconButton>
            <IconButton label="Delete question" onClick={() => remove(field.id)} danger>
              ✕
            </IconButton>
          </div>

          <input
            value={field.label}
            onChange={(e) => update(field.id, { label: e.target.value })}
            maxLength={200}
            placeholder="Question"
            className="field"
          />
          <input
            value={field.help ?? ''}
            onChange={(e) => update(field.id, { help: e.target.value })}
            maxLength={300}
            placeholder="Description (optional)"
            className="field !text-sm"
          />

          {hasOptions(field.type) && (
            <div className="flex flex-col gap-2">
              {(field.options ?? []).map((option, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <span className="w-4 text-center text-xs text-[var(--text-faint)]">
                    {field.type === 'checkboxes' ? '☐' : field.type === 'radio' ? '○' : `${oi + 1}.`}
                  </span>
                  <input
                    value={option}
                    onChange={(e) => {
                      const options = [...(field.options ?? [])]
                      options[oi] = e.target.value
                      update(field.id, { options })
                    }}
                    maxLength={200}
                    className="field !py-1.5 !text-sm"
                  />
                  <IconButton
                    label="Remove option"
                    disabled={(field.options ?? []).length <= 1}
                    onClick={() => update(field.id, { options: field.options!.filter((_, j) => j !== oi) })}
                  >
                    ✕
                  </IconButton>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  update(field.id, { options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`] })
                }
                className="self-start text-xs font-bold text-[var(--accent)] hover:underline"
              >
                + Add option
              </button>
            </div>
          )}

          {field.type === 'video' && (
            <div className="flex flex-col gap-1.5">
              <label className="label">Max length (seconds)</label>
              <input
                type="number"
                min={5}
                max={MAX_VIDEO_SECONDS}
                value={field.maxDurationSec ?? 120}
                onChange={(e) => update(field.id, { maxDurationSec: Number(e.target.value) })}
                className="field !w-40"
              />
              <p className="text-xs text-[var(--text-faint)]">
                MP4, WebM, MOV or MKV. The size limit is set once for the whole event, below.
              </p>
            </div>
          )}
        </div>
      ))}

      <button type="button" onClick={add} className="btn btn-ghost self-start !py-2 !text-sm">
        + Add question
      </button>

      {/* One limit for every video question in this event. Posted even when
          there are no video questions, so the saved value is kept. */}
      {hasVideo ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-sunken)] p-4">
          <label htmlFor="maxUploadMb" className="label">
            Max upload size for this event (MB)
          </label>
          <input
            id="maxUploadMb"
            type="number"
            name="maxUploadMb"
            min={1}
            max={MAX_VIDEO_MB}
            value={maxUploadMb}
            onChange={(e) => setMaxUploadMb(Number(e.target.value))}
            className="field !w-40"
          />
          <p className="text-xs text-[var(--text-faint)]">
            Applies to every video question above. Supabase&apos;s project upload limit (Storage → Settings) must be at
            least this size — 50 MB is the most the Free plan allows.
          </p>
        </div>
      ) : (
        <input type="hidden" name="maxUploadMb" value={maxUploadMb} />
      )}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm text-[var(--text-muted)] transition-colors hover:bg-white/8 disabled:opacity-30 ${
        danger ? 'hover:text-[var(--danger)]' : 'hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
