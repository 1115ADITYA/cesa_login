/**
 * The admin-controlled outside registration link (Unstop, a Google Form…).
 * `relative z-10` lifts it above the stretched link that makes a whole event
 * card clickable, so a tap here opens the join page instead of the event.
 */
export default function JoinNowButton({ href, className = '' }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn btn-primary relative z-10 ${className}`}
    >
      Join Now ↗
    </a>
  )
}
