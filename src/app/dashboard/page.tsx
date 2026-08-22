import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import TeamProgress from '@/components/TeamProgress'
import { ProfileCard } from './profile-card'
import NotificationCentre, { type Invite } from './NotificationCentre'
import { teamState, type MyRegistration } from '@/lib/events'

export const metadata = { title: 'Home — CESA' }
export const dynamic = 'force-dynamic'

type InvitationRow = {
  membership_id: string
  event_id: string
  event_title: string
  event_starts_at: string
  team_id: string
  team_name: string
  invited_by_username: string | null
  invited_by_full_name: string | null
  invited_at: string
  accepted_count: number
  min_team_size: number
  max_team_size: number | null
  registration_open: boolean
}

export default async function Dashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // The invitation feed and the registration list both come from SECURITY
  // DEFINER functions rather than PostgREST joins: the joins depended on one
  // member being able to read another member's `profiles` row, which is why
  // the inviter's name used to render as "someone".
  const [{ data: profile }, { data: invitationRows }, { data: regRows }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.rpc('get_my_invitations'),
    supabase.rpc('get_my_registrations'),
  ])

  const invites: Invite[] = ((invitationRows ?? []) as InvitationRow[]).map((r) => ({
    membershipId: r.membership_id,
    eventId: r.event_id,
    eventTitle: r.event_title,
    eventStartsAt: r.event_starts_at,
    teamName: r.team_name,
    invitedByUsername: r.invited_by_username ?? 'someone',
    invitedByFullName: r.invited_by_full_name,
    invitedAt: r.invited_at,
    acceptedCount: r.accepted_count,
    minTeamSize: r.min_team_size,
    maxTeamSize: r.max_team_size,
    registrationOpen: r.registration_open,
  }))

  const regs = ((regRows ?? []) as MyRegistration[]).filter((r) => r.my_status === 'accepted')

  // Titles for the registrations — RLS lets any signed-in member read events.
  const { data: eventRows } = regs.length
    ? await supabase.from('events').select('id, title, starts_at').in('id', regs.map((r) => r.event_id))
    : { data: [] }
  const eventById = new Map((eventRows ?? []).map((e) => [e.id, e]))

  const needsAttention = regs.filter((r) => !r.confirmed).length

  return (
    <div className="min-h-screen px-6 sm:px-8">
      <SiteNav active="dashboard" />

      <div className="mx-auto max-w-5xl pb-16">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold tracking-tight text-[var(--text-bright)]">
            Hi{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-1.5 text-[var(--text-muted)]">
            {invites.length > 0
              ? `${invites.length} invitation${invites.length === 1 ? '' : 's'} waiting on you.`
              : needsAttention > 0
                ? `${needsAttention} of your teams still need members to confirm.`
                : 'Everything is up to date.'}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <ProfileCard profile={profile} userEmail={user.email || ''} />

          <div className="flex flex-col gap-6 md:col-span-2">
            <section className="card p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <h2 className="font-bold text-white">Notifications</h2>
                {invites.length > 0 && (
                  <span className="pill bg-[var(--warning)]/12 text-[var(--warning)]">{invites.length} new</span>
                )}
              </div>
              <NotificationCentre invites={invites} />
            </section>

            <section className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold text-white">Your events</h2>
                <Link href="/events" className="text-xs font-bold text-[var(--accent)] hover:underline">
                  Browse all →
                </Link>
              </div>

              {regs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-6 text-center">
                  <p className="text-sm text-[var(--text-muted)]">You haven&apos;t registered for anything yet.</p>
                  <Link href="/events" className="btn btn-primary mt-4 !py-2 !text-xs">
                    Find an event
                  </Link>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {regs.map((r) => {
                    const event = eventById.get(r.event_id)
                    const state = teamState(r)
                    return (
                      <li key={r.team_id}>
                        <Link
                          href={`/events/${r.event_id}`}
                          className="block rounded-xl border border-[var(--border)] bg-[var(--bg-sunken)] p-4 transition-colors hover:border-[var(--accent)]/35"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-white">{event?.title ?? 'Event'}</p>
                              <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                                Team {r.team_name}
                                {r.is_leader && ' · you lead this team'}
                                {event && ` · ${new Date(event.starts_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
                              </p>
                            </div>
                            {state === 'confirmed' ? (
                              <span className="pill bg-[var(--success)]/12 text-[var(--success)]">Confirmed</span>
                            ) : (
                              <span className="pill bg-[var(--accent)]/12 text-[var(--accent)]">
                                {r.min_team_size - r.accepted_count} more to confirm
                              </span>
                            )}
                          </div>
                          <div className="mt-3">
                            <TeamProgress
                              accepted={r.accepted_count}
                              pending={r.pending_count}
                              min={r.min_team_size}
                              max={r.max_team_size}
                            />
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
