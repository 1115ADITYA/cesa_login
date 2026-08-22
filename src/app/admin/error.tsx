'use client'

import { adminLogout } from './logoutAction'

/**
 * Without this, a failure inside /admin/events was a genuine dead end: /admin
 * redirects a valid session straight through to the failing page, so there was
 * no screen left with a sign-out button on it. Most often that failure is a
 * missing SUPABASE_SERVICE_ROLE_KEY, so the message says so.
 */
export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#130F0E] text-[#F3E9E8] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#1D1716] p-8 rounded-2xl border border-white/5">
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold mb-2">
          The admin panel could not load
        </h1>
        <p className="text-sm text-[#A68F8C] mb-4">
          If this is a fresh deployment, check that <code className="text-[#E87A8C]">SUPABASE_SERVICE_ROLE_KEY</code> is
          set and that both migrations in <code className="text-[#E87A8C]">supabase/migrations/</code> have been run.
        </p>
        <pre className="text-xs text-[#8C7A77] bg-black/30 p-3 rounded-lg overflow-x-auto mb-6 whitespace-pre-wrap">
          {error.message}
        </pre>
        <div className="flex gap-3">
          <button onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <form action={adminLogout}>
            <button className="btn btn-ghost">Sign out</button>
          </form>
        </div>
      </div>
    </div>
  )
}
