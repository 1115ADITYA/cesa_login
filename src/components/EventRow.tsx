import Link from 'next/link'
import JoinNowButton from '@/components/JoinNowButton'
import {
  eventPhase,
  eventTitle,
  eventWhen,
  joinLink,
  registrationDeadline,
  teamSizeLabel,
  teamState,
  timeUntil,
  type EventRow as EventRecord,
  type MyRegistration,
} from '@/lib/events'

/**
 * The wide, full-bleed list item used wherever events are stacked rather than
 * gridded — the "All events" band on the home page and the events board.
 */
export default function EventRow({
  event,
  registration,
  now,
}: {
  event: EventRecord
  registration: MyRegistration | null
  now: number
}) {
  const phase = eventPhase(event, now)
  const deadline = registrationDeadline(event)
  const closesIn = timeUntil(deadline, now)
  const start = event.starts_at ? new Date(event.starts_at) : null
  const join = phase !== 'past' ? joinLink(event) : null

  return (
    // Stretched link, not a wrapping <Link> — see EventCard.
    <div
      className="group relative flex items-stretch gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-sunken)] p-3.5 transition-all hover:border-[var(--accent)]/35 hover:bg-black/40 sm:gap-5 sm:p-4"
    >
      {/* Always the date, never the banner. Rows are the dense, scannable
          view — grouped by phase, read top to bottom — and a date is what
          someone is actually scanning for there. The artwork gets its space
          on the cards and the event page instead. */}
      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-b from-[#D16475]/18 to-[#E87A8C]/6 py-3 sm:w-[4.5rem]">
        {start ? (
          <>
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--accent-light)]">
              {start.toLocaleDateString(undefined, { month: 'short' })}
            </span>
            <span className="heading text-2xl leading-none">{start.getDate()}</span>
          </>
        ) : (
          <span className="heading text-lg leading-none">TBA</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-bold text-white group-hover:text-[var(--accent-light)]">
            <Link href={`/events/${event.id}`} className="before:absolute before:inset-0">
              {eventTitle(event)}
            </Link>
          </h3>
          <Badge phase={phase} registration={registration} />
        </div>

        {event.description && (
          <p className="mt-1 line-clamp-1 text-sm text-[var(--text-muted)]">{event.description}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--text-faint)]">
          <span>{eventWhen(event)}</span>
          {event.location && <span>· {event.location}</span>}
          <span>· {teamSizeLabel(event.min_team_size, event.max_team_size)}</span>
        </div>
        {/* The right-hand column is hidden on phones, so the button moves here. */}
        {join && <JoinNowButton href={join} className="mt-2.5 !px-3 !py-1.5 !text-xs sm:hidden" />}
      </div>

      <div className="hidden shrink-0 flex-col items-end justify-center gap-1.5 text-right sm:flex">
        {registration ? (
          <span className="text-xs text-[var(--text-muted)]">
            <span className="font-bold text-[var(--text-bright)]">{registration.accepted_count}</span>
            {registration.max_team_size ? `/${registration.max_team_size}` : ''} confirmed
          </span>
        ) : phase === 'upcoming' && closesIn ? (
          <span className="text-xs font-semibold text-[var(--accent)]">Closes in {closesIn}</span>
        ) : null}
        {join && <JoinNowButton href={join} className="!px-3 !py-1.5 !text-xs" />}
        <span className="text-xs font-bold text-[var(--text-faint)] transition-colors group-hover:text-white">
          View →
        </span>
      </div>
    </div>
  )
}

function Badge({ phase, registration }: { phase: 'upcoming' | 'live' | 'past'; registration: MyRegistration | null }) {
  if (registration) {
    const state = teamState(registration)
    if (state === 'invited') return <span className="pill bg-[var(--warning)]/12 text-[var(--warning)]">Invited</span>
    if (state === 'confirmed') return <span className="pill bg-[var(--success)]/12 text-[var(--success)]">Confirmed</span>
    return <span className="pill bg-[var(--accent)]/12 text-[var(--accent)]">Forming</span>
  }
  if (phase === 'live') {
    return (
      <span className="pill bg-[var(--success)]/12 text-[var(--success)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
        Live
      </span>
    )
  }
  if (phase === 'past') return <span className="pill bg-white/5 text-[var(--text-faint)]">Ended</span>
  return null
}
