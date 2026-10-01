'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/utils/supabase/admin'
import { EVENTS_TAG } from '@/lib/eventData'

// `updateTag` rather than `revalidateTag`: in Next 16 revalidateTag schedules
// an expiry against a cache profile, while updateTag expires immediately and
// gives read-your-own-writes inside a Server Action — which is what an admin
// needs after creating an event and landing back on the list.
async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Not authorised')
}

const MAX_BANNER_BYTES = 5 * 1024 * 1024
const ALLOWED_BANNER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

/**
 * Uploads a banner image straight to the `event-banners` bucket (see
 * 0009_event_banners_bucket.sql) and hands back its public URL, which the
 * form then submits like it always did — createEvent/updateEvent still just
 * see a `bannerUrl` string, so the poster-flow path (registration page,
 * EventRow, EventCard) needed no changes.
 */
export async function uploadEventBanner(formData: FormData): Promise<{ url: string } | { error: string }> {
  await requireAdmin()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image to upload.' }
  if (!ALLOWED_BANNER_TYPES.has(file.type)) return { error: 'Use a JPEG, PNG, WebP or GIF image.' }
  if (file.size > MAX_BANNER_BYTES) return { error: 'Image must be 5MB or smaller.' }

  const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
  const path = `${crypto.randomUUID()}.${ext}`

  const supabase = createAdminClient()
  const { error } = await supabase.storage.from('event-banners').upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
  })
  if (error) return { error: `Upload failed: ${error.message}` }

  const { data } = supabase.storage.from('event-banners').getPublicUrl(path)
  return { url: data.publicUrl }
}

type EventFields = {
  title: string
  description: string
  location: string | null
  banner_url: string | null
  banner_position: string
  poster_url: string | null
  starts_at: string | null
  ends_at: string | null
  date_label: string | null
  registration_closes_at: string | null
  min_team_size: number
  max_team_size: number | null
  join_url: string | null
  show_join_button: boolean
}

/** Only "N% N%" is ever written by BannerUpload.tsx — anything else is either absent or tampered with. */
function toBannerPosition(raw: FormDataEntryValue | null): string {
  const value = String(raw || '').trim()
  return /^\d{1,3}% \d{1,3}%$/.test(value) ? value : '50% 50%'
}

/**
 * Only http(s) links — the button is an <a href>, and a pasted `javascript:`
 * URL would run in every member's session. A bare "unstop.com/…" gets https://.
 */
function toHttpUrl(raw: string): string | null {
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * Validates here as well as in the database. The check constraints are the
 * real guarantee, but a raised Postgres constraint name is not something to
 * show an admin — these messages are.
 */
function toEventFields(formData: FormData): { error: string } | { fields: EventFields } {
  const title = String(formData.get('title') || '').trim()
  if (!title) return { error: 'Title is required.' }

  // "Coming soon" drops the dates entirely and shows the admin's text instead.
  const comingSoon = formData.get('schedule') === 'comingSoon'
  let startsAt: Date | null = null
  let endsAt: Date | null = null
  let dateLabel: string | null = null
  if (comingSoon) {
    dateLabel = String(formData.get('dateLabel') || '').trim().slice(0, 80) || null
  } else {
    startsAt = new Date(String(formData.get('startsAt')))
    endsAt = new Date(String(formData.get('endsAt')))
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return { error: 'Start and end times are required — or choose "Coming soon".' }
    }
    if (endsAt < startsAt) return { error: 'The event cannot end before it starts.' }
  }

  const closesRaw = String(formData.get('registrationClosesAt') || '').trim()
  const closesAt = closesRaw ? new Date(closesRaw) : null
  if (closesAt && Number.isNaN(closesAt.getTime())) return { error: 'Registration close time is not a valid date.' }
  if (closesAt && endsAt && closesAt > endsAt) return { error: 'Registration cannot close after the event has ended.' }

  const showJoinButton = formData.get('showJoinButton') === 'on'
  const joinRaw = String(formData.get('joinUrl') || '').trim()
  const joinUrl = joinRaw ? toHttpUrl(joinRaw) : null
  if (joinRaw && !joinUrl) return { error: 'The Join Now link must be a full web address, like https://unstop.com/…' }
  if (showJoinButton && !joinUrl) return { error: 'Paste the link the Join Now button should open.' }

  const minRaw = String(formData.get('minTeamSize') || '').trim()
  const maxRaw = String(formData.get('maxTeamSize') || '').trim()
  const minTeamSize = minRaw ? Number(minRaw) : 1
  const maxTeamSize = maxRaw ? Number(maxRaw) : null

  if (!Number.isInteger(minTeamSize) || minTeamSize < 1) return { error: 'Min team size must be a whole number, 1 or more.' }
  if (maxTeamSize !== null && (!Number.isInteger(maxTeamSize) || maxTeamSize < 1)) {
    return { error: 'Max team size must be a whole number, 1 or more.' }
  }
  if (maxTeamSize !== null && maxTeamSize < minTeamSize) {
    return { error: 'Max team size cannot be smaller than the minimum.' }
  }

  return {
    fields: {
      title,
      description: String(formData.get('description') || '').trim(),
      location: String(formData.get('location') || '').trim() || null,
      banner_url: String(formData.get('bannerUrl') || '').trim() || null,
      banner_position: toBannerPosition(formData.get('bannerPosition')),
      poster_url: String(formData.get('posterUrl') || '').trim() || null,
      starts_at: startsAt ? startsAt.toISOString() : null,
      ends_at: endsAt ? endsAt.toISOString() : null,
      date_label: dateLabel,
      registration_closes_at: closesAt ? closesAt.toISOString() : null,
      min_team_size: minTeamSize,
      max_team_size: maxTeamSize,
      join_url: joinUrl,
      show_join_button: showJoinButton,
    },
  }
}

