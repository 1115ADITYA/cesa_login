import { getClient, getUser } from '@/utils/supabase/server'
import LiveRefresh from './LiveRefresh'
import { getMyProfile } from '@/lib/profile'
import NavBar, { type NavInvite, type NavNotification, type NavProfile } from './NavBar'

type NotificationRow = {
  id: string
  kind: NavNotification['kind']
  title: string
  body: string
  event_id: string | null
  read_at: string | null
  created_at: string
}

type InvitationRow = {
  membership_id: string
  event_id: string
  event_title: string
  team_name: string
  invited_by_username: string | null
}

/**
 * The signed-in header. Fetches its own data rather than taking it as props,
 * so no page has to remember to thread the invite count through — the bell is
 * accurate on every route that renders the nav.
 *
 * The active link is derived from the pathname inside NavBar, which is why
 * there is no `active` prop any more.
 */
export default async function SiteNav() {
  const [supabase, user] = await Promise.all([getClient(), getUser()])
  if (!user) return null

  const [profileRow, { data: invitationRows }, { data: notificationRows }] = await Promise.all([
    // Shared with the completion gate in the layout via React cache(), so this
    // is one query per request rather than two.
    getMyProfile(),
    supabase.rpc('get_my_invitations'),
    // RLS scopes this to the caller (notifications_read_own), so no filter is
    // needed here beyond the ordering and cap.
    supabase
      .from('notifications')
      .select('id, kind, title, body, event_id, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const profile: NavProfile = {
    id: user.id,
    username: profileRow?.username ?? '',
    fullName: profileRow?.full_name ?? null,
    avatarUrl: profileRow?.avatar_url || null,
    email: user.email ?? '',
    role: profileRow?.role ?? null,
  }

  const invites: NavInvite[] = ((invitationRows ?? []) as InvitationRow[]).map((r) => ({
    membershipId: r.membership_id,
    eventId: r.event_id,
    eventTitle: r.event_title,
    teamName: r.team_name,
    invitedByUsername: r.invited_by_username ?? 'someone',
  }))

  const notifications: NavNotification[] = ((notificationRows ?? []) as NotificationRow[]).map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    eventId: n.event_id,
    read: n.read_at !== null,
    createdAt: n.created_at,
  }))

  return (
    <>
      {/* Lives here rather than in the layout because it needs the user id for
          its realtime filter, and this is the first place that has one. */}
      <LiveRefresh userId={user.id} />
      <NavBar profile={profile} invites={invites} notifications={notifications} />
    </>
  )
}
