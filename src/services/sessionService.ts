// sessionService.ts — queue formation, card serving, and card completion lifecycle.
// Does not own error display; callers catch and route errors through useErrorStore.

import { LessonsRepo, CardsRepo, ReviewsRepo, SourcesRepo } from '@/db'
import { createInitialCardState, getDueCards, applyRating } from './fsrsService'
import type { Card } from 'ts-fsrs'
import type { Scope, QueueItem, LessonContext, CardRow, LessonCard } from '@/lib/types'
import { DEFAULT_SESSION_CAP, DEFAULT_QUEUE_PRIORITY } from '@/lib/types'

// Queue formation policy — D5 decision: reviews fill first, remaining slots go to new cards.
// Future values: 'balanced' | 'new-first' — wire to queuePriority setting (Phase 6).
const QUEUE_POLICY = DEFAULT_QUEUE_PRIORITY

/**
 * Forms a session queue from all cards in scope, applying the D5 queue policy and session cap.
 * Returns an empty array if no cards are due or in scope. Throws on DB error.
 */
export async function startSession(scope: Scope): Promise<QueueItem[]> {
  const allLessons = await getLessonsInScope(scope)
  if (allLessons.length === 0) return []

  const lessonKeys = allLessons.map(lesson => [lesson.sourceId, lesson.lessonId] as [string, string])
  const allCards = await CardsRepo.getByLessonKeys(lessonKeys)

  const dueCards = getDueCards(allCards)
  const dueKeySet = new Set(dueCards.map(card => `${card.sourceId}|${card.lessonId}|${card.cardId}`))
  const newCards = allCards.filter(
    card => card.reps === 0 && !dueKeySet.has(`${card.sourceId}|${card.lessonId}|${card.cardId}`),
  )

  const cap = DEFAULT_SESSION_CAP

  if (QUEUE_POLICY === 'reviews-first') {
    const reviewItems: QueueItem[] = dueCards.slice(0, cap).map(card => ({
      sourceId: card.sourceId, lessonId: card.lessonId, cardId: card.cardId, isNew: false,
    }))
    const newItems: QueueItem[] = newCards.slice(0, cap - reviewItems.length).map(card => ({
      sourceId: card.sourceId, lessonId: card.lessonId, cardId: card.cardId, isNew: true,
    }))
    return [...reviewItems, ...newItems]
  }

  // DEFERRED (Phase 6): implement 'balanced' and 'new-first' queue policies
  return []
}

/**
 * Fetches the card data, card DB row, and parent lesson context needed to render a queue item.
 * Returns null if the card or lesson no longer exists in the DB. Throws on DB error.
 */
export async function getCardAndContext(
  item: QueueItem,
): Promise<{ card: LessonCard; cardRow: CardRow; context: LessonContext; componentBundleUrl?: string } | null> {
  const [cardRow, lesson] = await Promise.all([
    CardsRepo.get(item.sourceId, item.lessonId, item.cardId),
    LessonsRepo.get(item.sourceId, item.lessonId),
  ])
  if (!cardRow || !lesson) return null

  const context: LessonContext = {
    lessonId: lesson.lessonId,
    title: lesson.title,
    tags: lesson.tags,
    sources: lesson.sources,
  }

  return { card: cardRow.data, cardRow, context, componentBundleUrl: lesson.componentBundleUrl }
}

/**
 * Applies a rating to a card's FSRS state, persists the update, and appends a review log entry.
 * Throws on DB error.
 */
export async function completeCard(
  item: QueueItem,
  cardRow: CardRow,
  rating: 1 | 2 | 3 | 4,
): Promise<void> {
  const fsrsCard = rowToFSRS(cardRow)
  const updated = applyRating(fsrsCard, rating)

  const now = Date.now()
  const updatedRow: CardRow = {
    ...cardRow,
    due: updated.due.getTime(),
    stability: updated.stability,
    difficulty: updated.difficulty,
    elapsedDays: updated.elapsed_days,
    scheduledDays: updated.scheduled_days,
    reps: updated.reps,
    lapses: updated.lapses,
    // ts-fsrs State enum is stored as its numeric value in Dexie
    state: updated.state as number,
    lastReview: now,
  }

  await CardsRepo.upsert(updatedRow)
  await ReviewsRepo.append({
    sourceId: item.sourceId,
    lessonId: item.lessonId,
    cardId: item.cardId,
    timestamp: now,
    rating,
    scheduledDays: updated.scheduled_days,
    elapsedDays: updated.elapsed_days,
  })
}

/**
 * Returns the number of cards currently due across all cards in scope.
 * Used by Dashboard; does not apply session cap.
 */
export async function getDueCardCount(scope: Scope): Promise<number> {
  const allLessons = await getLessonsInScope(scope)
  if (allLessons.length === 0) return 0
  const lessonKeys = allLessons.map(lesson => [lesson.sourceId, lesson.lessonId] as [string, string])
  const allCards = await CardsRepo.getByLessonKeys(lessonKeys)
  return getDueCards(allCards).length
}