export async function createEvent(prevState: unknown, formData: FormData) {
  await requireAdmin()
  const parsed = toEventFields(formData)
  if ('error' in parsed) return parsed

  const supabase = createAdminClient()
  const { error } = await supabase.from('events').insert(parsed.fields)
  if (error) return { error: error.message }

  updateTag(EVENTS_TAG)
  revalidatePath('/admin/events')
  revalidatePath('/events')
  redirect('/admin/events')
}

export async function updateEvent(eventId: string, prevState: unknown, formData: FormData) {
  await requireAdmin()
  const parsed = toEventFields(formData)
  if ('error' in parsed) return parsed

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('events')
    .update({ ...parsed.fields, updated_at: new Date().toISOString() })
    .eq('id', eventId)
  if (error) return { error: error.message }

  updateTag(EVENTS_TAG)
  revalidatePath('/admin/events')
  revalidatePath(`/admin/events/${eventId}`)
  revalidatePath('/events')
  redirect('/admin/events')
}

export async function deleteEvent(eventId: string) {
  await requireAdmin()
  const supabase = createAdminClient()
  // Teams and memberships cascade via the FK ON DELETE CASCADE in the migration.
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  if (error) throw new Error(error.message)
  updateTag(EVENTS_TAG)
  revalidatePath('/admin/events')
  revalidatePath('/events')
}

// ---------------------------------------------------------------------------
// Teams and rosters — "admins can even edit, add or remove team or team
// members" from any registered event.
// ---------------------------------------------------------------------------

export async function renameTeam(teamId: string, newName: string) {
  await requireAdmin()
  const name = newName.trim()
  if (name.length < 2) throw new Error('Team name is too short.')
  if (name.length > 60) throw new Error('Team name is too long.')
  const supabase = createAdminClient()
  const { error } = await supabase.from('event_teams').update({ name }).eq('id', teamId)
  if (error) {
    // 23505 is the per-event unique name index from 0002_team_flow.sql.
    throw new Error(error.code === '23505' ? 'Another team in this event already uses that name.' : error.message)
  }
  revalidatePath('/admin/events', 'layout')
}

export async function removeTeam(teamId: string, eventId: string) {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase.from('event_teams').delete().eq('id', teamId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/events/${eventId}/teams`)
}

/**
 * Adds a member directly, already accepted — bypasses the invite flow entirely.
 * Deliberately ignores max_team_size: an admin overriding the cap is a
 * legitimate call on the day. Being on two teams for one event is not, so that
 * one is still enforced.
 */
export async function addTeamMember(teamId: string, eventId: string, username: string) {
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: profile, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username.trim())
    .maybeSingle()
  if (lookupError || !profile) throw new Error('No account with that username.')

  const { data: teamIds } = await supabase.from('event_teams').select('id').eq('event_id', eventId)
  const { data: clash } = await supabase
    .from('event_team_members')
    .select('team_id')
    .eq('user_id', profile.id)
    .eq('status', 'accepted')
    .in('team_id', (teamIds ?? []).map((t) => t.id))
  if (clash?.some((row) => row.team_id !== teamId)) {
    throw new Error('That person has already joined another team for this event.')
  }

  const { error } = await supabase.from('event_team_members').insert({
    team_id: teamId,
    user_id: profile.id,
    status: 'accepted',
    responded_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.code === '23505' ? 'Already on this team.' : error.message)

  revalidatePath(`/admin/events/${eventId}/teams`)
}

export async function removeTeamMember(memberId: string, eventId: string) {
  await requireAdmin()
  const supabase = createAdminClient()

  // Removing the leader used to leave `event_teams.created_by` pointing at
  // somebody with no membership row. That team then had nobody who could
  // invite, and the leader could not even see it — get_event_team finds a team
  // through the roster, not through created_by. Hand leadership on instead.
  const { data: membership } = await supabase
    .from('event_team_members')
    .select('user_id, team_id, event_teams(created_by)')
    .eq('id', memberId)
    .maybeSingle()
  if (!membership) throw new Error('That member is no longer on the team.')

  const team = membership.event_teams as unknown as { created_by: string } | null
  if (team && team.created_by === membership.user_id) {
    const { data: heirs } = await supabase
      .from('event_team_members')
      .select('user_id')
      .eq('team_id', membership.team_id)
      .eq('status', 'accepted')
      .neq('user_id', membership.user_id)
      .order('responded_at', { ascending: true })
      .limit(1)

    const heir = heirs?.[0]
    if (!heir) {
      throw new Error(
        'This is the only confirmed member, so there is nobody to hand the team to. Remove the whole team instead.',
      )
    }
    const { error: transferError } = await supabase
      .from('event_teams')
      .update({ created_by: heir.user_id })
      .eq('id', membership.team_id)
    if (transferError) throw new Error(`Could not hand over the team: ${transferError.message}`)
  }

  const { error } = await supabase.from('event_team_members').delete().eq('id', memberId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/events/${eventId}/teams`)
}

