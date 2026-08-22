import { notFound, redirect } from 'next/navigation'
import { isAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/utils/supabase/admin'
import AdminNav from '../../../AdminNav'
import EventForm from '../../EventForm'
import { updateEvent } from '../../../actions'

export const metadata = { title: 'Edit event — Admin', robots: { index: false } }

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect('/admin')
  const { id } = await params

  const supabase = createAdminClient()
  const { data: event } = await supabase.from('events').select('*').eq('id', id).maybeSingle()
  if (!event) notFound()

  const boundUpdate = updateEvent.bind(null, id)

  return (
    <div className="min-h-screen bg-[#130F0E] text-[#F3E9E8] p-8">
      <div className="max-w-5xl mx-auto">
        <AdminNav active="events" />
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] mb-6">Edit event</h1>
        <EventForm
          action={boundUpdate}
          submitLabel="Save changes"
          defaults={{
            title: event.title,
            description: event.description,
            location: event.location ?? '',
            bannerUrl: event.banner_url ?? '',
            startsAt: event.starts_at,
            endsAt: event.ends_at,
            registrationClosesAt: event.registration_closes_at ?? '',
            minTeamSize: event.min_team_size,
            maxTeamSize: event.max_team_size,
          }}
        />
      </div>
    </div>
  )
}
