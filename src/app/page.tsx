"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()

  const [view, setView] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  
  // Live username checking states
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')

  // Live Check Username Effect
  useEffect(() => {
    if (view !== 'signup' || !username) {
      setUsernameStatus('idle')
      return
    }

    // Debounce the check so it doesn't spam the database on every single keystroke
    setUsernameStatus('checking')
    const timer = setTimeout(async () => {
      // Basic format check
      if (username.length < 3) {
        setUsernameStatus('idle')
        return
      }

      const { data, error } = await supabase.rpc('check_username_available', {
        username_to_check: username
      })

      if (error) {
        setUsernameStatus('idle')
        return
      }

      if (data === false) {
        setUsernameStatus('taken')
      } else {
        setUsernameStatus('available')
      }
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [username, view, supabase])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (usernameStatus === 'taken') {
      setError("Username is already taken.")
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    // Attempt signup
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    })

    if (error) {
      if (error.message.includes("already exists") || error.message.includes("already registered")) {
        setError("An account with this email already exists. Please sign in or use Google.")
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    if (data.user) {
      // Because email confirmations are enabled, the user does NOT have a session yet.
      // This means auth.uid() is null, so standard RLS blocks the insert.
      // We use a secure Postgres RPC function to handle the insert.
      const { error: profileError } = await supabase.rpc('create_profile_after_signup', {
        p_id: data.user.id,
        p_full_name: fullName,
        p_username: username,
        p_email: email
      })
      
      if (profileError) {
        console.error("Profile creation error:", profileError)
      }

      setMessage('Check your email for the confirmation link.')
      setView('signin')
    }
    
    setLoading(false)
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage('Password reset link sent to your email.')
    }
    setLoading(false)
  }

  const handleGoogleOAuth = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex w-screen h-screen min-h-screen bg-[#130F0E] text-[#F3E9E8] font-sans">
      <div className="hidden lg:flex lg:w-7/12 relative bg-[#130F0E]">
        <Image 
          src="/bg-cherry.jpg" 
          alt="Cherry Blossom Building" 
          fill 
          className="object-cover opacity-90"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#130F0E]/40 to-[#130F0E]"></div>
        <div className="absolute top-10 left-10 z-10">
          <Image 
            src="/cesa-logo.png" 
            alt="CESA logo" 
            width={140} 
            height={35} 
            className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" 
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-12 relative bg-[#130F0E]">
        <div className="lg:hidden absolute top-8 left-8">
          <Image 
            src="/cesa-logo.png" 
            alt="CESA logo" 
            width={100} 
            height={25} 
            className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" 
          />
        </div>

        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-[#1D1716]/80 p-10 rounded-[2rem] backdrop-blur-xl border border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-[#E87A8C]/40 to-transparent"></div>

            {view === 'signin' && (
              <form onSubmit={handleSignIn} className="flex flex-col gap-4">
                <div>
                  <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold mb-2 tracking-tight text-[#FDF8F8]">Welcome Back</h1>
                  <p className="text-[#A68F8C] text-sm">Sign in to your CESA account to continue.</p>
                </div>
                
                {error && <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20">{error}</div>}
                {message && <div className="text-sm text-green-400 bg-green-400/10 p-3 rounded-xl border border-green-400/20">{message}</div>}

                <div className="flex flex-col gap-4 mt-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#8C7A77] uppercase tracking-wider">Email</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email" 
                      required
                      className="w-full p-3.5 rounded-xl border border-white/5 bg-black/30 text-[#F3E9E8] text-sm outline-none transition-all focus:border-[#E87A8C] focus:bg-black/50 focus:ring-1 focus:ring-[#E87A8C]/50 placeholder-[#6B5A58]" 
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-[#8C7A77] uppercase tracking-wider">Password</label>
                      {/* MADE FORGOT PASSWORD MORE PROMINENT HERE */}
                      <button type="button" onClick={() => { setView('forgot'); setError(null); setMessage(null) }} className="text-xs text-[#E87A8C] font-bold hover:text-[#F4A5AE] transition-colors underline underline-offset-4">Forgot Password?</button>
                    </div>
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password" 
                      required
                      className="w-full p-3.5 rounded-xl border border-white/5 bg-black/30 text-[#F3E9E8] text-sm outline-none transition-all focus:border-[#E87A8C] focus:bg-black/50 focus:ring-1 focus:ring-[#E87A8C]/50 placeholder-[#6B5A58]" 
                    />
                  </div>
                </div>

                <button disabled={loading} type="submit" className="w-full mt-2 bg-gradient-to-r from-[#D16475] via-[#E87A8C] to-[#F4A5AE] text-white font-bold py-3.5 rounded-xl shadow-[0_8px_20px_rgba(232,122,140,0.2)] hover:shadow-[0_8px_25px_rgba(232,122,140,0.35)] transition-all hover:-translate-y-0.5 active:translate-y-0 bg-[length:200%_auto] hover:bg-[position:right_center] disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink-0 mx-4 text-[#8C7A77] text-xs font-bold uppercase tracking-widest">Or</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <button type="button" onClick={handleGoogleOAuth} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-[#D1C2C0] font-semibold py-3.5 rounded-xl hover:bg-white/10 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  <svg width="20" height="20" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.85.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
                  Continue with Google
                </button>

                <p className="text-center text-sm text-[#A68F8C] mt-4">
                  Don't have an account?{' '}
                  <button type="button" onClick={() => { setView('signup'); setError(null); setMessage(null) }} className="text-[#E87A8C] font-bold hover:underline underline-offset-4">Sign Up</button>
                </p>
              </form>
            )}

            {view === 'signup' && (
              <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div>
                  <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold mb-2 tracking-tight text-[#FDF8F8]">Create Account</h1>
                  <p className="text-[#A68F8C] text-sm">Join the CESA platform to participate in events.</p>
                </div>
                
                {error && <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20">{error}</div>}

                <div className="py-4">
                  <button type="button" onClick={handleGoogleOAuth} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-white border border-white/90 text-black font-bold py-4 rounded-xl hover:bg-gray-100 transition-colors shadow-[0_4px_14px_rgba(255,255,255,0.25)] hover:shadow-[0_6px_20px_rgba(255,255,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed text-base hover:-translate-y-0.5 active:translate-y-0">
                    <svg width="24" height="24" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.85.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
                    Continue with Google
                  </button>
                </div>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink-0 mx-4 text-[#8C7A77] text-xs font-bold uppercase tracking-widest">Or</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <div className="flex flex-col items-center justify-center p-6 border border-dashed border-white/10 rounded-2xl bg-black/20">
                  <span className="text-[#8C7A77] text-sm font-semibold mb-1">Email Registration</span>
                  <span className="bg-gradient-to-r from-[#D16475] to-[#E87A8C] text-transparent bg-clip-text text-lg font-bold">Coming Soon</span>
                </div>

                <p className="text-center text-sm text-[#A68F8C] mt-2">
                  Already have an account?{' '}
                  <button type="button" onClick={() => { setView('signin'); setError(null); setMessage(null) }} className="text-[#E87A8C] font-bold hover:underline underline-offset-4">Sign In</button>
                </p>
              </div>
            )}

            {view === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div>
                  <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold mb-2 tracking-tight text-[#FDF8F8]">Reset Password</h1>
                  <p className="text-[#A68F8C] text-sm">Enter your email and we'll send you a link to reset your password.</p>
                </div>
                
                {error && <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20">{error}</div>}
                {message && <div className="text-sm text-green-400 bg-green-400/10 p-3 rounded-xl border border-green-400/20">{message}</div>}

                <div className="flex flex-col gap-4 mt-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#8C7A77] uppercase tracking-wider">Email</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email" 
                      required
                      className="w-full p-3.5 rounded-xl border border-white/5 bg-black/30 text-[#F3E9E8] text-sm outline-none transition-all focus:border-[#E87A8C] focus:bg-black/50 focus:ring-1 focus:ring-[#E87A8C]/50 placeholder-[#6B5A58]" 
                    />
                  </div>
                </div>

                <button disabled={loading} type="submit" className="w-full mt-2 bg-gradient-to-r from-[#D16475] via-[#E87A8C] to-[#F4A5AE] text-white font-bold py-3.5 rounded-xl shadow-[0_8px_20px_rgba(232,122,140,0.2)] hover:shadow-[0_8px_25px_rgba(232,122,140,0.35)] transition-all hover:-translate-y-0.5 active:translate-y-0 bg-[length:200%_auto] hover:bg-[position:right_center] disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Sending link...' : 'Send Reset Link'}
                </button>

                <p className="text-center text-sm text-[#A68F8C] mt-4">
                  Remember your password?{' '}
                  <button type="button" onClick={() => { setView('signin'); setError(null); setMessage(null) }} className="text-[#E87A8C] font-bold hover:underline underline-offset-4">Sign In</button>
                </p>
              </form>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
