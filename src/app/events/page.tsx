import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import EventCard from './EventCard'

export const metadata = { title: 'Events — CESA' }
export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: events } = await supabase.from('events').select('*').order('starts_at', { ascending: true })

  // RLS limits this to teams the signed-in user created or belongs to, so no
  // extra filtering by user id is needed — see event_teams_read_own in the
  // migration.
  const { data: myTeams } = await supabase
    .from('event_teams')
    .select('event_id, name, event_team_members!inner(status, user_id)')
    .eq('event_team_members.user_id', user.id)

  const myStatusByEvent = new Map<string, string>()
  for (const t of myTeams ?? []) {
    const status = (t.event_team_members as unknown as { status: string }[])[0]?.status
    if (status) myStatusByEvent.set(t.event_id, status)
  }

  // This is a Server Component: it renders once per request rather than being
  // re-rendered by React on the client, so there is no hydration mismatch or
  // concurrent-render risk from reading the clock here — the purity rule is
  // guarding against a client-render concern that does not apply server-side.
  // eslint-disable-next-line react-hooks/purity -- Server Component, computed once per request; see above
  const now = Date.now()
  const all = events ?? []
  const upcoming = all.filter((e) => new Date(e.starts_at).getTime() > now)
  const ongoing = all.filter((e) => new Date(e.starts_at).getTime() <= now && new Date(e.ends_at).getTime() >= now)
  const joined = all.filter((e) => myStatusByEvent.get(e.id) === 'accepted')

  return (
    <div className="min-h-screen bg-[#130F0E] text-[#F3E9E8] p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)]">Events</h1>
          <Link href="/dashboard" className="text-sm text-[#A68F8C] hover:text-white">
            ← Dashboard
          </Link>
        </div>

        <Section title="Happening now" events={ongoing} myStatusByEvent={myStatusByEvent} empty="Nothing is running right now." />
        <Section title="Upcoming" events={upcoming} myStatusByEvent={myStatusByEvent} empty="No upcoming events yet — check back soon." />
        <Section title="Your events" events={joined} myStatusByEvent={myStatusByEvent} empty="You haven't joined an event yet." />
      </div>
    </div>
  )
}

function Section({
  title,
  events,
  myStatusByEvent,
  empty,
}: {
  title: string
  events: { id: string; title: string; description: string; starts_at: string; ends_at: string; location: string | null }[]
  myStatusByEvent: Map<string, string>
  empty: string
}) {
  return (
    <section className="mb-10">
      <h2 className="text-sm font-bold uppercase tracking-wider text-[#8C7A77] mb-3">{title}</h2>
      {events.length === 0 ? (
        <p className="text-[#A68F8C] text-sm">{empty}</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {events.map((e) => (
            <EventCard key={e.id} event={e} status={myStatusByEvent.get(e.id) ?? null} />
          ))}
        </div>
      )}
    </section>
  )
}
