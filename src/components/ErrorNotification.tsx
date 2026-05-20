import { useErrorStore } from '@/stores/uiStore'

export function ErrorNotification() {
  const message = useErrorStore(s => s.message)
  const dismiss = useErrorStore(s => s.dismiss)

  if (!message) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 max-w-md w-full px-4">
      <div className="flex items-start gap-3 rounded border border-red-700 bg-zinc-900 px-4 py-3 shadow-lg">
        <span className="flex-1 text-sm text-red-300">{message}</span>
        <button
          onClick={dismiss}
          className="shrink-0 text-zinc-500 hover:text-zinc-300 text-lg leading-none"
          aria-label="Dismiss error"
        >
          ×
        </button>
      </div>
    </div>
  )
}
