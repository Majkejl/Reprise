// OfflineIndicator.tsx — persistent offline banner. Shown at all times when offline, not a toast.

import { useEffect, useState } from 'react'

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="bg-amber-900/80 px-4 py-2 text-center text-sm text-amber-200">
      You are offline. Content is served from cache.
    </div>
  )
}
