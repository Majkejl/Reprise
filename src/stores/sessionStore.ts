// sessionStore.ts — ephemeral session queue and summary. Never persisted; cleared on session end.

import { create } from 'zustand'
import type { QueueItem, SessionSummary, CardRow } from '@/lib/types'

interface SessionState {
  queue: QueueItem[]
  currentIndex: number
  isActive: boolean
  summary: SessionSummary | null
  /** Snapshot of the last-completed card, kept for undo. Cleared after undo or on session start. */
  lastCompleted: { item: QueueItem; previousCardRow: CardRow } | null

  startSession: (queue: QueueItem[]) => void
  advanceQueue: (rating: 1 | 2 | 3 | 4, completedItem: QueueItem, previousCardRow: CardRow) => void
  /** Rolls back one card: decrements index, pops the rating log, returns the snapshot (or null). */
  undoLast: () => { item: QueueItem; previousCardRow: CardRow } | null
  endSession: () => SessionSummary
  clearSession: () => void
}

const emptyRatings = (): Record<1 | 2 | 3 | 4, number> => ({ 1: 0, 2: 0, 3: 0, 4: 0 })

function buildSummary(ratings: Record<1 | 2 | 3 | 4, number>): SessionSummary {
  const total = (Object.values(ratings) as number[]).reduce((a, b) => a + b, 0)
  return { total, ratings }
}

export const useSessionStore = create<SessionState>((set, get) => {
  const ratingLog: (1 | 2 | 3 | 4)[] = []

  return {
    queue: [],
    currentIndex: 0,
    isActive: false,
    summary: null,
    lastCompleted: null,

    startSession(queue) {
      ratingLog.length = 0
      set({ queue, currentIndex: 0, isActive: true, summary: null, lastCompleted: null })
    },

    advanceQueue(rating, completedItem, previousCardRow) {
      ratingLog.push(rating)
      set(state => ({
        currentIndex: state.currentIndex + 1,
        lastCompleted: { item: completedItem, previousCardRow },
      }))
    },

    undoLast() {
      const { lastCompleted, currentIndex } = get()
      if (!lastCompleted || currentIndex === 0) return null
      ratingLog.pop()
      set({ currentIndex: currentIndex - 1, lastCompleted: null })
      return lastCompleted
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
      set({ queue: [], currentIndex: 0, isActive: false, summary: null, lastCompleted: null })
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
