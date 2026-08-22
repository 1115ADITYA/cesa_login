import Link from 'next/link'
import { adminLogout } from './logoutAction'

export default function AdminNav({ active }: { active: 'events' }) {
  return (
    <nav className="flex items-center justify-between mb-8 flex-wrap gap-3">
      <div className="flex items-center gap-6">
        <span className="font-[family-name:var(--font-space-grotesk)] text-lg font-bold text-[#FDF8F8]">
          CESA Admin
        </span>
        <Link
          href="/admin/events"
          className={`text-sm font-semibold ${active === 'events' ? 'text-[#E87A8C]' : 'text-[#A68F8C] hover:text-[#F3E9E8]'}`}
        >
          Events
        </Link>
      </div>
      <form action={adminLogout}>
        <button className="bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-lg text-sm font-semibold">
          Sign out
        </button>
      </form>
    </nav>
  )
}
