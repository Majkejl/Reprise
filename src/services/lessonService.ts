// lessonService.ts — lesson content queries for browsing and reading views.
// Read-only; does not modify lesson or card data.

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
