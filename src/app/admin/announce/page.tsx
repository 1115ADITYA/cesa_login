import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/utils/supabase/admin'
import AdminShell, { AdminHeader } from '../AdminShell'
import AnnounceForm from './AnnounceForm'

export const metadata = { title: 'Send notification — Admin', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function AnnouncePage() {
  if (!(await isAdmin())) redirect('/admin')

  const supabase = createAdminClient()
  // Newest first: an announcement is nearly always about the event coming up,
  // not one from last term.
  const { data: events } = await supabase
    .from('events')
    .select('id, title')
    .order('starts_at', { ascending: false })

  return (
    <AdminShell active="announce">
      <AdminHeader
        title="Send a notification"
        subtitle="Goes straight to the notification bell of everyone you choose."
      />
      <AnnounceForm events={events ?? []} />
    </AdminShell>
  )
}
