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

/**
 * Saves the student details that event registration prefills from. Goes
 * through a SECURITY DEFINER RPC rather than a direct update because
 * `profiles` has no member-facing UPDATE policy — see
 * 0006_profile_details.sql for why adding a general one would be worse.
 */
export async function saveProfileDetails(details: {
  fullName: string
  department: string
  yearOfStudy: string
  division: string
  rollNo: string
  contact: string
}): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.rpc('save_my_profile_details', {
    p_full_name: details.fullName,
    p_department: details.department,
    p_year_of_study: details.yearOfStudy,
    p_division: details.division,
    p_roll_no: details.rollNo,
    p_contact: details.contact,
  })

  if (error) {
    // The RPC raises readable messages ("Please enter your name"), and the
    // check constraints raise 23514 for an option outside the allowed lists —
    // which can only happen if the form was bypassed, so a generic message is
    // right there.
    const message = error.code === '23514'
      ? 'One of those selections is not valid. Please pick from the options listed.'
      : error.message.replace(/^.*?(?:ERROR|error):\s*/, '').trim() || 'Could not save your details.'
    return { error: message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/profile')
  revalidatePath('/events', 'layout')
  return { success: true }
}
