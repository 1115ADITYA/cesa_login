import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/utils/supabase/admin'
import AdminShell, { AdminHeader } from '../AdminShell'
import { deleteEvent } from '../actions'
import DeleteEventButton from './DeleteEventButton'
import { formatDateRange, teamSizeLabel, type EventRow } from '@/lib/events'

export const metadata = { title: 'Events — Admin', robots: { index: false } }
export const dynamic = 'force-dynamic'

type TeamRow = { event_id: string; id: string }
type MemberRow = { team_id: string; status: string }

export default async function AdminEventsPage() {
  if (!(await isAdmin())) redirect('/admin')

  const supabase = createAdminClient()
  const [{ data: events }, { data: teams }, { data: members }] = await Promise.all([
    supabase.from('events').select('*').order('starts_at', { ascending: false }),
    supabase.from('event_teams').select('id, event_id'),
    supabase.from('event_team_members').select('team_id, status'),
  ])

  // Confirmed vs still-forming per event — the number an organiser actually
  // needs before the day, and which the old "N team(s) registered" line hid.
  const acceptedByTeam = new Map<string, number>()
  for (const m of (members ?? []) as MemberRow[]) {
    if (m.status === 'accepted') acceptedByTeam.set(m.team_id, (acceptedByTeam.get(m.team_id) ?? 0) + 1)
  }
  const teamsByEvent = new Map<string, string[]>()
  for (const t of (teams ?? []) as TeamRow[]) {
    teamsByEvent.set(t.event_id, [...(teamsByEvent.get(t.event_id) ?? []), t.id])
  }

  const all = (events ?? []) as EventRow[]
  // eslint-disable-next-line react-hooks/purity -- Server Component, resolved once per request
  const now = Date.now()

  return (
    <AdminShell>
      <AdminHeader
        title="Events"
        subtitle={all.length === 0 ? 'Nothing published yet.' : `${all.length} event${all.length === 1 ? '' : 's'}`}
        action={
          <Link href="/admin/events/new" className="btn btn-primary">
            + New event
          </Link>
        }
      />

      {all.length === 0 ? (
        <div className="glass px-6 py-12 text-center">
          <p className="font-semibold text-white">No events yet</p>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            Create one and it appears on every member&apos;s events board straight away.
          </p>
          <Link href="/admin/events/new" className="btn btn-primary mt-5">
            Create the first event
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {all.map((e) => {
            const ids = teamsByEvent.get(e.id) ?? []
            const confirmed = ids.filter((id) => (acceptedByTeam.get(id) ?? 0) >= e.min_team_size).length
            const status = eventStatus(e.starts_at, e.ends_at, now)
            const start = new Date(e.starts_at)

            return (
              <div key={e.id} className="glass card-hover flex flex-wrap items-center gap-4 p-4 sm:p-5">
                <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-b from-[var(--accent-deep)]/18 to-[var(--accent)]/6 py-3">
                  <span className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--accent-light)]">
                    {start.toLocaleDateString(undefined, { month: 'short' })}
                  </span>
                  <span className="heading text-2xl leading-none">{start.getDate()}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-white">{e.title}</h2>
                    <span className={`pill ${status.tone}`}>{status.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {formatDateRange(e.starts_at, e.ends_at)}
                    {e.location ? ` · ${e.location}` : ''} · {teamSizeLabel(e.min_team_size, e.max_team_size)}
                  </p>
                  <p className="mt-1.5 text-xs text-[var(--text-faint)]">
                    <span className="font-bold text-[var(--text)]">{ids.length}</span> registered ·{' '}
                    <span className="font-bold text-[var(--success)]">{confirmed}</span> confirmed
                    {ids.length - confirmed > 0 && (
                      <span className="text-[var(--warning)]"> · {ids.length - confirmed} still forming</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Link href={`/admin/events/${e.id}/teams`} className="btn btn-ghost !px-3 !py-2 !text-xs">
                    Teams
                  </Link>
                  <Link href={`/admin/events/${e.id}/edit`} className="btn btn-ghost !px-3 !py-2 !text-xs">
                    Edit
                  </Link>
                  <DeleteEventButton eventId={e.id} action={deleteEvent} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminShell>
  )
}

function eventStatus(startsAt: string, endsAt: string, now: number) {
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  if (now < start) return { label: 'Upcoming', tone: 'bg-[var(--info)]/12 text-[var(--info)]' }
  if (now <= end) return { label: 'Live', tone: 'bg-[var(--success)]/12 text-[var(--success)]' }
  return { label: 'Past', tone: 'bg-white/5 text-[var(--text-faint)]' }
}