/**
 * Returns the number of registered sources.
 * Temporary home until a dedicated SourceService exists (Phase 3).
 */
export async function getSourceCount(): Promise<number> {
  const sources = await SourcesRepo.getAll()
  return sources.length
}

/**
 * Forms a session queue limited to a single lesson. Used by "Study this lesson" shortcuts.
 * Applies the same D5 queue policy and session cap as startSession.
 */
export async function startSessionForLesson(sourceId: string, lessonId: string): Promise<QueueItem[]> {
  const allCards = await CardsRepo.getByLesson(sourceId, lessonId)
  if (allCards.length === 0) return []

  const dueCards = getDueCards(allCards)
  const dueKeySet = new Set(dueCards.map(card => `${card.sourceId}|${card.lessonId}|${card.cardId}`))
  const newCards = allCards.filter(
    card => card.reps === 0 && !dueKeySet.has(`${card.sourceId}|${card.lessonId}|${card.cardId}`),
  )

  const cap = DEFAULT_SESSION_CAP
  const reviewItems: QueueItem[] = dueCards.slice(0, cap).map(card => ({
    sourceId: card.sourceId, lessonId: card.lessonId, cardId: card.cardId, isNew: false,
  }))
  const newItems: QueueItem[] = newCards.slice(0, cap - reviewItems.length).map(card => ({
    sourceId: card.sourceId, lessonId: card.lessonId, cardId: card.cardId, isNew: true,
  }))
  return [...reviewItems, ...newItems]
}

/**
 * Reverts a completed card to its previous state and removes the most recent review log entry.
 * The previousCardRow snapshot must be taken before completeCard was called. Throws on DB error.
 */
export async function undoLastRating(item: QueueItem, previousCardRow: CardRow): Promise<void> {
  await CardsRepo.upsert(previousCardRow)
  await ReviewsRepo.deleteLatestForCard(item.sourceId, item.lessonId, item.cardId)
}

/**
 * Returns the number of consecutive days (up to and including today) that had at least one review.
 * If the user hasn't studied today yet, counts back from yesterday so the streak doesn't break mid-day.
 */
export async function getStreak(): Promise<number> {
  const reviews = await ReviewsRepo.getAll()
  if (reviews.length === 0) return 0

  const reviewDays = new Set(reviews.map(r => toLocalDateStr(new Date(r.timestamp))))
  const today = toLocalDateStr(new Date())
  // Start from today if already studied, otherwise yesterday (preserves streak before daily study)
  let cursor = reviewDays.has(today) ? new Date() : new Date(Date.now() - 86400000)
  let streak = 0

  while (reviewDays.has(toLocalDateStr(cursor))) {
    streak++
    cursor = new Date(cursor.getTime() - 86400000)
  }

  return streak
}

/**
 * Returns an array of `days` integers: how many cards are due on each upcoming calendar day.
 * Day 0 (today) includes all overdue cards. Future days count only new-due cards on that date.
 */
export async function getDueForecast(scope: Scope, days: number = 7): Promise<number[]> {
  const allLessons = await getLessonsInScope(scope)
  if (allLessons.length === 0) return Array(days).fill(0)

  const lessonKeys = allLessons.map(lesson => [lesson.sourceId, lesson.lessonId] as [string, string])
  const allCards = await CardsRepo.getByLessonKeys(lessonKeys)

  const now = new Date()
  // midnight local time for day-boundary arithmetic
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  return Array.from({ length: days }, (_, i) => {
    const dayStart = new Date(startOfToday.getTime() + i * 86400000)
    const dayEnd = new Date(dayStart.getTime() + 86400000 - 1)
    return allCards.filter(card => {
      const due = new Date(card.due)
      // Day 0: all overdue + due today; subsequent days: cards first due on that day
      return i === 0 ? due <= dayEnd : due >= dayStart && due <= dayEnd
    }).length
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getLessonsInScope(scope: Scope) {
  let lessons = scope.sourceIds === 'all'
    ? await LessonsRepo.getAll()
    : (await Promise.all(
        (scope.sourceIds as string[]).map(sourceId => LessonsRepo.getBySource(sourceId))
      )).flat()

  // categories is optional for backward compat — treat undefined as 'all'
  const effectiveCategories = scope.categories ?? 'all'
  if (effectiveCategories !== 'all') {
    const categorySet = new Set(effectiveCategories as string[])
    lessons = lessons.filter(lesson => lesson.category && categorySet.has(lesson.category))
  }

  if (scope.tags !== 'all') {
    const tagSet = new Set(scope.tags as string[])
    lessons = lessons.filter(lesson => lesson.tags.some(tag => tagSet.has(tag)))
  }
  return lessons
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function rowToFSRS(row: CardRow) {
  const initial = createInitialCardState()
  return {
    ...initial,
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    reps: row.reps,
    lapses: row.lapses,
    // ts-fsrs State enum is stored as a number in Dexie; cast is safe because we only write valid State values
    state: row.state as Card['state'],
    last_review: row.lastReview ? new Date(row.lastReview) : initial.last_review,
  }
}
