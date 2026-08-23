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

  // `.select()` so a zero-row update is distinguishable from a successful one —
  // an UPDATE that matches nothing is not an error, and a signed-in user with
  // no profile row (a Google sign-in whose insert failed) hit exactly that and
  // was told the save had worked.
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ username: newUsername })
    .eq('id', user.id)
    .select('id')

  if (updateError) {
    console.error('Update Error:', updateError)
    // If it's an RLS error, it usually has code 42501 or just fails silently depending on the query
    return { error: 'Failed to update profile. You might need to add an UPDATE policy to your profiles table in Supabase.' }
  }

  if (!updated?.length) {
    // No profile row yet — create one through the same SECURITY DEFINER RPC the
    // signup flow uses, rather than leaving the account permanently un-invitable.
    const { error: createError } = await supabase.rpc('create_profile_after_signup', {
      p_id: user.id,
      p_full_name: user.user_metadata?.full_name ?? '',
      p_username: newUsername,
      p_email: user.email ?? '',
    })
    if (createError) return { error: 'Could not set up your profile. Please try again.' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}
