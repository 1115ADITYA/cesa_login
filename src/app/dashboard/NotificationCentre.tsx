'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { respondToInvite } from '../events/actions'

export type Invite = {
  membershipId: string
  eventId: string
  eventTitle: string
  teamName: string
  invitedByUsername: string
}

export default function NotificationCentre({ invites }: { invites: Invite[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const respond = (membershipId: string, accept: boolean) => {
    startTransition(async () => {
      await respondToInvite(membershipId, accept)
      router.refresh()
    })
  }

  if (invites.length === 0) {
    return <p className="text-[#A68F8C] text-sm">No pending invitations.</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {invites.map((inv) => (
        <li key={inv.membershipId} className="bg-black/20 border border-white/5 rounded-xl p-4">
          <p className="text-sm text-[#D1C2C0]">
            <span className="font-bold text-white">@{inv.invitedByUsername}</span> invited you to join{' '}
            <span className="font-bold text-white">{inv.teamName}</span> for{' '}
            <span className="font-bold text-white">{inv.eventTitle}</span>
          </p>
          <div className="flex gap-3 mt-3">
            <button
              disabled={pending}
              onClick={() => respond(inv.membershipId, true)}
              className="text-xs font-bold text-[#7AE8A2] bg-[#7AE8A2]/10 px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              Accept
            </button>
            <button
              disabled={pending}
              onClick={() => respond(inv.membershipId, false)}
              className="text-xs font-bold text-red-400 bg-red-400/10 px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
