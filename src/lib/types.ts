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
  componentBundleRef?: string
}

// ─── DB row types ─────────────────────────────────────────────────────────────

export interface LessonRow {
  sourceId: string
  lessonId: string
  version: number
  title: string
  overview?: string
  tags: string[]
  creator?: string
  sources: LessonSource[]
  componentBundleRef?: string
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

export type SettingsKey = 'scope' | 'sessionCap' | 'queuePriority'

export type QueuePriority = 'reviews-first' | 'balanced' | 'new-first'

export const DEFAULT_SESSION_CAP = 20
export const DEFAULT_QUEUE_PRIORITY: QueuePriority = 'reviews-first'

// ─── Scope ────────────────────────────────────────────────────────────────────

export interface Scope {
  sourceIds: string[] | 'all'
  tags: string[] | 'all'
}

export const DEFAULT_SCOPE: Scope = { sourceIds: 'all', tags: 'all' }

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
