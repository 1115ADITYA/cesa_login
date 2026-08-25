import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getUser } from '@/utils/supabase/server'
import { getMyProfile } from '@/lib/profile'
import { isProfileComplete } from '@/lib/profileFields'
import ProfileDetailsForm from '@/components/ProfileDetailsForm'

export const metadata = { title: 'Complete your profile — CESA' }
export const dynamic = 'force-dynamic'

/**
 * The mandatory gate. Deliberately outside the (app) route group: that
 * layout redirects here whenever the profile is incomplete, so if this page
 * lived inside it the redirect would loop forever.
 *
 * There is no "skip" or "later" — every member fills this once, and the point
 * of collecting it is that organisers can rely on it being there.
 */
export default async function CompleteProfilePage() {
  const user = await getUser()
  if (!user) redirect('/')

  const profile = await getMyProfile()
  // Already done: nothing to gate on, send them where they were going.
  if (isProfileComplete(profile)) redirect('/dashboard')

  return (
    <>
      <div className="ambient" aria-hidden />
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5 py-12">
        <Image src="/cesa-logo.png" alt="CESA" width={104} height={26} priority className="mb-8" />

        <div className="glass p-6 sm:p-8">
          <h1 className="heading text-2xl sm:text-3xl">One last step</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Organisers need these on the roster for every event. Fill them in once here and every future
            registration is prefilled — you will not be asked again.
          </p>

          <div className="mt-6 border-t border-[var(--border)] pt-6">
            <ProfileDetailsForm
              profile={profile}
              submitLabel="Save and continue"
              redirectTo="/dashboard"
            />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-faint)]">
          Signed in as {user.email}
        </p>
      </div>
    </>
  )
}
