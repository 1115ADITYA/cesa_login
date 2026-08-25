import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import SiteNav from '@/components/SiteNav'
import { getMyProfile } from '@/lib/profile'
import { isProfileComplete } from '@/lib/profileFields'
import { NavSkeleton } from '@/components/Skeletons'

/**
 * The signed-in shell, as a layout rather than a per-page wrapper.
 *
 * As a component inside each page, the nav re-rendered on every navigation —
 * which meant its profile lookup and invitation RPC ran again each time. In a
 * layout, Next only re-renders the segments that actually changed, so moving
 * between Home / Events / Your Teams re-renders the page and leaves the nav
 * mounted.
 *
 * The Suspense boundary matters as much: this layout is synchronous, so the
 * server flushes the page frame straight away and streams the nav's data in
 * behind it. Awaiting the nav here would have held up the whole document.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The mandatory profile gate. Sits in the layout so it covers every signed-in
  // page at once rather than relying on each one remembering to check. The
  // target lives outside this route group, or redirecting to it would loop.
  //
  // getMyProfile is request-memoised and SiteNav calls it too, so gating costs
  // no extra Supabase round trip.
  const profile = await getMyProfile()
  if (profile && !isProfileComplete(profile)) {
    redirect('/complete-profile')
  }

  return (
    <>
      <div className="ambient" aria-hidden />
      <Suspense fallback={<NavSkeleton />}>
        <SiteNav />
      </Suspense>
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-8 sm:px-8">{children}</main>
    </>
  )
}
