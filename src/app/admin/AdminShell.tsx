import Image from 'next/image'
import Link from 'next/link'
import { adminLogout } from './logoutAction'

/**
 * Admin's counterpart to the member-side AppShell — same backdrop, same glass,
 * so the two halves stop looking like different products. What differs is
 * deliberate: an "Admin" mark next to the logo and a warmer accent on the
 * active tab, because acting on someone else's registration by mistake is the
 * failure this page has to guard against.
 */
export default function AdminShell({
  active = 'events',
  children,
}: {
  active?: 'events'
  children: React.ReactNode
}) {
  return (
    <>
      <div className="ambient" aria-hidden />

      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#130F0E]/70 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex h-[4.5rem] max-w-5xl items-center gap-4 px-5 sm:px-8">
          <Link href="/admin/events" className="flex shrink-0 items-center gap-2.5" aria-label="CESA admin">
            <Image src="/cesa-logo.png" alt="CESA" width={92} height={23} priority />
            <span className="rounded-md border border-[var(--warning)]/30 bg-[var(--warning)]/12 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[var(--warning)]">
              Admin
            </span>
          </Link>

          <nav className="flex flex-1 items-center gap-1 pl-3">
            <Link
              href="/admin/events"
              aria-current={active === 'events' ? 'page' : undefined}
              className={`relative rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                active === 'events' ? 'text-white' : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              Events
              {active === 'events' && (
                <span className="absolute inset-x-3.5 -bottom-[1.35rem] h-[2px] rounded-full bg-gradient-to-r from-[var(--accent-deep)] to-[var(--accent-light)]" />
              )}
            </Link>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link href="/dashboard" className="btn btn-ghost !px-3.5 !py-2 !text-xs">
              Member view
            </Link>
            <form action={adminLogout}>
              <button className="btn btn-ghost !px-3.5 !py-2 !text-xs">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20 pt-8 sm:px-8">{children}</main>
    </>
  )
}

/** Page title block, matching the member pages. */
export function AdminHeader({
  title,
  subtitle,
  action,
  back,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  back?: { href: string; label: string }
}) {
  return (
    <div className="mb-7">
      {back && (
        <Link
          href={back.href}
          className="on-art mb-3 inline-block text-sm text-[var(--text-muted)] transition-colors hover:text-white"
        >
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="heading on-art text-3xl sm:text-4xl">{title}</h1>
          {subtitle && <p className="on-art mt-2 text-[var(--text)]">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}
