// exportImportService.ts — exports all local data as a JSON blob and imports it back.
// Also handles local lesson file import (assigns sourceId from creator field).

import { LessonsRepo, CardsRepo, ReviewsRepo, SourcesRepo, SettingsRepo } from '@/db'
import { createInitialCardState } from './fsrsService'
import type { LessonJSON, LessonRow, CardRow } from '@/lib/types'

interface ExportMeta {
  version: 1
  exportedAt: number
  type: 'full' | 'progress'
}

interface FullExportData {
  _meta: ExportMeta
  lessons: LessonRow[]
  cards: CardRow[]
  reviews: unknown[]
  sources: unknown[]
  settings: unknown[]
}

interface ProgressExportData {
  _meta: ExportMeta
  cards: CardRow[]
  settings: unknown[]
}

/**
 * Exports all five tables to a downloadable JSON blob.
 */
export async function exportFull(): Promise<Blob> {
  const [lessons, cards, reviews, sources, settings] = await Promise.all([
    LessonsRepo.getAll(),
    CardsRepo.getAll(),
    ReviewsRepo.getAll(),
    SourcesRepo.getAll(),
    SettingsRepo.getAll(),
  ])

  const data: FullExportData = {
    _meta: { version: 1, exportedAt: Date.now(), type: 'full' },
    lessons,
    cards,
    reviews,
    sources,
    settings,
  }

  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

/**
 * Exports only card states and settings — no lesson content or review history.
 * Smaller file, sufficient to restore study progress without lesson data.
 */
export async function exportProgress(): Promise<Blob> {
  const [cards, settings] = await Promise.all([
    CardsRepo.getAll(),
    SettingsRepo.getAll(),
  ])

  const data: ProgressExportData = {
    _meta: { version: 1, exportedAt: Date.now(), type: 'progress' },
    cards,
    settings,
  }

  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

/**
 * Imports data from a previously exported JSON blob. Imported records win on conflict.
 * Validates top-level structure before writing anything. Throws on malformed input.
 */
export async function importData(jsonText: string): Promise<void> {
  const parsed: unknown = JSON.parse(jsonText)
  if (!isExportData(parsed)) {
    throw new Error('Unrecognised export format — the file may be corrupted or from an incompatible version')
  }

  if (parsed._meta.type === 'full') {
    const full = parsed as FullExportData
    await Promise.all([
      LessonsRepo.upsertMany(full.lessons),
      CardsRepo.upsertMany(full.cards),
    ])
    for (const review of full.reviews) {
      await ReviewsRepo.append(review as Parameters<typeof ReviewsRepo.append>[0])
    }
    for (const source of full.sources) {
      await SourcesRepo.upsert(source as Parameters<typeof SourcesRepo.upsert>[0])
    }
    for (const setting of full.settings) {
      const s = setting as { key: Parameters<typeof SettingsRepo.set>[0]; value: unknown }
      await SettingsRepo.set(s.key, s.value)
    }
  } else {
    const progress = parsed as ProgressExportData
    await CardsRepo.upsertMany(progress.cards)
    for (const setting of progress.settings) {
      const s = setting as { key: Parameters<typeof SettingsRepo.set>[0]; value: unknown }
      await SettingsRepo.set(s.key, s.value)
    }
  }
}

/**
 * Imports a single lesson JSON file into the local DB.
 * Derives sourceId from the lesson's `creator` field (e.g. local-jane-smith).
 * Initialises fresh card states for cards that do not yet have one.
 * Does not overwrite existing card FSRS progress. Throws on invalid lesson JSON.
 */
export async function importLocalLesson(jsonText: string): Promise<void> {
  const parsed: unknown = JSON.parse(jsonText)
  if (!isLessonJSON(parsed)) {
    throw new Error('Invalid lesson file — required fields (lessonId, version, title, tags, cards) are missing')
  }

  const lessonJSON = parsed as LessonJSON
  // DECISION: sourceId for local imports is derived from the creator field: local-{creator-slug}.
  // If creator is absent, a timestamp-based fallback avoids collisions across separate imports.
  const creatorSlug = lessonJSON.creator
    ? lessonJSON.creator.toLowerCase().trim().replace(/\s+/g, '-')
    : `import-${Date.now().toString(36)}`
  const sourceId = `local-${creatorSlug}`

  const lessonRow: LessonRow = {
    sourceId,
    lessonId: lessonJSON.lessonId,
    version: lessonJSON.version,
    title: lessonJSON.title,
    overview: lessonJSON.overview,
    tags: lessonJSON.tags.map(normalizeTag),
    creator: lessonJSON.creator,
    sources: lessonJSON.sources ?? [],
    // DEFERRED (Phase 4): locally imported lessons preserve the bundle URL from the JSON,
    // but the bundle won't be pre-cached. The engine will fall back to the default renderer.
    componentBundleUrl: lessonJSON.componentBundleUrl,
  }

  await LessonsRepo.upsert(lessonRow)

  const existingCards = await CardsRepo.getByLesson(sourceId, lessonJSON.lessonId)
  const existingCardById = new Map(existingCards.map(card => [card.cardId, card]))

  // Always upsert all cards: refresh data/type for existing cards (preserving FSRS state),
  // and initialise fresh state for new ones.
  const cardRows: CardRow[] = lessonJSON.cards.map(card => {
    const existing = existingCardById.get(card.cardId)
    if (existing) {
      return { ...existing, data: card, type: card.type }
    }
    const initialState = createInitialCardState()
    return {
      sourceId,
      lessonId: lessonJSON.lessonId,
      cardId: card.cardId,
      type: card.type,
      data: card,
      due: initialState.due.getTime(),
      stability: initialState.stability,
      difficulty: initialState.difficulty,
      elapsedDays: initialState.elapsed_days,
      scheduledDays: initialState.scheduled_days,
      reps: initialState.reps,
      lapses: initialState.lapses,
      state: initialState.state as number,
    }
  })

  await CardsRepo.upsertMany(cardRows)
}

/**
 * Triggers a file download in the browser with the given blob and filename.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

// ─── Validation helpers ────────────────────────────────────────────────────────

function isExportData(value: unknown): value is FullExportData | ProgressExportData {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (typeof obj._meta !== 'object' || obj._meta === null) return false
  const meta = obj._meta as Record<string, unknown>
  if (meta.version !== 1) return false
  if (meta.type !== 'full' && meta.type !== 'progress') return false
  if (!Array.isArray(obj.cards)) return false
  return true
}

function isLessonJSON(value: unknown): value is LessonJSON {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.lessonId === 'string' &&
    typeof obj.version === 'number' &&
    typeof obj.title === 'string' &&
    Array.isArray(obj.tags) &&
    Array.isArray(obj.cards)
  )
}

function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim().replace(/\s+/g, '-')
}
