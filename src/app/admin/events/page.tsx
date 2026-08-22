import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/utils/supabase/admin'
import AdminNav from '../AdminNav'
import { deleteEvent } from '../actions'
import DeleteEventButton from './DeleteEventButton'

export const metadata = { title: 'Events — Admin', robots: { index: false } }
export const dynamic = 'force-dynamic'

function eventStatus(startsAt: string, endsAt: string): { label: string; tone: string } {
  const now = Date.now()
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  if (now < start) return { label: 'Upcoming', tone: 'text-[#7AA2E8]' }
  if (now <= end) return { label: 'Ongoing', tone: 'text-[#7AE8A2]' }
  return { label: 'Past', tone: 'text-[#8C7A77]' }
}

export default async function AdminEventsPage() {
  if (!(await isAdmin())) redirect('/admin')

  const supabase = createAdminClient()
  const { data: events } = await supabase
    .from('events')
    .select('id, title, starts_at, ends_at, location')
    .order('starts_at', { ascending: false })

  const { data: teamCounts } = await supabase.from('event_teams').select('event_id')
  const countByEvent = new Map<string, number>()
  for (const row of teamCounts ?? []) {
    countByEvent.set(row.event_id, (countByEvent.get(row.event_id) ?? 0) + 1)
  }

  return (
    <div className="min-h-screen bg-[#130F0E] text-[#F3E9E8] p-8">
      <div className="max-w-5xl mx-auto">
        <AdminNav active="events" />

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">Events</h1>
          <Link
            href="/admin/events/new"
            className="bg-gradient-to-r from-[#D16475] to-[#E87A8C] text-white font-bold text-sm px-4 py-2.5 rounded-xl"
          >
            + New event
          </Link>
        </div>

        {!events?.length ? (
          <p className="text-[#A68F8C]">No events yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {events.map((e) => {
              const status = eventStatus(e.starts_at, e.ends_at)
              return (
                <div key={e.id} className="bg-[#1D1716] p-5 rounded-2xl border border-white/5 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-bold text-white">{e.title}</h2>
                      <span className={`text-xs font-bold uppercase tracking-wider ${status.tone}`}>{status.label}</span>
                    </div>
                    <p className="text-[#A68F8C] text-sm">
                      {new Date(e.starts_at).toLocaleString()} {e.location ? `· ${e.location}` : ''} ·{' '}
                      {countByEvent.get(e.id) ?? 0} team(s) registered
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-semibold">
                    <Link href={`/admin/events/${e.id}/teams`} className="text-[#E87A8C] hover:underline">
                      Teams
                    </Link>
                    <Link href={`/admin/events/${e.id}/edit`} className="text-[#D1C2C0] hover:text-white">
                      Edit
                    </Link>
                    <DeleteEventButton eventId={e.id} action={deleteEvent} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
