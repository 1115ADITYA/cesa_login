"use client"

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'

/**
 * Google-only, deliberately.
 *
 * Email sign-up is "Coming Soon", so an email/password form on the sign-in
 * side had nothing behind it — nobody could obtain those credentials in the
 * first place. The emailed-code option was worse than useless: it ran through
 * generateLink(), which *creates* the auth user on first use, so it quietly
 * reopened the very sign-up path the Coming Soon panel closes.
 *
 * Checked before removing: of 30 auth users, every member who has actually
 * registered for an event authenticates with Google. The 16 email-provider
 * rows are test accounts, and the only two that had ever signed in belong to
 * the maintainer, who also has Google linked.
 *
 * The OTP machinery (api/auth/send-otp, verify-otp, otpCrypto, otpRateLimit)
 * is left in place — it works, and it is what email sign-up will be built on
 * when "Coming Soon" ships. Only the entry points are gone.
 */
export default function AuthPage() {
  const supabase = createClient()

  const [view, setView] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

            <div>
              <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold mb-2 tracking-tight text-[#FDF8F8]">
                {view === 'signin' ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p className="text-[#A68F8C] text-sm">
                {view === 'signin'
                  ? 'Sign in to your CESA account to continue.'
                  : 'Join the CESA platform to participate in events.'}
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20">{error}</div>
            )}

            <button
              type="button"
              onClick={handleGoogleOAuth}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-white/90 text-black font-bold py-4 rounded-xl hover:bg-gray-100 transition-colors shadow-[0_4px_14px_rgba(255,255,255,0.25)] hover:shadow-[0_6px_20px_rgba(255,255,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed text-base hover:-translate-y-0.5 active:translate-y-0"
            >
              <svg width="24" height="24" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.85.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
              {loading ? 'Redirecting…' : 'Continue with Google'}
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink-0 mx-4 text-[#8C7A77] text-xs font-bold uppercase tracking-widest">Or</span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            <div className="flex flex-col items-center justify-center p-6 border border-dashed border-white/10 rounded-2xl bg-black/20">
              <span className="text-[#8C7A77] text-sm font-semibold mb-1">
                {view === 'signin' ? 'Email Sign In' : 'Email Registration'}
              </span>
              <span className="bg-gradient-to-r from-[#D16475] to-[#E87A8C] text-transparent bg-clip-text text-lg font-bold">
                Coming Soon
              </span>
            </div>

            <p className="text-center text-sm text-[#A68F8C] mt-2">
              {view === 'signin' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setView('signup'); setError(null) }}
                    className="text-[#E87A8C] font-bold hover:underline underline-offset-4"
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setView('signin'); setError(null) }}
                    className="text-[#E87A8C] font-bold hover:underline underline-offset-4"
                  >
                    Sign In
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
