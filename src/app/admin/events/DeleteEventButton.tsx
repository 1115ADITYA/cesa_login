'use client'

import { useTransition } from 'react'

export default function DeleteEventButton({ eventId, action }: { eventId: string; action: (id: string) => Promise<void> }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      className="text-red-400 hover:text-red-300 disabled:opacity-50"
      disabled={pending}
      onClick={() => {
        if (!confirm('Delete this event? This also removes every team and invitation registered for it.')) return
        startTransition(() => action(eventId))
      }}
    >
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  )
}
