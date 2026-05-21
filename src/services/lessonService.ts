// lessonService.ts — lesson content queries and deletion for the lesson browser.

import { LessonsRepo, CardsRepo } from '@/db'
import type { LessonRow, CardRow } from '@/lib/types'

/**
 * Returns all lessons currently in the local DB.
 */
export async function getAllLessons(): Promise<LessonRow[]> {
  return LessonsRepo.getAll()
}

/**
 * Returns a single lesson by its composite key, or undefined if not found.
 */
export async function getLessonById(
  sourceId: string,
  lessonId: string,
): Promise<LessonRow | undefined> {
  return LessonsRepo.get(sourceId, lessonId)
}

/**
 * Returns all card rows for a lesson. Card content is in each row's `data` field.
 */
export async function getAllCardsForLesson(
  sourceId: string,
  lessonId: string,
): Promise<CardRow[]> {
  return CardsRepo.getByLesson(sourceId, lessonId)
}

/**
 * Deletes a lesson and all its associated card states from the local DB.
 * Review history is preserved — it is an immutable audit log.
 */
export async function deleteLesson(sourceId: string, lessonId: string): Promise<void> {
  await Promise.all([
    LessonsRepo.delete(sourceId, lessonId),
    CardsRepo.deleteByLesson(sourceId, lessonId),
  ])
}

/**
 * Returns the sorted list of all unique tags across all lessons in the local DB.
 */
export async function getAllTags(): Promise<string[]> {
  const lessons = await LessonsRepo.getAll()
  const tagSet = new Set<string>()
  for (const lesson of lessons) {
    for (const tag of lesson.tags) tagSet.add(tag)
  }
  return Array.from(tagSet).sort()
}

/**
 * Returns the sorted list of unique category values across all lessons in the local DB.
 */
export async function getAllCategories(): Promise<string[]> {
  const lessons = await LessonsRepo.getAll()
  const categorySet = new Set<string>()
  for (const lesson of lessons) {
    if (lesson.category) categorySet.add(lesson.category)
  }
  return Array.from(categorySet).sort()
}

/**
 * Returns the sorted list of unique category values for a given source.
 * Only lessons that were synced with a category field are included.
 */
export async function getCategoriesForSource(sourceId: string): Promise<string[]> {
  const lessons = await LessonsRepo.getBySource(sourceId)
  const categorySet = new Set<string>()
  for (const lesson of lessons) {
    if (lesson.category) categorySet.add(lesson.category)
  }
  return Array.from(categorySet).sort()
}
