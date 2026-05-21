// LessonsRepo — thin typed wrapper around the Dexie lessons table.
// No business logic here; query composition belongs in services.

import { db } from './db'
import type { LessonRow } from '@/lib/types'

export const LessonsRepo = {
  /** Returns a single lesson by composite key, or undefined if not found. */
  get(sourceId: string, lessonId: string) {
    return db.lessons.get([sourceId, lessonId])
  },

  /** Returns all lessons in the DB. */
  getAll() {
    return db.lessons.toArray()
  },

  /** Returns all lessons belonging to a given source. */
  getBySource(sourceId: string) {
    return db.lessons.where('sourceId').equals(sourceId).toArray()
  },

  /** Returns all lessons that carry at least one of the given tags (distinct). */
  getByTags(tags: string[]) {
    return db.lessons.where('tags').anyOf(tags).distinct().toArray()
  },

  /** Inserts or replaces a lesson row by composite key. */
  upsert(lesson: LessonRow) {
    return db.lessons.put(lesson)
  },

  /** Bulk inserts or replaces lesson rows. */
  upsertMany(lessons: LessonRow[]) {
    return db.lessons.bulkPut(lessons)
  },

  /** Partially updates the category field on an existing lesson without touching other fields. */
  updateCategory(sourceId: string, lessonId: string, category: string) {
    return db.lessons.update([sourceId, lessonId], { category })
  },

  /** Deletes a single lesson by composite key. */
  delete(sourceId: string, lessonId: string) {
    return db.lessons.delete([sourceId, lessonId])
  },

  /** Deletes all lessons belonging to a given source. */
  deleteBySource(sourceId: string) {
    return db.lessons.where('sourceId').equals(sourceId).delete()
  },
}
