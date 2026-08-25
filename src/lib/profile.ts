import 'server-only'
import { cache } from 'react'
import { getClient, getUser } from '@/utils/supabase/server'
import type { ProfileDetails } from './profileFields'

export type MyProfile = ProfileDetails & {
  username: string | null
  avatar_url: string | null
  role: string | null
}

/**
 * The signed-in member's own profile row, memoised per request.
 *
 * Both the nav and the completion gate in app/(app)/layout.tsx need this, and
 * they render on the same request — without `cache()` that would be two round
 * trips to Supabase on every navigation, undoing the work that got page loads
 * down in the first place. React's cache() makes concurrent callers share one
 * in-flight promise.
 */
export const getMyProfile = cache(async (): Promise<MyProfile | null> => {
  const [supabase, user] = await Promise.all([getClient(), getUser()])
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('username, full_name, avatar_url, role, department, year_of_study, division, roll_no, contact')
    .eq('id', user.id)
    .maybeSingle()

  return (data as MyProfile) ?? null
})
