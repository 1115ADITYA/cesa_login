/**
 * Shared shapes and formatting for the events board. Kept out of the page
 * files so /events, /events/[id], /dashboard and the admin roster all describe
 * a team's state with the same words.
 */

export type MyRegistration = {
  event_id: string
  team_id: string
  team_name: string
  my_status: 'accepted' | 'invited'
  is_leader: boolean
  accepted_count: number
  pending_count: number
  min_team_size: number
  max_team_size: number | null
  confirmed: boolean
}

export type TeamMember = {
  id: string
  status: 'invited' | 'accepted' | 'declined'
  username: string
  fullName: string | null
  avatarUrl: string | null
  isLeader: boolean
  isMe: boolean
}

export type EventTeam = {
  id: string
  name: string
  isLeader: boolean
  members: TeamMember[]
}

export type EventRow = {
  id: string
  title: string
  description: string
  location: string | null
  banner_url: string | null
  banner_position: string | null
  poster_url: string | null
  /** Both null while the date is still to be announced — see date_label. */
  starts_at: string | null
  ends_at: string | null
  /** Shown in place of the dates while they are null. */
  date_label: string | null
  registration_closes_at: string | null
  min_team_size: number
  max_team_size: number | null
  /** Outside registration page behind the Join Now button. */
  join_url: string | null
  show_join_button: boolean
  /** Shown where registration would be, for events that take none. */
  custom_text: string | null
  /** Raw JSON from the database — always read through sanitizeFields(). */
  form_fields: unknown
  /** "Invite teammates by username"; off means solo registration. */
  allow_invites: boolean
}

export const DEFAULT_DATE_LABEL = 'Coming Soon'

/**
 * Coming Soon (undated) and Join Now events take no registrations here — the
 * admin's custom_text stands in for the form. Mirrors registration_is_open()
 * in 0012.
 */
export function usesSiteRegistration(event: Pick<EventRow, 'starts_at' | 'show_join_button'>) {
  return !event.show_join_button && event.starts_at !== null
}

/**
 * Registration deadline, falling back to the start of the event. Null when
 * neither is set — a Coming Soon event with no deadline stays open, matching
 * registration_is_open() in 0011.
 */
export function registrationDeadline(event: Pick<EventRow, 'registration_closes_at' | 'starts_at'>) {
  const at = event.registration_closes_at ?? event.starts_at
  return at ? new Date(at) : null
}

export function registrationIsOpen(
  event: Pick<EventRow, 'registration_closes_at' | 'starts_at' | 'show_join_button'>,
  now: number,
) {
  const deadline = registrationDeadline(event)
  return usesSiteRegistration(event) && deadline !== null && deadline.getTime() > now
}

export function eventPhase(event: Pick<EventRow, 'starts_at' | 'ends_at'>, now: number) {
  if (!event.starts_at || !event.ends_at) return 'upcoming' as const
  const start = new Date(event.starts_at).getTime()
  const end = new Date(event.ends_at).getTime()
  if (now < start) return 'upcoming' as const
  if (now <= end) return 'live' as const
  return 'past' as const
}

/**
 * How a team reads to its own members. `confirmed` is the whole point of the
 * min-team-size rule: a registration is provisional until enough people accept.
 */
export function teamState(reg: Pick<MyRegistration, 'my_status' | 'accepted_count' | 'min_team_size'>) {
  if (reg.my_status === 'invited') return 'invited' as const
  return reg.accepted_count >= reg.min_team_size ? ('confirmed' as const) : ('forming' as const)
}

/** A Coming Soon event may be saved without a title; never render a blank heading. */
export function eventTitle(event: { title: string | null }) {
  return event.title?.trim() || 'Upcoming event'
}

/** The "when" line for any event: its date range, or the Coming Soon text. */
export function eventWhen(event: Pick<EventRow, 'starts_at' | 'ends_at' | 'date_label'>) {
  if (!event.starts_at || !event.ends_at) return event.date_label?.trim() || DEFAULT_DATE_LABEL
  return formatDateRange(event.starts_at, event.ends_at)
}

/** The Join Now link, only when the admin has switched the button on. */
export function joinLink(event: Pick<EventRow, 'join_url' | 'show_join_button'>) {
  return event.show_join_button && event.join_url ? event.join_url : null
}

export function formatDateRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const sameDay = start.toDateString() === end.toDateString()

  const date = start.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  const startTime = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const endTime = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  if (sameDay) return `${date} · ${startTime} – ${endTime}`

  // Carry the year on the end date only when it differs, otherwise a range
  // like 1 Mar 2026 → 1 Jan reads as if the event runs backwards.
  const endDate = end.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(end.getFullYear() === start.getFullYear() ? {} : { year: 'numeric' }),
  })
  return `${date} ${startTime} → ${endDate} ${endTime}`
}

/** "in 3 days" / "in 4 hours" / "closed" — for the registration deadline. */
export function timeUntil(target: Date | null, now: number) {
  if (!target) return null
  const ms = target.getTime() - now
  if (ms <= 0) return null

  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

/** "Solo" / "Teams of 3" / "Teams of 2–4". */
export function teamSizeLabel(min: number, max: number | null) {
  if (max === 1) return 'Solo entry'
  if (max === null) return min > 1 ? `Teams of ${min}+` : 'Any team size'
  if (min === max) return `Teams of ${max}`
  return `Teams of ${min}–${max}`
}
