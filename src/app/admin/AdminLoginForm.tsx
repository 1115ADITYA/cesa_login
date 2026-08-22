'use client'

import { useActionState } from 'react'
import { adminLogin } from './loginAction'

export default function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLogin, null)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <div className="alert alert-error">{state.error}</div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="label">Username</label>
        <input
          name="username"
          type="text"
          required
          autoComplete="username"
          className="field"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="label">Password</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="field"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-2 w-full !py-3.5"
      >
        {pending ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}
