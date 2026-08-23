import SiteNav from '@/components/SiteNav'

/**
 * The signed-in shell, as a layout rather than a per-page wrapper.
 *
 * As a component inside each page, the nav re-rendered on every navigation —
 * which meant its profile lookup and invitation RPC ran again each time. In a
 * layout, Next only re-renders the segments that actually changed, so moving
 * between Home / Events / Your Teams re-renders the page and leaves the nav
 * mounted: two fewer Supabase round trips per click, and the header no longer
 * flickers.
 *
 * It also gives `loading.tsx` something worth showing — the nav stays put and
 * only the content area falls back to a skeleton.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="ambient" aria-hidden />
      <SiteNav />
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-8 sm:px-8">{children}</main>
    </>
  )
}
