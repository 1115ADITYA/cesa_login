'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/utils/supabase/admin'

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Not authorised')
}

type EventFields = {
  title: string
  description: string
  location: string | null
  banner_url: string | null
  starts_at: string
  ends_at: string
  registration_closes_at: string | null
  min_team_size: number
  max_team_size: number | null
}

/**
 * Validates here as well as in the database. The check constraints are the
 * real guarantee, but a raised Postgres constraint name is not something to
 * show an admin — these messages are.
 */
function toEventFields(formData: FormData): { error: string } | { fields: EventFields } {
  const title = String(formData.get('title') || '').trim()
  if (!title) return { error: 'Title is required.' }

  const startsAt = new Date(String(formData.get('startsAt')))
  const endsAt = new Date(String(formData.get('endsAt')))
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { error: 'Start and end times are required.' }
  }
  if (endsAt < startsAt) return { error: 'The event cannot end before it starts.' }

  const closesRaw = String(formData.get('registrationClosesAt') || '').trim()
  const closesAt = closesRaw ? new Date(closesRaw) : null
  if (closesAt && Number.isNaN(closesAt.getTime())) return { error: 'Registration close time is not a valid date.' }
  if (closesAt && closesAt > endsAt) return { error: 'Registration cannot close after the event has ended.' }

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
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      registration_closes_at: closesAt ? closesAt.toISOString() : null,
      min_team_size: minTeamSize,
      max_team_size: maxTeamSize,
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
  const { error } = await supabase.from('event_team_members').delete().eq('id', memberId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/events/${eventId}/teams`)
}
