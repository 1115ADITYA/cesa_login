import { notFound, redirect } from 'next/navigation'
import { isAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/utils/supabase/admin'
import { AdminHeader } from '../../../AdminShell'
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
    <>
      <AdminHeader title="Edit event" subtitle="Changes apply to the members’ board straight away." back={{ href: '/admin/events', label: 'All events' }} />
        <EventForm
          action={boundUpdate}
          submitLabel="Save changes"
          defaults={{
            title: event.title,
            description: event.description,
            location: event.location ?? '',
            bannerUrl: event.banner_url ?? '',
            bannerPosition: event.banner_position ?? '50% 50%',
            posterUrl: event.poster_url ?? '',
            startsAt: event.starts_at ?? undefined,
            endsAt: event.ends_at ?? undefined,
            dateLabel: event.date_label,
            registrationClosesAt: event.registration_closes_at ?? '',
            joinUrl: event.join_url ?? '',
            showJoinButton: event.show_join_button ?? false,
            customText: event.custom_text ?? '',
            minTeamSize: event.min_team_size,
            maxTeamSize: event.max_team_size,
          }}
        />
    </>
  )
}
