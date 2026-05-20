import { db } from './db'
import type { LessonRow } from '@/lib/types'

export const LessonsRepo = {
  get(sourceId: string, lessonId: string) {
    return db.lessons.get([sourceId, lessonId])
  },

  getAll() {
    return db.lessons.toArray()
  },

  getBySource(sourceId: string) {
    return db.lessons.where('sourceId').equals(sourceId).toArray()
  },

  getByTags(tags: string[]) {
    return db.lessons.where('tags').anyOf(tags).distinct().toArray()
  },

  upsert(lesson: LessonRow) {
    return db.lessons.put(lesson)
  },

  upsertMany(lessons: LessonRow[]) {
    return db.lessons.bulkPut(lessons)
  },

  delete(sourceId: string, lessonId: string) {
    return db.lessons.delete([sourceId, lessonId])
  },

  deleteBySource(sourceId: string) {
    return db.lessons.where('sourceId').equals(sourceId).delete()
  },
}
