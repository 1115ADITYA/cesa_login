import { Suspense } from 'react'
import SiteNav from '@/components/SiteNav'
import LiveRefresh from '@/components/LiveRefresh'
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
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="ambient" aria-hidden />
      <LiveRefresh />
      <Suspense fallback={<NavSkeleton />}>
        <SiteNav />
      </Suspense>
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-8 sm:px-8">{children}</main>
    </>
  )
}
