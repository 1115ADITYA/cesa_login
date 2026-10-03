import 'server-only'
import { unstable_cache } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import { getClient, getUser } from '@/utils/supabase/server'
import { eventPhase, registrationIsOpen, usesSiteRegistration, type EventRow, type MyRegistration } from './events'

export const EVENTS_TAG = 'events'

/**
 * The event catalogue is the same for every signed-in member and only changes
 * when an admin edits it, yet it was the slowest query on the page (~250ms
 * median) and ran on every request. Cached under a tag instead; the admin
 * write paths expire it immediately.
 *
 * The client choice here is load-bearing. A cached function must not close
 * over one caller's cookies, so the request-scoped client is out. The anon
 * client is also wrong, and silently so: the RLS policy on `events` is
 * `for select TO AUTHENTICATED using (true)`, so the anon role matches no
 * policy and PostgREST returns an empty array rather than an error — which
 * cached "no events at all" for everyone. Hence the service-role client, which
 * is request-independent and sees every row.
 *
 * That means access control for this table now lives in the callers: every
 * page redirects an unauthenticated visitor before reaching loadEventBoard.
 * If `events` ever gains rows that are not meant for all members (drafts, say),
 * this must filter them explicitly — the RLS policy will no longer do it.
 */
const loadEvents = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase.from('events').select('*').order('starts_at', { ascending: true })
    // Never cache a failure as an empty catalogue: that would pin "no events"
    // in place until the next admin write.
    if (error) throw new Error(`Could not load events: ${error.message}`)
    return (data ?? []) as EventRow[]
  },
  ['events-catalogue'],
  { tags: [EVENTS_TAG], revalidate: 60 },
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
    /** Coming Soon and Join Now events — upcoming, but no registration here. */
    announced: all.filter((e) => eventPhase(e, now) === 'upcoming' && !usesSiteRegistration(e)),
    open: all.filter((e) => eventPhase(e, now) === 'upcoming' && registrationIsOpen(e, now)),
    closed: all.filter(
      (e) => eventPhase(e, now) === 'upcoming' && usesSiteRegistration(e) && !registrationIsOpen(e, now),
    ),
    past: all.filter((e) => eventPhase(e, now) === 'past'),
  }
}
