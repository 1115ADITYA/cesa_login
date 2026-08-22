'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { registerForEvent } from '../actions'
import { teamSizeLabel } from '@/lib/events'

/**
 * Step one, and only step one. Inviting friends used to happen in this same
 * form, which meant a typo'd username could block someone from registering at
 * all — and there was no way to add anyone afterwards without re-submitting the
 * team name. You register first; the roster is built on the next screen.
 */
export default function RegisterForm({
  eventId,
  minTeamSize,
  maxTeamSize,
}: {
  eventId: string
  minTeamSize: number
  maxTeamSize: number | null
}) {
  const router = useRouter()
  const solo = maxTeamSize === 1
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await registerForEvent(eventId, teamName)
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="glass flex flex-col gap-5 p-6">
      <div>
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-white">
          {solo ? 'Register for this event' : 'Register your team'}
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {solo
            ? 'This is a solo event — one click and you are in.'
            : `${teamSizeLabel(minTeamSize, maxTeamSize)}. Register now, then invite your friends — your spot is held while they reply.`}
        </p>
      </div>

      {!solo && <Steps minTeamSize={minTeamSize} />}

      {error && <div className="alert alert-error">{error}</div>}

      {!solo && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="teamName" className="label">
            Team name
          </label>
          <input
            id="teamName"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
            minLength={2}
            maxLength={60}
            placeholder="e.g. Byte Me"
            className="field"
          />
          <p className="text-xs text-[var(--text-faint)]">
            Visible to your teammates and the organisers. You can change it later.
          </p>
        </div>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary !py-3">
        {pending ? 'Registering…' : solo ? 'Register' : 'Register & pick teammates'}
      </button>
    </form>
  )
}

function Steps({ minTeamSize }: { minTeamSize: number }) {
  const steps = [
    'Register and name your team',
    'Invite friends by username',
    minTeamSize > 1
      ? `${minTeamSize} members accept — your team is confirmed`
      : 'They accept — your team is confirmed',
  ]

  return (
    <ol className="flex flex-col gap-2.5 rounded-xl bg-[var(--bg-sunken)] p-4">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-3 text-sm">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              i === 0 ? 'bg-[var(--accent)] text-white' : 'bg-white/8 text-[var(--text-faint)]'
            }`}
          >
            {i + 1}
          </span>
          <span className={i === 0 ? 'font-semibold text-[var(--text-bright)]' : 'text-[var(--text-muted)]'}>
            {label}
          </span>
        </li>
      ))}
    </ol>
  )
}
