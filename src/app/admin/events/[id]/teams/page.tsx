import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/utils/supabase/admin'
import AdminNav from '../../../AdminNav'
import TeamRow from './TeamRow'
import { renameTeam, removeTeam, addTeamMember, removeTeamMember } from '../../../actions'

export const metadata = { title: 'Teams — Admin', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function EventTeamsPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect('/admin')
  const { id: eventId } = await params

  const supabase = createAdminClient()
  const { data: event } = await supabase.from('events').select('id, title').eq('id', eventId).single()
  if (!event) notFound()

  const { data: teams } = await supabase
    .from('event_teams')
    .select('id, name, created_at, event_team_members(id, status, invited_at, responded_at, profiles(username, full_name))')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  return (
    <div className="min-h-screen bg-[#130F0E] text-[#F3E9E8] p-8">
      <div className="max-w-5xl mx-auto">
        <AdminNav active="events" />
        <Link href="/admin/events" className="text-sm text-[#A68F8C] hover:text-white">
          ← All events
        </Link>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] mt-2 mb-6">{event.title} — Teams</h1>

        {!teams?.length ? (
          <p className="text-[#A68F8C]">No teams registered yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {teams.map((t) => (
              <TeamRow
                key={t.id}
                team={{
                  id: t.id,
                  name: t.name,
                  // Supabase's generated types make a to-one FK relation look like
                  // an array here; it is exactly one row per membership.
                  members: (t.event_team_members ?? []).map((m) => ({
                    id: m.id,
                    status: m.status,
                    username: (m.profiles as unknown as { username: string; full_name: string } | null)?.username ?? '(deleted user)',
                    fullName: (m.profiles as unknown as { username: string; full_name: string } | null)?.full_name ?? '',
                  })),
                }}
                eventId={eventId}
                renameTeam={renameTeam}
                removeTeam={removeTeam}
                addTeamMember={addTeamMember}
                removeTeamMember={removeTeamMember}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
