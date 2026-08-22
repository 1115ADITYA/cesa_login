import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import SiteNav from '@/components/SiteNav'
import EventCard from './EventCard'
import { eventPhase, registrationDeadline, type EventRow, type MyRegistration } from '@/lib/events'

export const metadata = { title: 'Events — CESA' }
export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [{ data: events }, { data: regs }] = await Promise.all([
    supabase.from('events').select('*').order('starts_at', { ascending: true }),
    supabase.rpc('get_my_registrations'),
  ])

  const all = (events ?? []) as EventRow[]
  const byEvent = new Map<string, MyRegistration>()
  for (const r of (regs ?? []) as MyRegistration[]) byEvent.set(r.event_id, r)

  // Server Component: this renders once per request, so reading the clock here
  // carries none of the hydration/concurrent-render risk the purity rule
  // guards against on the client.
  // eslint-disable-next-line react-hooks/purity -- Server Component, computed once per request; see above
  const now = Date.now()

  const mine = all.filter((e) => byEvent.has(e.id))
  const live = all.filter((e) => eventPhase(e, now) === 'live' && !byEvent.has(e.id))
  const open = all.filter(
    (e) => eventPhase(e, now) === 'upcoming' && registrationDeadline(e).getTime() > now && !byEvent.has(e.id),
  )
  const closed = all.filter(
    (e) => eventPhase(e, now) === 'upcoming' && registrationDeadline(e).getTime() <= now && !byEvent.has(e.id),
  )
  const past = all.filter((e) => eventPhase(e, now) === 'past' && !byEvent.has(e.id))

  const pendingInvites = [...byEvent.values()].filter((r) => r.my_status === 'invited').length

  return (
    <div className="min-h-screen px-6 sm:px-8">
      <SiteNav active="events" />

      <div className="mx-auto max-w-5xl pb-16">
        <div className="mb-10">
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-4xl font-bold tracking-tight text-[var(--text-bright)]">
            Events
          </h1>
          <p className="mt-2 text-[var(--text-muted)]">
            Register, build your team, and track everything you have joined.
          </p>

          {pendingInvites > 0 && (
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--warning)]/25 bg-[var(--warning)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--warning)] transition-colors hover:bg-[var(--warning)]/15"
            >
              {pendingInvites} team invitation{pendingInvites === 1 ? '' : 's'} waiting for your answer →
            </Link>
          )}
        </div>

        {all.length === 0 && (
          <div className="card p-10 text-center">
            <p className="font-semibold text-white">No events published yet</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Check back soon — new CESA events are posted here through the year.
            </p>
          </div>
        )}

        <Section title="Your events" events={mine} regs={byEvent} now={now} />
        <Section title="Happening now" events={live} regs={byEvent} now={now} />
        <Section title="Open for registration" events={open} regs={byEvent} now={now} />
        <Section title="Registration closed" events={closed} regs={byEvent} now={now} />
        <Section title="Past events" events={past} regs={byEvent} now={now} />
      </div>
    </div>
  )
}

function Section({
  title,
  events,
  regs,
  now,
}: {
  title: string
  events: EventRow[]
  regs: Map<string, MyRegistration>
  now: number
}) {
  if (events.length === 0) return null

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="eyebrow">{title}</h2>
        <span className="text-xs font-bold text-[var(--text-faint)]">{events.length}</span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {events.map((e) => (
          <EventCard key={e.id} event={e} registration={regs.get(e.id) ?? null} now={now} />
        ))}
      </div>
    </section>
  )
}
