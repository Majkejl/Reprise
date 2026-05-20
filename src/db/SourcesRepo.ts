import { db } from './db'
import type { SourceRow } from '@/lib/types'

export const SourcesRepo = {
  get(sourceId: string) {
    return db.sources.get(sourceId)
  },

  getAll() {
    return db.sources.toArray()
  },

  upsert(source: SourceRow) {
    return db.sources.put(source)
  },

  updateSyncTimestamp(sourceId: string, timestamp: number) {
    return db.sources.update(sourceId, { lastSynced: timestamp })
  },

  delete(sourceId: string) {
    return db.sources.delete(sourceId)
  },
}
