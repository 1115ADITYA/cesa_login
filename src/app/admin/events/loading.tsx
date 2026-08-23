export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-7 h-9 w-48 rounded-xl bg-white/[0.07]" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass flex items-center gap-4 p-5">
            <div className="h-14 w-16 shrink-0 rounded-xl bg-white/[0.06]" />
            <div className="flex-1">
              <div className="h-5 w-1/3 rounded-lg bg-white/[0.07]" />
              <div className="mt-2 h-3.5 w-2/3 rounded bg-white/[0.05]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
