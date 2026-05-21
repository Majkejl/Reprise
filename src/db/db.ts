// db.ts — AppDB Dexie class. Holds all schema versions; version history is never deleted.

import Dexie, { type Table } from 'dexie'
import type { LessonRow, CardRow, ReviewRow, SourceRow, SettingsRow } from '@/lib/types'

export class AppDB extends Dexie {
  lessons!: Table<LessonRow>
  cards!: Table<CardRow>
  reviews!: Table<ReviewRow>
  sources!: Table<SourceRow>
  settings!: Table<SettingsRow>

  constructor() {
    super('reprise')

    this.version(1).stores({
      lessons: '[sourceId+lessonId], sourceId, *tags',
      cards: '[sourceId+lessonId+cardId], [sourceId+lessonId], due',
      reviews: '[sourceId+lessonId+cardId+timestamp], [sourceId+lessonId+cardId]',
      sources: 'sourceId',
      settings: 'key',
    })

    // Version 2: adds `category` index to lessons for category-based sync filtering.
    this.version(2).stores({
      lessons: '[sourceId+lessonId], sourceId, *tags, category',
    })
  }
}

export const db = new AppDB()
