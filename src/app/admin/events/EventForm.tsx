'use client'

import { useActionState } from 'react'

type EventDefaults = {
  title?: string
  description?: string
  location?: string
  bannerUrl?: string
  startsAt?: string
  endsAt?: string
  registrationClosesAt?: string
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
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      {state?.error && (
        <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20">{state.error}</div>
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

      <div className="grid grid-cols-2 gap-4">
        <Field label="Registration closes (optional)">
          <input
            type="datetime-local"
            name="registrationClosesAt"
            defaultValue={toLocalInput(defaults?.registrationClosesAt)}
            className={inputClass}
          />
        </Field>
        <Field label="Max team size (blank = no cap)">
          <input type="number" min={1} name="maxTeamSize" defaultValue={defaults?.maxTeamSize ?? ''} className={inputClass} />
        </Field>
      </div>

      <Field label="Location (optional)">
        <input name="location" defaultValue={defaults?.location} className={inputClass} />
      </Field>

      <Field label="Banner image URL (optional)">
        <input name="bannerUrl" defaultValue={defaults?.bannerUrl} className={inputClass} />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 bg-gradient-to-r from-[#D16475] to-[#E87A8C] text-white font-bold py-3 rounded-xl disabled:opacity-50"
      >
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}

const inputClass =
  'w-full p-3 rounded-xl border border-white/5 bg-black/30 text-[#F3E9E8] text-sm outline-none transition-all focus:border-[#E87A8C] focus:bg-black/50'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-[#8C7A77] uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}
