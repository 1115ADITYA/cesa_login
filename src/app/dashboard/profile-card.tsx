'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import { updateUsername } from './actions'

type Profile = {
  id: string
  full_name: string
  username: string
  avatar_url: string
  role: string
}

export function ProfileCard({ profile, userEmail }: { profile: Profile, userEmail: string }) {
  const [isEditing, setIsEditing] = useState(false)
  const [newUsername, setNewUsername] = useState(profile.username)
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Live checking username availability
  useEffect(() => {
    if (newUsername === profile.username) {
      setStatus('idle')
      return
    }
    
    if (newUsername.length < 3) {
      setStatus('taken')
      return
    }

    const checkUsername = async () => {
      setStatus('checking')
      const { data, error } = await supabase.rpc('check_username_available', {
        username_to_check: newUsername
      })
      
      if (error || !data) {
        setStatus('taken')
      } else {
        setStatus('available')
      }
    }

    const timer = setTimeout(() => {
      checkUsername()
    }, 500)

    return () => clearTimeout(timer)
  }, [newUsername, profile.username, supabase])

  const handleSave = async () => {
    if (status !== 'available' && newUsername !== profile.username) return
    if (newUsername === profile.username) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    setError(null)

    const result = await updateUsername(newUsername)

    if (result.error) {
      setError(result.error)
      setIsSaving(false)
    } else {
      setIsEditing(false)
      setIsSaving(false)
      setStatus('idle')
    }
  }

  return (
    <div className="md:col-span-1 bg-[#1D1716] p-6 rounded-2xl border border-white/5">
      <div className="flex flex-col items-center text-center relative">
        
        {isEditing && (
          <button 
            onClick={() => { setIsEditing(false); setNewUsername(profile.username); setError(null); setStatus('idle'); }}
            className="absolute top-0 right-0 text-[#8C7A77] hover:text-white text-sm font-semibold"
          >
            Cancel
          </button>
        )}
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="absolute top-0 right-0 text-[#E87A8C] hover:text-[#F4A5AE] text-sm font-semibold"
          >
            Edit Profile
          </button>
        )}

        {profile.avatar_url ? (
          <Image 
            src={profile.avatar_url} 
            alt="Profile" 
            width={100} 
            height={100} 
            className="rounded-full mb-4 border-4 border-[#E87A8C]/20"
          />
        ) : (
          <div className="w-[100px] h-[100px] rounded-full bg-gradient-to-br from-[#D16475] to-[#E87A8C] flex items-center justify-center text-3xl font-bold mb-4">
            {profile.full_name?.charAt(0) || userEmail.charAt(0) || 'U'}
          </div>
        )}
        
        <h2 className="text-xl font-bold text-white">{profile.full_name || 'User'}</h2>
        
        {isEditing ? (
          <div className="mt-3 w-full flex flex-col gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C7A77]">@</span>
              <input 
                type="text" 
                value={newUsername}
                maxLength={20}
                onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className={`w-full p-2 pl-7 rounded-lg border bg-black/30 text-[#F3E9E8] text-sm outline-none transition-all ${
                  status === 'taken' 
                    ? 'border-red-400/50 focus:border-red-400' 
                    : status === 'available'
                    ? 'border-green-400/50 focus:border-green-400'
                    : 'border-white/10 focus:border-[#E87A8C]'
                }`}
                placeholder="new_username"
              />
            </div>
            
            {status === 'checking' && <span className="text-xs text-yellow-400 text-left">Checking availability...</span>}
            {status === 'taken' && <span className="text-xs text-red-400 text-left">Username taken or too short</span>}
            {status === 'available' && <span className="text-xs text-green-400 text-left">Username available!</span>}
            {error && <span className="text-xs text-red-400 text-left bg-red-400/10 p-2 rounded">{error}</span>}

            <button 
              onClick={handleSave}
              disabled={isSaving || status === 'taken' || status === 'checking'}
              className="mt-2 w-full bg-[#E87A8C] hover:bg-[#D16475] text-white text-sm font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        ) : (
          <p className="text-[#E87A8C] font-semibold mt-1">@{profile.username}</p>
        )}

        <p className="text-[#A68F8C] text-sm mt-1">{userEmail}</p>
        
        <div className="mt-6 inline-flex items-center px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold uppercase tracking-wider text-[#D1C2C0]">
          Role: {profile.role || 'participant'}
        </div>
      </div>
    </div>
  )
}
