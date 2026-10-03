'use client'

import { useActionState, useState } from 'react'
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
  /** Set (even to '') when the event is saved as Coming Soon. */
  dateLabel?: string | null
  registrationClosesAt?: string
  joinUrl?: string
  showJoinButton?: boolean
  customText?: string
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
  // An existing event with no start date was saved as Coming Soon.
  const [comingSoon, setComingSoon] = useState(Boolean(defaults && !defaults.startsAt))
  const [showJoin, setShowJoin] = useState(defaults?.showJoinButton ?? false)
  // Coming Soon or Join Now: the event needs nothing else to be published.
  const allOptional = comingSoon || showJoin

  return (
    <form action={formAction} className="glass flex max-w-xl flex-col gap-4 p-6">
      {state?.error && (
        <div className="alert alert-error">{state.error}</div>
      )}

      <Field label={allOptional ? 'Title (optional)' : 'Title'}>
        <input
          name="title"
          required={!allOptional}
          defaultValue={defaults?.title}
          placeholder={allOptional ? 'Upcoming event' : undefined}
          className={inputClass}
        />
      </Field>

      <Field label="Description">
        <textarea name="description" rows={4} defaultValue={defaults?.description} className={inputClass} />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="label mb-1.5">Date</legend>
        <div className="flex flex-wrap gap-2">
          <ScheduleOption checked={!comingSoon} onSelect={() => setComingSoon(false)} value="fixed" label="Fixed dates" />
          <ScheduleOption checked={comingSoon} onSelect={() => setComingSoon(true)} value="comingSoon" label="Coming soon" />
        </div>

        {comingSoon ? (
          <Field label="Show this instead of a date">
            <input
              name="dateLabel"
              maxLength={80}
              defaultValue={defaults?.dateLabel || 'Coming Soon'}
              placeholder="Coming Soon"
              className={inputClass}
            />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Field label={showJoin ? 'Starts (optional)' : 'Starts'}>
              <input type="datetime-local" name="startsAt" required={!showJoin} defaultValue={toLocalInput(defaults?.startsAt)} className={inputClass} />
            </Field>
            <Field label={showJoin ? 'Ends (optional)' : 'Ends'}>
              <input type="datetime-local" name="endsAt" required={!showJoin} defaultValue={toLocalInput(defaults?.endsAt)} className={inputClass} />
            </Field>
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2.5 text-sm font-semibold text-[var(--text)]">
          <input
            type="checkbox"
            name="showJoinButton"
            checked={showJoin}
            onChange={(e) => setShowJoin(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Show a Join Now button
        </label>
        {/* Kept in the form while hidden, so switching the button off does not
            throw the link away. */}
        <div className={showJoin ? '' : 'hidden'}>
          <Field label="Join Now link">
            <input
              type="url"
              name="joinUrl"
              required={showJoin}
              defaultValue={defaults?.joinUrl}
              placeholder="https://unstop.com/…"
              className={inputClass}
            />
          </Field>
          <p className="mt-1.5 text-xs text-[var(--text-faint)]">
            Members are sent to this link instead of registering on this site. Opens in a new tab.
          </p>
        </div>
      </div>

      {allOptional ? (
        <Field label="Text shown instead of registration (optional)">
          <textarea
            name="customText"
            rows={3}
            maxLength={2000}
            defaultValue={defaults?.customText}
            placeholder={showJoin ? 'e.g. Registrations are on Unstop — team size 2–4.' : 'e.g. Details dropping next week. Stay tuned!'}
            className={inputClass}
          />
          <p className="mt-0.5 text-xs text-[var(--text-faint)]">
            {comingSoon ? 'Coming soon' : 'Join Now'} events take no registrations on this site, so the form, deadline and
            team sizes are hidden. This text appears in their place.
          </p>
        </Field>
      ) : (
        <>
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
        </>
      )}

      <Field label="Location (optional)">
        <input name="location" defaultValue={defaults?.location} className={inputClass} />
      </Field>

      <ImageUpload
        name="bannerUrl"
        label="Banner image (optional)"
        variant="banner"
        defaultUrl={defaults?.bannerUrl}
        positionName="bannerPosition"
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

function ScheduleOption({
  checked,
  onSelect,
  value,
  label,
}: {
  checked: boolean
  onSelect: () => void
  value: string
  label: string
}) {
  return (
    <label className={`btn !px-4 !py-2 !text-sm ${checked ? 'btn-primary' : 'btn-ghost'}`}>
      <input type="radio" name="schedule" value={value} checked={checked} onChange={onSelect} className="sr-only" />
      {label}
    </label>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="label">{label}</label>
      {children}
    </div>
  )
}
