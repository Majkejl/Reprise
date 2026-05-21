// CardsRepo — thin typed wrapper around the Dexie cards table.
// No business logic here; FSRS logic belongs in fsrsService.

import { db } from './db'
import type { CardRow } from '@/lib/types'

export const CardsRepo = {
  /** Returns a single card row by composite key, or undefined if not found. */
  get(sourceId: string, lessonId: string, cardId: string) {
    return db.cards.get([sourceId, lessonId, cardId])
  },

  /** Returns all card rows for a given lesson. */
  getByLesson(sourceId: string, lessonId: string) {
    return db.cards.where('[sourceId+lessonId]').equals([sourceId, lessonId]).toArray()
  },

  /** Returns all card rows for a set of (sourceId, lessonId) pairs. */
  getByLessonKeys(keys: Array<[string, string]>) {
    return db.cards
      .where('[sourceId+lessonId]')
      .anyOf(keys)
      .toArray()
  },

  /** Returns all card rows with a due timestamp at or before the given value. */
  getDueBefore(timestamp: number) {
    return db.cards.where('due').belowOrEqual(timestamp).toArray()
  },

  /** Inserts or replaces a card row by composite key. */
  upsert(card: CardRow) {
    return db.cards.put(card)
  },

  /** Bulk inserts or replaces card rows. */
  upsertMany(cards: CardRow[]) {
    return db.cards.bulkPut(cards)
  },

  /** Deletes a single card row by composite key. */
  delete(sourceId: string, lessonId: string, cardId: string) {
    return db.cards.delete([sourceId, lessonId, cardId])
  },

  /** Returns every card row in the DB. Used for full export. */
  getAll() {
    return db.cards.toArray()
  },

  /** Deletes all card rows belonging to a given lesson. */
  deleteByLesson(sourceId: string, lessonId: string) {
    return db.cards.where('[sourceId+lessonId]').equals([sourceId, lessonId]).delete()
  },
}
