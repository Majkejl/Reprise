// fsrsService.ts — pure, stateless wrapper around ts-fsrs. No DB access, no side effects.

import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs'
import type { Card } from 'ts-fsrs'
import type { CardRow } from '@/lib/types'

// ts-fsrs requires a pre-built scheduler instance; generatorParameters() uses library defaults.
const fsrsScheduler = fsrs(generatorParameters())

/**
 * Creates a blank ts-fsrs Card for a card that has never been reviewed.
 */
export function createInitialCardState(): Card {
  return createEmptyCard()
}

/**
 * Filters a list of card rows to those whose due date is at or before now.
 */
export function getDueCards(cards: CardRow[]): CardRow[] {
  const now = Date.now()
  return cards.filter(card => card.due <= now)
}

/**
 * Applies a rating to a card and returns the updated ts-fsrs Card state.
 * Does not persist — the caller owns persistence.
 */
export function applyRating(card: Card, rating: 1 | 2 | 3 | 4): Card {
  const result = fsrsScheduler.repeat(card, new Date())
  // Rating.Manual (0) is excluded from the IPreview result type — only 1–4 are valid schedule targets
  return result[rating as Exclude<Rating, Rating.Manual>].card
}
