'use client'

import { useEffect, useState, useTransition } from 'react'

type Member = {
  id: string
  status: string
  isLeader: boolean
  username: string
  fullName: string
  department: string | null
  yearOfStudy: string | null
  division: string | null
  rollNo: string | null
  contact: string | null
}
type Team = { id: string; name: string; leaderId: string; members: Member[] }
type Suggestion = { username: string; fullName: string; onATeam: boolean }

export default function TeamRow({
  team,
  eventId,
  minTeamSize,
  maxTeamSize,
  renameTeam,
  removeTeam,
  addTeamMember,
  removeTeamMember,
  makeTeamLeader,
  searchProfiles,
}: {
  team: Team
  eventId: string
  minTeamSize: number
  maxTeamSize: number | null
  renameTeam: (teamId: string, newName: string) => Promise<void>
  removeTeam: (teamId: string, eventId: string) => Promise<void>
  addTeamMember: (teamId: string, eventId: string, username: string) => Promise<void>
  removeTeamMember: (memberId: string, eventId: string) => Promise<void>
  makeTeamLeader: (memberId: string, eventId: string) => Promise<void>
  searchProfiles: (query: string, eventId: string) => Promise<Suggestion[]>
}) {
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(team.name)
  const [newUsername, setNewUsername] = useState('')
  const [suggestions, setSuggestions] = useState<{ query: string; results: Suggestion[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [pending, startTransition] = useTransition()

  const accepted = team.members.filter((m) => m.status === 'accepted').length
  const invited = team.members.filter((m) => m.status === 'invited').length
  const confirmed = accepted >= minTeamSize
  const leader = team.members.find((m) => m.isLeader)

  const q = newUsername.trim().replace(/^@/, '')

  useEffect(() => {
    if (q.length < 2) return
    let live = true
    const timer = setTimeout(async () => {
      const results = await searchProfiles(q, eventId)
      // Tagged with the query it answers, so a slow reply for an earlier
      // keystroke cannot replace a newer list.
      if (live) setSuggestions({ query: q, results })
    }, 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [q, eventId, searchProfiles])

  // Derived rather than cleared inside the effect: below the threshold, or
  // while a newer query is in flight, the stale list simply is not shown.
  const visible = suggestions && suggestions.query === q ? suggestions.results : []

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

  const add = (username: string) => {
    const handle = username.trim().replace(/^@/, '')
    if (!handle) return
    run(async () => {
      await addTeamMember(team.id, eventId, handle)
      setNewUsername('')
      setSuggestions(null)
    })
  }

  return (
    <div className="glass p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        {editingName ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field max-w-xs"
              aria-label="Team name"
            />
            <button
              className="btn btn-primary !px-3 !py-2 !text-xs"
              disabled={pending}
              onClick={() => run(async () => { await renameTeam(team.id, name); setEditingName(false) })}
            >
              Save
            </button>
            <button
              className="btn btn-ghost !px-3 !py-2 !text-xs"
              onClick={() => { setEditingName(false); setName(team.name) }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="heading text-lg">{team.name}</h3>
              {confirmed ? (
                <span className="pill bg-[var(--success)]/12 text-[var(--success)]">Confirmed</span>
              ) : (
                <span className="pill bg-[var(--warning)]/12 text-[var(--warning)]">
                  Forming — {minTeamSize - accepted} short
                </span>
              )}
              <button
                className="text-xs font-semibold text-[var(--text-faint)] transition-colors hover:text-white"
                onClick={() => setEditingName(true)}
              >
                rename
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--text-faint)]">
              Registered by{' '}
              <span className="font-semibold text-[var(--text-muted)]">
                {leader ? `@${leader.username}` : '(no longer on the roster)'}
              </span>{' '}
              · {accepted}
              {maxTeamSize ? `/${maxTeamSize}` : ''} accepted
              {invited > 0 && <span className="text-[var(--warning)]"> · {invited} awaiting reply</span>}
            </p>
          </div>
        )}

        {!editingName && (
          <button
            className="btn btn-danger !px-3 !py-2 !text-xs"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Remove the team "${team.name}" and its whole roster?`)) return
              run(() => removeTeam(team.id, eventId))
            }}
          >
            Remove team
          </button>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {team.members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${
                m.isLeader
                  ? 'bg-gradient-to-br from-[var(--warning)] to-[var(--accent-deep)]'
                  : 'bg-gradient-to-br from-[var(--accent-deep)] to-[var(--accent)]'
              }`}
            >
              {m.username.charAt(0).toUpperCase()}
            </span>

            <div className="min-w-0 flex-1">
              <button 
                onClick={() => setSelectedMember(m)}
                className="flex flex-wrap items-center gap-2 truncate text-sm font-semibold text-white hover:underline text-left"
              >
                @{m.username}
                {m.isLeader && (
                  <span className="pill bg-[var(--warning)]/12 text-[var(--warning)]">Leader</span>
                )}
              </button>
              {m.fullName && <p className="truncate text-xs text-[var(--text-faint)]">{m.fullName}</p>}
              {/* The details members enter once on their profile — here so an
                  organiser has the roster and contact list in one place. */}
              {(m.department || m.rollNo || m.contact) && (
                <p className="mt-0.5 truncate text-xs text-[var(--text-faint)]">
                  {[
                    m.department,
                    m.yearOfStudy,
                    m.division && `Div ${m.division}`,
                    m.rollNo && `Roll ${m.rollNo}`,
                    m.contact,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>

            <span
              className={`shrink-0 text-xs font-semibold ${
                m.status === 'accepted'
                  ? 'text-[var(--success)]'
                  : m.status === 'declined'
                    ? 'text-[var(--danger)]'
                    : 'text-[var(--warning)]'
              }`}
            >
              {m.status === 'accepted' ? 'Confirmed' : m.status === 'declined' ? 'Declined' : 'Awaiting reply'}
            </span>

            {!m.isLeader && m.status === 'accepted' && (
              <button
                className="shrink-0 text-xs font-semibold text-[var(--text-faint)] transition-colors hover:text-[var(--warning)] disabled:opacity-50"
                disabled={pending}
                onClick={() => run(() => makeTeamLeader(m.id, eventId))}
              >
                make leader
              </button>
            )}

            <button
              className="shrink-0 text-xs font-semibold text-[var(--text-faint)] transition-colors hover:text-white disabled:opacity-50"
              disabled={pending}
              onClick={() => setSelectedMember(m)}
            >
              view details
            </button>

            <button
              className="shrink-0 text-xs font-semibold text-[var(--text-faint)] transition-colors hover:text-[var(--danger)] disabled:opacity-50"
              disabled={pending}
              onClick={() => run(() => removeTeamMember(m.id, eventId))}
            >
              remove
            </button>
          </li>
        ))}
      </ul>

      {error && <div className="alert alert-error mt-3">{error}</div>}

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-[16rem]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]">@</span>
            <input
              placeholder="search a username"
              value={newUsername}
              onChange={(e) => { setNewUsername(e.target.value); setError(null) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add(newUsername)
                }
              }}
              autoComplete="off"
              className="field !pl-7"
              aria-label="Username to add"
            />
          </div>
          <button
            className="btn btn-ghost !px-3 !py-2 !text-xs"
            disabled={pending || q.length < 2}
            onClick={() => add(newUsername)}
          >
            + Add directly
          </button>
          <span className="text-xs text-[var(--text-faint)]">Skips the invite — added as already confirmed.</span>
        </div>

        {visible.length > 0 && (
          <ul className="mt-2 flex max-w-md flex-col overflow-hidden rounded-xl border border-[var(--border-strong)] bg-black/30">
            {visible.map((s) => (
              <li key={s.username}>
                <button
                  disabled={pending || s.onATeam}
                  onClick={() => add(s.username)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-deep)] to-[var(--accent)] text-xs font-bold text-white">
                    {s.username.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">@{s.username}</span>
                    {s.fullName && <span className="block truncate text-xs text-[var(--text-faint)]">{s.fullName}</span>}
                  </span>
                  {s.onATeam && (
                    <span className="pill shrink-0 bg-white/5 text-[var(--text-faint)]">Already on a team</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {q.length >= 2 && suggestions?.query === q && visible.length === 0 && !error && (
          <p className="mt-2 text-xs text-[var(--text-faint)]">No account matches “{q}”.</p>
        )}
      </div>

      {selectedMember && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" 
          onClick={() => setSelectedMember(null)}
        >
          <div className="glass w-full max-w-md p-6 relative border border-[var(--border-strong)] shadow-2xl" onClick={e => e.stopPropagation()}>
            <button 
              className="absolute top-4 right-4 text-[var(--text-faint)] hover:text-white transition-colors" 
              onClick={() => setSelectedMember(null)}
            >
              ✕
            </button>
            <h3 className="text-xl font-bold text-white mb-6">Member Details</h3>
            <div className="space-y-4">
              <div>
                <span className="block text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Username</span>
                <span className="text-white text-sm font-medium">@{selectedMember.username}</span>
              </div>
              {selectedMember.fullName && (
                <div>
                  <span className="block text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Full Name</span>
                  <span className="text-white text-sm font-medium">{selectedMember.fullName}</span>
                </div>
              )}
              {selectedMember.department && (
                <div>
                  <span className="block text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Department</span>
                  <span className="text-white text-sm font-medium">{selectedMember.department}</span>
                </div>
              )}
              {selectedMember.yearOfStudy && (
                <div>
                  <span className="block text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Year of Study</span>
                  <span className="text-white text-sm font-medium">{selectedMember.yearOfStudy}</span>
                </div>
              )}
              {selectedMember.division && (
                <div>
                  <span className="block text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Division</span>
                  <span className="text-white text-sm font-medium">{selectedMember.division}</span>
                </div>
              )}
              {selectedMember.rollNo && (
                <div>
                  <span className="block text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Roll No</span>
                  <span className="text-white text-sm font-medium">{selectedMember.rollNo}</span>
                </div>
              )}
              {selectedMember.contact && (
                <div>
                  <span className="block text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Contact</span>
                  <span className="text-white text-sm font-medium">{selectedMember.contact}</span>
                </div>
              )}
            </div>
            
            <div className="mt-8 flex justify-end">
              <button className="btn btn-ghost" onClick={() => setSelectedMember(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
