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
    <>
      <div className="ambient" aria-hidden />
      <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass w-full max-w-md p-8">
        <h1 className="heading mb-2 text-xl">
          The admin panel could not load
        </h1>
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          If this is a fresh deployment, check that <code className="text-[var(--accent)]">SUPABASE_SERVICE_ROLE_KEY</code> is
          set and that both migrations in <code className="text-[var(--accent)]">supabase/migrations/</code> have been run.
        </p>
        <pre className="mb-6 overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-[var(--text-faint)]">
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
    </>
  )
}
