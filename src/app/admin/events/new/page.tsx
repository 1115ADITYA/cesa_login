import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/adminAuth'
import AdminShell, { AdminHeader } from '../../AdminShell'
import EventForm from '../EventForm'
import { createEvent } from '../../actions'

export const metadata = { title: 'New event — Admin', robots: { index: false } }

export default async function NewEventPage() {
  if (!(await isAdmin())) redirect('/admin')

  return (
    <AdminShell>
      <AdminHeader title="New event" subtitle="Publishing makes it visible to every member immediately." back={{ href: '/admin/events', label: 'All events' }} />
        <EventForm action={createEvent} submitLabel="Create event" />
    </AdminShell>
  )
}
