'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

/**
 * Keeps the layout's data fresh without giving up the layout.
 *
 * Moving the nav into app/(app)/layout.tsx is what stopped its profile lookup
 * and notification query re-running on every click — but Next only re-renders
 * the segments that changed, and a layout is never one of them. So the nav's
 * data was fetched once per full page load and then frozen: an invitation
 * arriving while you browsed stayed invisible until a manual reload.
 *
 * `router.refresh()` re-fetches the current route from the server *including*
 * its layouts, which is the missing piece. Three things trigger it:
 *
 *   1. A Postgres realtime subscription on `notifications` for this user. This
 *      is the one that makes an invite appear immediately — the row lands and
 *      the nav re-renders, no polling involved.
 *   2. Returning to the tab, which covers anything missed while the socket was
 *      closed or the laptop was asleep.
 *   3. A slow tick, purely as a backstop for a dropped socket.
 *
 * Deliberately not on navigation, so the fast-click win survives. Hidden tabs
 * skip the tick; the visibility listener catches up on return.
 */
export default function LiveRefresh({
  userId,
  intervalMs = 120_000,
}: {
  userId: string
  intervalMs?: number
}) {
  const router = useRouter()

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }

    window.addEventListener('focus', refreshIfVisible)
    document.addEventListener('visibilitychange', refreshIfVisible)
    const timer = setInterval(refreshIfVisible, intervalMs)

    // Filtered server-side by user_id: without the filter every client would
    // wake on every notification in the table.
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => router.refresh(),
      )
      .subscribe()

    return () => {
      window.removeEventListener('focus', refreshIfVisible)
      document.removeEventListener('visibilitychange', refreshIfVisible)
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [router, intervalMs, userId])

  return null
}
