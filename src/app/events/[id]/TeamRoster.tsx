'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { inviteToTeam } from '../actions'

type Member = { id: string; status: string; username: string }

export default function TeamRoster({ eventId, team }: { eventId: string; team: { id: string; name: string; members: Member[] } }) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const invite = () => {
    if (!username.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await inviteToTeam(team.id, eventId, username)
      if (result?.error) {
        setError(result.error)
        return
      }
      setUsername('')
      router.refresh()
    })
  }

  return (
    <div className="bg-[#1D1716] p-6 rounded-2xl border border-white/5">
      <h2 className="font-bold text-white mb-3">Your team — {team.name}</h2>
      <ul className="flex flex-col gap-1.5 mb-4">
        {team.members.map((m) => (
          <li key={m.id} className="text-sm text-[#D1C2C0]">
            @{m.username}{' '}
            <span
              className={
                m.status === 'accepted' ? 'text-[#7AE8A2]' : m.status === 'declined' ? 'text-red-400' : 'text-[#E8C87A]'
              }
            >
              ({m.status})
            </span>
          </li>
        ))}
      </ul>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      <div className="flex items-center gap-2">
        <span className="text-[#8C7A77]">@</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="invite another friend"
          className="flex-1 p-2.5 rounded-xl border border-white/5 bg-black/30 text-sm outline-none focus:border-[#E87A8C]"
        />
        <button
          onClick={invite}
          disabled={pending || !username.trim()}
          className="text-sm font-bold text-[#E87A8C] disabled:opacity-50"
        >
          Invite
        </button>
      </div>
    </div>
  )
}
