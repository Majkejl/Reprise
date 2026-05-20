import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs'
import type { Card } from 'ts-fsrs'
import type { CardRow } from '@/lib/types'

const f = fsrs(generatorParameters())

export function createInitialCardState(): Card {
  return createEmptyCard()
}

export function getDueCards(cards: CardRow[]): CardRow[] {
  const now = Date.now()
  return cards.filter(c => c.due <= now)
}

export function applyRating(card: Card, rating: 1 | 2 | 3 | 4): Card {
  const result = f.repeat(card, new Date())
  // Rating.Manual (0) is excluded from IPreview — only 1–4 are valid schedule targets
  return result[rating as Exclude<Rating, Rating.Manual>].card
}
