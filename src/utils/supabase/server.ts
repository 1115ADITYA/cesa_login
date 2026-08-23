import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Request-scoped client and user.
 *
 * `auth.getUser()` is a network call to Supabase Auth, not a cookie read — it
 * verifies the JWT server-side. A single page was making up to four of them:
 * the middleware, the nav, the page itself and its data loader each built their
 * own client and asked independently. With the Supabase project in Mumbai and
 * Vercel functions defaulting to Washington DC, that was roughly a second of
 * round trips before a single row was fetched.
 *
 * React's `cache()` memoises per request, so every caller inside one render
 * shares a single client and a single auth check. Concurrent callers share the
 * in-flight promise rather than racing a second request. The middleware runs in
 * its own invocation and still does its own check — that one is what keeps the
 * session refreshed.
 */
export const getClient = cache(createClient)

export const getUser = cache(async () => {
  const supabase = await getClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
