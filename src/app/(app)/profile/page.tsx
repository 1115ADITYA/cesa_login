import { redirect } from 'next/navigation'
import { getClient, getUser } from '@/utils/supabase/server'
import { ProfileCard } from '@/app/(app)/dashboard/profile-card'
import { loadEventBoard } from '@/lib/eventData'

export const metadata = { title: 'Profile — CESA' }
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const [supabase, user] = await Promise.all([getClient(), getUser()])
  if (!user) redirect('/')

  const [{ data: profile }, board] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    loadEventBoard(),
  ])

  const joined = board.registrations.filter((r) => r.my_status === 'accepted')
  const confirmed = joined.filter((r) => r.confirmed).length
  const leading = joined.filter((r) => r.is_leader).length

  return (
    <>
      <div className="mb-7">
        <h1 className="heading on-art text-3xl sm:text-4xl">Profile</h1>
        <p className="on-art mt-2 text-[var(--text)]">
          Your username is how teammates find and invite you, so keep it something they will recognise.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <ProfileCard profile={profile} userEmail={user.email || ''} />

        <div className="flex flex-col gap-6 md:col-span-2">
          <section className="glass p-6">
            <h2 className="mb-4 font-bold text-white">At a glance</h2>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Events joined" value={joined.length} />
              <Stat label="Teams confirmed" value={confirmed} />
              <Stat label="Teams you lead" value={leading} />
            </div>
          </section>

          <section className="glass p-6">
            <h2 className="mb-4 font-bold text-white">Account</h2>
            <dl className="flex flex-col gap-3 text-sm">
              <Row label="Email" value={user.email || '—'} />
              <Row label="Username" value={profile?.username ? `@${profile.username}` : 'Not set yet'} />
              <Row label="Role" value={profile?.role || 'participant'} />
              <Row
                label="Member since"
                value={new Date(user.created_at).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              />
            </dl>
          </section>
        </div>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-sunken)] p-4 text-center">
      <p className="heading text-3xl">{value}</p>
      <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-wider text-[var(--text-faint)]">{label}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
      <dt className="text-[var(--text-faint)]">{label}</dt>
      <dd className="truncate font-semibold text-[var(--text)]">{value}</dd>
    </div>
  )
}
