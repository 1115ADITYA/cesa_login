import 'server-only'
import { redirect } from 'next/navigation'
import { getClient, getUser } from '@/utils/supabase/server'
import { eventPhase, registrationDeadline, type EventRow, type MyRegistration } from './events'

/**
 * The one fetch every signed-in events page needs: the catalogue, plus what
 * the caller is registered for, keyed by event. Four pages were each rolling
 * their own version of this and disagreeing about what "registered" meant.
 */
export async function loadEventBoard() {
  const [supabase, user] = await Promise.all([getClient(), getUser()])
  if (!user) redirect('/')

  const [{ data: events }, { data: regs }] = await Promise.all([
    supabase.from('events').select('*').order('starts_at', { ascending: true }),
    supabase.rpc('get_my_registrations'),
  ])

  const all = (events ?? []) as EventRow[]
  const registrations = (regs ?? []) as MyRegistration[]
  const byEvent = new Map(registrations.map((r) => [r.event_id, r]))

  // Resolved once per request on the server, so every section of a page
  // classifies events against the same instant.
  const now = Date.now()

  return {
    user,
    now,
    all,
    registrations,
    byEvent,
    /** Events the caller has joined or been invited to, soonest first. */
    mine: all.filter((e) => byEvent.has(e.id)),
    live: all.filter((e) => eventPhase(e, now) === 'live'),
    open: all.filter((e) => eventPhase(e, now) === 'upcoming' && registrationDeadline(e).getTime() > now),
    closed: all.filter((e) => eventPhase(e, now) === 'upcoming' && registrationDeadline(e).getTime() <= now),
    past: all.filter((e) => eventPhase(e, now) === 'past'),
  }
}
