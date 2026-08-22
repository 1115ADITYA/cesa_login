'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { respondToInvite } from '../events/actions'

export type Invite = {
  membershipId: string
  eventId: string
  eventTitle: string
  eventStartsAt: string
  teamName: string
  invitedByUsername: string
  invitedByFullName: string | null
  invitedAt: string
  acceptedCount: number
  minTeamSize: number
  maxTeamSize: number | null
  registrationOpen: boolean
}

export default function NotificationCentre({ invites }: { invites: Invite[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const respond = (membershipId: string, accept: boolean) => {
    setError(null)
    setBusy(membershipId)
    startTransition(async () => {
      const result = await respondToInvite(membershipId, accept)
      setBusy(null)
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  if (invites.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">You&apos;re all caught up.</p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          Team invitations from your friends will show up here.
        </p>
      </div>
    )
  }

  return (
    <>
      {error && <div className="alert alert-error mb-3">{error}</div>}
      <ul className="flex flex-col gap-3">
        {invites.map((inv) => {
          const stillNeeded = Math.max(0, inv.minTeamSize - inv.acceptedCount)
          return (
            <li key={inv.membershipId} className="rounded-xl border border-[var(--border)] bg-[var(--bg-sunken)] p-4">
              <p className="text-sm text-[#d1c2c0]">
                <span className="font-bold text-white">@{inv.invitedByUsername}</span> invited you to join{' '}
                <span className="font-bold text-white">{inv.teamName}</span> for{' '}
                <Link href={`/events/${inv.eventId}`} className="font-bold text-[var(--accent)] hover:underline">
                  {inv.eventTitle}
                </Link>
              </p>

              <p className="mt-1.5 text-xs text-[var(--text-faint)]">
                {inv.acceptedCount} confirmed
                {stillNeeded > 0 ? ` · ${stillNeeded} more needed to lock the team in` : ' · team is already confirmed'}
                {' · '}
                {new Date(inv.eventStartsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </p>

              {inv.registrationOpen ? (
                <div className="mt-3 flex gap-2.5">
                  <button
                    disabled={pending}
                    onClick={() => respond(inv.membershipId, true)}
                    className="btn btn-primary !px-3.5 !py-2 !text-xs"
                  >
                    {busy === inv.membershipId ? 'Working…' : 'Accept'}
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => respond(inv.membershipId, false)}
                    className="btn btn-danger !px-3.5 !py-2 !text-xs"
                  >
                    Decline
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-[var(--text-faint)]">
                  Registration for this event has closed.
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
