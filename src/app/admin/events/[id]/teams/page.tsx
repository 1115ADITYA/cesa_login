import { notFound, redirect } from 'next/navigation'
import { isAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/utils/supabase/admin'
import { AdminHeader } from '../../../AdminShell'
import TeamRow from './TeamRow'
import {
  VIDEO_BUCKET,
  answerText,
  formatDuration,
  isMemberAnswers,
  isVideoAnswer,
  sanitizeFields,
  type Answers,
  type FormField,
} from '@/lib/formFields'
import MembersTable from '@/components/MembersTable'
import { renameTeam, removeTeam, addTeamMember, removeTeamMember, makeTeamLeader, searchProfiles } from '../../../actions'

export const metadata = { title: 'Teams — Admin', robots: { index: false } }
export const dynamic = 'force-dynamic'

type Profile = {
  username: string
  full_name: string
  department: string | null
  year_of_study: string | null
  division: string | null
  roll_no: string | null
  contact: string | null
} | null

export default async function EventTeamsPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect('/admin')
  const { id: eventId } = await params

  const supabase = createAdminClient()
  const { data: event } = await supabase
    .from('events')
    .select('id, title, min_team_size, max_team_size, form_fields')
    .eq('id', eventId)
    .maybeSingle()
  if (!event) notFound()

  // `profiles` must be reached through an explicitly named foreign key:
  // event_team_members points at it twice (user_id and invited_by), so a bare
  // `profiles(...)` embed is ambiguous and PostgREST rejects the whole query
  // with PGRST201. This page used to swallow that error by destructuring only
  // `data`, and every event silently reported "No teams registered yet."
  const { data: teams, error: teamsError } = await supabase
    .from('event_teams')
    .select(
      'id, name, created_at, created_by, form_answers, event_team_members(id, status, user_id, invited_at, responded_at, profiles!event_team_members_user_id_fkey(username, full_name, department, year_of_study, division, roll_no, contact))',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  // Surfaced rather than rendered as an empty roster — "no teams" and "the
  // query failed" must never look the same on a page organisers act on.
  if (teamsError) throw new Error(`Could not load teams: ${teamsError.message}`)

  const formFields = sanitizeFields(event.form_fields)

  // Videos sit in a private bucket; hand the admin short-lived links, signed
  // in one batch for the whole page.
  const videoPaths = (teams ?? []).flatMap((t) =>
    Object.values((t.form_answers ?? {}) as Answers).filter(isVideoAnswer).map((v) => v.path),
  )
  const videoUrls = new Map<string, string>()
  if (videoPaths.length > 0) {
    const { data: signed } = await supabase.storage.from(VIDEO_BUCKET).createSignedUrls(videoPaths, 60 * 60)
    for (const s of signed ?? []) if (s.path && s.signedUrl) videoUrls.set(s.path, s.signedUrl)
  }

  const summary = (teams ?? []).reduce(
    (acc, t) => {
      const accepted = (t.event_team_members ?? []).filter((m) => m.status === 'accepted').length
      acc.total += 1
      acc.people += accepted
      if (accepted >= event.min_team_size) acc.confirmed += 1
      else acc.forming += 1
      return acc
    },
    { total: 0, confirmed: 0, forming: 0, people: 0 },
  )

  return (
    <>
      <AdminHeader
        title={event.title?.trim() || 'Upcoming event'}
        subtitle={`Needs ${event.min_team_size} accepted member${event.min_team_size === 1 ? '' : 's'} for a team to count as confirmed.`}
        back={{ href: '/admin/events', label: 'All events' }}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Teams" value={summary.total} />
        <Stat label="Confirmed" value={summary.confirmed} tone="text-[var(--success)]" />
        <Stat label="Still forming" value={summary.forming} tone="text-[var(--warning)]" />
        <Stat label="People confirmed" value={summary.people} />
      </div>

      {!teams?.length ? (
        <div className="glass px-6 py-12 text-center">
          <p className="font-semibold text-white">No teams registered yet</p>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            Teams appear here the moment someone registers, even before their invites are accepted.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {teams.map((t) => (
            <TeamRow
              key={t.id}
              minTeamSize={event.min_team_size}
              maxTeamSize={event.max_team_size}
              team={{
                id: t.id,
                name: t.name,
                leaderId: t.created_by,
                // Supabase's generated types make a to-one FK relation look like
                // an array here; it is exactly one row per membership.
                members: (t.event_team_members ?? []).map((m) => ({
                  id: m.id,
                  status: m.status,
                  isLeader: m.user_id === t.created_by,
                  username: (m.profiles as unknown as Profile)?.username ?? '(deleted user)',
                  fullName: (m.profiles as unknown as Profile)?.full_name ?? '',
                  department: (m.profiles as unknown as Profile)?.department ?? null,
                  yearOfStudy: (m.profiles as unknown as Profile)?.year_of_study ?? null,
                  division: (m.profiles as unknown as Profile)?.division ?? null,
                  rollNo: (m.profiles as unknown as Profile)?.roll_no ?? null,
                  contact: (m.profiles as unknown as Profile)?.contact ?? null,
                })),
              }}
              eventId={eventId}
              renameTeam={renameTeam}
              removeTeam={removeTeam}
              addTeamMember={addTeamMember}
              removeTeamMember={removeTeamMember}
              makeTeamLeader={makeTeamLeader}
              searchProfiles={searchProfiles}
            >
              {formFields.length > 0 && (
                <FormAnswers fields={formFields} answers={(t.form_answers ?? {}) as Answers} videoUrls={videoUrls} />
              )}
            </TeamRow>
          ))}
        </div>
      )}
    </>
  )
}

function Stat({ label, value, tone = 'text-[var(--text-bright)]' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="glass p-4 text-center">
      <p className={`heading text-3xl ${tone}`}>{value}</p>
      <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-wider text-[var(--text-faint)]">{label}</p>
    </div>
  )
}

function FormAnswers({
  fields,
  answers,
  videoUrls,
}: {
  fields: FormField[]
  answers: Answers
  videoUrls: Map<string, string>
}) {
  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      <p className="label mb-3">Registration form</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const answer = answers[f.id]
          const url = isVideoAnswer(answer) ? videoUrls.get(answer.path) : undefined
          return (
            <div key={f.id} className={f.type === 'long' || f.type === 'video' || f.type === 'members' ? 'sm:col-span-2' : ''}>
              <dt className="text-xs font-semibold text-[var(--text-muted)]">{f.label}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[var(--text)]">
                {answer === undefined ? (
                  <span className="text-[var(--text-faint)]">Not answered</span>
                ) : f.type === 'members' ? (
                  <MembersTable field={f} members={isMemberAnswers(answer) ? answer : []} />
                ) : isVideoAnswer(answer) ? (
                  url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="text-[var(--accent-light)] hover:underline">
                      ▶ {answer.name} · {formatDuration(answer.durationSec)} · {(answer.size / 1024 / 1024).toFixed(1)} MB
                    </a>
                  ) : (
                    <span className="text-[var(--text-faint)]">{answer.name} (file missing)</span>
                  )
                ) : f.type === 'url' ? (
                  <a
                    href={/^https?:\/\//i.test(answerText(answer)) ? answerText(answer) : `https://${answerText(answer)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--accent-light)] hover:underline"
                  >
                    {answerText(answer)}
                  </a>
                ) : (
                  answerText(answer)
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}
