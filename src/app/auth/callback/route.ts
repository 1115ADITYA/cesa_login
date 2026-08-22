import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
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
    
    const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && authData.user) {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authData.user.id)
        .maybeSingle()

      if (!existingProfile) {
        // Create profile for OAuth user
        const fullName = authData.user.user_metadata?.full_name || 'User'
        const avatarUrl = authData.user.user_metadata?.avatar_url || ''
        const email = authData.user.email || ''

        const baseUsername =
          fullName.toLowerCase().replace(/[^a-z0-9]/g, '') ||
          email.split('@')[0].replace(/[^a-z0-9]/g, '') ||
          'member'

        // Collision detection used to be a `select` against other people's
        // profile rows, which RLS can hide — the check then always said "free",
        // the insert lost to the unique index, and the account ended up with no
        // profile at all (and so no username anyone could invite). Let the
        // unique constraint be the judge and retry on 23505 instead.
        for (let attempt = 0; attempt < 5; attempt++) {
          const candidate = `${baseUsername}_${Math.floor(Math.random() * 100000)}`
          const { error: insertError } = await supabase.from('profiles').insert({
            id: authData.user.id,
            full_name: fullName,
            username: candidate,
            email: email,
            avatar_url: avatarUrl,
            role: 'participant'
          })
          if (!insertError) break
          if (insertError.code !== '23505') {
            console.error('Profile creation failed:', insertError)
            break
          }
        }
      }
      
      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/?error=auth-callback-failed`)
}
