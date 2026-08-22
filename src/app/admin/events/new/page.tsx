import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/adminAuth'
import AdminNav from '../../AdminNav'
import EventForm from '../EventForm'
import { createEvent } from '../../actions'

export const metadata = { title: 'New event — Admin', robots: { index: false } }

export default async function NewEventPage() {
  if (!(await isAdmin())) redirect('/admin')

  return (
    <div className="min-h-screen bg-[#130F0E] text-[#F3E9E8] p-8">
      <div className="max-w-5xl mx-auto">
        <AdminNav active="events" />
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] mb-6">New event</h1>
        <EventForm action={createEvent} submitLabel="Create event" />
      </div>
    </div>
  )
}
