// lessonService.ts — lesson content queries and deletion for the lesson browser.

import { LessonsRepo, CardsRepo } from '@/db'
import type { LessonRow, CardRow } from '@/lib/types'

/**
 * Maps a card's FSRS state + stability to a mastery percentage (0–100).
 *
 * FSRS state values: 0=New, 1=Learning, 2=Review, 3=Relearning.
 * For Review cards, stability in days is used to interpolate 50–100%
 * (stability ≥ 90 days is treated as fully mastered).
 */
export function computeCardMastery(card: CardRow): number {
  switch (card.state) {
    case 1: return 25   // Learning — still in short-interval phase
    case 3: return 10   // Relearning — lapsed, close to Again
    case 2: {
      // Review: stability 0 → 50%, stability 90+ days → 100%
      return Math.min(100, 50 + Math.round((Math.min(card.stability, 90) / 90) * 50))
    }
    default: return 0   // New — never rated
  }
}

/**
 * Returns a map of `sourceId|lessonId` → mastery percentage (0–100) for the given lessons.
 * Fetches all card rows in a single batch query and averages mastery per lesson.
 * Lessons with no cards default to 0%.
 */
export async function getLessonProgressMap(
  lessons: LessonRow[],
): Promise<Record<string, number>> {
  const keys: Array<[string, string]> = lessons.map(l => [l.sourceId, l.lessonId])
  const allCards = await CardsRepo.getByLessonKeys(keys)

  const cardsByLesson: Record<string, CardRow[]> = {}
  for (const card of allCards) {
    const key = `${card.sourceId}|${card.lessonId}`
    ;(cardsByLesson[key] ??= []).push(card)
  }

  const result: Record<string, number> = {}
  for (const lesson of lessons) {
    const key = `${lesson.sourceId}|${lesson.lessonId}`
    const cards = cardsByLesson[key] ?? []
    if (cards.length === 0) { result[key] = 0; continue }
    const total = cards.reduce((sum, card) => sum + computeCardMastery(card), 0)
    result[key] = Math.round(total / cards.length)
  }
  return result
}

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
