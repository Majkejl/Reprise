// sourceManager.ts — syncs lesson sources with external repos and manages source registration.
// Services throw on failure; callers own error display and sync-status store updates.

import { LessonsRepo, CardsRepo, SourcesRepo } from '@/db'
import { createInitialCardState } from './fsrsService'
import type { LessonJSON, LessonRow, CardRow, SourceRow } from '@/lib/types'
import { BUNDLE_CACHE_NAME } from '@/lib/types'

// DECISION: stable identifier for the first-party lesson source row in SourcesRepo.
export const OFFICIAL_SOURCE_ID = 'reprise-official'

export const OFFICIAL_SOURCE_URL = 'https://majkejl.github.io/Reprise-lessons/'

// DECISION: index.json format: { "lessons": [{ "lessonId", "version", "url" }] }
// where "url" is a path relative to the source's base URL, or an absolute URL.
interface SourceIndexEntry {
  lessonId: string
  version: number
  url: string
}

interface SourceIndexJSON {
  lessons: SourceIndexEntry[]
}

/** Callback invoked by sync functions so callers can update UI state without importing stores. */
export type SyncProgressCallback = (sourceId: string, status: 'syncing' | 'done' | 'error') => void

/**
 * Ensures the official source row exists in SourcesRepo. Safe to call on every app startup.
 */
export async function ensureOfficialSource(): Promise<void> {
  const existing = await SourcesRepo.get(OFFICIAL_SOURCE_ID)
  if (!existing) {
    await SourcesRepo.upsert({
      sourceId: OFFICIAL_SOURCE_ID,
      label: 'Reprise Official',
      url: OFFICIAL_SOURCE_URL,
    })
  }
}

/**
 * Returns all registered sources.
 */
export async function getAllSources(): Promise<SourceRow[]> {
  return SourcesRepo.getAll()
}

/**
 * Syncs a single source: fetches its index.json, diffs against local lessons on (lessonId, version),
 * downloads changed lesson JSON, and upserts results. Initialises card states for new cards.
 * Skips silently if the browser is offline. Throws on network or parse error.
 */
export async function syncSource(
  sourceId: string,
  onProgress?: SyncProgressCallback,
): Promise<void> {
  if (!navigator.onLine) return

  const source = await SourcesRepo.get(sourceId)
  if (!source?.url) throw new Error(`Source "${sourceId}" has no registered URL`)

  onProgress?.(sourceId, 'syncing')

  try {
    const indexResponse = await fetch(`${source.url}index.json`)
    if (!indexResponse.ok) {
      throw new Error(`Failed to fetch index for "${sourceId}" (HTTP ${indexResponse.status})`)
    }

    const indexData: unknown = await indexResponse.json()
    if (!isSourceIndexJSON(indexData)) {
      throw new Error(`Invalid index.json format received from "${sourceId}"`)
    }

    const localLessons = await LessonsRepo.getBySource(sourceId)
    const localVersionByLessonId = new Map(localLessons.map(lesson => [lesson.lessonId, lesson.version]))

    const changedEntries = indexData.lessons.filter(entry => {
      const localVersion = localVersionByLessonId.get(entry.lessonId)
      return localVersion === undefined || localVersion < entry.version
    })

    for (const entry of changedEntries) {
      const lessonUrl = resolveUrl(source.url, entry.url)
      const lessonResponse = await fetch(lessonUrl)
      if (!lessonResponse.ok) {
        throw new Error(`Failed to fetch lesson "${entry.lessonId}" (HTTP ${lessonResponse.status})`)
      }
      const lessonJSON: LessonJSON = await lessonResponse.json() as LessonJSON

      if (lessonJSON.componentBundleUrl) {
        const resolvedBundleUrl = resolveUrl(source.url, lessonJSON.componentBundleUrl)
        await cacheBundleIfNeeded(resolvedBundleUrl)
        // Store the resolved absolute URL so the engine can look it up by key
        lessonJSON.componentBundleUrl = resolvedBundleUrl
      }

      await upsertLessonWithCards(sourceId, lessonJSON)
    }

    await SourcesRepo.updateSyncTimestamp(sourceId, Date.now())
    onProgress?.(sourceId, 'done')
  } catch (error) {
    onProgress?.(sourceId, 'error')
    throw error
  }
}

/**
 * Syncs all registered sources in sequence. Continues past individual failures.
 * Throws a combined error message if any sources fail.
 */
