/**
 * Layout primitives shared by the signed-in pages. The shell itself (backdrop,
 * nav, container) is `app/(app)/layout.tsx` now — keeping it out of the page
 * tree is what lets Next preserve the nav across navigations.
 */

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
