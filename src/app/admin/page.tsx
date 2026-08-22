import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/adminAuth'
import AdminLoginForm from './AdminLoginForm'

export const metadata = { title: 'Admin — CESA', robots: { index: false } }

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect('/admin/events')

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#130F0E] text-[#F3E9E8] p-6">
      <div className="w-full max-w-sm bg-[#1D1716]/80 p-8 rounded-[2rem] border border-white/5 backdrop-blur-xl">
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold mb-1 text-[#FDF8F8]">
          Admin
        </h1>
        <p className="text-[#A68F8C] text-sm mb-6">Sign in to manage events, teams, and rosters.</p>
        <AdminLoginForm />
      </div>
    </div>
  )
}
