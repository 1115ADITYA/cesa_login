'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

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

export async function registerForEvent(eventId: string, teamName: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again.' }

  const { error } = await supabase.rpc('register_for_event', {
    p_event_id: eventId,
    p_team_name: teamName.trim() || null,
  })
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
