'use client'

import { useTransition } from 'react'

export default function DeleteEventButton({ eventId, action }: { eventId: string; action: (id: string) => Promise<void> }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      className="btn btn-danger !px-3 !py-2 !text-xs"
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
