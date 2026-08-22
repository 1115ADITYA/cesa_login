import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { ProfileCard } from './profile-card'

export default async function Dashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-[#130F0E] text-[#F3E9E8] font-sans p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)]">Dashboard</h1>
          <form action="/auth/signout" method="post">
            <button className="bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-lg text-sm font-semibold">
              Logout
            </button>
          </form>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <ProfileCard profile={profile} userEmail={user.email || ''} />

          <div className="md:col-span-2 bg-[#1D1716] p-6 rounded-2xl border border-white/5 flex items-center justify-center min-h-[300px]">
            <p className="text-[#A68F8C] text-lg font-medium">Events will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
