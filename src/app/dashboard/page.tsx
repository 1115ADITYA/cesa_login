import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ProfileCard } from './profile-card'
import NotificationCentre, { type Invite } from './NotificationCentre'

export default async function Dashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // RLS already limits this to the signed-in user's own memberships (see
  // event_team_members_read_own), so no extra `.eq('user_id', user.id)` is
  // needed — but the status filter keeps this to just pending invitations.
  const { data: pendingRows } = await supabase
    .from('event_team_members')
    .select('id, event_teams(name, event_id, events(title)), profiles!invited_by(username)')
    .eq('user_id', user.id)
    .eq('status', 'invited')
    .order('invited_at', { ascending: false })

  const invites: Invite[] = (pendingRows ?? []).map((r) => {
    const team = r.event_teams as unknown as { name: string; event_id: string; events: { title: string } | null } | null
    const inviter = r.profiles as unknown as { username: string } | null
    return {
      membershipId: r.id,
      eventId: team?.event_id ?? '',
      eventTitle: team?.events?.title ?? 'an event',
      teamName: team?.name ?? 'a team',
      invitedByUsername: inviter?.username ?? 'someone',
    }
  })

  const { data: myEvents } = await supabase
    .from('event_teams')
    .select('event_id, events(id, title, starts_at)')
    .eq('created_by', user.id)

  return (
    <div className="min-h-screen bg-[#130F0E] text-[#F3E9E8] font-sans p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)]">Dashboard</h1>
          <div className="flex items-center gap-4">
            <Link href="/events" className="text-sm font-semibold text-[#E87A8C] hover:text-[#F4A5AE]">
              Browse events
            </Link>
            <form action="/auth/signout" method="post">
              <button className="bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-lg text-sm font-semibold">
                Logout
              </button>
            </form>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <ProfileCard profile={profile} userEmail={user.email || ''} />

          <div className="md:col-span-2 flex flex-col gap-6">
            <div className="bg-[#1D1716] p-6 rounded-2xl border border-white/5">
              <h2 className="font-bold text-white mb-4">Notifications</h2>
              <NotificationCentre invites={invites} />
            </div>

            <div className="bg-[#1D1716] p-6 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-white">Your events</h2>
                <Link href="/events" className="text-xs font-bold text-[#E87A8C]">
                  See all →
                </Link>
              </div>
              {!myEvents?.length ? (
                <p className="text-[#A68F8C] text-sm">You haven&apos;t registered for any events yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {myEvents.map((row) => {
                    const e = row.events as unknown as { id: string; title: string; starts_at: string } | null
                    if (!e) return null
                    return (
                      <li key={e.id}>
                        <Link href={`/events/${e.id}`} className="text-sm text-[#D1C2C0] hover:text-white">
                          {e.title} <span className="text-[#8C7A77]">— {new Date(e.starts_at).toLocaleDateString()}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
