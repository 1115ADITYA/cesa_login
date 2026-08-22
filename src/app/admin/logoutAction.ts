'use server'

import { redirect } from 'next/navigation'
import { clearAdminSession } from '@/lib/adminAuth'

export async function adminLogout() {
  await clearAdminSession()
  redirect('/admin')
}
