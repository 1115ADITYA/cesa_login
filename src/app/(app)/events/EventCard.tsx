import Link from 'next/link'
import JoinNowButton from '@/components/JoinNowButton'
import TeamProgress from '@/components/TeamProgress'
import {
  eventPhase,
  eventTitle,
  eventWhen,
  joinLink,
  registrationDeadline,
  teamSizeLabel,
  teamState,
  timeUntil,
  type EventRow,
  type MyRegistration,
} from '@/lib/events'

export default function EventCard({
  event,
  registration,
  now,
}: {
  event: EventRow
  registration: MyRegistration | null
  now: number
}) {
  const phase = eventPhase(event, now)
  const deadline = registrationDeadline(event)
  const closesIn = timeUntil(deadline, now)
  const join = phase !== 'past' ? joinLink(event) : null

  return (
    // A div with a stretched link rather than one big <Link>: the Join Now
    // button is an <a> too, and an anchor inside an anchor is invalid HTML.
    <div className="glass card-hover relative flex flex-col overflow-hidden">
      {event.banner_url && (
        // Admin-supplied URLs from arbitrary hosts, so plain <img> rather than
        // next/image — which would need every host allow-listed up front.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.banner_url}
          alt=""
          style={{ objectPosition: event.banner_position ?? '50% 50%' }}
          className="h-32 w-full object-cover"
        />
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold leading-snug text-white">
            <Link href={`/events/${event.id}`} className="before:absolute before:inset-0">
              {eventTitle(event)}
            </Link>
          </h3>
          <StatusPill phase={phase} registration={registration} />
        </div>

        {event.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-[var(--text-muted)]">{event.description}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-faint)]">
          <span>{eventWhen(event)}</span>
          {event.location && <span>· {event.location}</span>}
          <span>· {teamSizeLabel(event.min_team_size, event.max_team_size)}</span>
        </div>

        {registration ? (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <p className="mb-2 text-xs text-[var(--text-muted)]">
              Team <span className="font-bold text-[var(--text-bright)]">{registration.team_name}</span>
            </p>
            <TeamProgress
              accepted={registration.accepted_count}
              pending={registration.pending_count}
              min={registration.min_team_size}
              max={registration.max_team_size}
            />
          </div>
        ) : (
          phase === 'upcoming' && (
            <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs font-semibold">
              {closesIn ? (
                <span className="text-[var(--accent)]">Registration closes in {closesIn}</span>
              ) : !deadline ? (
                <span className="text-[var(--accent)]">Registration open</span>
              ) : (
                <span className="text-[var(--text-faint)]">Registration closed</span>
              )}
            </p>
          )
        )}

        {join && <JoinNowButton href={join} className="mt-4 w-full !py-2.5" />}
      </div>
    </div>
  )
}

function StatusPill({ phase, registration }: { phase: 'upcoming' | 'live' | 'past'; registration: MyRegistration | null }) {
  if (registration) {
    const state = teamState(registration)
    if (state === 'invited') {
      return <span className="pill shrink-0 bg-[var(--warning)]/12 text-[var(--warning)]">Invited</span>
    }
    if (state === 'confirmed') {
      return <span className="pill shrink-0 bg-[var(--success)]/12 text-[var(--success)]">Confirmed</span>
    }
    return <span className="pill shrink-0 bg-[var(--accent)]/12 text-[var(--accent)]">Forming team</span>
  }

  if (phase === 'live') {
    return (
      <span className="pill shrink-0 bg-[var(--success)]/12 text-[var(--success)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
        Live
      </span>
    )
  }
  if (phase === 'past') {
    return <span className="pill shrink-0 bg-white/5 text-[var(--text-faint)]">Ended</span>
  }
  return null
}
