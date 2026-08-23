import Link from 'next/link'
import { Band, EmptyState } from '@/components/AppShell'
import EventCard from '@/app/(app)/events/EventCard'
import { loadEventBoard } from '@/lib/eventData'
import { eventPhase } from '@/lib/events'

export const metadata = { title: 'Your events — CESA' }
export const dynamic = 'force-dynamic'

export default async function MyEventsPage() {
  const { now, mine, byEvent } = await loadEventBoard()

  const invited = mine.filter((e) => byEvent.get(e.id)?.my_status === 'invited')
  const joined = mine.filter((e) => byEvent.get(e.id)?.my_status === 'accepted')
  const upcoming = joined.filter((e) => eventPhase(e, now) !== 'past')
  const finished = joined.filter((e) => eventPhase(e, now) === 'past')

  return (
    <>
      <div className="mb-7">
        <h1 className="heading on-art text-3xl sm:text-4xl">Your events</h1>
        <p className="on-art mt-2 text-[var(--text)]">
          Everything you have registered for, plus invitations still waiting on you.
        </p>
      </div>

      {mine.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body="Once you register for an event — or a friend invites you to their team — it shows up on this page."
        >
          <Link href="/events" className="btn btn-primary">
            Browse events
          </Link>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {invited.length > 0 && (
            <Band title="Waiting on your reply" subtitle="Accept from the bell in the nav, or open the event.">
              <div className="grid gap-4 md:grid-cols-2">
                {invited.map((e) => (
                  <EventCard key={e.id} event={e} registration={byEvent.get(e.id) ?? null} now={now} />
                ))}
              </div>
            </Band>
          )}

          {upcoming.length > 0 && (
            <Band title="Registered" subtitle="Your teams and how close they are to being confirmed.">
              <div className="grid gap-4 md:grid-cols-2">
                {upcoming.map((e) => (
                  <EventCard key={e.id} event={e} registration={byEvent.get(e.id) ?? null} now={now} />
                ))}
              </div>
            </Band>
          )}

          {finished.length > 0 && (
            <Band title="Past">
              <div className="grid gap-4 md:grid-cols-2">
                {finished.map((e) => (
                  <EventCard key={e.id} event={e} registration={byEvent.get(e.id) ?? null} now={now} />
                ))}
              </div>
            </Band>
          )}
        </div>
      )}
    </>
  )
}
