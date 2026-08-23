import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getClient, getUser } from '@/utils/supabase/server'
import RegisterForm from './RegisterForm'
import TeamPanel from './TeamPanel'
import {
  eventPhase,
  formatDateRange,
  registrationDeadline,
  teamSizeLabel,
  timeUntil,
  type EventRow,
  type EventTeam,
} from '@/lib/events'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getClient()
  const { data } = await supabase.from('events').select('title').eq('id', id).maybeSingle()
  return { title: data ? `${data.title} — CESA` : 'Event — CESA' }
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [supabase, user] = await Promise.all([getClient(), getUser()])
  if (!user) redirect('/')

  const [{ data: eventRow }, { data: teamJson }] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).maybeSingle(),
    // Membership-based, not "did I create it" — joining a friend's team used to
    // leave you looking unregistered, with the register form still offered.
    supabase.rpc('get_event_team', { p_event_id: id }),
  ])

  if (!eventRow) notFound()
  const event = eventRow as EventRow
  const team = (teamJson ?? null) as EventTeam | null

  // eslint-disable-next-line react-hooks/purity -- Server Component, computed once per request
  const now = Date.now()
  const phase = eventPhase(event, now)
  const deadline = registrationDeadline(event)
  const closesIn = timeUntil(deadline, now)
  const registrationOpen = deadline.getTime() > now

  return (
    <>
      <div className="mx-auto max-w-3xl">
        <Link href="/events" className="text-sm text-[var(--text-muted)] transition-colors hover:text-white">
          ← All events
        </Link>

        {event.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.banner_url} alt="" className="mt-4 h-48 w-full rounded-2xl object-cover" />
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {phase === 'live' && (
            <span className="pill bg-[var(--success)]/12 text-[var(--success)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              Happening now
            </span>
          )}
          {phase === 'past' && <span className="pill bg-white/5 text-[var(--text-faint)]">Ended</span>}
          <span className="pill bg-white/5 text-[var(--text-muted)]">
            {teamSizeLabel(event.min_team_size, event.max_team_size)}
          </span>
          {registrationOpen && closesIn && (
            <span className="pill bg-[var(--accent)]/12 text-[var(--accent)]">Registration closes in {closesIn}</span>
          )}
          {!registrationOpen && phase !== 'past' && (
            <span className="pill bg-white/5 text-[var(--text-faint)]">Registration closed</span>
          )}
        </div>

        <h1 className="on-art mt-3 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold tracking-tight text-[var(--text-bright)] sm:text-4xl">
          {event.title}
        </h1>

        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <Meta label="When" value={formatDateRange(event.starts_at, event.ends_at)} />
          <Meta label="Where" value={event.location || 'To be announced'} />
          <Meta
            label="Registration closes"
            value={deadline.toLocaleString(undefined, {
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
          />
        </dl>

        {event.description && (
          <div className="mt-8">
            <h2 className="eyebrow mb-2">About</h2>
            <p className="on-art whitespace-pre-wrap leading-relaxed text-[var(--text)]">{event.description}</p>
          </div>
        )}

        <div className="mt-10">
          {team ? (
            <TeamPanel
              eventId={id}
              team={team}
              minTeamSize={event.min_team_size}
              maxTeamSize={event.max_team_size}
              registrationOpen={registrationOpen}
              eventStarted={phase !== 'upcoming'}
            />
          ) : registrationOpen ? (
            <RegisterForm
              eventId={id}
              minTeamSize={event.min_team_size}
              maxTeamSize={event.max_team_size}
            />
          ) : (
            <div className="glass p-6 text-center">
              <p className="font-semibold text-white">Registration is closed</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {phase === 'past'
                  ? 'This event has already finished.'
                  : 'The deadline for this event has passed.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass p-4">
      <dt className="label">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--text)]">{value}</dd>
    </div>
  )
}
