'use client'

import { useState, useTransition } from 'react'

type Member = { id: string; status: string; username: string; fullName: string }
type Team = { id: string; name: string; members: Member[] }

export default function TeamRow({
  team,
  eventId,
  renameTeam,
  removeTeam,
  addTeamMember,
  removeTeamMember,
}: {
  team: Team
  eventId: string
  renameTeam: (teamId: string, newName: string) => Promise<void>
  removeTeam: (teamId: string, eventId: string) => Promise<void>
  addTeamMember: (teamId: string, eventId: string, username: string) => Promise<void>
  removeTeamMember: (memberId: string, eventId: string) => Promise<void>
}) {
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(team.name)
  const [newUsername, setNewUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (fn: () => Promise<void>) => {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <div className="bg-[#1D1716] p-5 rounded-2xl border border-white/5">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="p-2 rounded-lg border border-white/10 bg-black/30 text-sm text-[#F3E9E8] outline-none focus:border-[#E87A8C]"
            />
            <button
              className="text-xs font-bold text-[#E87A8C]"
              disabled={pending}
              onClick={() => run(async () => { await renameTeam(team.id, name); setEditingName(false) })}
            >
              Save
            </button>
            <button className="text-xs text-[#8C7A77]" onClick={() => { setEditingName(false); setName(team.name) }}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white">{team.name}</h3>
            <button className="text-xs text-[#A68F8C] hover:text-white" onClick={() => setEditingName(true)}>
              rename
            </button>
          </div>
        )}

        <button
          className="text-red-400 hover:text-red-300 text-sm disabled:opacity-50"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Remove the team "${team.name}" and its whole roster?`)) return
            run(() => removeTeam(team.id, eventId))
          }}
        >
          Remove team
        </button>
      </div>

      <ul className="flex flex-col gap-1.5 mb-3">
        {team.members.map((m) => (
          <li key={m.id} className="flex items-center justify-between text-sm">
            <span className="text-[#D1C2C0]">
              @{m.username} {m.fullName && <span className="text-[#8C7A77]">— {m.fullName}</span>}{' '}
              <span
                className={
                  m.status === 'accepted' ? 'text-[#7AE8A2]' : m.status === 'declined' ? 'text-red-400' : 'text-[#E8C87A]'
                }
              >
                ({m.status})
              </span>
            </span>
            <button
              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
              disabled={pending}
              onClick={() => run(() => removeTeamMember(m.id, eventId))}
            >
              remove
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      <div className="flex items-center gap-2">
        <input
          placeholder="username"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          className="p-2 rounded-lg border border-white/10 bg-black/30 text-sm text-[#F3E9E8] outline-none focus:border-[#E87A8C]"
        />
        <button
          className="text-xs font-bold text-[#E87A8C] disabled:opacity-50"
          disabled={pending || !newUsername.trim()}
          onClick={() => run(async () => { await addTeamMember(team.id, eventId, newUsername); setNewUsername('') })}
        >
          + Add member directly
        </button>
      </div>
    </div>
  )
}
