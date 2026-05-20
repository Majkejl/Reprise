import { create } from 'zustand'
import type { QueueItem, SessionSummary } from '@/lib/types'

interface SessionState {
  queue: QueueItem[]
  currentIndex: number
  isActive: boolean
  summary: SessionSummary | null

  startSession: (queue: QueueItem[]) => void
  advanceQueue: (rating: 1 | 2 | 3 | 4) => void
  endSession: () => SessionSummary
  clearSession: () => void
}

const emptyRatings = (): Record<1 | 2 | 3 | 4, number> => ({ 1: 0, 2: 0, 3: 0, 4: 0 })

function buildSummary(ratings: Record<1 | 2 | 3 | 4, number>): SessionSummary {
  const total = (Object.values(ratings) as number[]).reduce((a, b) => a + b, 0)
  return { total, ratings }
}

export const useSessionStore = create<SessionState>((set) => {
  const ratingLog: (1 | 2 | 3 | 4)[] = []

  return {
    queue: [],
    currentIndex: 0,
    isActive: false,
    summary: null,

    startSession(queue) {
      ratingLog.length = 0
      set({ queue, currentIndex: 0, isActive: true, summary: null })
    },

    advanceQueue(rating) {
      ratingLog.push(rating)
      set(s => ({ currentIndex: s.currentIndex + 1 }))
    },

    endSession() {
      const counts = emptyRatings()
      for (const r of ratingLog) counts[r]++
      const summary = buildSummary(counts)
      set({ isActive: false, summary })
      return summary
    },

    clearSession() {
      ratingLog.length = 0
      set({ queue: [], currentIndex: 0, isActive: false, summary: null })
    },
  }
})

export const selectCurrentQueueItem = (s: SessionState): QueueItem | null =>
  s.queue[s.currentIndex] ?? null

export const selectProgress = (s: SessionState) => ({
  current: Math.min(s.currentIndex, s.queue.length),
  total: s.queue.length,
})

export const selectIsSessionComplete = (s: SessionState): boolean =>
  s.isActive && s.currentIndex >= s.queue.length
