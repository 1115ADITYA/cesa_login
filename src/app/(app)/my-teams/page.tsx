import Link from 'next/link'
import { EmptyState } from '@/components/AppShell'
import TeamProgress from '@/components/TeamProgress'
import { loadEventBoard } from '@/lib/eventData'
import { teamSizeLabel } from '@/lib/events'

export const metadata = { title: 'Your teams — CESA' }
export const dynamic = 'force-dynamic'

export default async function MyTeamsPage() {
  const { registrations, all } = await loadEventBoard()
  const eventById = new Map(all.map((e) => [e.id, e]))

  const teams = registrations.filter((r) => r.my_status === 'accepted')
  const confirmed = teams.filter((r) => r.confirmed).length

  return (
    <>
      <div className="mb-7">
        <h1 className="heading on-art text-3xl sm:text-4xl">Your teams</h1>
        <p className="on-art mt-2 text-[var(--text)]">
          {teams.length === 0
            ? 'Teams you lead or belong to will be listed here.'
            : `${teams.length} team${teams.length === 1 ? '' : 's'} · ${confirmed} confirmed`}
        </p>
      </div>

      {teams.length === 0 ? (
        <EmptyState
          title="You are not on a team yet"
          body="Register for an event to start a team, or accept an invitation from a friend."
        >
          <Link href="/events" className="btn btn-primary">
            Find an event
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((r) => {
            const event = eventById.get(r.event_id)
            const short = Math.max(0, r.min_team_size - r.accepted_count)
            return (
              <Link
                key={r.team_id}
                href={`/events/${r.event_id}`}
                className="glass card-hover flex flex-col p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow">{event?.title ?? 'Event'}</p>
                    <h2 className="heading mt-1 truncate text-xl">{r.team_name}</h2>
                  </div>
                  {r.confirmed ? (
                    <span className="pill shrink-0 bg-[var(--success)]/12 text-[var(--success)]">Confirmed</span>
                  ) : (
                    <span className="pill shrink-0 bg-[var(--accent)]/12 text-[var(--accent)]">{short} short</span>
                  )}
                </div>

                <div className="mt-4">
                  <TeamProgress
                    accepted={r.accepted_count}
                    pending={r.pending_count}
                    min={r.min_team_size}
                    max={r.max_team_size}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-faint)]">
                  <span>{r.is_leader ? 'You lead this team' : 'Member'}</span>
                  <span>· {teamSizeLabel(r.min_team_size, r.max_team_size)}</span>
                  <span className="ml-auto font-bold text-[var(--accent)]">
                    {r.is_leader ? 'Manage roster →' : 'View team →'}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
