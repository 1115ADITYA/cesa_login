import { memberLabel, type FormField, type MemberAnswers } from '@/lib/formFields'

/**
 * A "Team members" answer as a table — one row per member, one column per
 * per-member question, the leader first. No hooks, so both the admin roster
 * (server) and the team panel (client) render it.
 */
export default function MembersTable({ field, members }: { field: FormField; members: MemberAnswers }) {
  const columns = field.fields ?? []
  if (members.length === 0) return <span className="text-[var(--text-faint)]">Not answered</span>

  return (
    <div className="mt-1 overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-white/5 text-xs text-[var(--text-muted)]">
          <tr>
            <th className="px-3 py-2 font-semibold">Member</th>
            {columns.map((c) => (
              <th key={c.id} className="px-3 py-2 font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {members.map((m, i) => (
            <tr key={i}>
              <td className={`whitespace-nowrap px-3 py-2 text-xs font-bold ${i === 0 ? 'text-[var(--accent-light)]' : 'text-[var(--text-muted)]'}`}>
                {memberLabel(i)}
              </td>
              {columns.map((c) => {
                const v = m[c.id]
                const text = Array.isArray(v) ? v.join(', ') : (v ?? '')
                return (
                  <td key={c.id} className="px-3 py-2 text-[var(--text)]">
                    {text || <span className="text-[var(--text-faint)]">—</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
