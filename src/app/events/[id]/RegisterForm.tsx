'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { registerForEvent } from '../actions'

export default function RegisterForm({ eventId, maxTeamSize }: { eventId: string; maxTeamSize: number | null }) {
  const router = useRouter()
  const [teamName, setTeamName] = useState('')
  const [invites, setInvites] = useState<string[]>([''])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const inviteCap = maxTeamSize ? maxTeamSize - 1 : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const usernames = invites.map((u) => u.trim()).filter(Boolean)
      const result = await registerForEvent(eventId, teamName, usernames)
      if (result?.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="bg-[#1D1716] p-6 rounded-2xl border border-white/5 flex flex-col gap-4">
      <h2 className="font-bold text-white">Register your team</h2>
      {error && <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20">{error}</div>}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-[#8C7A77] uppercase tracking-wider">Team name</label>
        <input
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          required
          minLength={2}
          className="p-3 rounded-xl border border-white/5 bg-black/30 text-sm outline-none focus:border-[#E87A8C]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-[#8C7A77] uppercase tracking-wider">
          Invite friends by username {maxTeamSize ? `(up to ${inviteCap} more — max team size ${maxTeamSize})` : '(optional)'}
        </label>
        {invites.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[#8C7A77]">@</span>
            <input
              value={v}
              onChange={(e) => setInvites((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
              placeholder="friend_username"
              className="flex-1 p-2.5 rounded-xl border border-white/5 bg-black/30 text-sm outline-none focus:border-[#E87A8C]"
            />
            {invites.length > 1 && (
              <button
                type="button"
                onClick={() => setInvites((prev) => prev.filter((_, j) => j !== i))}
                className="text-[#8C7A77] hover:text-red-400 text-sm"
              >
                remove
              </button>
            )}
          </div>
        ))}
        {(inviteCap === null || invites.length < inviteCap) && (
          <button
            type="button"
            onClick={() => setInvites((prev) => [...prev, ''])}
            className="text-xs font-bold text-[#E87A8C] self-start mt-1"
          >
            + Add another
          </button>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 bg-gradient-to-r from-[#D16475] to-[#E87A8C] text-white font-bold py-3 rounded-xl disabled:opacity-50"
      >
        {pending ? 'Registering…' : 'Register'}
      </button>
    </form>
  )
}
