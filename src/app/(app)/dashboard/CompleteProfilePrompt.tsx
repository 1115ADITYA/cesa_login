'use client'

import { useState } from 'react'
import ProfileDetailsForm from '@/components/ProfileDetailsForm'
import type { ProfileDetails } from '@/lib/profileFields'

/**
 * Shown on the dashboard until the profile has everything registration needs.
 *
 * This is deliberately the first-run prompt rather than a step wired into the
 * signup form itself: Google sign-in never touches that form (the profile row
 * is created in auth/callback), and email signup lands here after confirming
 * a link. The dashboard is the one screen every new member reaches whichever
 * way they got in, so one prompt here covers all of them.
 */
export default function CompleteProfilePrompt({
  profile,
  missing,
}: {
  profile: Partial<ProfileDetails> | null
  missing: string[]
}) {
  const [open, setOpen] = useState(false)
  const isFirstRun = missing.length >= 5

  return (
    <section className="glass border-[var(--accent)]/25 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="heading text-lg">
            {isFirstRun ? 'Finish setting up your profile' : 'Complete your profile'}
          </h2>
          <p className="mt-1.5 max-w-prose text-sm text-[var(--text-muted)]">
            {isFirstRun
              ? 'Fill these in once and every event registration is prefilled — no more retyping the same form each time.'
              : `Still needed: ${missing.join(', ')}.`}
          </p>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="btn btn-primary shrink-0">
            {isFirstRun ? 'Get started' : 'Complete now'}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-5 border-t border-[var(--border)] pt-5">
          <ProfileDetailsForm profile={profile} onSaved={() => setOpen(false)} submitLabel="Save and continue" />
        </div>
      )}
    </section>
  )
}
