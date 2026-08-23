'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Keeps the layout's data fresh without giving up the layout.
 *
 * Moving the nav into app/(app)/layout.tsx is what stopped its profile lookup
 * and invitation RPC re-running on every click — but Next only re-renders the
 * segments that changed, so the layout never re-rendered at all. An invitation
 * that arrived while you were browsing stayed invisible until a full page
 * reload, because clicking between pages only ever re-rendered the page.
 *
 * `router.refresh()` re-fetches the current route from the server *including*
 * its layouts, which is exactly the missing piece. It is triggered on the two
 * moments that actually matter — coming back to the tab, and a slow tick while
 * you are looking at it — rather than on navigation, so the fast-navigation
 * win stays intact.
 *
 * Refreshing is skipped while the tab is hidden: a background tab polling
 * Supabase every interval is pure waste, and the visibility listener catches
 * up the moment it is foregrounded.
 */
export default function LiveRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }

    window.addEventListener('focus', refreshIfVisible)
    document.addEventListener('visibilitychange', refreshIfVisible)
    const timer = setInterval(refreshIfVisible, intervalMs)

    return () => {
      window.removeEventListener('focus', refreshIfVisible)
      document.removeEventListener('visibilitychange', refreshIfVisible)
      clearInterval(timer)
    }
  }, [router, intervalMs])

  return null
}
