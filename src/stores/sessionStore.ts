// sessionStore.ts — ephemeral session queue and summary. Never persisted; cleared on session end.

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
      set(state => ({ currentIndex: state.currentIndex + 1 }))
    },

    endSession() {
      const counts = emptyRatings()
      for (const rating of ratingLog) counts[rating]++
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

export const selectCurrentQueueItem = (state: SessionState): QueueItem | null =>
  state.queue[state.currentIndex] ?? null

// Split into two scalar selectors — object-returning selectors cause infinite re-renders
// in Zustand because a new object literal never passes Object.is comparison.
export const selectProgressCurrent = (state: SessionState): number =>
  Math.min(state.currentIndex, state.queue.length)

export const selectProgressTotal = (state: SessionState): number =>
  state.queue.length

export const selectIsSessionComplete = (state: SessionState): boolean =>
  state.isActive && state.currentIndex >= state.queue.length
