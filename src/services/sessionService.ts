import { LessonsRepo, CardsRepo, ReviewsRepo } from '@/db'
import { createInitialCardState, getDueCards, applyRating } from './fsrsService'
import type { Card } from 'ts-fsrs'
import type { Scope, QueueItem, LessonContext, CardRow, LessonCard } from '@/lib/types'
import { DEFAULT_SESSION_CAP, DEFAULT_QUEUE_PRIORITY } from '@/lib/types'
import { useErrorStore } from '@/stores/uiStore'

// Named constant for queue formation policy (D5).
// Future values: 'reviews-first' | 'balanced' | 'new-first'
const QUEUE_POLICY = DEFAULT_QUEUE_PRIORITY // 'reviews-first'

export async function startSession(scope: Scope): Promise<QueueItem[]> {
  try {
    const allLessons = await getLessonsInScope(scope)
    if (allLessons.length === 0) return []

    const lessonKeys = allLessons.map(l => [l.sourceId, l.lessonId] as [string, string])
    const allCards = await CardsRepo.getByLessonKeys(lessonKeys)

    const dueCards = getDueCards(allCards)
    const dueKeySet = new Set(dueCards.map(c => `${c.sourceId}|${c.lessonId}|${c.cardId}`))
    const newCards = allCards.filter(
      c => c.reps === 0 && !dueKeySet.has(`${c.sourceId}|${c.lessonId}|${c.cardId}`),
    )

    const cap = DEFAULT_SESSION_CAP

    if (QUEUE_POLICY === 'reviews-first') {
      const reviewItems: QueueItem[] = dueCards.slice(0, cap).map(c => ({
        sourceId: c.sourceId, lessonId: c.lessonId, cardId: c.cardId, isNew: false,
      }))
      const newItems: QueueItem[] = newCards.slice(0, cap - reviewItems.length).map(c => ({
        sourceId: c.sourceId, lessonId: c.lessonId, cardId: c.cardId, isNew: true,
      }))
      return [...reviewItems, ...newItems]
    }

    return []
  } catch (e) {
    useErrorStore.getState().show(String(e))
    return []
  }
}

export async function getCardAndContext(
  item: QueueItem,
): Promise<{ card: LessonCard; cardRow: CardRow; context: LessonContext } | null> {
  try {
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

    return { card: cardRow.data, cardRow, context }
  } catch (e) {
    useErrorStore.getState().show(String(e))
    return null
  }
}

export async function completeCard(
  item: QueueItem,
  cardRow: CardRow,
  rating: 1 | 2 | 3 | 4,
): Promise<void> {
  try {
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
  } catch (e) {
    useErrorStore.getState().show(String(e))
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getLessonsInScope(scope: Scope) {
  if (scope.sourceIds === 'all' && scope.tags === 'all') {
    return LessonsRepo.getAll()
  }
  let lessons = scope.sourceIds === 'all'
    ? await LessonsRepo.getAll()
    : (await Promise.all(
        (scope.sourceIds as string[]).map(sid => LessonsRepo.getBySource(sid))
      )).flat()

  if (scope.tags !== 'all') {
    const tagSet = new Set(scope.tags as string[])
    lessons = lessons.filter(l => l.tags.some(t => tagSet.has(t)))
  }
  return lessons
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
    state: row.state as Card['state'],
    last_review: row.lastReview ? new Date(row.lastReview) : initial.last_review,
  }
}
