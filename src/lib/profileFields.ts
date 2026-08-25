/**
 * The student details every event used to re-ask via a Google Form. Held on
 * the profile so registration reads them instead.
 *
 * The option lists mirror the check constraints in
 * supabase/migrations/0006_profile_details.sql — if one changes, the other
 * must too, or a valid-looking selection is rejected by the database.
 */

export const DEPARTMENTS = ['INFT', 'CMPN', 'EXTC', 'EXCS', 'BIOM'] as const
export const YEARS = ['FE', 'SE', 'TE', 'BE'] as const
export const DIVISIONS = ['A', 'B', 'C'] as const

export type ProfileDetails = {
  full_name: string | null
  department: string | null
  year_of_study: string | null
  division: string | null
  roll_no: string | null
  contact: string | null
}

/**
 * Whether the profile has everything an event registration needs. Drives the
 * "complete your profile" prompt and gates the register button — asking once
 * up front only pays off if the data is actually there by the time it matters.
 */
export function isProfileComplete(p: Partial<ProfileDetails> | null | undefined): boolean {
  if (!p) return false
  return Boolean(p.full_name && p.department && p.year_of_study && p.division && p.roll_no && p.contact)
}

export function missingProfileFields(p: Partial<ProfileDetails> | null | undefined): string[] {
  const labels: [keyof ProfileDetails, string][] = [
    ['full_name', 'Name'],
    ['department', 'Department'],
    ['year_of_study', 'Year of study'],
    ['division', 'Division'],
    ['roll_no', 'Roll number'],
    ['contact', 'Contact number'],
  ]
  return labels.filter(([key]) => !p?.[key]).map(([, label]) => label)
}
