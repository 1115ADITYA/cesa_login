"use client"

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage("Password updated successfully! Redirecting...")
      setTimeout(() => {
        router.push('/')
      }, 2000)
    }
    
    setLoading(false)
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

            <form onSubmit={handleUpdatePassword} className="flex flex-col gap-6">
              <div>
                <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold mb-2 tracking-tight text-[#FDF8F8]">Set New Password</h1>
                <p className="text-[#A68F8C] text-sm">Please enter a new, secure password below.</p>
              </div>
              
              {error && <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20">{error}</div>}
              {message && <div className="text-sm text-green-400 bg-green-400/10 p-3 rounded-xl border border-green-400/20">{message}</div>}

              <div className="flex flex-col gap-4 mt-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#8C7A77] uppercase tracking-wider">New Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password" 
                    required
                    className="w-full p-3.5 rounded-xl border border-white/5 bg-black/30 text-[#F3E9E8] text-sm outline-none transition-all focus:border-[#E87A8C] focus:bg-black/50 focus:ring-1 focus:ring-[#E87A8C]/50 placeholder-[#6B5A58]" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#8C7A77] uppercase tracking-wider">Confirm Password</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password" 
                    required
                    className="w-full p-3.5 rounded-xl border border-white/5 bg-black/30 text-[#F3E9E8] text-sm outline-none transition-all focus:border-[#E87A8C] focus:bg-black/50 focus:ring-1 focus:ring-[#E87A8C]/50 placeholder-[#6B5A58]" 
                  />
                </div>
              </div>

              <button disabled={loading} type="submit" className="w-full mt-2 bg-gradient-to-r from-[#D16475] via-[#E87A8C] to-[#F4A5AE] text-white font-bold py-3.5 rounded-xl shadow-[0_8px_20px_rgba(232,122,140,0.2)] hover:shadow-[0_8px_25px_rgba(232,122,140,0.35)] transition-all hover:-translate-y-0.5 active:translate-y-0 bg-[length:200%_auto] hover:bg-[position:right_center] disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
