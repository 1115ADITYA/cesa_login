import SiteNav from './SiteNav'

/**
 * Every signed-in page is the same three layers: the fixed ambient backdrop,
 * the sticky nav, then a centred column. Keeping it here means a new page
 * cannot accidentally ship without the nav — which is how `/events` and
 * `/dashboard` ended up cross-linking to each other by hand.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="ambient" aria-hidden />
      <SiteNav />
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-8 sm:px-8">{children}</main>
    </>
  )
}

/** The bordered band the home page stacks — header row plus content. */
export function Band({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="shell p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="heading text-xl sm:text-2xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function EmptyState({
  title,
  body,
  children,
}: {
  title: string
  body: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-strong)] px-6 py-10 text-center">
      <p className="font-semibold text-white">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--text-muted)]">{body}</p>
      {children && <div className="mt-5 flex justify-center">{children}</div>}
    </div>
  )
}
