import Link from 'next/link'
import { Band, EmptyState } from '@/components/AppShell'
import EventCard from '@/app/(app)/events/EventCard'
import EventRow from '@/components/EventRow'
import { loadEventBoard } from '@/lib/eventData'

export const metadata = { title: 'Home — CESA' }
export const dynamic = 'force-dynamic'

export default async function Home() {
  const { now, all, mine, byEvent, registrations } = await loadEventBoard()

  const needsAttention = registrations.filter((r) => r.my_status === 'accepted' && !r.confirmed).length
  const pendingInvites = registrations.filter((r) => r.my_status === 'invited').length

  // The catalogue band leads with what someone can still act on, and never
  // repeats a card that is already sitting in the rail above it.
  const browse = all.filter((e) => !byEvent.has(e.id)).slice(0, 6)

  return (
    <>
      <div className="flex flex-col gap-6">
        <Band
          title="Your events"
          subtitle={
            pendingInvites > 0
              ? `${pendingInvites} invitation${pendingInvites === 1 ? '' : 's'} waiting on you — check the bell.`
              : needsAttention > 0
                ? `${needsAttention} team${needsAttention === 1 ? '' : 's'} still need members to confirm.`
                : mine.length > 0
                  ? 'Everything you have registered for or been invited to.'
                  : undefined
          }
          action={
            mine.length > 0 ? (
              <Link href="/my-events" className="text-sm font-bold text-[var(--accent)] hover:underline">
                See all →
              </Link>
            ) : undefined
          }
        >
          {mine.length === 0 ? (
            <EmptyState
              title="You haven't joined anything yet"
              body="Register for an event below and your team will show up here, with its confirmation progress."
            >
              <Link href="/events" className="btn btn-primary">
                Browse events
              </Link>
            </EmptyState>
          ) : (
            <div className="rail">
              {mine.map((e) => (
                <EventCard key={e.id} event={e} registration={byEvent.get(e.id) ?? null} now={now} />
              ))}
            </div>
          )}
        </Band>

        <Band
          title="All events"
          subtitle="Everything CESA is running this year."
          action={
            <Link href="/events" className="text-sm font-bold text-[var(--accent)] hover:underline">
              Browse all →
            </Link>
          }
        >
          {browse.length === 0 ? (
            <EmptyState
              title={all.length === 0 ? 'No events published yet' : 'You are signed up for everything'}
              body={
                all.length === 0
                  ? 'New CESA events are posted here through the year — check back soon.'
                  : 'Every event currently on the board is already in your list above.'
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {browse.map((e) => (
                <EventRow key={e.id} event={e} registration={null} now={now} />
              ))}
            </div>
          )}
        </Band>
      </div>
    </>
  )
}
