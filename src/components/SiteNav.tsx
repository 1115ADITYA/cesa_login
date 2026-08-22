import Image from 'next/image'
import Link from 'next/link'

/**
 * The member-side header. Both /dashboard and /events grew their own ad-hoc
 * "← Dashboard" / "Browse events" links pointing at each other; this is the
 * one bar, so signing out is reachable from every signed-in page.
 */
export default function SiteNav({ active }: { active: 'dashboard' | 'events' }) {
  return (
    <header className="sticky top-0 z-30 -mx-6 mb-8 border-b border-[var(--border)] bg-[var(--bg)]/85 px-6 backdrop-blur-xl sm:-mx-8 sm:px-8">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="CESA home">
            <Image src="/cesa-logo.png" alt="CESA" width={92} height={23} priority />
          </Link>

          <nav className="flex items-center gap-1">
            <NavLink href="/dashboard" active={active === 'dashboard'}>
              Home
            </NavLink>
            <NavLink href="/events" active={active === 'events'}>
              Events
            </NavLink>
          </nav>
        </div>

        <form action="/auth/signout" method="post">
          <button className="btn btn-ghost !px-3.5 !py-2 !text-xs">Sign out</button>
        </form>
      </div>
    </header>
  )
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
        active ? 'bg-white/8 text-[var(--text-bright)]' : 'text-[var(--text-muted)] hover:text-white'
      }`}
    >
      {children}
    </Link>
  )
}
