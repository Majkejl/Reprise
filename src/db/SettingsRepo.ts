// SettingsRepo — thin typed wrapper around the Dexie settings table.
// Keys are constrained to the SettingsKey union defined in types.ts.

import { db } from './db'
import type { SettingsKey } from '@/lib/types'

export const SettingsRepo = {
  /**
   * Returns the stored value for a settings key, cast to T, or undefined if not set.
   * The `as T` cast is safe because only SettingsRepo.set writes values and callers specify T.
   */
  async get<T>(key: SettingsKey): Promise<T | undefined> {
    const row = await db.settings.get(key)
    return row?.value as T | undefined
  },

  /** Stores a value under the given settings key, overwriting any existing value. */
  set<T>(key: SettingsKey, value: T) {
    return db.settings.put({ key, value })
  },

  /** Removes a settings entry. */
  delete(key: SettingsKey) {
    return db.settings.delete(key)
  },

  /** Returns all settings rows. Used for full export. */
  async getAll() {
    return db.settings.toArray()
  },
}
