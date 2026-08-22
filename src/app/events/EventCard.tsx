import Link from 'next/link'

type Event = { id: string; title: string; description: string; starts_at: string; ends_at: string; location: string | null }

export default function EventCard({ event, status }: { event: Event; status: string | null }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="block bg-[#1D1716] p-5 rounded-2xl border border-white/5 hover:border-[#E87A8C]/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold text-white">{event.title}</h3>
        {status === 'accepted' && (
          <span className="text-xs font-bold text-[#7AE8A2] bg-[#7AE8A2]/10 px-2 py-1 rounded-full shrink-0">Joined</span>
        )}
        {status === 'invited' && (
          <span className="text-xs font-bold text-[#E8C87A] bg-[#E8C87A]/10 px-2 py-1 rounded-full shrink-0">Invited</span>
        )}
      </div>
      <p className="text-[#A68F8C] text-sm mt-1 line-clamp-2">{event.description}</p>
      <p className="text-[#8C7A77] text-xs mt-3">
        {new Date(event.starts_at).toLocaleString()} {event.location ? `· ${event.location}` : ''}
      </p>
    </Link>
  )
}
