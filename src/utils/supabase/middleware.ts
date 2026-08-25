import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Define protected and auth routes
  const isAuthRoute = request.nextUrl.pathname === '/' || request.nextUrl.pathname.startsWith('/auth')
  const PROTECTED = ['/dashboard', '/events', '/my-events', '/my-teams', '/profile', '/complete-profile']
  const isProtectedRoute = PROTECTED.some((p) => request.nextUrl.pathname.startsWith(p))

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // /admin is a completely separate credential from Supabase Auth (see
  // lib/adminAuth.ts), and its HMAC check needs Node's `crypto` module, which
  // Edge middleware cannot use. This is only the coarse gate — "is there even
  // a cesa_admin cookie" — so a stale or empty cookie is bounced to the login
  // page immediately; the real verification happens in each /admin page
  // (Node runtime) via isAdmin().
  const isAdminArea = request.nextUrl.pathname.startsWith('/admin') && request.nextUrl.pathname !== '/admin'
  if (isAdminArea && !request.cookies.get('cesa_admin')?.value) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
