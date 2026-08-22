'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateUsername(newUsername: string) {
  const supabase = await createClient()

  // Ensure user is logged in
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Double check availability (just in case client side check was bypassed)
  const { data: isAvailable, error: checkError } = await supabase.rpc('check_username_available', {
    username_to_check: newUsername
  })

  if (checkError) {
    return { error: 'Failed to verify username availability.' }
  }

  if (!isAvailable) {
    return { error: 'Username is already taken.' }
  }

  // Update the profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ username: newUsername })
    .eq('id', user.id)

  if (updateError) {
    console.error('Update Error:', updateError)
    // If it's an RLS error, it usually has code 42501 or just fails silently depending on the query
    return { error: 'Failed to update profile. You might need to add an UPDATE policy to your profiles table in Supabase.' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}
