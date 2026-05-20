// ReviewsRepo — thin typed wrapper around the Dexie reviews table.
// Reviews are immutable log entries; no update or delete operations are exposed.

import { db } from './db'
import type { ReviewRow } from '@/lib/types'

export const ReviewsRepo = {
  /** Appends an immutable review log entry. */
  append(review: ReviewRow) {
    return db.reviews.put(review)
  },

  /** Returns all review entries for a given card, ordered by insertion. */
  getByCard(sourceId: string, lessonId: string, cardId: string) {
    return db.reviews
      .where('[sourceId+lessonId+cardId]')
      .equals([sourceId, lessonId, cardId])
      .toArray()
  },

  /** Returns every review row in the DB. Used for full export. */
  getAll() {
    return db.reviews.toArray()
  },
}
