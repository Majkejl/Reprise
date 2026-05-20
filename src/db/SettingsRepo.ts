import { db } from './db'
import type { SettingsKey } from '@/lib/types'

export const SettingsRepo = {
  async get<T>(key: SettingsKey): Promise<T | undefined> {
    const row = await db.settings.get(key)
    return row?.value as T | undefined
  },

  set<T>(key: SettingsKey, value: T) {
    return db.settings.put({ key, value })
  },

  delete(key: SettingsKey) {
    return db.settings.delete(key)
  },

  async getAll() {
    return db.settings.toArray()
  },
}
