import { db } from './db'
import type { CardRow } from '@/lib/types'

export const CardsRepo = {
  get(sourceId: string, lessonId: string, cardId: string) {
    return db.cards.get([sourceId, lessonId, cardId])
  },

  getByLesson(sourceId: string, lessonId: string) {
    return db.cards.where('[sourceId+lessonId]').equals([sourceId, lessonId]).toArray()
  },

  getByLessonKeys(keys: Array<[string, string]>) {
    return db.cards
      .where('[sourceId+lessonId]')
      .anyOf(keys)
      .toArray()
  },

  getDueBefore(timestamp: number) {
    return db.cards.where('due').belowOrEqual(timestamp).toArray()
  },

  upsert(card: CardRow) {
    return db.cards.put(card)
  },

  upsertMany(cards: CardRow[]) {
    return db.cards.bulkPut(cards)
  },

  delete(sourceId: string, lessonId: string, cardId: string) {
    return db.cards.delete([sourceId, lessonId, cardId])
  },

  deleteByLesson(sourceId: string, lessonId: string) {
    return db.cards.where('[sourceId+lessonId]').equals([sourceId, lessonId]).delete()
  },
}
