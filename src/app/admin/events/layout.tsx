import AdminShell from '../AdminShell'

/**
 * Wraps every /admin/events page so the admin header is rendered once and kept
 * mounted across navigation, the same reason the member shell moved into
 * app/(app)/layout.tsx. /admin itself (the login) deliberately sits outside
 * this, since there is no session to build a header from yet.
 */
export default function AdminEventsLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
