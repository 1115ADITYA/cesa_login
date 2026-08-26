'use client'

import { useActionState } from 'react'
import ImageUpload from './ImageUpload'

type EventDefaults = {
  title?: string
  description?: string
  location?: string
  bannerUrl?: string
  bannerPosition?: string
  posterUrl?: string
  startsAt?: string
  endsAt?: string
  registrationClosesAt?: string
  minTeamSize?: number | null
  maxTeamSize?: number | null
}

/** `datetime-local` wants "YYYY-MM-DDTHH:mm", not a full ISO string. */
function toLocalInput(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EventForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prevState: unknown, formData: FormData) => Promise<{ error: string } | void>
  defaults?: EventDefaults
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, null)

  return (
    <form action={formAction} className="glass flex max-w-xl flex-col gap-4 p-6">
      {state?.error && (
        <div className="alert alert-error">{state.error}</div>
      )}

      <Field label="Title">
        <input name="title" required defaultValue={defaults?.title} className={inputClass} />
      </Field>

      <Field label="Description">
        <textarea name="description" rows={4} defaultValue={defaults?.description} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Starts">
          <input type="datetime-local" name="startsAt" required defaultValue={toLocalInput(defaults?.startsAt)} className={inputClass} />
        </Field>
        <Field label="Ends">
          <input type="datetime-local" name="endsAt" required defaultValue={toLocalInput(defaults?.endsAt)} className={inputClass} />
        </Field>
      </div>

      <Field label="Registration closes (blank = when the event starts)">
        <input
          type="datetime-local"
          name="registrationClosesAt"
          defaultValue={toLocalInput(defaults?.registrationClosesAt)}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Min team size">
          <input
            type="number"
            min={1}
            name="minTeamSize"
            defaultValue={defaults?.minTeamSize ?? 1}
            className={inputClass}
          />
        </Field>
        <Field label="Max team size (blank = no cap)">
          <input type="number" min={1} name="maxTeamSize" defaultValue={defaults?.maxTeamSize ?? ''} className={inputClass} />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-[var(--text-faint)]">
        A team is only <strong className="text-[var(--text)]">confirmed</strong> once the minimum number of members have
        accepted their invitations. Set both to 1 for a solo event — participants then register without naming a team.
      </p>

      <Field label="Location (optional)">
        <input name="location" defaultValue={defaults?.location} className={inputClass} />
      </Field>

      <ImageUpload
        name="bannerUrl"
        label="Banner image (optional)"
        variant="banner"
        defaultUrl={defaults?.bannerUrl}
        positionName="bannerPosition"
        defaultPosition={defaults?.bannerPosition}
      />

      <ImageUpload
        name="posterUrl"
        label="Full poster (optional)"
        variant="poster"
        hint="Shown uncropped beside the registration form, so entrants can read the prizes, rules and venue straight off the artwork."
        defaultUrl={defaults?.posterUrl}
      />

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-2 !py-3"
      >
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}

const inputClass = 'field'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="label">{label}</label>
      {children}
    </div>
  )
}
