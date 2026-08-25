'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveProfileDetails } from '@/app/(app)/dashboard/actions'
import { DEPARTMENTS, YEARS, DIVISIONS, type ProfileDetails } from '@/lib/profileFields'

/**
 * The one place these fields are edited. Shared by the first-time prompt on
 * /dashboard and the editor on /profile so the two can never drift apart —
 * which matters because the option lists have to stay in step with the check
 * constraints in 0006_profile_details.sql.
 */
export default function ProfileDetailsForm({
  profile,
  onSaved,
  submitLabel = 'Save details',
  redirectTo,
}: {
  profile: Partial<ProfileDetails> | null
  onSaved?: () => void
  submitLabel?: string
  /** Where to go once saved — used by the mandatory gate at /complete-profile. */
  redirectTo?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [department, setDepartment] = useState(profile?.department ?? '')
  const [yearOfStudy, setYearOfStudy] = useState(profile?.year_of_study ?? '')
  const [division, setDivision] = useState(profile?.division ?? '')
  const [rollNo, setRollNo] = useState(profile?.roll_no ?? '')
  const [contact, setContact] = useState(profile?.contact ?? '')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await saveProfileDetails({ fullName, department, yearOfStudy, division, rollNo, contact })
      if ('error' in result) {
        setError(result.error)
        return
      }
      setSaved(true)
      if (redirectTo) {
        router.replace(redirectTo)
        return
      }
      router.refresh()
      onSaved?.()
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="alert alert-success">Details saved.</div>}

      <Field label="Full name">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          maxLength={80}
          placeholder="As it should appear on the roster"
          className="field"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Department">
          <select value={department} onChange={(e) => setDepartment(e.target.value)} required className="field">
            <option value="">Select…</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>

        <Field label="Year of study">
          <select value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)} required className="field">
            <option value="">Select…</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Division">
          <select value={division} onChange={(e) => setDivision(e.target.value)} required className="field">
            <option value="">Select…</option>
            {DIVISIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>

        <Field label="Roll number">
          <input
            value={rollNo}
            onChange={(e) => setRollNo(e.target.value)}
            required
            maxLength={20}
            className="field"
          />
        </Field>
      </div>

      <Field label="Contact number">
        <input
          type="tel"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          required
          minLength={7}
          maxLength={20}
          placeholder="Organisers use this on the day"
          className="field"
        />
      </Field>

      <button type="submit" disabled={pending} className="btn btn-primary mt-1 !py-3">
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
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
