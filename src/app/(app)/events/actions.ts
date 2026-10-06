'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getUser } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  VIDEO_BUCKET,
  VIDEO_MIME_TYPES,
  isVideoAnswer,
  sanitizeFields,
  sanitizeMaxUploadMb,
  validateAnswers,
  type Answers,
} from '@/lib/formFields'

/**
 * Every write goes through a Postgres RPC (supabase/migrations/0002_team_flow.sql)
 * rather than a table write. Each step — register, invite, accept, withdraw —
 * has to re-check the deadline, the team's capacity and the "one team per
 * event" rule against live data, and RLS policies alone cannot express that.
 *
 * The RPCs raise readable exceptions ("@nikhil has already joined another team
 * for this event"), so their message is safe to show the user directly.
 */

type Result = { error: string } | { success: true }

function fail(message: string): Result {
  // Postgres prefixes raised exceptions when they surface through PostgREST;
  // strip that so the user sees the sentence, not the plumbing.
  return { error: message.replace(/^.*?(?:ERROR|error):\s*/, '').trim() || 'Something went wrong.' }
}

/**
 * Checks the event's custom form answers before anything is written: the
 * fields themselves, and for each video that the upload really exists, sits
 * in this user's own folder, and is within the question's size limit. A
 * video already saved on the team (unchanged on an edit) is trusted as-is —
 * it may have been uploaded by a previous leader.
 */
async function checkAnswers(
  eventId: string,
  userId: string,
  raw: unknown,
  saved: Answers = {},
): Promise<{ error: string } | { answers: Answers }> {
  const admin = createAdminClient()
  const { data: event } = await admin.from('events').select('form_fields, max_upload_mb').eq('id', eventId).maybeSingle()
  if (!event) return { error: 'This event no longer exists.' }

  const fields = sanitizeFields(event.form_fields)
  const maxUploadMb = sanitizeMaxUploadMb(event.max_upload_mb)
  const result = validateAnswers(fields, raw)
  if ('error' in result) return result

  for (const field of fields) {
    const answer = result.answers[field.id]
    if (field.type !== 'video' || !isVideoAnswer(answer)) continue
    const before = saved[field.id]
    if (isVideoAnswer(before) && before.path === answer.path) {
      result.answers[field.id] = before
      continue
    }

    const folder = `${eventId}/${userId}`
    const file = answer.path.startsWith(`${folder}/`) ? answer.path.slice(folder.length + 1) : ''
    if (!/^[a-z0-9-]+\.(mp4|webm|mov|mkv)$/i.test(file)) return { error: `Upload "${field.label}" again.` }

    const { data: objects } = await admin.storage.from(VIDEO_BUCKET).list(folder, { search: file, limit: 1 })
    const object = objects?.find((o) => o.name === file)
    if (!object) return { error: `The video for "${field.label}" did not finish uploading — upload it again.` }

    const size = Number(object.metadata?.size ?? 0)
    if (size > maxUploadMb * 1024 * 1024) {
      return { error: `The video for "${field.label}" is over ${maxUploadMb} MB.` }
    }
    const mime = String(object.metadata?.mimetype ?? '')
    if (mime && !VIDEO_MIME_TYPES.includes(mime)) return { error: `"${field.label}" must be a video.` }
    result.answers[field.id] = { ...answer, size }
  }
  return result
}

export async function registerForEvent(eventId: string, teamName: string, rawAnswers: unknown = {}): Promise<Result> {
  const [supabase, user] = await Promise.all([createClient(), getUser()])
  if (!user) return { error: 'Please sign in again.' }

  // Validated before registering, so a bad answer never leaves a half-made team.
  const checked = await checkAnswers(eventId, user.id, rawAnswers)
  if ('error' in checked) return checked

  const { data: teamId, error } = await supabase.rpc('register_for_event', {
    p_event_id: eventId,
    p_team_name: teamName.trim() || null,
  })
  if (error) return fail(error.message)

  // event_teams has no member-writable policy for answers; the service role
  // writes them, now that the RPC has proved this user owns the team.
  const { error: saveError } = await createAdminClient()
    .from('event_teams')
    .update({ form_answers: checked.answers })
    .eq('id', teamId as string)
    .eq('created_by', user.id)
  if (saveError) return { error: `You are registered, but your answers were not saved: ${saveError.message}` }

  revalidate(eventId)
  return { success: true }
}

/** The team leader editing the form answers while registration is open. */
export async function saveTeamAnswers(teamId: string, eventId: string, rawAnswers: unknown): Promise<Result> {
  const user = await getUser()
  if (!user) return { error: 'Please sign in again.' }

  const admin = createAdminClient()
  const { data: team } = await admin
    .from('event_teams')
    .select('created_by, event_id, form_answers')
    .eq('id', teamId)
    .maybeSingle()
  if (!team || team.event_id !== eventId) return { error: 'That team no longer exists.' }
  if (team.created_by !== user.id) return { error: 'Only the team leader can edit the answers.' }

  const { data: open } = await admin.rpc('registration_is_open', { p_event_id: eventId })
  if (!open) return { error: 'Registration has closed, so the answers are locked.' }

  const checked = await checkAnswers(eventId, user.id, rawAnswers, (team.form_answers ?? {}) as Answers)
  if ('error' in checked) return checked

  const { error } = await admin.from('event_teams').update({ form_answers: checked.answers }).eq('id', teamId)
  if (error) return fail(error.message)

  revalidate(eventId)
  return { success: true }
}

export async function inviteToTeam(teamId: string, eventId: string, username: string): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('invite_to_team', {
    p_team_id: teamId,
    p_username: username.trim().replace(/^@/, ''),
  })
  if (error) return fail(error.message)

  revalidate(eventId)
  return { success: true }
}

export async function respondToInvite(membershipId: string, accept: boolean): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('respond_to_invite', {
    p_membership_id: membershipId,
    p_accept: accept,
  })
  if (error) return fail(error.message)

  revalidate()
  return { success: true }
}

/** Leader withdrawing a pending invite, or dropping a member from the roster. */
export async function removeTeamMember(membershipId: string, eventId: string): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_team_member', { p_membership_id: membershipId })
  if (error) return fail(error.message)

  revalidate(eventId)
  return { success: true }
}

/** Leader cancels the whole entry; anyone else just leaves the team. */
export async function withdrawRegistration(teamId: string, eventId: string): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('withdraw_registration', { p_team_id: teamId })
  if (error) return fail(error.message)

  revalidate(eventId)
  return { success: true }
}

/** Typeahead for the invite box, so nobody has to guess a friend's handle. */
export async function searchUsernames(query: string, eventId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('search_usernames', {
    p_query: query,
    p_event_id: eventId,
  })
  if (error) return []
  return (data ?? []) as { username: string; full_name: string | null; avatar_url: string | null; unavailable: boolean }[]
}

function revalidate(eventId?: string) {
  revalidatePath('/dashboard')
  revalidatePath('/events')
  if (eventId) revalidatePath(`/events/${eventId}`)
}

/**
 * Marks notifications read. Scoped by RLS (notifications_update_own), so the
 * id list cannot be used to touch anyone else's rows even if it were forged.
 */
export async function markNotificationsRead(ids: string[]) {
  if (ids.length === 0) return { success: true } as const
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .is('read_at', null)
  if (error) return fail(error.message)

  revalidatePath('/dashboard')
  return { success: true } as const
}
