'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/utils/supabase/admin'

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Not authorised')
}

function toEventFields(formData: FormData) {
  const maxTeamSizeRaw = String(formData.get('maxTeamSize') || '').trim()
  const closesRaw = String(formData.get('registrationClosesAt') || '').trim()
  return {
    title: String(formData.get('title') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    location: String(formData.get('location') || '').trim() || null,
    banner_url: String(formData.get('bannerUrl') || '').trim() || null,
    starts_at: new Date(String(formData.get('startsAt'))).toISOString(),
    ends_at: new Date(String(formData.get('endsAt'))).toISOString(),
    registration_closes_at: closesRaw ? new Date(closesRaw).toISOString() : null,
    max_team_size: maxTeamSizeRaw ? Number(maxTeamSizeRaw) : null,
  }
}

export async function createEvent(prevState: unknown, formData: FormData) {
  await requireAdmin()
  const fields = toEventFields(formData)
  if (!fields.title) return { error: 'Title is required.' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('events').insert(fields)
  if (error) return { error: error.message }

  revalidatePath('/admin/events')
  revalidatePath('/events')
  redirect('/admin/events')
}

export async function updateEvent(eventId: string, prevState: unknown, formData: FormData) {
  await requireAdmin()
  const fields = toEventFields(formData)
  if (!fields.title) return { error: 'Title is required.' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('events')
    .update({ ...fields, updated_at: new Date().toISOString() })
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
  const supabase = createAdminClient()
  const { error } = await supabase.from('event_teams').update({ name }).eq('id', teamId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/events', 'layout')
}

export async function removeTeam(teamId: string, eventId: string) {
  await requireAdmin()
  const supabase = createAdminClient()
  const { error } = await supabase.from('event_teams').delete().eq('id', teamId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/events/${eventId}/teams`)
}

/** Adds a member directly, already accepted — bypasses the invite flow entirely. */
export async function addTeamMember(teamId: string, eventId: string, username: string) {
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: profile, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username.trim())
    .single()
  if (lookupError || !profile) throw new Error('No account with that username.')

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
