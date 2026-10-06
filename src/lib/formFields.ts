/**
 * The custom registration form an admin builds per event (events.form_fields)
 * and the answers a team leader gives (event_teams.form_answers). Shared by
 * the admin builder, the member form and the server-side validation, so all
 * three agree on what a field is.
 */

export const FIELD_TYPES = {
  short: 'Short answer',
  long: 'Paragraph',
  number: 'Number',
  email: 'Email',
  phone: 'Phone',
  url: 'Link',
  date: 'Date',
  select: 'Dropdown',
  radio: 'Multiple choice',
  checkboxes: 'Checkboxes',
  video: 'Video upload',
} as const

export type FieldType = keyof typeof FIELD_TYPES

export type FormField = {
  id: string
  type: FieldType
  label: string
  help?: string
  required: boolean
  /** select / radio / checkboxes */
  options?: string[]
  /** video only — the size limit is per event (events.max_upload_mb). */
  maxDurationSec?: number
}

export type VideoAnswer = { path: string; name: string; size: number; durationSec: number }
export type Answer = string | string[] | VideoAnswer
export type Answers = Record<string, Answer>

export const VIDEO_BUCKET = 'event-submissions'
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']
/** Ceiling an admin can set; Supabase's project upload limit may be lower. */
export const MAX_VIDEO_MB = 500
export const DEFAULT_VIDEO_MB = 50
export const MAX_VIDEO_SECONDS = 3600
const DEFAULT_VIDEO_SECONDS = 120

const MAX_FIELDS = 30

export function hasOptions(type: FieldType) {
  return type === 'select' || type === 'radio' || type === 'checkboxes'
}

export function newFieldId() {
  return `f_${Math.random().toString(36).slice(2, 10)}`
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

/**
 * Cleans whatever the admin form posted (or the database holds) into valid
 * field definitions. Anything malformed is dropped rather than rejected, so a
 * bad row can never take the event page down.
 */
export function sanitizeFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const fields: FormField[] = []

  for (const item of raw.slice(0, MAX_FIELDS)) {
    if (!item || typeof item !== 'object') continue
    const f = item as Record<string, unknown>
    const type = String(f.type) as FieldType
    if (!(type in FIELD_TYPES)) continue
    const label = String(f.label ?? '').trim().slice(0, 200)
    if (!label) continue

    let id = String(f.id ?? '')
    if (!/^[a-z0-9_-]{1,40}$/i.test(id) || seen.has(id)) id = newFieldId()
    seen.add(id)

    const field: FormField = { id, type, label, required: Boolean(f.required) }
    const help = String(f.help ?? '').trim().slice(0, 300)
    if (help) field.help = help

    if (hasOptions(type)) {
      const options = Array.isArray(f.options)
        ? [...new Set(f.options.map((o) => String(o).trim().slice(0, 200)).filter(Boolean))].slice(0, 50)
        : []
      if (options.length === 0) continue
      field.options = options
    }
    if (type === 'video') {
      field.maxDurationSec = clampInt(f.maxDurationSec, 5, MAX_VIDEO_SECONDS, DEFAULT_VIDEO_SECONDS)
    }
    fields.push(field)
  }
  return fields
}

/** The event's upload limit, clamped to what 0014's check constraint allows. */
export function sanitizeMaxUploadMb(raw: unknown) {
  return clampInt(raw, 1, MAX_VIDEO_MB, DEFAULT_VIDEO_MB)
}

export function isVideoAnswer(value: unknown): value is VideoAnswer {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'path' in value)
}

export function formatDuration(seconds: number) {
  const s = Math.round(seconds)
  const m = Math.floor(s / 60)
  return m ? `${m}:${String(s % 60).padStart(2, '0')} min` : `${s} sec`
}

/**
 * Checks answers against the fields. Video answers are only shape-checked
 * here; the server also confirms the upload exists, sits in the uploader's
 * folder and is within the size limit (see checkVideoUploads in the action).
 */
export function validateAnswers(
  fields: FormField[],
  raw: unknown,
): { error: string } | { answers: Answers } {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const answers: Answers = {}

  for (const field of fields) {
    const value = input[field.id]
    const missing = () => (field.required ? { error: `"${field.label}" is required.` } : null)

    if (field.type === 'checkboxes') {
      const picked = Array.isArray(value)
        ? value.map(String).filter((v) => field.options!.includes(v))
        : []
      if (picked.length === 0) {
        const err = missing()
        if (err) return err
        continue
      }
      answers[field.id] = picked
      continue
    }

    if (field.type === 'video') {
      if (!isVideoAnswer(value)) {
        const err = missing()
        if (err) return err
        continue
      }
      const v = value as VideoAnswer
      const durationSec = Number(v.durationSec)
      if (Number.isFinite(durationSec) && durationSec > field.maxDurationSec! + 1) {
        return { error: `"${field.label}" must be ${formatDuration(field.maxDurationSec!)} or shorter.` }
      }
      answers[field.id] = {
        path: String(v.path),
        name: String(v.name ?? 'video').slice(0, 200),
        size: Number(v.size) || 0,
        durationSec: Number.isFinite(durationSec) ? durationSec : 0,
      }
      continue
    }

    const text = typeof value === 'string' ? value.trim() : ''
    if (!text) {
      const err = missing()
      if (err) return err
      continue
    }

    const bad = (what: string) => ({ error: `"${field.label}" ${what}` })
    switch (field.type) {
      case 'short':
        if (text.length > 300) return bad('must be 300 characters or fewer.')
        break
      case 'long':
        if (text.length > 5000) return bad('must be 5000 characters or fewer.')
        break
      case 'number':
        if (!Number.isFinite(Number(text))) return bad('must be a number.')
        break
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return bad('must be an email address.')
        break
      case 'phone':
        if (!/^[+\d][\d\s-]{6,19}$/.test(text)) return bad('must be a phone number.')
        break
      case 'url':
        try {
          const u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
          if (u.protocol !== 'https:' && u.protocol !== 'http:') return bad('must be a web link.')
        } catch {
          return bad('must be a web link.')
        }
        break
      case 'date':
        if (Number.isNaN(new Date(text).getTime())) return bad('must be a date.')
        break
      case 'select':
      case 'radio':
        if (!field.options!.includes(text)) return bad('has an option that is not on the list.')
        break
    }
    answers[field.id] = text.slice(0, 5000)
  }

  return { answers }
}

/** Human-readable answer for the admin roster. */
export function answerText(answer: Answer | undefined): string {
  if (answer === undefined) return ''
  if (Array.isArray(answer)) return answer.join(', ')
  if (isVideoAnswer(answer)) return answer.name
  return answer
}
