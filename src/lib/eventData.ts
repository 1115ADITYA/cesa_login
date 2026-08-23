import 'server-only'
import { unstable_cache } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient as createAnonClient } from '@/utils/supabase/client'
import { getClient, getUser } from '@/utils/supabase/server'
import { eventPhase, registrationDeadline, type EventRow, type MyRegistration } from './events'

export const EVENTS_TAG = 'events'

/**
 * The event catalogue is the same for every signed-in member and only changes
 * when an admin edits it, yet it was the slowest query on the page (~250ms
 * median) and ran on every single request. Cached under a tag instead — the
 * admin actions call revalidateTag(EVENTS_TAG) whenever they write, so edits
 * still appear immediately.
 *
 * Uses the plain anon client rather than the request-scoped one on purpose: a
 * cached function must not close over one caller's cookies, or the first
 * visitor's session would be baked into every later hit. Nothing here is
 * user-specific — the RLS policy on `events` is `select to authenticated
 * using (true)` — and the pages redirect unauthenticated visitors before this
 * ever runs.
 */
const loadEvents = unstable_cache(
  async () => {
    const supabase = createAnonClient()
    const { data, error } = await supabase.from('events').select('*').order('starts_at', { ascending: true })
    // Never cache a failure as an empty catalogue: that would pin "no events"
    // in place until the next admin write.
    if (error) throw new Error(`Could not load events: ${error.message}`)
    return (data ?? []) as EventRow[]
  },
  ['events-catalogue'],
  { tags: [EVENTS_TAG], revalidate: 300 },
)

/**
 * The one fetch every signed-in events page needs: the catalogue, plus what
 * the caller is registered for, keyed by event. Four pages were each rolling
 * their own version of this and disagreeing about what "registered" meant.
 */
export async function loadEventBoard() {
  const [supabase, user] = await Promise.all([getClient(), getUser()])
  if (!user) redirect('/')

  const [all, { data: regs }] = await Promise.all([loadEvents(), supabase.rpc('get_my_registrations')])

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
