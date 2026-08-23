'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { inviteToTeam, searchUsernames } from '../actions'

type Suggestion = { username: string; full_name: string | null; avatar_url: string | null; unavailable: boolean }

/**
 * The invite button and its typeahead. Usernames are exact-match on the server,
 * so guessing a friend's handle from memory was the single most common way to
 * hit "No CESA account with that username" — the suggestion list removes the
 * guessing.
 */
export default function InviteBox({
  teamId,
  eventId,
  seatsLeft,
  onDone,
}: {
  teamId: string
  eventId: string
  seatsLeft: number | null
  onDone: () => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ query: string; results: Suggestion[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const q = query.trim().replace(/^@/, '')

  useEffect(() => {
    if (q.length < 2) return

    let live = true
    const timer = setTimeout(async () => {
      const results = await searchUsernames(q, eventId)
      // Tagged with the query they answer, so a slow response for "ad" cannot
      // overwrite a newer list for "adit".
      if (live) setSuggestions({ query: q, results })
    }, 250)

    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [q, eventId])

  // Derived rather than cleared in the effect: below the threshold, or while a
  // newer query is still in flight, the stale list simply is not shown.
  const visible = suggestions && suggestions.query === q ? suggestions.results : []

  const invite = (username: string) => {
    const handle = username.trim().replace(/^@/, '')
    if (!handle) return
    setError(null)
    startTransition(async () => {
      const result = await inviteToTeam(teamId, eventId, handle)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setSent(handle)
      setQuery('')
      setSuggestions(null)
      router.refresh()
    })
  }

  const full = seatsLeft !== null && seatsLeft <= 0

  return (
    <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-sunken)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Invite a friend</h3>
        <button onClick={onDone} className="text-xs font-semibold text-[var(--text-faint)] hover:text-white">
          Close
        </button>
      </div>

      {full ? (
        <p className="text-sm text-[var(--text-muted)]">
          Every seat is taken or has a pending invite. Withdraw an invite below to free one up.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]">@</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setError(null)
                  setSent(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    invite(query)
                  }
                }}
                placeholder="their username"
                autoComplete="off"
                className="field !pl-7"
              />
            </div>
            <button onClick={() => invite(query)} disabled={pending || query.trim().length < 2} className="btn btn-primary">
              {pending ? 'Sending…' : 'Send invite'}
            </button>
          </div>

          {visible.length > 0 && (
            <ul className="mt-2 flex flex-col overflow-hidden rounded-xl border border-[var(--border)]">
              {visible.map((s) => (
                <li key={s.username}>
                  <button
                    disabled={pending || s.unavailable}
                    onClick={() => invite(s.username)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <Avatar username={s.username} url={s.avatar_url} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">@{s.username}</span>
                      {s.full_name && (
                        <span className="block truncate text-xs text-[var(--text-faint)]">{s.full_name}</span>
                      )}
                    </span>
                    {s.unavailable && (
                      <span className="pill shrink-0 bg-white/5 text-[var(--text-faint)]">Already on a team</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {q.length >= 2 && suggestions?.query === q && visible.length === 0 && !error && !sent && (
            <p className="mt-2 text-xs text-[var(--text-faint)]">
              No matching username yet — they need a CESA account before they can be invited.
            </p>
          )}
        </>
      )}

      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
      {sent && <p className="mt-3 text-sm text-[var(--success)]">Invite sent to @{sent}.</p>}
    </div>
  )
}

function Avatar({ username, url }: { username: string; url: string | null }) {
  if (url) {
    // Arbitrary avatar hosts (Google, Supabase storage) — see EventCard.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-deep)] to-[var(--accent)] text-sm font-bold text-white">
      {username.charAt(0).toUpperCase()}
    </span>
  )
}
