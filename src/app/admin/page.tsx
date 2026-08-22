import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/adminAuth'
import AdminLoginForm from './AdminLoginForm'

export const metadata = { title: 'Admin — CESA', robots: { index: false } }

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect('/admin/events')

  return (
    <>
      <div className="ambient" aria-hidden />

      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass w-full max-w-sm p-8">
          <div className="mb-6 flex items-center gap-2.5">
            <Image src="/cesa-logo.png" alt="CESA" width={84} height={21} priority />
            <span className="rounded-md border border-[var(--warning)]/30 bg-[var(--warning)]/12 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[var(--warning)]">
              Admin
            </span>
          </div>

          <h1 className="heading text-2xl">Organiser sign in</h1>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            A shared credential, separate from any member account. Manage events, teams, and rosters.
          </p>

          <div className="mt-6">
            <AdminLoginForm />
          </div>

          <Link
            href="/dashboard"
            className="mt-6 block text-center text-xs font-semibold text-[var(--text-faint)] transition-colors hover:text-white"
          >
            ← Back to the member site
          </Link>
        </div>
      </div>
    </>
  )
}
