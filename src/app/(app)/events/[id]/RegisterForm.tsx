'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { registerForEvent } from '../actions'
import { teamSizeLabel } from '@/lib/events'
import Link from 'next/link'
import type { ProfileDetails } from '@/lib/profileFields'
import FormFieldsInput from '@/components/FormFieldsInput'
import type { Answers, FormField } from '@/lib/formFields'

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
  profile,
  profileComplete,
  missingFields,
  formFields,
  allowInvites,
  userId,
  maxUploadMb,
}: {
  eventId: string
  minTeamSize: number
  maxTeamSize: number | null
  profile: Partial<ProfileDetails> | null
  profileComplete: boolean
  missingFields: string[]
  formFields: FormField[]
  allowInvites: boolean
  userId: string
  maxUploadMb: number
}) {
  const router = useRouter()
  const solo = maxTeamSize === 1
  const [teamName, setTeamName] = useState('')
  const [answers, setAnswers] = useState<Answers>({})
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await registerForEvent(eventId, teamName, answers)
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
            ? formFields.length > 0
              ? 'Answer the questions below and you are in.'
              : 'This is a solo event — one click and you are in.'
            : `${teamSizeLabel(minTeamSize, maxTeamSize)}. Register now, then invite your friends — your spot is held while they reply.`}
        </p>
      </div>

      {!solo && allowInvites && <Steps minTeamSize={minTeamSize} />}

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

      {/* The point of holding these on the profile: shown back for confirmation
          rather than re-entered per event. */}
      {profileComplete ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-sunken)] p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="label">Registering as</span>
            <Link href="/profile" className="text-xs font-bold text-[var(--accent)] hover:underline">
              Edit
            </Link>
          </div>
          <p className="text-sm font-semibold text-white">{profile?.full_name}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {profile?.department} · {profile?.year_of_study} · Div {profile?.division} · Roll {profile?.roll_no}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{profile?.contact}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--warning)]/25 bg-[var(--warning)]/8 p-4">
          <p className="text-sm font-semibold text-[var(--warning)]">Complete your profile first</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Organisers need {missingFields.join(', ').toLowerCase()} on the roster. Fill it in once and every
            future event is prefilled.
          </p>
          <Link href="/profile" className="btn btn-primary mt-3 !py-2 !text-xs">
            Complete profile
          </Link>
        </div>
      )}

      {formFields.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-5">
          <h3 className="label">Registration form</h3>
          <FormFieldsInput
            fields={formFields}
            answers={answers}
            onChange={setAnswers}
            eventId={eventId}
            userId={userId}
            maxUploadMb={maxUploadMb}
            onUploadingChange={setUploading}
          />
        </div>
      )}

      <button type="submit" disabled={pending || uploading || !profileComplete} className="btn btn-primary !py-3">
        {pending ? 'Registering…' : uploading ? 'Uploading video…' : solo || !allowInvites ? 'Register' : 'Register & pick teammates'}
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
