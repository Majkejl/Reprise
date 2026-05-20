import { db } from './db'
import type { ReviewRow } from '@/lib/types'

export const ReviewsRepo = {
  append(review: ReviewRow) {
    return db.reviews.put(review)
  },

  getByCard(sourceId: string, lessonId: string, cardId: string) {
    return db.reviews
      .where('[sourceId+lessonId+cardId]')
      .equals([sourceId, lessonId, cardId])
      .toArray()
  },

  getAll() {
    return db.reviews.toArray()
  },
}
