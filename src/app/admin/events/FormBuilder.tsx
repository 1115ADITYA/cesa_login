'use client'

import { useState } from 'react'
import {
  DEFAULT_VIDEO_MB,
  FIELD_TYPES,
  MAX_MEMBERS,
  MAX_VIDEO_MB,
  MAX_VIDEO_SECONDS,
  MEMBER_FIELD_TYPES,
  defaultMemberFields,
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

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={JSON.stringify(fields)} />

      <div>
        <p className="label">Registration form</p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          Extra questions the team leader answers once when registering — like a Google Form. Answers show up under
          each team on the Teams page. Questions without a title are skipped. Use a{' '}
          <strong className="text-[var(--text)]">Team members</strong> question to collect the same details (name,
          phone…) for every member.
        </p>
      </div>

      <QuestionList fields={fields} onChange={setFields} types={Object.keys(FIELD_TYPES) as FieldType[]} />

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

/**
 * An editable list of questions. Used for the form itself and, nested, for
 * the questions a "Team members" block asks of every member.
 */
function QuestionList({
  fields,
  onChange,
  types,
  nested = false,
}: {
  fields: FormField[]
  onChange: (fields: FormField[]) => void
  types: FieldType[]
  nested?: boolean
}) {
  const update = (id: string, patch: Partial<FormField>) =>
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  const remove = (id: string) => onChange(fields.filter((f) => f.id !== id))
  const move = (index: number, by: number) => {
    const target = index + by
    if (target < 0 || target >= fields.length) return
    const next = [...fields]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  const add = () => onChange([...fields, { id: newFieldId(), type: 'short', label: '', required: false }])

  const changeType = (field: FormField, type: FieldType) => {
    const patch: Partial<FormField> = { type }
    if (hasOptions(type) && !field.options?.length) patch.options = ['Option 1']
    if (type === 'video') patch.maxDurationSec = field.maxDurationSec ?? 120
    if (type === 'members') {
      patch.minMembers = field.minMembers ?? 2
      patch.maxMembers = field.maxMembers ?? 4
      patch.fields = field.fields?.length ? field.fields : defaultMemberFields()
      patch.required = true
      if (!field.label.trim()) patch.label = 'Team members'
    }
    update(field.id, patch)
  }

  return (
    <>
      {fields.map((field, i) => (
        <div
          key={field.id}
          className={`flex flex-col gap-3 rounded-xl border p-4 ${
            nested ? 'border-[var(--border)] bg-black/20' : 'border-[var(--border)] bg-[var(--bg-sunken)]'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-faint)]">Q{i + 1}</span>
            <select
              value={field.type}
              onChange={(e) => changeType(field, e.target.value as FieldType)}
              className="field !w-auto !py-1.5 !text-sm"
              aria-label="Question type"
            >
              {types.map((value) => (
                <option key={value} value={value}>
                  {FIELD_TYPES[value]}
                </option>
              ))}
            </select>
            {field.type !== 'members' && (
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => update(field.id, { required: e.target.checked })}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                Required
              </label>
            )}
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

          {field.type === 'members' && (
            <MembersSettings field={field} onChange={(patch) => update(field.id, patch)} />
          )}
        </div>
      ))}

      <button type="button" onClick={add} className="btn btn-ghost self-start !py-2 !text-sm">
        + Add {nested ? 'member question' : 'question'}
      </button>
    </>
  )
}

/** Team size and the per-member questions of a "Team members" block. */
function MembersSettings({ field, onChange }: { field: FormField; onChange: (patch: Partial<FormField>) => void }) {
  const min = field.minMembers ?? 1
  const max = field.maxMembers ?? min

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="label">Min members (required)</label>
          <input
            type="number"
            min={1}
            max={MAX_MEMBERS}
            value={min}
            onChange={(e) => {
              const next = Math.max(1, Math.min(MAX_MEMBERS, Number(e.target.value) || 1))
              onChange({ minMembers: next, maxMembers: Math.max(next, max) })
            }}
            className="field"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="label">Max members</label>
          <input
            type="number"
            min={min}
            max={MAX_MEMBERS}
            value={max}
            onChange={(e) => onChange({ maxMembers: Math.max(min, Math.min(MAX_MEMBERS, Number(e.target.value) || min)) })}
            className="field"
          />
        </div>
      </div>
      <p className="text-xs text-[var(--text-faint)]">
        The form shows {max} member section{max === 1 ? '' : 's'}. Member 1 is the <strong>leader</strong>; members 1–
        {min} must be filled in, the rest are optional. The questions below are asked for every member — a question
        marked Required is required for each member who is filled in.
      </p>

      <div className="flex flex-col gap-3 border-l-2 border-[var(--accent)]/30 pl-3">
        <p className="label">Asked for every member</p>
        <QuestionList
          fields={field.fields ?? []}
          onChange={(fields) => onChange({ fields })}
          types={MEMBER_FIELD_TYPES}
          nested
        />
      </div>
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
