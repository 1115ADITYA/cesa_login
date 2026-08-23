import Link from 'next/link'
import { Band, EmptyState } from '@/components/AppShell'
import EventRow from '@/components/EventRow'
import EventCard from './EventCard'
import { loadEventBoard } from '@/lib/eventData'

export const metadata = { title: 'Events — CESA' }
export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  const { now, all, live, open, closed, past, byEvent } = await loadEventBoard()

  return (
    <>
      <div className="mb-7">
        <h1 className="heading on-art text-3xl sm:text-4xl">Events</h1>
        <p className="on-art mt-2 text-[var(--text)]">
          Register, build your team, and track everything you have joined.
        </p>
      </div>

      {all.length === 0 ? (
        <EmptyState
          title="No events published yet"
          body="New CESA events are posted here through the year — check back soon."
        >
          <Link href="/dashboard" className="btn btn-ghost">
            Back to home
          </Link>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {live.length > 0 && (
            <Band title="Happening now">
              <div className="grid gap-4 md:grid-cols-2">
                {live.map((e) => (
                  <EventCard key={e.id} event={e} registration={byEvent.get(e.id) ?? null} now={now} />
                ))}
              </div>
            </Band>
          )}

          <Band
            title="Open for registration"
            subtitle={open.length === 0 ? undefined : `${open.length} event${open.length === 1 ? '' : 's'} taking entries`}
          >
            {open.length === 0 ? (
              <EmptyState title="Nothing open right now" body="Registrations for the next event will open here." />
            ) : (
              <div className="flex flex-col gap-3">
                {open.map((e) => (
                  <EventRow key={e.id} event={e} registration={byEvent.get(e.id) ?? null} now={now} />
                ))}
              </div>
            )}
          </Band>

          {closed.length > 0 && (
            <Band title="Registration closed" subtitle="Still coming up, but no longer taking entries.">
              <div className="flex flex-col gap-3">
                {closed.map((e) => (
                  <EventRow key={e.id} event={e} registration={byEvent.get(e.id) ?? null} now={now} />
                ))}
              </div>
            </Band>
          )}

          {past.length > 0 && (
            <Band title="Past events">
              <div className="flex flex-col gap-3">
                {past.map((e) => (
                  <EventRow key={e.id} event={e} registration={byEvent.get(e.id) ?? null} now={now} />
                ))}
              </div>
            </Band>
          )}
        </div>
      )}
    </>
  )
}
