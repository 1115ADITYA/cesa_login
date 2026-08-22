'use server'

import { redirect } from 'next/navigation'
import { verifyAdminCredentials, setAdminSession } from '@/lib/adminAuth'

export async function adminLogin(prevState: unknown, formData: FormData) {
  const username = String(formData.get('username') || '')
  const password = String(formData.get('password') || '')

  if (!username || !password) {
    return { error: 'Enter both a username and a password.' }
  }

  const ok = await verifyAdminCredentials(username, password)
  if (!ok) {
    return { error: 'Incorrect username or password.' }
  }

  await setAdminSession()
  redirect('/admin/events')
}
