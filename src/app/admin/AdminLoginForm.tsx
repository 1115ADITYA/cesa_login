'use client'

import { useActionState } from 'react'
import { adminLogin } from './loginAction'

export default function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLogin, null)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20">{state.error}</div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-[#8C7A77] uppercase tracking-wider">Username</label>
        <input
          name="username"
          type="text"
          required
          autoComplete="username"
          className="w-full p-3.5 rounded-xl border border-white/5 bg-black/30 text-[#F3E9E8] text-sm outline-none transition-all focus:border-[#E87A8C] focus:bg-black/50 focus:ring-1 focus:ring-[#E87A8C]/50"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-[#8C7A77] uppercase tracking-wider">Password</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full p-3.5 rounded-xl border border-white/5 bg-black/30 text-[#F3E9E8] text-sm outline-none transition-all focus:border-[#E87A8C] focus:bg-black/50 focus:ring-1 focus:ring-[#E87A8C]/50"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full mt-2 bg-gradient-to-r from-[#D16475] via-[#E87A8C] to-[#F4A5AE] text-white font-bold py-3.5 rounded-xl transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}