/** Hands leadership to another confirmed member of the same team. */
export async function makeTeamLeader(memberId: string, eventId: string) {
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: membership } = await supabase
    .from('event_team_members')
    .select('user_id, team_id, status')
    .eq('id', memberId)
    .maybeSingle()
  if (!membership) throw new Error('That member is no longer on the team.')
  if (membership.status !== 'accepted') {
    throw new Error('Only a confirmed member can lead a team.')
  }

  const { error } = await supabase
    .from('event_teams')
    .update({ created_by: membership.user_id })
    .eq('id', membership.team_id)
  if (error) {
    // event_teams is unique on (event_id, created_by) — one team per person.
    throw new Error(
      error.code === '23505'
        ? 'That person already leads another team for this event.'
        : error.message,
    )
  }
  revalidatePath(`/admin/events/${eventId}/teams`)
}

/**
 * Username lookup for the admin roster box. Deliberately not the members'
 * `search_usernames` RPC: that one gates on auth.uid() and is granted to the
 * `authenticated` role, and an admin session is not a Supabase Auth user at
 * all. This goes through the service-role client instead.
 */
export async function searchProfiles(query: string, eventId: string) {
  await requireAdmin()
  const q = query.trim().replace(/^@/, '')
  if (q.length < 2) return []

  const supabase = createAdminClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, full_name')
    .ilike('username', `${q}%`)
    .order('username')
    .limit(8)
  if (!profiles?.length) return []

  // Flag anyone already placed, so an admin does not have to discover the
  // "already on another team" error by hitting it.
  const { data: teamIds } = await supabase.from('event_teams').select('id').eq('event_id', eventId)
  const { data: taken } = await supabase
    .from('event_team_members')
    .select('user_id')
    .eq('status', 'accepted')
    .in('team_id', (teamIds ?? []).map((t) => t.id))
    .in('user_id', profiles.map((p) => p.id))

  const takenIds = new Set((taken ?? []).map((r) => r.user_id))
  return profiles.map((p) => ({
    username: p.username as string,
    fullName: (p.full_name as string) ?? '',
    onATeam: takenIds.has(p.id),
  }))
}

/**
 * Sends a notification to members — everyone, or just the people registered
 * for one event. Fans out one row per recipient (see broadcast_announcement in
 * 0008), which is what makes it land in each person's bell instantly via the
 * realtime subscription.
 */
export async function sendAnnouncement(prevState: unknown, formData: FormData) {
  await requireAdmin()

  const title = String(formData.get('title') || '').trim()
  const body = String(formData.get('body') || '').trim()
  const audience = String(formData.get('audience') || 'all')
  const eventId = audience === 'all' ? null : audience

  if (!title) return { error: 'Give the announcement a title.' }
  if (!body) return { error: 'Write a message to send.' }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('broadcast_announcement', {
    p_title: title,
    p_body: body,
    p_event_id: eventId,
  })

  if (error) {
    return { error: error.message.replace(/^.*?(?:ERROR|error):\s*/, '').trim() || 'Could not send the announcement.' }
  }

  const count = typeof data === 'number' ? data : 0
  revalidatePath('/admin/announce')
  return {
    success: count === 0
      ? 'Nobody matched that audience, so no notifications were sent.'
      : `Sent to ${count} member${count === 1 ? '' : 's'}.`,
  }
}
