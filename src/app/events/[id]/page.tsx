import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import RegisterForm from './RegisterForm'
import TeamRoster from './TeamRoster'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('events').select('title').eq('id', id).single()
  return { title: data ? `${data.title} — CESA` : 'Event — CESA' }
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: event } = await supabase.from('events').select('*').eq('id', id).single()
  if (!event) notFound()

  // RLS: this only returns a row if the signed-in user created the team or is
  // on its roster — so "no row" genuinely means "not registered yet."
  const { data: myTeam } = await supabase
    .from('event_teams')
    .select('id, name, created_by, event_team_members(id, status, user_id, profiles(username, full_name))')
    .eq('event_id', id)
    .eq('created_by', user.id)
    .maybeSingle()

  // Server Component — renders once per request, so reading the clock here
  // carries none of the hydration/concurrent-render risk this rule guards
  // against on the client.
  // eslint-disable-next-line react-hooks/purity -- Server Component, computed once per request; see above
  const now = Date.now()
  const registrationOpen =
    new Date(event.registration_closes_at ?? event.starts_at).getTime() > now

  return (
    <div className="min-h-screen bg-[#130F0E] text-[#F3E9E8] p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/events" className="text-sm text-[#A68F8C] hover:text-white">
          ← All events
        </Link>

        <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mt-3 mb-2">{event.title}</h1>
        <p className="text-[#8C7A77] text-sm mb-1">
          {new Date(event.starts_at).toLocaleString()} – {new Date(event.ends_at).toLocaleString()}
        </p>
        {event.location && <p className="text-[#8C7A77] text-sm mb-4">{event.location}</p>}
        <p className="text-[#D1C2C0] whitespace-pre-wrap mb-8">{event.description}</p>

        {myTeam ? (
          <TeamRoster
            eventId={id}
            team={{
              id: myTeam.id,
              name: myTeam.name,
              members: (myTeam.event_team_members ?? []).map((m) => ({
                id: m.id,
                status: m.status,
                username: (m.profiles as unknown as { username: string } | null)?.username ?? '(deleted user)',
              })),
            }}
          />
        ) : registrationOpen ? (
          <RegisterForm eventId={id} maxTeamSize={event.max_team_size} />
        ) : (
          <p className="text-[#A68F8C]">Registration for this event is closed.</p>
        )}
      </div>
    </div>
  )
}
