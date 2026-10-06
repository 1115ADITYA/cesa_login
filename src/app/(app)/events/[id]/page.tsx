import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getClient, getUser } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sanitizeFields, sanitizeMaxUploadMb, type Answers } from '@/lib/formFields'
import { isProfileComplete, missingProfileFields } from '@/lib/profileFields'
import RegisterForm from './RegisterForm'
import TeamPanel from './TeamPanel'
import JoinNowButton from '@/components/JoinNowButton'
import {
  eventPhase,
  eventTitle,
  eventWhen,
  joinLink,
  registrationDeadline,
  registrationIsOpen,
  teamSizeLabel,
  timeUntil,
  usesSiteRegistration,
  type EventRow,
  type EventTeam,
} from '@/lib/events'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getClient()
  const { data } = await supabase.from('events').select('title').eq('id', id).maybeSingle()
  return { title: data ? `${eventTitle(data)} — CESA` : 'Event — CESA' }
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [supabase, user] = await Promise.all([getClient(), getUser()])
  if (!user) redirect('/')

  const [{ data: eventRow }, { data: teamJson }, { data: profile }] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).maybeSingle(),
    // Membership-based, not "did I create it" — joining a friend's team used to
    // leave you looking unregistered, with the register form still offered.
    supabase.rpc('get_event_team', { p_event_id: id }),
    supabase
      .from('profiles')
      .select('full_name, department, year_of_study, division, roll_no, contact')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  if (!eventRow) notFound()
  const event = eventRow as EventRow
  const team = (teamJson ?? null) as EventTeam | null
  const formFields = sanitizeFields(event.form_fields)

  // get_event_team only returns teams the caller is on, so reading that team's
  // answers with the service role does not widen what this member can see.
  let answers: Answers = {}
  if (team && formFields.length > 0) {
    const { data } = await createAdminClient().from('event_teams').select('form_answers').eq('id', team.id).maybeSingle()
    answers = (data?.form_answers ?? {}) as Answers
  }

  // eslint-disable-next-line react-hooks/purity -- Server Component, computed once per request
  const now = Date.now()
  const phase = eventPhase(event, now)
  const deadline = registrationDeadline(event)
  const closesIn = timeUntil(deadline, now)
  const registrationOpen = registrationIsOpen(event, now)
  const join = phase !== 'past' ? joinLink(event) : null
  // Coming Soon / Join Now: no registration on this page at all — not the
  // form, the team panel, the deadline or the team size. Custom text instead.
  const siteRegistration = usesSiteRegistration(event)

  return (
    <>
      <div className="mx-auto max-w-6xl">
        <Link href="/events" className="text-sm text-[var(--text-muted)] transition-colors hover:text-white">
          ← All events
        </Link>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {phase === 'live' && (
            <span className="pill bg-[var(--success)]/12 text-[var(--success)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              Happening now
            </span>
          )}
          {phase === 'past' && <span className="pill bg-white/5 text-[var(--text-faint)]">Ended</span>}
          {siteRegistration && (
            <>
              <span className="pill bg-white/5 text-[var(--text-muted)]">
                {teamSizeLabel(event.min_team_size, event.max_team_size)}
              </span>
              {registrationOpen && closesIn && (
                <span className="pill bg-[var(--accent)]/12 text-[var(--accent)]">Registration closes in {closesIn}</span>
              )}
              {!registrationOpen && phase !== 'past' && (
                <span className="pill bg-white/5 text-[var(--text-faint)]">Registration closed</span>
              )}
            </>
          )}
        </div>

        <h1 className="on-art mt-3 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold tracking-tight text-[var(--text-bright)] sm:text-4xl">
          {eventTitle(event)}
        </h1>

        {/* Two columns from lg up: the action on the left, the poster pinned on
            the right. The poster carries details that live only in the artwork
            — prizes, rules, the venue map — so it stays in view while someone
            fills the form rather than being scrolled past at the top. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
          <div className="min-w-0">
            <dl className={`grid gap-4 ${siteRegistration ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              <Meta label="When" value={eventWhen(event)} />
              <Meta label="Where" value={event.location || 'To be announced'} />
              {siteRegistration && (
                <Meta
                  label="Registration closes"
                  value={
                    deadline
                      ? deadline.toLocaleString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : 'To be announced'
                  }
                />
              )}
            </dl>

            {event.description && (
              <div className="mt-8">
                <h2 className="eyebrow mb-2">About</h2>
                <p className="on-art whitespace-pre-wrap leading-relaxed text-[var(--text)]">{event.description}</p>
              </div>
            )}

            <div className="mt-8">
              {!siteRegistration ? (
                (event.custom_text?.trim() || join) && (
                  <div className="glass p-6 text-center">
                    {event.custom_text?.trim() && (
                      <p className="whitespace-pre-wrap leading-relaxed text-[var(--text)]">{event.custom_text}</p>
                    )}
                    {join && (
                      <JoinNowButton
                        href={join}
                        className={`!px-8 !py-3 ${event.custom_text?.trim() ? 'mt-4' : ''}`}
                      />
                    )}
                  </div>
                )
              ) : team ? (
                <TeamPanel
                  eventId={id}
                  team={team}
                  minTeamSize={event.min_team_size}
                  maxTeamSize={event.max_team_size}
                  registrationOpen={registrationOpen}
                  eventStarted={phase !== 'upcoming'}
                  allowInvites={event.allow_invites ?? true}
                  formFields={formFields}
                  answers={answers}
                  userId={user.id}
                  maxUploadMb={sanitizeMaxUploadMb(event.max_upload_mb)}
                />
              ) : registrationOpen ? (
                <RegisterForm
                  eventId={id}
                  minTeamSize={event.min_team_size}
                  maxTeamSize={event.max_team_size}
                  profile={profile}
                  profileComplete={isProfileComplete(profile)}
                  missingFields={missingProfileFields(profile)}
                  formFields={formFields}
                  allowInvites={event.allow_invites ?? true}
                  userId={user.id}
                  maxUploadMb={sanitizeMaxUploadMb(event.max_upload_mb)}
                />
              ) : (
                <div className="glass p-6 text-center">
                  <p className="font-semibold text-white">Registration is closed</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {phase === 'past'
                      ? 'This event has already finished.'
                      : 'The deadline for this event has passed.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {event.poster_url && (
            <a
              href={event.poster_url}
              target="_blank"
              rel="noreferrer"
              className="glass group block overflow-hidden p-2 lg:sticky lg:top-6"
            >
              {/* 9:16 slot, and object-contain inside it — the whole poster
                  stays visible because the detail someone came for (prizes,
                  venue, rules) might sit in any corner of it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.poster_url}
                alt={`${eventTitle(event)} poster`}
                className="aspect-[9/16] w-full rounded-xl object-contain"
              />
              <p className="px-2 py-2 text-center text-xs text-[var(--text-faint)] transition-colors group-hover:text-[var(--text-muted)]">
                Tap to open full size
              </p>
            </a>
          )}
        </div>
      </div>
    </>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass p-4">
      <dt className="label">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--text)]">{value}</dd>
    </div>
  )
}
