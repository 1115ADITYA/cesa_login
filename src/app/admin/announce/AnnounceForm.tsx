'use client'

import { useActionState } from 'react'
import { sendAnnouncement } from '../actions'

type EventOption = { id: string; title: string }

export default function AnnounceForm({ events }: { events: EventOption[] }) {
  const [state, formAction, pending] = useActionState(sendAnnouncement, null)

  return (
    <form action={formAction} className="glass flex max-w-xl flex-col gap-4 p-6">
      {state && 'error' in state && state.error && <div className="alert alert-error">{state.error}</div>}
      {state && 'success' in state && state.success && <div className="alert alert-success">{state.success}</div>}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="audience" className="label">
          Send to
        </label>
        <select id="audience" name="audience" defaultValue="all" className="field">
          <option value="all">Every member</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              Registered for: {e.title}
            </option>
          ))}
        </select>
        <p className="text-xs text-[var(--text-faint)]">
          Event-specific messages reach everyone on a team for it, including people whose invitation is still
          pending.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="label">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={120}
          placeholder="Venue changed for tomorrow"
          className="field"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="label">
          Message
        </label>
        <textarea
          id="body"
          name="body"
          rows={4}
          required
          maxLength={1000}
          placeholder="Report to Seminar Hall 2 instead of the main auditorium. Bring your ID card."
          className="field"
        />
      </div>

      <button type="submit" disabled={pending} className="btn btn-primary mt-1 !py-3">
        {pending ? 'Sending…' : 'Send notification'}
      </button>

      <p className="text-xs text-[var(--text-faint)]">
        Appears in each member&apos;s notification bell immediately. There is no undo, and no email is sent.
      </p>
    </form>
  )
}
