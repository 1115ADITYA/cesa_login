'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import TeamProgress from '@/components/TeamProgress'
import InviteBox from './InviteBox'
import { removeTeamMember, respondToInvite, withdrawRegistration } from '../actions'
import type { EventTeam, TeamMember } from '@/lib/events'

export default function TeamPanel({
  eventId,
  team,
  minTeamSize,
  maxTeamSize,
  registrationOpen,
  eventStarted,
}: {
  eventId: string
  team: EventTeam
  minTeamSize: number
  maxTeamSize: number | null
  registrationOpen: boolean
  eventStarted: boolean
}) {
  const router = useRouter()
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const me = team.members.find((m) => m.isMe)
  const accepted = team.members.filter((m) => m.status === 'accepted')
  const invited = team.members.filter((m) => m.status === 'invited')
  const declined = team.members.filter((m) => m.status === 'declined')
  const confirmed = accepted.length >= minTeamSize
  const seatsLeft = maxTeamSize === null ? null : maxTeamSize - (accepted.length + invited.length)

  const run = (fn: () => Promise<{ error: string } | { success: true }>) => {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  // Someone invited me into their team and I have not answered yet. Same
  // decision as the dashboard notification, offered where they landed.
  if (me?.status === 'invited') {
    const leader = team.members.find((m) => m.isLeader)
    return (
      <div className="glass p-6">
        <span className="pill mb-3 bg-[var(--warning)]/12 text-[var(--warning)]">Invitation pending</span>
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-white">
          @{leader?.username ?? 'Someone'} invited you to {team.name}
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {accepted.length} of {minTeamSize} needed members have confirmed so far.
        </p>

        {error && <div className="alert alert-error mt-4">{error}</div>}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            disabled={pending || !registrationOpen}
            onClick={() => run(() => respondToInvite(me.id, true))}
            className="btn btn-primary"
          >
            Accept & join team
          </button>
          <button
            disabled={pending}
            onClick={() => run(() => respondToInvite(me.id, false))}
            className="btn btn-ghost"
          >
            Decline
          </button>
        </div>

        {!registrationOpen && (
          <p className="mt-3 text-xs text-[var(--text-faint)]">Registration has closed, so this can no longer be accepted.</p>
        )}
      </div>
    )
  }

  return (
    <div className="glass p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="eyebrow mb-1">Your team</h2>
          <p className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-white">{team.name}</p>
        </div>
        {confirmed ? (
          <span className="pill bg-[var(--success)]/12 text-[var(--success)]">✓ Registration confirmed</span>
        ) : (
          <span className="pill bg-[var(--accent)]/12 text-[var(--accent)]">
            {minTeamSize - accepted.length} more to confirm
          </span>
        )}
      </div>

      <div className="mt-5">
        <TeamProgress
          accepted={accepted.length}
          pending={invited.length}
          min={minTeamSize}
          max={maxTeamSize}
        />
      </div>

      {!confirmed && (
        <p className="mt-3 rounded-xl border border-[var(--warning)]/20 bg-[var(--warning)]/8 p-3 text-sm text-[var(--warning)]">
          Your spot is held, but the entry is not final until {minTeamSize} members have accepted.
        </p>
      )}

      <ul className="mt-5 flex flex-col divide-y divide-[var(--border)]">
        {team.members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            canManage={team.isLeader && registrationOpen && !m.isMe}
            pending={pending}
            onRemove={() => run(() => removeTeamMember(m.id, eventId))}
          />
        ))}
      </ul>

      {declined.length > 0 && team.isLeader && (
        <p className="mt-3 text-xs text-[var(--text-faint)]">
          Declined invites do not take up a seat — you can invite someone else, or ask them again.
        </p>
      )}

      {error && <div className="alert alert-error mt-4">{error}</div>}

      <div className="mt-5 flex flex-col gap-4">
        {team.isLeader && registrationOpen && (
          inviting ? (
            <InviteBox teamId={team.id} eventId={eventId} seatsLeft={seatsLeft} onDone={() => setInviting(false)} />
          ) : (
            <button
              onClick={() => setInviting(true)}
              disabled={seatsLeft !== null && seatsLeft <= 0}
              className="btn btn-primary self-start"
            >
              + Invite a friend
              {seatsLeft !== null && (
                <span className="font-medium opacity-80">
                  {seatsLeft > 0 ? `${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left` : 'team full'}
                </span>
              )}
            </button>
          )
        )}

        {!registrationOpen && (
          <p className="text-sm text-[var(--text-faint)]">
            Registration has closed — the roster is now locked.
          </p>
        )}

        {!eventStarted && (
          <button
            disabled={pending}
            onClick={() => {
              const message = team.isLeader
                ? `Cancel the registration for "${team.name}"? This removes the whole team.`
                : `Leave "${team.name}"?`
              if (!confirm(message)) return
              run(() => withdrawRegistration(team.id, eventId))
            }}
            className="self-start text-sm font-semibold text-[var(--text-faint)] transition-colors hover:text-[var(--danger)] disabled:opacity-50"
          >
            {team.isLeader ? 'Cancel registration' : 'Leave this team'}
          </button>
        )}
      </div>
    </div>
  )
}

function MemberRow({
  member,
  canManage,
  pending,
  onRemove,
}: {
  member: TeamMember
  canManage: boolean
  pending: boolean
  onRemove: () => void
}) {
  const tone =
    member.status === 'accepted'
      ? 'text-[var(--success)]'
      : member.status === 'declined'
        ? 'text-[var(--danger)]'
        : 'text-[var(--warning)]'
  const statusLabel =
    member.status === 'accepted' ? 'Confirmed' : member.status === 'declined' ? 'Declined' : 'Awaiting reply'

  return (
    <li className="flex items-center gap-3 py-3">
      {member.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-deep)] to-[var(--accent)] text-sm font-bold text-white">
          {member.username.charAt(0).toUpperCase()}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          @{member.username}
          {member.isMe && <span className="ml-1.5 text-xs font-normal text-[var(--text-faint)]">you</span>}
          {member.isLeader && (
            <span className="ml-2 rounded bg-white/8 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Leader
            </span>
          )}
        </p>
        {member.fullName && <p className="truncate text-xs text-[var(--text-faint)]">{member.fullName}</p>}
      </div>

      <span className={`shrink-0 text-xs font-semibold ${tone}`}>{statusLabel}</span>

      {canManage && (
        <button
          disabled={pending}
          onClick={onRemove}
          className="shrink-0 text-xs font-semibold text-[var(--text-faint)] transition-colors hover:text-[var(--danger)] disabled:opacity-50"
          aria-label={`Remove @${member.username}`}
        >
          {member.status === 'invited' ? 'Withdraw' : 'Remove'}
        </button>
      )}
    </li>
  )
}
