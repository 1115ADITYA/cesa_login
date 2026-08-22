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
  const { data: event } = await supabase
    .from('events')
    .select('id, title, min_team_size, max_team_size')
    .eq('id', eventId)
    .maybeSingle()
  if (!event) notFound()

  // `profiles` must be reached by an explicit FK name: event_team_members
  // points at it twice (user_id and invited_by), so a bare `profiles(...)`
  // embed is ambiguous and PostgREST rejects the whole query — which this page
  // then rendered as the far more convincing "No teams registered yet."
  const { data: teams, error: teamsError } = await supabase
    .from('event_teams')
    .select(
      'id, name, created_at, event_team_members(id, status, invited_at, responded_at, profiles!event_team_members_user_id_fkey(username, full_name))',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  // Never silently claim an event has no teams because the query failed.
  if (teamsError) throw new Error(`Could not load teams: ${teamsError.message}`)

  const summary = (teams ?? []).reduce(
    (acc, t) => {
      const accepted = (t.event_team_members ?? []).filter((m) => m.status === 'accepted').length
      acc.total += 1
      if (accepted >= event.min_team_size) acc.confirmed += 1
      else acc.forming += 1
      return acc
    },
    { total: 0, confirmed: 0, forming: 0 },
  )

  return (
    <div className="min-h-screen bg-[#130F0E] text-[#F3E9E8] p-8">
      <div className="max-w-5xl mx-auto">
        <AdminNav active="events" />
        <Link href="/admin/events" className="text-sm text-[#A68F8C] hover:text-white">
          ← All events
        </Link>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] mt-2 mb-1">{event.title} — Teams</h1>
        <p className="text-sm text-[#8C7A77] mb-6">
          {summary.total} registered · <span className="text-[#7AE8A2]">{summary.confirmed} confirmed</span> ·{' '}
          <span className="text-[#E8C87A]">{summary.forming} still forming</span> · needs{' '}
          {event.min_team_size} accepted member{event.min_team_size === 1 ? '' : 's'} to confirm
        </p>

        {!teams?.length ? (
          <p className="text-[#A68F8C]">No teams registered yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {teams.map((t) => (
              <TeamRow
                key={t.id}
                minTeamSize={event.min_team_size}
                maxTeamSize={event.max_team_size}
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
