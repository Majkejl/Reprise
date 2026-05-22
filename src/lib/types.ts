// types.ts — all shared types and constants. Single source of truth; do not redefine elsewhere.

export type { Card as FSRSCard, State as FSRSState, Rating as FSRSRating } from 'ts-fsrs'

// ─── Question types ───────────────────────────────────────────────────────────

export type QuestionType = 'multiple-choice' | 'fill-in-blank' | 'free-text'

export interface MultipleChoiceCard {
  cardId: string
  type: 'multiple-choice'
  question: string
  options: string[]
  correctIndex: number
  explanation?: string
}

export interface FillInBlankCard {
  cardId: string
  type: 'fill-in-blank'
  prompt: string
  acceptedAnswers: string[]
  explanation?: string
}

export interface FreeTextCard {
  cardId: string
  type: 'free-text'
  question: string
  explanation?: string
}

export type LessonCard = MultipleChoiceCard | FillInBlankCard | FreeTextCard

// ─── Lesson JSON ──────────────────────────────────────────────────────────────

export interface LessonSource {
  label: string
  url?: string
  summary?: string
}

export interface LessonJSON {
  lessonId: string
  version: number
  title: string
  overview?: string
  tags: string[]
  creator?: string
  sources?: LessonSource[]
  cards: LessonCard[]
  // D1: ES module URL pointing to the lesson's custom renderer bundle
  componentBundleUrl?: string
}

// ─── DB row types ─────────────────────────────────────────────────────────────

export interface LessonRow {
  sourceId: string
  lessonId: string
  version: number
  title: string
  overview?: string
  tags: string[]
  // Organisational category from the source's index.json — used for selective sync.
  category?: string
  creator?: string
  sources: LessonSource[]
  componentBundleUrl?: string
}

export interface CardRow {
  sourceId: string
  lessonId: string
  cardId: string
  type: QuestionType
  data: LessonCard
  due: number
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  reps: number
  lapses: number
  state: number
  lastReview?: number
}

export interface ReviewRow {
  sourceId: string
  lessonId: string
  cardId: string
  timestamp: number
  rating: 1 | 2 | 3 | 4
  scheduledDays: number
  elapsedDays: number
  reviewDuration?: number
}

export interface SourceRow {
  sourceId: string
  label: string
  url?: string
  lastSynced?: number
}

export interface SettingsRow {
  key: SettingsKey
  value: unknown
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'done'

// ─── Settings ─────────────────────────────────────────────────────────────────

export type SettingsKey = 'scope' | 'sessionCap' | 'queuePriority' | 'sourceCategories' | 'tutorialDismissed'

/** Per-source category filter. 'all' means sync all categories; a string[] lists the selected ones. */
export type SourceCategoryFilter = Record<string, string[] | 'all'>

export type QueuePriority = 'reviews-first' | 'balanced' | 'new-first'

// Cache name for component bundles — used by Source Manager (write) and Lesson Engine (read).
// Convention defined in D1; must match in both places.
export const BUNDLE_CACHE_NAME = 'reprise-bundles'

export const DEFAULT_SESSION_CAP = 20
export const DEFAULT_QUEUE_PRIORITY: QueuePriority = 'reviews-first'

// ─── Scope ────────────────────────────────────────────────────────────────────

export interface Scope {
  sourceIds: string[] | 'all'
  // Optional for backward compatibility with scopes stored before categories were introduced.
  // Treat undefined as 'all' everywhere — see getLessonsInScope in sessionService.ts.
  categories?: string[] | 'all'
  tags: string[] | 'all'
}

export const DEFAULT_SCOPE: Scope = { sourceIds: 'all', categories: 'all', tags: 'all' }

// ─── Session ──────────────────────────────────────────────────────────────────

export interface LessonContext {
  lessonId: string
  title: string
  tags: string[]
  sources: LessonSource[]
}

export interface QueueItem {
  sourceId: string
  lessonId: string
  cardId: string
  isNew: boolean
}

export interface SessionSummary {
  total: number
  ratings: Record<1 | 2 | 3 | 4, number>
}
