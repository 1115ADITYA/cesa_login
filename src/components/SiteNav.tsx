import { createClient } from '@/utils/supabase/server'
import NavBar, { type NavInvite, type NavProfile } from './NavBar'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profileRow }, { data: invitationRows }] = await Promise.all([
    supabase.from('profiles').select('username, full_name, avatar_url, role').eq('id', user.id).maybeSingle(),
    supabase.rpc('get_my_invitations'),
  ])

  const profile: NavProfile = {
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

  return <NavBar profile={profile} invites={invites} />
}
