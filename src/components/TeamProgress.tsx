/**
 * How far a team is from being locked in. The whole register-then-invite flow
 * hinges on this number, so it renders identically on the events board, the
 * event page and the dashboard.
 */
export default function TeamProgress({
  accepted,
  pending,
  min,
  max,
  compact = false,
}: {
  accepted: number
  pending: number
  min: number
  max: number | null
  compact?: boolean
}) {
  const confirmed = accepted >= min
  const target = Math.max(min, 1)
  const acceptedPct = Math.min(100, (accepted / target) * 100)
  // Pending invites are shown as a fainter continuation of the bar — "this is
  // where you land if everyone says yes."
  const pendingPct = Math.min(100 - acceptedPct, (pending / target) * 100)

  return (
    <div className={compact ? '' : 'flex flex-col gap-2'}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${acceptedPct}%`,
            backgroundColor: confirmed ? 'var(--success)' : 'var(--accent)',
          }}
        />
        <div
          className="h-full transition-all"
          style={{ width: `${pendingPct}%`, backgroundColor: 'var(--warning)', opacity: 0.35 }}
        />
      </div>

      {!compact && (
        <p className="text-xs text-[var(--text-muted)]">
          <span className="font-bold text-[var(--text-bright)]">{accepted}</span>
          {max ? ` of ${max}` : ''} confirmed
          {pending > 0 && <span className="text-[var(--warning)]"> · {pending} awaiting reply</span>}
          {!confirmed && (
            <span className="text-[var(--text-faint)]">
              {' '}
              · {min - accepted} more needed to lock in
            </span>
          )}
        </p>
      )}
    </div>
  )
}
