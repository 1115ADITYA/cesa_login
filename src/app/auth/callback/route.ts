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
        .single()
        
      if (!existingProfile) {
        // Create profile for OAuth user
        const fullName = authData.user.user_metadata?.full_name || 'User'
        const avatarUrl = authData.user.user_metadata?.avatar_url || ''
        const email = authData.user.email || ''
        
        // Generate a simple unique username
        const baseUsername = fullName.toLowerCase().replace(/[^a-z0-9]/g, '') || email.split('@')[0].replace(/[^a-z0-9]/g, '')
        const randomNum = Math.floor(Math.random() * 10000)
        let newUsername = `${baseUsername}_${randomNum}`
        
        // Ensure uniqueness (simple retry loop if collision)
        let isUnique = false
        while (!isUnique) {
          const { data: collision } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', newUsername)
            .single()
            
          if (!collision) {
            isUnique = true
          } else {
            newUsername = `${baseUsername}_${Math.floor(Math.random() * 100000)}`
          }
        }
        
        await supabase.from('profiles').insert({
          id: authData.user.id,
          full_name: fullName,
          username: newUsername,
          email: email,
          avatar_url: avatarUrl,
          role: 'participant'
        })
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