export async function syncAll(onProgress?: SyncProgressCallback): Promise<void> {
  const sources = await SourcesRepo.getAll()
  const failedMessages: string[] = []

  for (const source of sources) {
    try {
      await syncSource(source.sourceId, onProgress)
    } catch (error) {
      failedMessages.push(
        `${source.label}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  if (failedMessages.length > 0) {
    throw new Error(`${failedMessages.length} source(s) failed:\n${failedMessages.join('\n')}`)
  }
}

/**
 * Registers a third-party lesson source by URL. Validates the URL by fetching its index.json
 * before saving (skipped if offline). Returns the derived sourceId.
 * Throws if the URL is already registered or the index.json fetch fails.
 */
export async function registerSource(url: string, label: string): Promise<string> {
  const normalizedUrl = url.endsWith('/') ? url : `${url}/`
  // DECISION: third-party sourceId is URL-derived — strip protocol, replace non-alphanumeric with
  // hyphens, prefix with "user-". Truncated to keep composite DB keys manageable.
  const slug = normalizedUrl
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  const sourceId = `user-${slug}`

  const existing = await SourcesRepo.get(sourceId)
  if (existing) throw new Error('A source at that URL is already registered')

  if (navigator.onLine) {
    let indexResponse: Response
    try {
      indexResponse = await fetch(`${normalizedUrl}index.json`)
    } catch {
      throw new Error('Could not reach that URL — check the address and try again')
    }
    if (!indexResponse.ok) {
      throw new Error(`Source returned HTTP ${indexResponse.status} — check the URL`)
    }
    let indexData: unknown
    try {
      indexData = await (indexResponse.json() as Promise<unknown>)
    } catch {
      throw new Error('URL does not appear to be a valid Reprise lesson source')
    }
    if (!isSourceIndexJSON(indexData)) {
      throw new Error('URL does not appear to be a valid Reprise lesson source')
    }
  }

  const resolvedLabel = label.trim() || extractHostname(normalizedUrl)
  await SourcesRepo.upsert({ sourceId, label: resolvedLabel, url: normalizedUrl })
  return sourceId
}

/**
 * Removes a user-added source from SourcesRepo. Does not cascade-delete associated lessons or cards.
 * Throws if the official source is targeted.
 */
export async function removeSource(sourceId: string): Promise<void> {
  if (sourceId === OFFICIAL_SOURCE_ID) throw new Error('The official source cannot be removed')
  await SourcesRepo.delete(sourceId)
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function upsertLessonWithCards(sourceId: string, lessonJSON: LessonJSON): Promise<void> {
  const lessonRow: LessonRow = {
    sourceId,
    lessonId: lessonJSON.lessonId,
    version: lessonJSON.version,
    title: lessonJSON.title,
    overview: lessonJSON.overview,
    tags: lessonJSON.tags.map(normalizeTag),
    creator: lessonJSON.creator,
    sources: lessonJSON.sources ?? [],
    componentBundleUrl: lessonJSON.componentBundleUrl,
  }

  await LessonsRepo.upsert(lessonRow)

  const existingCards = await CardsRepo.getByLesson(sourceId, lessonJSON.lessonId)
  const existingCardIds = new Set(existingCards.map(card => card.cardId))

  const newCardRows: CardRow[] = lessonJSON.cards
    .filter(card => !existingCardIds.has(card.cardId))
    .map(card => {
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

  if (newCardRows.length > 0) {
    await CardsRepo.upsertMany(newCardRows)
  }
}

// Fetches a component bundle URL and stores it in the bundle Cache API entry.
// Skips silently if already cached. The cache key is the resolved absolute URL (D1).
async function cacheBundleIfNeeded(bundleUrl: string): Promise<void> {
  const cache = await caches.open(BUNDLE_CACHE_NAME)
  const existing = await cache.match(bundleUrl)
  if (existing) return

  const response = await fetch(bundleUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch component bundle (HTTP ${response.status}): ${bundleUrl}`)
  }
  await cache.put(bundleUrl, response)
}

function isSourceIndexJSON(value: unknown): value is SourceIndexJSON {
  return (
    typeof value === 'object' &&
    value !== null &&
    'lessons' in value &&
    Array.isArray((value as Record<string, unknown>).lessons)
  )
}

function resolveUrl(baseUrl: string, relativeOrAbsoluteUrl: string): string {
  try {
    return new URL(relativeOrAbsoluteUrl, baseUrl).href
  } catch {
    return relativeOrAbsoluteUrl
  }
}

function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim().replace(/\s+/g, '-')
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
