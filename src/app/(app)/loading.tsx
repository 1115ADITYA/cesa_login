/**
 * Shown the instant a navigation starts, while the server renders the real
 * page. Because the nav lives in the layout it stays mounted, so only this
 * content area swaps — which is the difference between a click feeling
 * immediate and feeling like nothing happened for three seconds.
 */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-7">
        <div className="h-9 w-56 rounded-xl bg-white/[0.07]" />
        <div className="mt-3 h-4 w-80 max-w-full rounded-lg bg-white/[0.05]" />
      </div>

      <div className="flex flex-col gap-6">
        {[0, 1].map((band) => (
          <section key={band} className="shell p-5 sm:p-6">
            <div className="mb-5 h-6 w-40 rounded-lg bg-white/[0.07]" />
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((card) => (
                <div key={card} className="glass p-5">
                  <div className="h-5 w-2/3 rounded-lg bg-white/[0.07]" />
                  <div className="mt-2.5 h-3.5 w-full rounded bg-white/[0.05]" />
                  <div className="mt-1.5 h-3.5 w-4/5 rounded bg-white/[0.05]" />
                  <div className="mt-5 h-1.5 w-full rounded-full bg-white/[0.06]" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
