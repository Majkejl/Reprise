// ReviewsRepo — thin typed wrapper around the Dexie reviews table.
// Reviews are append-only except for deleteLatestForCard, which exists solely to support undo.

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

  /** Removes the most recent review entry for a card. Used exclusively to support undo-last-rating. */
  async deleteLatestForCard(sourceId: string, lessonId: string, cardId: string): Promise<void> {
    const reviews = await db.reviews
      .where('[sourceId+lessonId+cardId]')
      .equals([sourceId, lessonId, cardId])
      .toArray()
    if (reviews.length === 0) return
    const latest = reviews.reduce((a, b) => a.timestamp > b.timestamp ? a : b)
    await db.reviews.delete([sourceId, lessonId, cardId, latest.timestamp])
  },
}
