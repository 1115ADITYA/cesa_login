'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

/**
 * All three calls go through Postgres RPCs (see supabase/migrations/0001_events.sql)
 * rather than direct table writes — a registration is "create a team, add
 * myself as accepted, add every invite" as one atomic step, and RLS alone
 * cannot express "insert into a table I'm otherwise only allowed to read."
 */

export async function registerForEvent(eventId: string, teamName: string, inviteUsernames: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.rpc('register_for_event', {
    p_event_id: eventId,
    p_team_name: teamName,
    p_invite_usernames: inviteUsernames,
  })
  if (error) return { error: error.message }

  revalidatePath('/events')
  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

export async function inviteToTeam(teamId: string, eventId: string, username: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('invite_to_team', { p_team_id: teamId, p_username: username })
  if (error) return { error: error.message }

  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

export async function respondToInvite(membershipId: string, accept: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('respond_to_invite', { p_membership_id: membershipId, p_accept: accept })
  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/events')
  return { success: true }
}
