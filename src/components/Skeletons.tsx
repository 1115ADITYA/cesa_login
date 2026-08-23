/**
 * Fallbacks for the Suspense boundaries around data. They exist so the server
 * can flush the page shell immediately and stream the real content in behind
 * it — without them, every page waited on its slowest query before sending a
 * single byte.
 */

export function NavSkeleton() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#130F0E]/70 backdrop-blur-2xl">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center gap-4 px-5 sm:px-8">
        <div className="h-6 w-[104px] rounded bg-white/[0.07]" />
        <div className="ml-auto flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-white/[0.06]" />
          <div className="h-10 w-28 rounded-xl bg-white/[0.06]" />
        </div>
      </div>
    </header>
  )
}

export function CardGridSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className="grid animate-pulse gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="glass p-5">
          <div className="h-5 w-2/3 rounded-lg bg-white/[0.07]" />
          <div className="mt-2.5 h-3.5 w-full rounded bg-white/[0.05]" />
          <div className="mt-1.5 h-3.5 w-4/5 rounded bg-white/[0.05]" />
          <div className="mt-5 h-1.5 w-full rounded-full bg-white/[0.06]" />
        </div>
      ))}
    </div>
  )
}

export function BandsSkeleton({ bands = 2 }: { bands?: number }) {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Loading">
      {Array.from({ length: bands }, (_, i) => (
        <section key={i} className="shell p-5 sm:p-6">
          <div className="mb-5 h-6 w-40 rounded-lg bg-white/[0.07]" />
          <CardGridSkeleton />
        </section>
      ))}
    </div>
  )
}

export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex animate-pulse flex-col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="glass flex items-center gap-4 p-4">
          <div className="h-14 w-16 shrink-0 rounded-xl bg-white/[0.06]" />
          <div className="flex-1">
            <div className="h-5 w-1/3 rounded-lg bg-white/[0.07]" />
            <div className="mt-2 h-3.5 w-2/3 rounded bg-white/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  )
}
