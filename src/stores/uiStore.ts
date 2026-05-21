// uiStore.ts — UI & Scope Store (scope, sync status, modal state) and global error store.

import { create } from 'zustand'
import type { Scope, SyncStatus } from '@/lib/types'
import { DEFAULT_SCOPE } from '@/lib/types'
import { SettingsRepo } from '@/db'

interface UIState {
  scope: Scope
  syncStatus: Record<string, SyncStatus>
  activeModal: string | null

  loadScope: () => Promise<void>
  setScope: (scope: Scope) => Promise<void>
  setSyncStatus: (sourceId: string, status: SyncStatus) => void
  openModal: (id: string) => void
  closeModal: () => void
}

export const useUIStore = create<UIState>(set => ({
  scope: DEFAULT_SCOPE,
  syncStatus: {},
  activeModal: null,

  async loadScope() {
    const stored = await SettingsRepo.get<Scope>('scope')
    set({ scope: stored ?? DEFAULT_SCOPE })
  },

  async setScope(scope) {
    await SettingsRepo.set('scope', scope)
    set({ scope })
  },

  setSyncStatus(sourceId, status) {
    set(state => ({ syncStatus: { ...state.syncStatus, [sourceId]: status } }))
  },

  openModal(id) {
    set({ activeModal: id })
  },

  closeModal() {
    set({ activeModal: null })
  },
}))

// ─── Error store ──────────────────────────────────────────────────────────────

interface ErrorState {
  message: string | null
  show: (message: string) => void
  dismiss: () => void
}

export const useErrorStore = create<ErrorState>(set => ({
  message: null,
  show: (message) => set({ message }),
  dismiss: () => set({ message: null }),
}))
