// SourcesRepo — thin typed wrapper around the Dexie sources table.
// No business logic; sync orchestration belongs in the future Source Manager service.

import { db } from './db'
import type { SourceRow } from '@/lib/types'

export const SourcesRepo = {
  /** Returns a single source row by sourceId, or undefined if not found. */
  get(sourceId: string) {
    return db.sources.get(sourceId)
  },

  /** Returns all registered sources. */
  getAll() {
    return db.sources.toArray()
  },

  /** Inserts or replaces a source row. */
  upsert(source: SourceRow) {
    return db.sources.put(source)
  },

  /** Updates only the lastSynced timestamp for a source. */
  updateSyncTimestamp(sourceId: string, timestamp: number) {
    return db.sources.update(sourceId, { lastSynced: timestamp })
  },

  /** Deletes a source by sourceId. Does not cascade-delete associated lessons or cards. */
  delete(sourceId: string) {
    return db.sources.delete(sourceId)
  },
}
