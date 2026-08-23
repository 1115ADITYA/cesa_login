'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { respondToInvite } from '@/app/(app)/events/actions'

export type NavInvite = {
  membershipId: string
  eventId: string
  eventTitle: string
  teamName: string
  invitedByUsername: string
}

export type NavProfile = {
  username: string
  fullName: string | null
  avatarUrl: string | null
  email: string
  role: string | null
}

const LINKS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/my-events', label: 'Your Events' },
  { href: '/my-teams', label: 'Your Teams' },
]

export default function NavBar({ profile, invites }: { profile: NavProfile | null; invites: NavInvite[] }) {
  const pathname = usePathname()
  // Only one panel open at a time — two stacked dropdowns overlapping in the
  // top-right corner is the fastest way to make a header feel broken.
  const [open, setOpen] = useState<'none' | 'bell' | 'profile' | 'menu'>('none')

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#130F0E]/70 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center gap-4 px-5 sm:px-8">
        <Link href="/dashboard" className="shrink-0" aria-label="CESA home">
          <Image src="/cesa-logo.png" alt="CESA" width={104} height={26} priority />
        </Link>

        <nav className="hidden flex-1 items-center gap-1 pl-4 md:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`relative rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                  active ? 'text-white' : 'text-[#A68F8C] hover:text-[#F3E9E8]'
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute inset-x-3.5 -bottom-[1.35rem] h-[2px] rounded-full bg-gradient-to-r from-[#D16475] to-[#F4A5AE]" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <NotificationBell
            invites={invites}
            open={open === 'bell'}
            onToggle={() => setOpen((v) => (v === 'bell' ? 'none' : 'bell'))}
            onClose={() => setOpen('none')}
          />
          <ProfileMenu
            profile={profile}
            open={open === 'profile'}
            onToggle={() => setOpen((v) => (v === 'profile' ? 'none' : 'profile'))}
            onClose={() => setOpen('none')}
          />
          <button
            onClick={() => setOpen((v) => (v === 'menu' ? 'none' : 'menu'))}
            aria-label="Menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#D1C2C0] md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      {open === 'menu' && (
        <nav className="flex flex-col gap-1 border-t border-white/[0.06] px-5 py-3 md:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen('none')}
              className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold ${
                pathname === link.href ? 'bg-white/[0.07] text-white' : 'text-[#A68F8C]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}

function NotificationBell({
  invites,
  open,
  onToggle,
  onClose,
}: {
  invites: NavInvite[]
  open: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const respond = (membershipId: string, accept: boolean) => {
    setError(null)
    startTransition(async () => {
      const result = await respondToInvite(membershipId, accept)
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        aria-label={`Notifications${invites.length ? ` (${invites.length} unread)` : ''}`}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#D1C2C0] transition-colors hover:bg-white/10 hover:text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {invites.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-gradient-to-br from-[#D16475] to-[#F4A5AE] px-1 text-[0.65rem] font-bold text-white ring-2 ring-[#130F0E]">
            {invites.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={onClose} tabIndex={-1} />
          <div className="absolute right-0 z-50 mt-2 w-[21rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/12 bg-[#1D1716]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_24px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <span className="text-sm font-bold text-white">Notifications</span>
              {invites.length > 0 && (
                <span className="text-[0.7rem] font-bold text-[#E87A8C]">{invites.length} pending</span>
              )}
            </div>

            {error && <p className="px-4 py-2 text-xs text-red-400">{error}</p>}

            {invites.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[#8C7A77]">Nothing new right now.</p>
            ) : (
              <ul className="max-h-[22rem] divide-y divide-white/[0.06] overflow-y-auto">
                {invites.map((inv) => (
                  <li key={inv.membershipId} className="px-4 py-3">
                    <p className="text-sm leading-snug text-[#D1C2C0]">
                      <span className="font-bold text-white">@{inv.invitedByUsername}</span> invited you to{' '}
                      <span className="font-bold text-white">{inv.teamName}</span> for{' '}
                      <Link href={`/events/${inv.eventId}`} onClick={onClose} className="font-bold text-[#E87A8C] hover:underline">
                        {inv.eventTitle}
                      </Link>
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        disabled={pending}
                        onClick={() => respond(inv.membershipId, true)}
                        className="rounded-lg bg-gradient-to-r from-[#D16475] to-[#E87A8C] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        disabled={pending}
                        onClick={() => respond(inv.membershipId, false)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-[#A68F8C] hover:text-white disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ProfileMenu({
  profile,
  open,
  onToggle,
  onClose,
}: {
  profile: NavProfile | null
  open: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const initial = (profile?.fullName || profile?.username || profile?.email || 'U').charAt(0).toUpperCase()

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        aria-label="Your profile"
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-1.5 transition-colors hover:bg-white/10 sm:pr-3"
      >
        {profile?.avatarUrl ? (
          // Google / Supabase storage avatars come from hosts we cannot enumerate
          // up front, so next/image would need every one allow-listed.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="" className="h-7 w-7 rounded-lg object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#D16475] to-[#E87A8C] text-xs font-bold text-white">
            {initial}
          </span>
        )}
        <span className="hidden max-w-[7rem] truncate text-sm font-semibold text-[#D1C2C0] sm:block">
          {profile?.username ? `@${profile.username}` : 'Account'}
        </span>
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={onClose} tabIndex={-1} />
          <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-white/12 bg-[#1D1716]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_24px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#D16475] to-[#E87A8C] font-bold text-white">
                  {initial}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{profile?.fullName || 'Your account'}</p>
                <p className="truncate text-xs text-[#8C7A77]">
                  {profile?.username ? `@${profile.username}` : profile?.email}
                </p>
              </div>
            </div>

            <div className="p-1.5">
              <MenuLink href="/profile" onClick={onClose}>
                Profile &amp; username
              </MenuLink>
              <MenuLink href="/my-events" onClick={onClose}>
                Your events
              </MenuLink>
              <MenuLink href="/my-teams" onClick={onClose}>
                Your teams
              </MenuLink>
            </div>

            <div className="border-t border-white/[0.06] p-1.5">
              <form action="/auth/signout" method="post">
                <button className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#A68F8C] transition-colors hover:bg-white/5 hover:text-red-400">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MenuLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-[#D1C2C0] transition-colors hover:bg-white/5 hover:text-white"
    >
      {children}
    </Link>
  )
}
